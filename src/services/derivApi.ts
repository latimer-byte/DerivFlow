/**
 * Deriv API Service
 * Aligned with https://developers.deriv.com/llms.txt
 */

const DEFAULT_APP_ID = '33433';
const PUBLIC_WS_URL = 'wss://api.derivws.com/trading/v1/options/ws/public';

const getAppId = () => {
  // Hub API REST endpoints (Deriv-App-ID header) usually expect the numeric app_id.
  // OAuth 2.0 uses the client_id (alphanumeric).
  // We prefer the environment variables.
  return (
    localStorage.getItem('deriv_app_id') || 
    import.meta.env.VITE_DERIV_APP_ID || 
    import.meta.env.VITE_DERIV_CLIENT_ID || 
    DEFAULT_APP_ID
  );
};

export type Tick = {
  symbol: string;
  quote: number;
  epoch: number;
  id: string;
  ask?: number;
  bid?: number;
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
  private otpUrl: string | null = null;
  private activeAccountId: string | null = localStorage.getItem('active_account_id');

  constructor() {
    this.connect();
    
    // If we have a token, automatically try to initialize the authenticated flow
    if (this.token) {
      this.authorize(this.token).catch(err => {
        console.warn("Auto-initialization of modern auth flow failed:", err);
      });
    }
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

  private connect(url?: string) {
    const wsUrl = url || this.otpUrl || PUBLIC_WS_URL;
    console.log(`Connecting to Deriv API (${this.isAuthorized ? 'Authenticated' : 'Public'} via ${wsUrl})...`);
    this.setStatus('connecting');
    
    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        
        if (this.isAuthorized) {
          this.setStatus('authorized');
          console.log('Deriv WebSocket Authenticated via OTP');
        } else {
          this.setStatus('connected');
          console.log('Deriv WebSocket Connected (Public)');
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
          if (data.error.code === 'AlreadySubscribed') {
            console.warn(`Deriv API: Already subscribed to ${data.error.details?.symbol || 'symbol'}`);
          } else {
            console.error(`Deriv API Error (${msgType}):`, data.error.message);
          }
          
          if (reqId !== undefined) {
            this.trigger(`req_${reqId}`, data);
            this.trigger(`${msgType}_${reqId}`, data);
          }
          return;
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
      this.setStatus('disconnected');
      if (this.pingInterval) clearInterval(this.pingInterval);
      
      // If we were authorized and connection dropped, we might need new OTP or just retry
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
      try {
        this.socket.send(JSON.stringify(data));
      } catch (e) {
        console.error('Deriv: Failed to send message, queueing instead:', e);
        this.messageQueue.push(data);
      }
    } else {
      this.messageQueue.push(data);
    }
  }

  /**
   * Modern Authorization Workflow via REST + OTP with legacy API token fallback
   */
  public async authorize(token: string) {
    this.token = token;
    localStorage.setItem('deriv_token', token);
    
    // Smart Detection: Legacy API tokens are shorter than OAuth tokens
    const isLegacyToken = token.length < 50;

    try {
      if (isLegacyToken) {
        console.log("Deriv: Short token detected, skipping Hub REST and using WebSocket auth...");
        return await this.legacyAuthorize(token);
      }

      // 1. Fetch available accounts (Modern Hub API)
      const accountsRes = await fetch('/api/deriv/accounts', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'x-deriv-app-id': getAppId()
        }
      });
      
      if (!accountsRes.ok) {
        throw new Error("REST Hub API rejected token. Checking fallback...");
      }
      
      const accountsData = await accountsRes.json();
      
      // If Deriv returned an error even with 200 OK (proxy logic)
      if (accountsData.error) {
        throw new Error(`REST Hub Error: ${accountsData.error.message || "Unknown"}`);
      }

      const accounts = accountsData.data || [];
      if (accounts.length === 0) throw new Error("No trading accounts found for this user");

      // 2. Select account (demo preferred for this environment)
      const demoAccount = accounts.find((a: any) => a.account_type === 'demo') || accounts[0];
      this.activeAccountId = demoAccount.account_id;
      localStorage.setItem('active_account_id', this.activeAccountId!);
      
      // 3. Get OTP for this account
      const otpRes = await fetch(`/api/deriv/otp/${this.activeAccountId}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'x-deriv-app-id': getAppId()
        }
      });
      
      if (!otpRes.ok) throw new Error("Failed to obtain OTP for authenticated flow");
      
      const otpData = await otpRes.json();
      if (otpData.data?.url) {
        this.otpUrl = otpData.data.url;
        this.isAuthorized = true;
        
        // 4. Force reconnection with the authenticated URL
        if (this.socket) {
          this.socket.close();
        } else {
          this.connect();
        }
        return accountsData;
      } else {
        throw new Error("OTP response missing WebSocket URL");
      }
    } catch (error: any) {
      console.warn("Modern Hub Auth failed, falling back to WebSocket authorize:", error.message);
      
      // FALLBACK: Traditional WebSocket authorize
      try {
        const authData = await this.legacyAuthorize(token);
        console.log("Deriv: WebSocket Auth Fallback Successful:", authData);
        return authData;
      } catch (fallbackError: any) {
        console.error("Deriv Authentication Total Failure:", fallbackError);
        this.isAuthorized = false;
        this.otpUrl = null;
        throw fallbackError;
      }
    }
  }

  /**
   * Traditional WebSocket Authorize
   */
  private async legacyAuthorize(token: string): Promise<any> {
    return new Promise((resolve, reject) => {
      // Ensure we are connected first
      if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
        this.connect();
        // Wait for connection
        const checkConn = setInterval(() => {
          if (this.isConnected && this.socket?.readyState === WebSocket.OPEN) {
            clearInterval(checkConn);
            this.executeLegacyAuth(token, resolve, reject);
          }
        }, 500);
        
        // Timeout after 10s
        setTimeout(() => {
          clearInterval(checkConn);
          reject(new Error("Connection timeout during WebSocket auth fallback"));
        }, 10000);
      } else {
        this.executeLegacyAuth(token, resolve, reject);
      }
    });
  }

  private executeLegacyAuth(token: string, resolve: Function, reject: Function) {
    const reqId = ++this.reqIdCounter;
    const listener = (data: any) => {
      if (data.req_id === reqId) {
        this.off(`req_${reqId}`, listener);
        if (data.error) {
          reject(new Error(data.error.message));
        } else {
          this.isAuthorized = true;
          this.setStatus('authorized');
          // For legacy, we use the existing socket
          console.log("Deriv: WebSocket Authorized successfully");
          resolve(data.authorize);
        }
      }
    };
    this.on(`req_${reqId}`, listener);
    this.send({ authorize: token, req_id: reqId });
  }

  public setAppId(appId: string) {
    localStorage.setItem('deriv_app_id', appId);
    if (this.socket) this.socket.close();
  }

  public getAccountId() {
    return this.activeAccountId;
  }

  public logout() {
    this.token = null;
    this.isAuthorized = false;
    this.otpUrl = null;
    localStorage.removeItem('deriv_token');
    localStorage.removeItem('deriv_user_data');
    localStorage.removeItem('active_account_id');
    if (this.socket) this.socket.close();
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
          ask: data.tick.ask,
          bid: data.tick.bid,
        });
      }
    };

    if (!this.isConnected) {
      simulatorInterval = this.simulateTicks(symbol, callback);
    }

    const currentCount = this.subscriptionCounts.get(symbol) || 0;
    this.subscriptionCounts.set(symbol, currentCount + 1);

    const reqId = ++this.reqIdCounter;
    
    if (currentCount === 0) {
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
    if (this.isConnected && (this.isAuthorized || !this.token)) {
      return;
    }

    if (!navigator.onLine) {
      throw new Error('Device is offline.');
    }

    return new Promise((resolve, reject) => {
      const checkTimeout = setTimeout(() => {
        this.off('ping', onConnect);
        reject(new Error(`Deriv API connection timed out`));
      }, 15000);

      const onConnect = () => {
        if (this.isAuthorized || !this.token) {
          clearTimeout(checkTimeout);
          this.off('ping', onConnect);
          resolve();
        }
      };

      this.on('ping', onConnect);
      this.send({ ping: 1 });
    });
  }

  public async getHistory(symbol: string, count: number = 100) {
    try {
      if (this.token && !this.isAuthorized) {
        await this.waitForReady();
      }
    } catch (e) {
      if (!this.isConnected) {
        return this.getSimulatedHistory(symbol, count);
      }
    }

    return new Promise<HistoryPoint[]>((resolve, reject) => {
      const reqId = ++this.reqIdCounter;
      
      const timeout = setTimeout(() => {
        this.off(`req_${reqId}`, listener);
        resolve(this.getSimulatedHistory(symbol, count));
      }, 10000);

      const listener = (data: any) => {
        if (data.req_id === reqId) {
          clearTimeout(timeout);
          this.off(`req_${reqId}`, listener);
          
          if (data.error || !data.history) {
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

  public async buyContract(symbol: string, amount: number, type: 'CALL' | 'PUT', duration: number = 60, basis: 'stake' | 'payout' = 'stake') {
    if (!this.token || !this.isAuthorized) {
      throw new Error('Not authorized for trading');
    }

    return new Promise((resolve, reject) => {
      const reqId = ++this.reqIdCounter;
      
      const timeout = setTimeout(() => {
        this.off(`req_${reqId}`, listener);
        reject(new Error('Trade request timed out'));
      }, 10000);

      const listener = (data: any) => {
        if (data.req_id === reqId) {
          clearTimeout(timeout);
          this.off(`req_${reqId}`, listener);
          
          if (data.error) {
            reject(new Error(data.error.message || 'Failed to place trade'));
            return;
          }

          resolve(data.buy);
        }
      };

      this.on(`req_${reqId}`, listener);

      // In modern API, we buy using parameters directly
      this.send({
        buy: 1,
        subscribe: 1,
        price: amount,
        parameters: {
          amount: amount,
          basis: basis,
          contract_type: type,
          currency: 'USD',
          duration: duration,
          duration_unit: 's',
          symbol: symbol
        },
        req_id: reqId
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
      if (!this.isConnected) {
        return this.getSimulatedCandles(symbol, granularity, count);
      }
    }

    return new Promise<Candle[]>((resolve, reject) => {
      const reqId = ++this.reqIdCounter;
      
      const timeout = setTimeout(() => {
        this.off(`req_${reqId}`, listener);
        resolve(this.getSimulatedCandles(symbol, granularity, count));
      }, 10000);

      const listener = (data: any) => {
        if (data.req_id === reqId) {
          clearTimeout(timeout);
          this.off(`req_${reqId}`, listener);
          
          if (data.error || !data.candles) {
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
