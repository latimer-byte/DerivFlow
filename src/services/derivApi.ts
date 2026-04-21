/**
 * Deriv API Service
 * Handles WebSocket connection to Deriv API
 */

const DEFAULT_APP_ID = '1089';
const getAppId = () => localStorage.getItem('deriv_app_id') || import.meta.env.VITE_DERIV_APP_ID || DEFAULT_APP_ID;
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

class DerivService {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private isConnected = false;
  private isConnecting = false;
  private messageQueue: any[] = [];
  private pingInterval: any = null;
  private activeSubscriptions: Map<string, string> = new Map(); // symbol -> subscriptionId
  private subscriptionCounts: Map<string, number> = new Map(); // symbol -> count
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
      this.socket.close();
    }

    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      this.isConnected = true;
      this.isConnecting = false;
      console.log('Deriv WebSocket Connected');
      
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
            console.warn(`Deriv API: Already subscribed to ${data.error.details?.symbol || 'symbol'}`);
          } else {
            console.error(`Deriv API Error (${msgType}):`, data.error.message);
            // If authorization failed, we must unblock anyone waiting
            if (msgType === 'authorize') {
              console.warn('Deriv API: Authorization failed. Processing queue anyway...');
              this.isAuthorized = false;
              this.processQueue();
              this.trigger('authorize', data);
            }
          }
          
          if (reqId !== undefined) {
            this.trigger(`req_${reqId}`, data);
            this.trigger(`${msgType}_${reqId}`, data);
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
        
        this.trigger(msgType, data);
        
        if (reqId !== undefined) {
          this.trigger(`req_${reqId}`, data);
          this.trigger(`${msgType}_${reqId}`, data);
        }
        
        if (data.subscription) {
          this.trigger(`sub_${data.subscription.id}`, data);
        }
      } catch (e) {
        console.error('Failed to parse Deriv message:', e);
      }
    };

    this.socket.onclose = () => {
      this.isConnected = false;
      this.isConnecting = false;
      this.isAuthorized = false;
      if (this.pingInterval) clearInterval(this.pingInterval);
      
      // Fail pending requests on close so they don't wait for timeout
      console.log(`Connection lost. Failing ${this.pendingRequests.size} pending requests.`);
      this.pendingRequests.forEach((fail) => fail(new Error('Deriv API connection lost')));
      this.pendingRequests.clear();

      console.log('Deriv WebSocket Disconnected. Reconnecting in 5s...');
      setTimeout(() => this.connect(), 5000);
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
      // If it's not an authorize request and we have a token but aren't authorized yet, queue it
      if (data.authorize === undefined && this.token && !this.isAuthorized) {
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
    this.socket?.send(JSON.stringify({ authorize: token }));
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
    // If not connected, start a simulator as fallback
    let simulatorInterval: any = null;
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
    } else {
      console.log(`Adding additional listener for ${symbol} (existing subscription)`);
    }
    
    const listener = (data: any) => {
      if (data.msg_type === 'tick' && data.tick && data.tick.symbol === symbol) {
        callback({
          symbol: data.tick.symbol,
          quote: data.tick.quote,
          epoch: data.tick.epoch,
          id: data.tick.id,
        });
      }
    };
    
    this.on('tick', listener);

    return () => {
      if (simulatorInterval) {
        console.log(`Stopping simulator for ${symbol}`);
        clearInterval(simulatorInterval);
      }
      
      const count = this.subscriptionCounts.get(symbol) || 0;
      if (count <= 1) {
        this.subscriptionCounts.delete(symbol);
        console.log(`Unsubscribing from ticks for ${symbol} (last listener)`);
        const subId = this.activeSubscriptions.get(symbol);
        if (subId) {
          this.send({ forget: subId });
          this.activeSubscriptions.delete(symbol);
        } else {
          this.send({ forget_all: 'ticks' });
        }
      } else {
        this.subscriptionCounts.set(symbol, count - 1);
        console.log(`Removing one listener for ${symbol} (${count - 1} remaining)`);
      }
      this.off('tick', listener);
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
      };

      const onAuth = () => {
        cleanup();
        resolve();
      };

      const onConnect = () => {
        cleanup();
        resolve();
      };

      this.on('authorize', onAuth);

      if (!this.isConnected) {
        if (!this.token) {
          this.on('ping', onConnect);
          this.send({ ping: 1 });
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
