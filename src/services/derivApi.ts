/**
 * Deriv API Service
 * Handles WebSocket connection to Deriv API
 */

const APP_ID = '31063'; // Deriv.com official public app_id
const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${APP_ID}`;

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

class DerivService {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private isConnected = false;
  private messageQueue: any[] = [];
  private pingInterval: any = null;
  private activeSubscriptions: Map<string, string> = new Map(); // symbol -> subscriptionId

  constructor() {
    this.connect();
  }

  private connect() {
    console.log(`Connecting to Deriv API (App ID: ${APP_ID})...`);
    this.socket = new WebSocket(WS_URL);

    this.socket.onopen = () => {
      this.isConnected = true;
      console.log('Deriv WebSocket Connected');
      
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
          console.error('Deriv API Error:', data.error.message);
        }

        // Store subscription ID if present
        if (data.subscription && data.tick) {
          this.activeSubscriptions.set(data.tick.symbol, data.subscription.id);
        }
        
        // Handle generic message type listeners
        this.trigger(msgType, data);
        
        // Handle specific request ID listeners
        if (reqId) {
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
      this.socket.send(JSON.stringify(data));
    } else {
      this.messageQueue.push(data);
    }
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
    console.log(`Subscribing to ticks for ${symbol}`);
    this.send({
      ticks: symbol,
      subscribe: 1,
    });
    
    const listener = (data: any) => {
      if (data.msg_type === 'tick' && data.tick.symbol === symbol) {
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
      console.log(`Unsubscribing from ticks for ${symbol}`);
      const subId = this.activeSubscriptions.get(symbol);
      if (subId) {
        this.send({ forget: subId });
        this.activeSubscriptions.delete(symbol);
      } else {
        this.send({ forget_all: 'ticks' });
      }
      this.off('tick', listener);
    };
  }

  public getHistory(symbol: string, count: number = 100) {
    return new Promise<HistoryPoint[]>((resolve, reject) => {
      const requestId = `history_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      console.log(`Requesting history for ${symbol} (req_id: ${requestId})`);
      
      const timeout = setTimeout(() => {
        this.off(`history_${requestId}`, listener);
        reject(new Error(`History request for ${symbol} timed out`));
      }, 15000);

      const listener = (data: any) => {
        if (data.msg_type === 'history' && data.req_id === requestId) {
          clearTimeout(timeout);
          this.off(`history_${requestId}`, listener);
          
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

      this.on(`history_${requestId}`, listener);

      this.send({
        ticks_history: symbol,
        adjust_start_time: 1,
        count: count,
        end: 'latest',
        start: 1,
        style: 'ticks',
        req_id: requestId,
      });
    });
  }
}

export const derivApi = new DerivService();
