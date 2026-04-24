/**
 * Deriv API Service
 * Aligned with https://developers.deriv.com/llms.txt
 */

const DEFAULT_APP_ID = '33433';
const DEFAULT_CLIENT_ID = '33433jm6aon9vgTQHB9vn';
const PUBLIC_WS_URL = 'wss://api.derivws.com/trading/v1/options/ws/public';

const getAppId = () => {
  // Hub API REST endpoints (Deriv-App-ID header) and WebSocket app_id MUST be numeric.
  // OAuth 2.0 uses the client_id (alphanumeric).
  const storedAppId = localStorage.getItem('deriv_app_id');
  if (storedAppId && /^\d+$/.test(storedAppId)) return storedAppId;

  const envAppId = import.meta.env.VITE_DERIV_APP_ID;
  if (envAppId && /^\d+$/.test(envAppId)) return envAppId;

  // Fallback: extract numeric part from client_id if possible
  const clientId = import.meta.env.VITE_DERIV_CLIENT_ID || DEFAULT_CLIENT_ID;
  const numericMatch = clientId.match(/^(\d+)/);
  if (numericMatch) return numericMatch[1];

  return DEFAULT_APP_ID;
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
  private token: string | null = localStorage.getItem('deriv_token') || import.meta.env.VITE_DERIV_TOKEN || 'p5nK796S38ivS68';
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
    else if (this.isConnected && this.socket?.readyState === WebSocket.OPEN) callback('connected');
    else if (this.socket && this.socket.readyState === WebSocket.CONNECTING) callback('connecting');
    else callback('disconnected');
    return () => this.statusListeners.delete(callback);
  }

  private setStatus(status: ConnectionStatus) {
    this.statusListeners.forEach(cb => cb(status));
    this.trigger(status, { status });
  }

  private connect(url?: string) {
    // If already connecting or connected to the correct URL, don't restart
    const wsUrl = url || this.otpUrl || `${PUBLIC_WS_URL}?app_id=${getAppId()}`;
    
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      // If we are already connecting/connected to a DIFFERENT URL, we must close and restart
      if (this.socket.url !== wsUrl) {
        console.log(`Deriv: URL mismatch (${this.socket.url} vs ${wsUrl}), restarting socket...`);
        this.socket.close();
      } else {
        return; // Already in flight or connected
      }
    }

    console.log(`Connecting to Deriv API (${this.isAuthorized ? 'Authenticated' : 'Public'} via ${wsUrl})...`);
    this.setStatus('connecting');
    this.isConnected = false;
    
    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = (event) => {
        if (this.socket !== event.target) return;
        this.isConnected = true;
        
        if (this.isAuthorized) {
          this.setStatus('authorized');
          console.log('Deriv WebSocket Authenticated');
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
      this.isConnected = false;
    }

    this.socket.onmessage = (event) => {
      if (this.socket !== event.target) return;
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

    this.socket.onclose = (event) => {
      if (this.socket !== event.target && event.target !== null) return;
      
      this.isConnected = false;
      this.setStatus('disconnected');
      if (this.pingInterval) clearInterval(this.pingInterval);
      
      // If this.socket was nulled out, it means we are doing an immediate reconnect
      // elsewhere (e.g. in authorize transition to OTP)
      if (this.socket === null) return;

      // Only auto-reconnect if it wasn't a manual logout or explicit reset
      if (this.token) {
        console.log('Deriv WebSocket Disconnected. Reconnecting in 5s...');
        setTimeout(() => {
          if (!this.isConnected && this.token && this.socket !== null) this.connect();
        }, 5000);
      }
    };

    this.socket.onerror = (event) => {
      if (this.socket !== event.target) return;
      console.error('Deriv WebSocket Error:', event);
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
    if (this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(data));
      } catch (e) {
        // Silently catch and queue if send fails during race condition
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
    if (!token) throw new Error("No token provided for authorization");
    
    this.token = token;
    localStorage.setItem('deriv_token', token);
    
    // Smart Detection: Legacy API tokens are shorter than OAuth tokens
    const isLegacyToken = token.length < 50;

    console.log(`Deriv: Initiating authorization (Type: ${isLegacyToken ? 'Legacy' : 'Modern'})`);
    console.log(`Deriv: Using token: ${token.substring(0, 4)}...${token.substring(Math.max(0, token.length - 4))}`);

    try {
      if (isLegacyToken) {
        return await this.legacyAuthorize(token);
      }

      // 1. Fetch available accounts (Modern Hub API)
      // We set a strict timeout for the resting hub call to avoid UI lag
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const accountsRes = await fetch('/api/deriv/accounts', {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'x-deriv-app-id': getAppId()
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!accountsRes.ok) {
          const errText = await accountsRes.text();
          throw new Error(`Hub API rejected token: ${errText}`);
        }
        
        const accountsData = await accountsRes.json();
        
        if (accountsData.error) {
          throw new Error(`Hub API Error: ${accountsData.error.message || "Unknown"}`);
        }

        const accounts = accountsData.data || [];
        if (accounts.length === 0) throw new Error("No accounts found");

        const demoAccount = accounts.find((a: any) => a.account_type === 'demo') || accounts[0];
        this.activeAccountId = demoAccount.account_id;
        localStorage.setItem('active_account_id', this.activeAccountId!);
        
        const otpRes = await fetch(`/api/deriv/otp/${this.activeAccountId}`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'x-deriv-app-id': getAppId()
          }
        });
        
        if (!otpRes.ok) throw new Error("Failed to obtain OTP");
        
        const otpData = await otpRes.json();
        if (otpData.data?.url) {
          console.log("Deriv: Modern Hub Auth Successful, switching to OTP WebSocket...");
          this.otpUrl = otpData.data.url;
          this.isAuthorized = true;
          
          if (this.socket) {
            console.log("Deriv: Rotating socket to OTP endpoint...");
            const oldSocket = this.socket;
            this.socket = null; // Prevent onclose auto-reconnect
            this.isConnected = false;
            oldSocket.close();
          }
          
          this.connect();
          return accountsData;
        } else {
          throw new Error("OTP response missing URL");
        }
      } catch (restError: any) {
        if (restError.name === 'AbortError') throw new Error("Hub API Timeout");
        throw restError;
      }
    } catch (error: any) {
      console.warn(`Deriv: Modern Auth failed (${error.message || 'Error'}), falling back to Legacy WebSocket Auth...`);
      this.otpUrl = null; // IMPORTANT: Clear OTP URL for legacy fallback
      
      // FALLBACK: Traditional WebSocket authorize
      try {
        // Force a clean websocket connection for legacy auth to ensure fresh state/app_id
        if (this.socket) {
          console.log("Deriv: Resetting socket for legacy fallback...");
          const oldSocket = this.socket;
          this.socket = null; // Prevent onclose from triggering auto-reconnect
          this.isConnected = false;
          if (oldSocket.readyState === WebSocket.OPEN || oldSocket.readyState === WebSocket.CONNECTING) {
            oldSocket.close();
          }
          await new Promise(r => setTimeout(r, 300));
        }

        const authData = await this.legacyAuthorize(token);
        console.log("Deriv: WebSocket Auth Fallback Successful");
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
    if (this.isAuthorized && this.token === token && this.isConnected) {
      console.log("Deriv: Already authorized with this token, skipping redundant auth.");
      return Promise.resolve({ authorize: {} });
    }

    return new Promise((resolve, reject) => {
      const timeoutSec = 25;
      const timeoutId = setTimeout(() => {
        if (!this.isAuthorized) {
          console.error(`Deriv auth timeout after ${timeoutSec}s. Status: ${this.isConnected ? 'Connected' : 'Disconnected'}, ReadyState: ${this.socket?.readyState}`);
          reject(new Error("Connection timeout during WebSocket auth fallback. Please check your internet or App ID whitelist. Ensure the token is valid and the App ID matches your domain."));
        }
      }, timeoutSec * 1000);

      const doAuth = () => {
        console.log("Deriv: Executing WebSocket authorize command...");
        this.executeLegacyAuth(token, (res: any) => {
          clearTimeout(timeoutId);
          resolve(res);
        }, (err: any) => {
          clearTimeout(timeoutId);
          reject(err);
        });
      };

      // Ensure we are connected first
      if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
        console.log("Deriv: Socket not ready for auth, connecting...");
        this.connect();
        
        const checkConn = () => {
          if (this.socket?.readyState === WebSocket.OPEN) {
            console.log("Deriv: Socket opened, proceeding with auth.");
            this.off('connected', checkConn);
            this.off('authorized', checkConn);
            doAuth();
          }
        };
        
        this.on('connected', checkConn);
        this.on('authorized', checkConn);
      } else {
        doAuth();
      }
    });
  }

  private executeLegacyAuth(token: string, resolve: Function, reject: Function) {
    const reqId = ++this.reqIdCounter;
    const appId = getAppId();
    const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'unknown';
    
    const listener = (data: any) => {
      if (data.req_id === reqId) {
        this.off(`req_${reqId}`, listener);
        if (data.error) {
          const errMsg = data.error.message;
          if (errMsg.includes('Sorry, an error occurred') || data.error.code === 'InvalidAppID') {
            console.error(`Deriv Security Reject: App ID ${appId} not authorized for domain ${currentDomain}.`);
            reject(new Error(`Deriv Access Denied: The App ID (${appId}) is not registered or not permitted for this domain (${currentDomain}). Please register your App ID at api.deriv.com and add this domain to the whitelist.`));
          } else {
            reject(new Error(errMsg));
          }
        } else {
          this.isAuthorized = true;
          this.setStatus('authorized');
          console.log(`Deriv: WebSocket Authorized (App ID: ${appId})`);
          resolve(data.authorize);
        }
      }
    };
    this.on(`req_${reqId}`, listener);
    this.send({ authorize: token, req_id: reqId });
  }

  public resetAppId() {
    localStorage.removeItem('deriv_app_id');
    // Forcing a reconnect will pick up the default or env ID
    if (this.socket) this.socket.close();
  }

  public setAppId(appId: string) {
    localStorage.setItem('deriv_app_id', appId);
    if (this.socket) {
      console.log(`Deriv: App ID updated to ${appId}, reconnecting...`);
      this.socket.close();
    }
  }

  public getAccountId() {
    return this.activeAccountId;
  }

  public async getApiTokens() {
    return new Promise((resolve, reject) => {
      const reqId = ++this.reqIdCounter;
      const listener = (data: any) => {
        if (data.req_id === reqId) {
          this.off(`req_${reqId}`, listener);
          if (data.error) reject(new Error(data.error.message));
          else resolve(data.api_token);
        }
      };
      this.on(`req_${reqId}`, listener);
      this.send({ api_token: 1, req_id: reqId });
    });
  }

  public async createApiToken(name: string, scopes: string[] = ['read', 'trade']) {
    return new Promise((resolve, reject) => {
      const reqId = ++this.reqIdCounter;
      const listener = (data: any) => {
        if (data.req_id === reqId) {
          this.off(`req_${reqId}`, listener);
          if (data.error) reject(new Error(data.error.message));
          else resolve(data.api_token);
        }
      };
      this.on(`req_${reqId}`, listener);
      this.send({ 
        api_token: 1, 
        new_token: name, 
        new_token_scopes: scopes, 
        req_id: reqId 
      });
    });
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
