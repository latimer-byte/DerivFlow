/**
 * Deriv API Service
 * Handles WebSocket connection to Deriv API
 */

const DEFAULT_APP_ID = '33433';
const getAppId = () => {
  const id = localStorage.getItem('deriv_app_id') || import.meta.env.VITE_DERIV_APP_ID || DEFAULT_APP_ID;
  return id;
};
const getWsUrl = () => `wss://ws.binaryws.com/websockets/v3?app_id=${getAppId()}`;

export type Tick = {
  symbol: string;
  quote: number;
  epoch: number;
  id: string;
};

export type HistoryPoint = {
  epoch: number;
  quote: number;
};

export type Candle = {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type ConnectionStatus = 'connecting' | 'connected' | 'error' | 'disconnected' | 'authorized';

class DerivService {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private isConnected = false;
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private messageQueue: any[] = [];
  private pingInterval: any = null;
  private activeSubscriptions: Map<string, string> = new Map(); // symbol -> subscriptionId
  private subscriptionCounts: Map<string, number> = new Map(); // symbol -> count
  private reqIdCounter = 0;
  private token: string | null = localStorage.getItem('deriv_token') || import.meta.env.VITE_DERIV_TOKEN || null;
  private isAuthorized = false;

  constructor() {
    this.connect();
  }

  public onStatusChange(callback: (status: ConnectionStatus) => void) {
    this.statusListeners.add(callback);
    // Immediately trigger with current status
    if (this.isAuthorized) callback('authorized');
    else if (this.isConnected) callback('connected');
    else callback('connecting');
    return () => this.statusListeners.delete(callback);
  }

  private setStatus(status: ConnectionStatus) {
    this.statusListeners.forEach(cb => cb(status));
  }

  private connect() {
    const appId = getAppId();
    const wsUrl = getWsUrl();
    console.log(`Connecting to Deriv API (App ID: ${appId})...`);
    this.setStatus('connecting');
    
    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.setStatus('connected');
        console.log('Deriv WebSocket Connected');
        
        // Authorize if token is available
        if (this.token) {
          this.authorize(this.token);
        }

        // Start ping to keep connection alive
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          this.send({ ping: 1 });
        }, 30000);

        // Flush queue
        this.flushQueue();
      };
    } catch (error) {
      console.error('Failed to establish Deriv WebSocket:', error);
      this.setStatus('error');
    }

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const msgType = data.msg_type;
        const reqId = data.req_id;

        if (data.error) {
          // Special handling for "already subscribed"
          if (data.error.code === 'AlreadySubscribed') {
            console.warn(`Deriv API: Already subscribed to ${data.error.details?.symbol || 'symbol'}`);
          } else {
            console.error(`Deriv API Error (${msgType}):`, data.error.message);
          }
          
          // If authorization fails, clear token and flush queue with errors
          if (msgType === 'authorize') {
            console.error('Authorization failed. Clearing token.');
            this.logout();
            this.isAuthorized = false;
            
            // Reject all pending messages in queue if they required auth
            const tempQueue = [...this.messageQueue];
            this.messageQueue = [];
            tempQueue.forEach(msg => {
              if (msg.req_id) {
                this.trigger(`req_${msg.req_id}`, { error: { message: 'Authorization failed' }, req_id: msg.req_id });
              }
            });
          }

          if (reqId !== undefined) {
            this.trigger(`req_${reqId}`, data);
            this.trigger(`${msgType}_${reqId}`, data);
          }
          return;
        }

        // Handle authorization response
        if (msgType === 'authorize') {
          this.isAuthorized = true;
          this.setStatus('authorized');
          console.log('Deriv API: Authorized successfully');
          
          this.flushQueue();
        }

        // Store subscription ID if present
        if (data.subscription && data.tick && data.tick.symbol) {
          this.activeSubscriptions.set(data.tick.symbol, data.subscription.id);
        }
        
        // Handle generic message type listeners
        this.trigger(msgType, data);
        
        // Handle specific request ID listeners
        if (reqId !== undefined) {
          this.trigger(`req_${reqId}`, data);
          this.trigger(`${msgType}_${reqId}`, data);
        }
        
        // Handle specific subscription IDs
        if (data.subscription) {
          this.trigger(`sub_${data.subscription.id}`, data);
        }
      } catch (e) {
        console.error('Failed to parse Deriv message:', e);
      }
    };

    this.socket.onclose = () => {
      this.isConnected = false;
      this.isAuthorized = false;
      this.setStatus('disconnected');
      if (this.pingInterval) clearInterval(this.pingInterval);
      console.log('Deriv WebSocket Disconnected. Reconnecting in 5s...');
      setTimeout(() => this.connect(), 5000);
    };

    this.socket.onerror = (error) => {
      console.error('Deriv WebSocket Error:', error);
      this.setStatus('error');
    };
  }

  private flushQueue() {
    const itemsToProcess = [...this.messageQueue];
    this.messageQueue = [];
    itemsToProcess.forEach(msg => this.send(msg));
  }

  private trigger(type: string, data: any) {
    const callbacks = this.listeners.get(type);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }

  public send(data: any) {
    if (this.isConnected && this.socket?.readyState === WebSocket.OPEN) {
      // If it's not an authorize request and we have a token but aren't authorized yet, queue it
      if (data.authorize === undefined && this.token && !this.isAuthorized) {
        this.messageQueue.push(data);
      } else {
        try {
          if (data.authorize) {
            console.log('Deriv: Sending authorization request...');
          }
          this.socket.send(JSON.stringify(data));
        } catch (e) {
          console.error('Deriv: Failed to send message, queueing instead:', e);
          this.messageQueue.push(data);
        }
      }
    } else {
      if (data.authorize) {
        console.log(`Deriv: WebSocket not ready (Connected: ${this.isConnected}, State: ${this.socket?.readyState}). Queueing authorize request.`);
      }
      // Prevent multiple authorize requests in queue to avoid redundancy
      if (data.authorize !== undefined) {
        this.messageQueue = this.messageQueue.filter(m => m.authorize === undefined);
      }
      this.messageQueue.push(data);
    }
  }

  public authorize(token: string) {
    this.token = token;
    localStorage.setItem('deriv_token', token);
    this.isAuthorized = false;
    this.send({ authorize: token });
  }

  public setAppId(appId: string) {
    localStorage.setItem('deriv_app_id', appId);
    this.socket?.close(); // This will trigger reconnection with new App ID
  }

  public logout() {
    this.token = null;
    this.isAuthorized = false;
    localStorage.removeItem('deriv_token');
    localStorage.removeItem('deriv_user_data');
    this.socket?.close();
  }

  public on(type: string, callback: (data: any) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);
  }

  public off(type: string, callback: (data: any) => void) {
    const callbacks = this.listeners.get(type);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(type);
      }
    }
  }

  private simulateTicks(symbol: string, callback: (tick: Tick) => void) {
    console.log(`Starting simulator for ${symbol}`);
    let lastPrice = symbol.startsWith('R_') ? 1000 + Math.random() * 500 : 1.1234 + Math.random() * 0.1;
    
    return setInterval(() => {
      const change = (Math.random() - 0.5) * (lastPrice * 0.0002);
      lastPrice += change;
      
      callback({
        symbol,
        quote: lastPrice,
        epoch: Math.floor(Date.now() / 1000),
        id: `sim_${Date.now()}`
      });
    }, 1000);
  }

  public subscribeTicks(symbol: string, callback: (tick: Tick) => void) {
    let simulatorInterval: any = null;
    
    const tickHandler = (data: any) => {
      if (data.msg_type === 'tick' && data.tick && data.tick.symbol === symbol) {
        // If we get a real tick, stop any simulator for this symbol
        if (simulatorInterval) {
          console.log(`Real data received for ${symbol}, stopping simulator`);
          clearInterval(simulatorInterval);
          simulatorInterval = null;
        }
        callback({
          symbol: data.tick.symbol,
          quote: data.tick.quote,
          epoch: data.tick.epoch,
          id: data.tick.id,
        });
      }
    };

    if (!this.isConnected) {
      simulatorInterval = this.simulateTicks(symbol, callback);
    }

    const currentCount = this.subscriptionCounts.get(symbol) || 0;
    this.subscriptionCounts.set(symbol, currentCount + 1);

    const reqId = ++this.reqIdCounter;
    
    // Only send subscribe request if this is the first listener for this symbol
    if (currentCount === 0) {
      console.log(`Subscribing to ticks for ${symbol} (req_id: ${reqId})`);
      this.send({
        ticks: symbol,
        subscribe: 1,
        req_id: reqId
      });
    }

    this.on('tick', tickHandler);

    return () => {
      if (simulatorInterval) {
        clearInterval(simulatorInterval);
        simulatorInterval = null;
      }
      
      const count = this.subscriptionCounts.get(symbol) || 0;
      if (count <= 1) {
        this.subscriptionCounts.delete(symbol);
        const subId = this.activeSubscriptions.get(symbol);
        if (subId) {
          this.send({ forget: subId });
          this.activeSubscriptions.delete(symbol);
        } else {
          this.send({ forget_all: 'ticks' });
        }
      } else {
        this.subscriptionCounts.set(symbol, count - 1);
      }
      this.off('tick', tickHandler);
    };
  }

  private async waitForReady(): Promise<void> {
    if (this.isConnected && (!this.token || this.isAuthorized)) {
      return;
    }

    // Check for offline mode
    if (!navigator.onLine) {
      throw new Error('Device is offline. Please check your internet connection.');
    }

    return new Promise((resolve, reject) => {
      const checkTimeout = setTimeout(() => {
        this.off('authorize', onAuth);
        this.off('ping', onConnect);
        reject(new Error(`Deriv API connection/auth timed out (Status: ${this.isConnected ? 'Connected, waiting auth' : 'Disconnected'})`));
      }, 15000); // Shorter timeout for faster feedback

      const onAuth = (data: any) => {
        if (data.error) {
          clearTimeout(checkTimeout);
          this.off('authorize', onAuth);
          reject(new Error(`Authorization failed: ${data.error.message}`));
          return;
        }
        clearTimeout(checkTimeout);
        this.off('authorize', onAuth);
        resolve();
      };

      const onConnect = () => {
        if (!this.token || this.isAuthorized) {
          clearTimeout(checkTimeout);
          this.off('ping', onConnect);
          this.off('authorize', onAuth);
          resolve();
        }
      };

      this.on('authorize', onAuth);
      this.on('ping', onConnect);
      
      if (this.isConnected && !this.isAuthorized && this.token) {
        // Already connected but waiting for auth
      } else if (!this.isConnected) {
        // Not connected yet
        this.send({ ping: 1 });
      }
    });
  }

  public async getHistory(symbol: string, count: number = 100) {
    try {
      if (this.token && !this.isAuthorized) {
        await this.waitForReady();
      }
    } catch (e) {
      console.warn("History request proceeding without full auth wait or failed auth", e);
      // If we're not connected, return simulated history as fallback
      if (!this.isConnected) {
        return this.getSimulatedHistory(symbol, count);
      }
    }

    return new Promise<HistoryPoint[]>((resolve, reject) => {
      const reqId = ++this.reqIdCounter;
      console.log(`Requesting history for ${symbol} (req_id: ${reqId})`);
      
      const timeout = setTimeout(() => {
        this.off(`req_${reqId}`, listener);
        // Fallback to simulation on timeout
        console.warn(`History request for ${symbol} timed out, using simulation`);
        resolve(this.getSimulatedHistory(symbol, count));
      }, 10000); // Faster timeout for UI responsiveness

      const listener = (data: any) => {
        if (data.req_id === reqId) {
          clearTimeout(timeout);
          this.off(`req_${reqId}`, listener);
          
          if (data.error) {
            console.error(`Deriv History Error: ${data.error.message}`);
            resolve(this.getSimulatedHistory(symbol, count));
            return;
          }

          if (data.msg_type !== 'history' || !data.history || !data.history.times) {
            resolve(this.getSimulatedHistory(symbol, count));
            return;
          }

          const history = data.history.times.map((time: number, index: number) => ({
            epoch: time,
            quote: data.history.prices[index],
          }));
          resolve(history);
        }
      };

      this.on(`req_${reqId}`, listener);

      this.send({
        ticks_history: symbol,
        adjust_start_time: 1,
        count: count,
        end: 'latest',
        style: 'ticks',
        req_id: reqId,
      });
    });
  }

  private getSimulatedHistory(symbol: string, count: number): HistoryPoint[] {
    const basePrice = symbol.startsWith('R_') ? 1000 + Math.random() * 500 : 1.1234 + Math.random() * 0.1;
    const now = Math.floor(Date.now() / 1000);
    return Array.from({ length: count }, (_, i) => ({
      epoch: now - (count - i),
      quote: basePrice + (Math.random() - 0.5) * (basePrice * 0.01)
    }));
  }

  public async getCandles(symbol: string, granularity: number = 60, count: number = 100) {
    try {
      if (this.token && !this.isAuthorized) {
        await this.waitForReady();
      }
    } catch (e) {
      console.warn("Candle request proceeding without full auth wait or failed auth", e);
      if (!this.isConnected) {
        return this.getSimulatedCandles(symbol, granularity, count);
      }
    }

    return new Promise<Candle[]>((resolve, reject) => {
      const reqId = ++this.reqIdCounter;
      console.log(`Requesting candles for ${symbol} (req_id: ${reqId})`);
      
      const timeout = setTimeout(() => {
        this.off(`req_${reqId}`, listener);
        console.warn(`Candles request for ${symbol} timed out, using simulation`);
        resolve(this.getSimulatedCandles(symbol, granularity, count));
      }, 10000);

      const listener = (data: any) => {
        if (data.req_id === reqId) {
          clearTimeout(timeout);
          this.off(`req_${reqId}`, listener);
          
          if (data.error) {
            console.error(`Deriv Candles Error: ${data.error.message}`);
            resolve(this.getSimulatedCandles(symbol, granularity, count));
            return;
          }

          if (data.msg_type !== 'candles' || !data.candles) {
            resolve(this.getSimulatedCandles(symbol, granularity, count));
            return;
          }

          const candles = data.candles.map((c: any) => ({
            epoch: c.epoch,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }));
          resolve(candles);
        }
      };

      this.on(`req_${reqId}`, listener);

      this.send({
        ticks_history: symbol,
        adjust_start_time: 1,
        count: count,
        end: 'latest',
        style: 'candles',
        granularity: granularity,
        req_id: reqId,
      });
    });
  }

  private getSimulatedCandles(symbol: string, granularity: number, count: number): Candle[] {
    const basePrice = symbol.startsWith('R_') ? 1000 + Math.random() * 500 : 1.1234 + Math.random() * 0.1;
    const now = Math.floor(Date.now() / 1000);
    return Array.from({ length: count }, (_, i) => {
      const open = basePrice + (Math.random() - 0.5) * (basePrice * 0.01);
      const close = open + (Math.random() - 0.5) * (basePrice * 0.005);
      return {
        epoch: (Math.floor(now / granularity) * granularity) - ((count - i) * granularity),
        open,
        high: Math.max(open, close) + Math.random() * (basePrice * 0.002),
        low: Math.min(open, close) - Math.random() * (basePrice * 0.002),
        close
      };
    });
  }
}

export const derivApi = new DerivService();
