/**
 * Deriv API Service
 * Handles WebSocket connection to Deriv API
 */

const DEFAULT_APP_ID = '333ttXJvMqziMT0ErTbKd';
const getAppId = () => localStorage.getItem('deriv_app_id') || import.meta.env.VITE_DERIV_APP_ID || DEFAULT_APP_ID;
const getWsUrl = () => {
  const appId = getAppId();
  // Using ws.derivws.com which is the modern endpoint, adding branch and language params
  return `wss://ws.derivws.com/websockets/v3?app_id=${appId}&l=en&brand=deriv`;
};

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

class DerivService {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private isConnected = false;
  private isConnecting = false;
  private messageQueue: any[] = [];
  private pingInterval: any = null;
  private activeSubscriptions: Map<string, string> = new Map(); // symbol -> subscriptionId
  private subscriptionCallbacks: Map<string, Set<(tick: Tick) => void>> = new Map(); // symbol -> callbacks
  private reqIdCounter = 0;
  private token: string | null = localStorage.getItem('deriv_token');
  private isAuthorized = false;
  private pendingRequests: Map<number, (error?: Error) => void> = new Map();

  constructor() {
    this.connect();
  }

  private connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    const appId = getAppId();
    const wsUrl = getWsUrl();
    console.log(`Connecting to Deriv API (App ID: ${appId})...`);
    
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      try { this.socket.close(); } catch (e) {}
    }

    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      this.isConnected = true;
      this.isConnecting = false;
      console.log('Deriv WebSocket Connected');
      
      // Resubscribe to active symbols on reconnection
      this.activeSubscriptions.clear(); // Clear old IDs, they are invalid now
      this.subscriptionCallbacks.forEach((callbacks, symbol) => {
        if (callbacks.size > 0) {
          console.log(`Re-subscribing to ${symbol} after reconnection`);
          this.send({ ticks: symbol, subscribe: 1, req_id: ++this.reqIdCounter });
        }
      });

      // Authorize if token is available
      if (this.token) {
        this.authorize(this.token);
      } else {
        this.processQueue();
      }

      if (this.pingInterval) clearInterval(this.pingInterval);
      this.pingInterval = setInterval(() => {
        this.send({ ping: 1 });
      }, 30000);
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const msgType = data.msg_type;
        const reqId = data.req_id;

        if (data.error) {
          if (data.error.code === 'AlreadySubscribed') {
            // Already subscribed is fine, we just want the ticks
            console.warn(`Deriv API: Already subscribed to ${data.error.details?.symbol || 'symbol'}`);
          } else {
            console.error(`Deriv API Error (${msgType}):`, data.error.message);
            // If authorization failed, we must unblock anyone waiting
            if (msgType === 'authorize') {
              this.isAuthorized = false;
              this.processQueue();
              this.trigger('authorize', data);
            }
          }
          
          if (reqId !== undefined) {
            this.trigger(`req_${reqId}`, data);
          }
          return;
        }

        if (msgType === 'authorize') {
          this.isAuthorized = true;
          console.log('Deriv API: Authorized successfully');
          this.processQueue();
        }

        if (data.subscription && data.tick && data.tick.symbol) {
          this.activeSubscriptions.set(data.tick.symbol, data.subscription.id);
        }
        
        // Handle tick data
        if (msgType === 'tick' && data.tick) {
          const callbacks = this.subscriptionCallbacks.get(data.tick.symbol);
          if (callbacks) {
            const tick: Tick = {
              symbol: data.tick.symbol,
              quote: data.tick.quote,
              epoch: data.tick.epoch,
              id: data.tick.id,
            };
            callbacks.forEach(cb => cb(tick));
          }
        }

        this.trigger(msgType, data);
        
        if (reqId !== undefined) {
          this.trigger(`req_${reqId}`, data);
        }
      } catch (e) {
        console.error('Failed to parse Deriv message:', e);
      }
    };

    this.socket.onclose = (event) => {
      this.isConnected = false;
      this.isConnecting = false;
      this.isAuthorized = false;
      if (this.pingInterval) clearInterval(this.pingInterval);
      
      console.warn(`Deriv WebSocket Closed. Code: ${event.code}, Reason: ${event.reason || 'None'}`);

      if (this.pendingRequests.size > 0) {
        this.pendingRequests.forEach((fail) => fail(new Error('Deriv API connection lost')));
        this.pendingRequests.clear();
      }

      this.trigger('connection_lost', event);

      console.log('Reconnecting in 3s...');
      setTimeout(() => this.connect(), 3000);
    };

    this.socket.onerror = (error) => {
      this.isConnecting = false;
      console.error('Deriv WebSocket Error:', error);
    };
  }

  private async request(data: any, timeoutMs: number = 35000): Promise<any> {
    // Proactively connect if disconnected
    if (!this.isConnected && !this.isConnecting && this.token) {
      console.log('Request initiated while disconnected. Connecting...');
      this.connect();
    }

    try {
      if (data.authorize === undefined && this.token && !this.isAuthorized) {
        await this.waitForReady();
      }
    } catch (e) {
      console.warn("Request proceeding without full auth wait", e);
    }

    const reqId = data.req_id || ++this.reqIdCounter;
    data.req_id = reqId;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Request ${reqId} timed out (${timeoutMs}ms)`));
      }, timeoutMs);

      const cleanup = () => {
        clearTimeout(timeout);
        this.off(`req_${reqId}`, listener);
        this.pendingRequests.delete(reqId);
      };

      const listener = (response: any) => {
        if (response.req_id === reqId) {
          cleanup();
          if (response.error) {
            reject(new Error(response.error.message || 'Deriv API Error'));
          } else {
            resolve(response);
          }
        }
      };

      this.pendingRequests.set(reqId, (err) => {
        cleanup();
        reject(err || new Error('Request cancelled'));
      });

      this.on(`req_${reqId}`, listener);
      this.send(data);
    });
  }

  private processQueue() {
    console.log(`Processing ${this.messageQueue.length} queued messages.`);
    const queue = [...this.messageQueue];
    this.messageQueue = [];
    queue.forEach(msg => this.send(msg));
  }

  private trigger(type: string, data: any) {
    const callbacks = this.listeners.get(type);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }

  public send(data: any) {
    if (this.isConnected && this.socket?.readyState === WebSocket.OPEN) {
      // If we have a token and aren't authorized yet, only allow certain messages
      const isAuthRequest = data.authorize !== undefined;
      const isPing = data.ping !== undefined;
      
      if (!isAuthRequest && !isPing && this.token && !this.isAuthorized) {
        this.messageQueue.push(data);
      } else {
        this.socket.send(JSON.stringify(data));
      }
    } else {
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
    const isMockMode = !this.isConnected && !this.isConnecting && !this.token;

    if (isMockMode) {
      simulatorInterval = this.simulateTicks(symbol, callback);
    }

    if (!this.subscriptionCallbacks.has(symbol)) {
      this.subscriptionCallbacks.set(symbol, new Set());
    }
    
    const callbacks = this.subscriptionCallbacks.get(symbol)!;
    callbacks.add(callback);

    // Only send subscribe request if this is the first listener for this symbol
    if (callbacks.size === 1) {
      console.log(`Subscribing to ticks for ${symbol}`);
      this.send({
        ticks: symbol,
        subscribe: 1,
        req_id: ++this.reqIdCounter
      });
    }

    return () => {
      if (simulatorInterval) {
        clearInterval(simulatorInterval);
      }
      
      const callbacks = this.subscriptionCallbacks.get(symbol);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          console.log(`Unsubscribing from ticks for ${symbol}`);
          const subId = this.activeSubscriptions.get(symbol);
          if (subId) {
            this.send({ forget: subId });
            this.activeSubscriptions.delete(symbol);
          } else {
            // If we don't have a subId yet but want to forget, we have a problem.
            // Sending forget_all is risky but sometimes necessary.
            // Better: just wait for it.
          }
          this.subscriptionCallbacks.delete(symbol);
        }
      }
    };
  }

  private async waitForReady(): Promise<void> {
    if (this.isConnected && (!this.token || this.isAuthorized)) {
      return;
    }

    return new Promise((resolve, reject) => {
      const checkTimeout = setTimeout(() => {
        cleanup();
        reject(new Error('Deriv API connection/auth timed out (30s)'));
      }, 30000);

      const cleanup = () => {
        clearTimeout(checkTimeout);
        this.off('authorize', onAuth);
        this.off('ping', onConnect);
        this.off('connection_lost', onError);
      };

      const onAuth = () => {
        cleanup();
        resolve();
      };

      const onConnect = () => {
        cleanup();
        resolve();
      };

      const onError = () => {
        cleanup();
        reject(new Error('Deriv API connection lost during ready wait'));
      };

      this.on('authorize', onAuth);
      this.on('connection_lost', onError);

      if (!this.isConnected) {
        if (!this.token) {
          this.on('ping', onConnect);
          this.send({ ping: 1 });
        } else if (!this.isConnecting) {
          this.connect();
        }
      }
    });
  }

  public async getHistory(symbol: string, count: number = 100, retryCount = 1): Promise<HistoryPoint[]> {
    try {
      const data = await this.request({
        ticks_history: symbol,
        adjust_start_time: 1,
        count: count,
        end: 'latest',
        style: 'ticks',
      });

      if (!data.history || !data.history.times) {
        throw new Error('Invalid history format from API');
      }

      return data.history.times.map((time: number, index: number) => ({
        epoch: time,
        quote: data.history.prices[index],
      }));
    } catch (error) {
      if (retryCount > 0) {
        console.warn(`History request for ${symbol} failed. Retrying...`, error);
        return this.getHistory(symbol, count, retryCount - 1);
      }
      throw error;
    }
  }

  public async getCandles(symbol: string, granularity: number = 60, count: number = 100, retryCount = 1): Promise<Candle[]> {
    try {
      const data = await this.request({
        ticks_history: symbol,
        adjust_start_time: 1,
        count: count,
        end: 'latest',
        style: 'candles',
        granularity: granularity,
      });

      if (!data.candles) {
        throw new Error('Invalid candles format from API');
      }

      return data.candles.map((c: any) => ({
        epoch: c.epoch,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
    } catch (error) {
      if (retryCount > 0) {
        console.warn(`Candles request for ${symbol} failed. Retrying...`, error);
        return this.getCandles(symbol, granularity, count, retryCount - 1);
      }
      throw error;
    }
  }
}

export const derivApi = new DerivService();
