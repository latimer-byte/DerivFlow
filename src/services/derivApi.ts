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
  private messageQueue: any[] = [];
  private pingInterval: any = null;
  private activeSubscriptions: Map<string, string> = new Map(); // symbol -> subscriptionId
  private subscriptionCounts: Map<string, number> = new Map(); // symbol -> count
  private reqIdCounter = 0;
  private token: string | null = localStorage.getItem('deriv_token');
  private isAuthorized = false;

  constructor() {
    this.connect();
  }

  private connect() {
    const appId = getAppId();
    const wsUrl = getWsUrl();
    console.log(`Connecting to Deriv API (App ID: ${appId})...`);
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      this.isConnected = true;
      console.log('Deriv WebSocket Connected');
      
      // Authorize if token is available
      if (this.token) {
        this.authorize(this.token);
      }

      // Start ping to keep connection alive
      this.pingInterval = setInterval(() => {
        this.send({ ping: 1 });
      }, 30000);

      while (this.messageQueue.length > 0) {
        const msg = this.messageQueue.shift();
        this.send(msg);
      }
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const msgType = data.msg_type;
        const reqId = data.req_id;

        if (data.error) {
          // Special handling for "already subscribed" - we can ignore it if we're tracking correctly
          if (data.error.code === 'AlreadySubscribed') {
            console.warn(`Deriv API: Already subscribed to ${data.error.details?.symbol || 'symbol'}`);
          } else {
            console.error(`Deriv API Error (${msgType}):`, data.error.message);
          }
          
          if (reqId !== undefined) {
            this.trigger(`${msgType}_${reqId}`, data);
          }
          return;
        }

        // Handle authorization response
        if (msgType === 'authorize') {
          this.isAuthorized = true;
          console.log('Deriv API: Authorized successfully');
          
          // Now that we are authorized, we can send queued messages
          while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            this.send(msg);
          }
        }

        // Store subscription ID if present
        if (data.subscription && data.tick && data.tick.symbol) {
          this.activeSubscriptions.set(data.tick.symbol, data.subscription.id);
        }
        
        // Handle generic message type listeners
        this.trigger(msgType, data);
        
        // Handle specific request ID listeners
        if (reqId !== undefined) {
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
      if (this.pingInterval) clearInterval(this.pingInterval);
      console.log('Deriv WebSocket Disconnected. Reconnecting in 5s...');
      setTimeout(() => this.connect(), 5000);
    };

    this.socket.onerror = (error) => {
      console.error('Deriv WebSocket Error:', error);
    };
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

  public subscribeTicks(symbol: string, callback: (tick: Tick) => void) {
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

  public getHistory(symbol: string, count: number = 100) {
    return new Promise<HistoryPoint[]>((resolve, reject) => {
      const reqId = ++this.reqIdCounter;
      console.log(`Requesting history for ${symbol} (req_id: ${reqId})`);
      
      const timeout = setTimeout(() => {
        this.off(`history_${reqId}`, listener);
        reject(new Error(`History request for ${symbol} timed out (req_id: ${reqId})`));
      }, 20000);

      const listener = (data: any) => {
        if (data.msg_type === 'history' && data.req_id === reqId) {
          clearTimeout(timeout);
          this.off(`history_${reqId}`, listener);
          
          if (data.error) {
            reject(new Error(data.error.message));
            return;
          }

          if (!data.history || !data.history.times) {
            reject(new Error('Invalid history data received'));
            return;
          }

          const history = data.history.times.map((time: number, index: number) => ({
            epoch: time,
            quote: data.history.prices[index],
          }));
          resolve(history);
        }
      };

      this.on(`history_${reqId}`, listener);

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

  public getCandles(symbol: string, granularity: number = 60, count: number = 100) {
    return new Promise<Candle[]>((resolve, reject) => {
      const reqId = ++this.reqIdCounter;
      console.log(`Requesting candles for ${symbol} (req_id: ${reqId})`);
      
      const timeout = setTimeout(() => {
        this.off(`candles_${reqId}`, listener);
        reject(new Error(`Candles request for ${symbol} timed out (req_id: ${reqId})`));
      }, 20000);

      const listener = (data: any) => {
        if (data.msg_type === 'candles' && data.req_id === reqId) {
          clearTimeout(timeout);
          this.off(`candles_${reqId}`, listener);
          
          if (data.error) {
            reject(new Error(data.error.message));
            return;
          }

          if (!data.candles) {
            reject(new Error('No candles data received'));
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

      this.on(`candles_${reqId}`, listener);

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
}

export const derivApi = new DerivService();
