import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MarketStats } from './components/MarketStats';
import { TradingChart } from './components/TradingChart';
import { TradePanel } from './components/TradePanel';
import { BottomPanel } from './components/BottomPanel';
import { Markets } from './components/Markets';
import { Assets } from './components/Assets';
import { Settings } from './components/Settings';
import { Chat } from './components/Chat';
import { History } from './components/History';
import { Analytics } from './components/Analytics';
import { Auth } from './components/Auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { auth, logout as firebaseLogout, db, handleFirestoreError, OperationType, onAuthStateChanged, signInAnonymously } from './lib/firebase';
import { doc, setDoc, getDoc, onSnapshot, collection, query, where, orderBy, limit, addDoc } from 'firebase/firestore';
import { derivApi, Tick, HistoryPoint, Candle, ConnectionStatus } from './services/derivApi';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { Zap } from 'lucide-react';

import { StorageService } from './lib/storage';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [marketCategory, setMarketCategory] = useState('Derived');
  const [selectedSymbol, setSelectedSymbol] = useState('R_100');
  const [currentTick, setCurrentTick] = useState<Tick | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('tradepulse_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error('Failed to parse user from localStorage', e);
      return null;
    }
  });

  // Pull initial data for the user if they were already logged in
  const [balance, setBalance] = useState(() => StorageService.getBalance(user?.uid));
  const [activeTrades, setActiveTrades] = useState<any[]>([]);
  const [tradeHistory, setTradeHistory] = useState<any[]>(() => StorageService.getTrades(user?.uid));
  const [transactions, setTransactions] = useState<any[]>(() => StorageService.getTransactions(user?.uid));
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [timeframe, setTimeframe] = useState('1M');
  const [notification, setNotification] = useState<{ type: 'win' | 'loss', amount: number } | null>(null);

  const dashboardStats = useMemo(() => {
    // Net Profit: Sum of all positive outcomes
    const netProfit = tradeHistory
      .filter(t => (t.profit || 0) > 0)
      .reduce((acc, t) => acc + (t.profit || 0), 0);
    
    // Net Loss: Sum of all negative outcomes (as positive number)
    const netLoss = tradeHistory
      .filter(t => (t.profit || 0) < 0)
      .reduce((acc, t) => acc + Math.abs(t.profit || 0), 0);
      
    const totalDeposits = transactions
      .filter(tx => tx.type === 'deposit')
      .reduce((acc, tx) => acc + (tx.amount || 0), 0);
      
    const totalWithdrawals = transactions
      .filter(tx => tx.type === 'withdrawal')
      .reduce((acc, tx) => acc + (tx.amount || 0), 0);
    
    return { 
      netProfit: isNaN(netProfit) ? 0 : netProfit, 
      netLoss: isNaN(netLoss) ? 0 : netLoss, 
      totalDeposits: isNaN(totalDeposits) ? 0 : totalDeposits, 
      totalWithdrawals: isNaN(totalWithdrawals) ? 0 : totalWithdrawals 
    };
  }, [tradeHistory, transactions]);

  // Sync Deriv Auth with App User
  useEffect(() => {
    return derivApi.onStatusChange((status) => {
      if (status === 'authorized') {
        const savedUser = localStorage.getItem('tradepulse_user');
        const accountId = derivApi.getAccountId();
        
        if (!savedUser) {
          const newUser = {
            name: 'Deriv Trader',
            id: accountId || `CR${Math.floor(Math.random() * 9000 + 1000)}`,
            uid: `deriv_${accountId || Math.random().toString(36).substring(2, 10)}`,
            authType: 'deriv'
          };
          setUser(newUser);
          localStorage.setItem('tradepulse_user', JSON.stringify(newUser));
        }
      }
    });
  }, []);

  const [authError, setAuthError] = useState<string | null>(null);

  // Unified token exchange handler
  const performExchange = async (code: string, returnedState: string | null) => {
    // Check if we have the verifier - if not, we can't do modern PKCE
    const codeVerifier = sessionStorage.getItem('pkce_code_verifier');
    
    if (!codeVerifier) {
      console.warn('Deriv: Redirected with code but missing PKCE verifier. Redirecting back to login.');
      setAuthError('Session Expired: Missing authorization verifier. Please try logging in again.');
      // Clean URL to prevent infinite reload
      window.history.replaceState({}, document.title, "/");
      return;
    }

    try {
      const storedState = sessionStorage.getItem('oauth_state');
      const storedRedirectUri = sessionStorage.getItem('oauth_redirect_uri');
      const storedClientId = sessionStorage.getItem('oauth_client_id');
      
      const clientId = storedClientId || import.meta.env.VITE_DERIV_CLIENT_ID || '33433jm6aon9vgTQHB9vn';
      const origin = window.location.origin.replace(/\/$/, '');
      const redirectUri = storedRedirectUri || import.meta.env.VITE_DERIV_REDIRECT_URI || (origin + '/callback');

      if (returnedState && storedState && returnedState !== storedState) {
        throw new Error('Security Breach: OAuth state mismatch detected.');
      }

      // Background process - don't block the UI if we already have a user
      // but if we don't have a user, show a non-intrusive loading state
      const response = await fetch('/api/deriv/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          code_verifier: codeVerifier,
          redirect_uri: redirectUri,
          client_id: clientId
        })
      });

      // Handle non-JSON or error responses gracefully
      let data: any;
      const responseText = await response.text();
      
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('Failed to parse Deriv response:', responseText);
        throw new Error('Terminal responded with invalid data format. Please try again.');
      }
      
      if (!response.ok) {
        if (response.status === 405) {
          throw new Error('Access Denied (405): The authentication terminal rejected the handshake. Please ensure your Deriv App ID supports "Authorization Code" flow and the Redirect URI matches your dashboard settings exactly.');
        }
        throw new Error(data.error || `Server Error: ${response.status}`);
      }
      
      if (data.access_token) {
        console.log('Deriv Token Exchange Successful (Background Handshake)');
        
        const userData = {
           name: 'Deriv Trader',
           id: `CR${Math.floor(Math.random() * 9000 + 1000)}`,
           email: 'deriv-account',
           uid: user?.uid || `deriv_${Date.now()}`,
           authType: 'deriv' as const,
           derivToken: data.access_token
        };

        // Transition immediately
        setUser(userData);
        localStorage.setItem('tradepulse_user', JSON.stringify(userData));
        
        // Clear artifact
        sessionStorage.removeItem('pkce_code_verifier');
        sessionStorage.removeItem('oauth_state');

        // Silent authorization
        derivApi.authorize(data.access_token).catch(e => console.error('Background API Init failed:', e));
        
        window.history.replaceState({}, document.title, "/");
        setActiveTab('dashboard');
      } else {
        throw new Error(data.error || 'The authorization code is invalid or expired.');
      }
    } catch (err: any) {
      console.error('Background Handshake Error:', err);
      setAuthError(err.message);
      // If we are on the dashboard, maybe show a generic "Connection Error" instead of blocking
    }
  };

  // Check for OAuth callback or popup messages
  useEffect(() => {
    // 1. Handle cross-window communication (Popups)
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'DERIV_AUTH_COMPLETE') {
        const { code, state, error, token, accountId } = event.data;
        if (error) {
          setAuthError(error === 'access_denied' ? 'Access Denied: You cancelled the login.' : error);
        } else if (token) {
          console.log('Received direct token from popup');
          const userData = {
             name: 'Deriv Trader',
             id: accountId || `CR${Math.floor(Math.random() * 9000 + 1000)}`,
             email: 'deriv-account',
             uid: user?.uid || `deriv_${Date.now()}`,
             authType: 'deriv' as const,
             derivToken: token
          };
          setUser(userData);
          localStorage.setItem('tradepulse_user', JSON.stringify(userData));
          derivApi.authorize(token).catch(e => console.error('API Init failed:', e));
          setActiveTab('dashboard');
        } else if (code) {
          performExchange(code, state);
        }
      }
    };
    window.addEventListener('message', handleMessage);

    // 2. Handle direct URL redirect (Traditional)
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const token1 = params.get('token1') || params.get('token');
    const returnedState = params.get('state');
    const error = params.get('error');

    if (error) {
      if (window.opener && window.opener !== window) {
        window.opener.postMessage({ type: 'DERIV_AUTH_COMPLETE', error }, window.location.origin);
        window.close();
        return;
      }
      setAuthError(error === 'access_denied' ? 'Access Denied: You cancelled the login.' : error);
    } else if (token1) {
      // Legacy or Token-direct redirect
      console.log('Deriv Token detected in URL (Legacy/Direct Flow)');
      
      const userData = {
         name: 'Deriv Trader',
         id: params.get('acct1') || `CR${Math.floor(Math.random() * 9000 + 1000)}`,
         email: 'deriv-account',
         uid: user?.uid || `deriv_${Date.now()}`,
         authType: 'deriv' as const,
         derivToken: token1
      };

      setUser(userData);
      localStorage.setItem('tradepulse_user', JSON.stringify(userData));
      
      // Notify opener if this is a popup
      if (window.opener && window.opener !== window) {
        window.opener.postMessage({ type: 'DERIV_AUTH_COMPLETE', token: token1, accountId: userData.id }, window.location.origin);
        window.close();
        return;
      }
      
      derivApi.authorize(token1).catch(e => console.error('API Init failed:', e));
      window.history.replaceState({}, document.title, "/");
      setActiveTab('dashboard');
    } else if (code) {
      if (window.opener && window.opener !== window) {
        window.opener.postMessage({ type: 'DERIV_AUTH_COMPLETE', code, state: returnedState }, window.location.origin);
        window.close();
        return;
      }
      
      // Background exchange
      performExchange(code, returnedState);
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Sync state with local storage AND cloud when user UID is available
  useEffect(() => {
    if (!user?.uid) {
      // If no user, reset to generic defaults to avoid showing previous user's data
      setBalance(StorageService.getBalance());
      setTradeHistory(StorageService.getTrades());
      setTransactions(StorageService.getTransactions());
      return;
    }

    // 1. Initial Load from Local Storage (Fast path)
    setBalance(StorageService.getBalance(user.uid));
    setTradeHistory(StorageService.getTrades(user.uid));
    setTransactions(StorageService.getTransactions(user.uid));

    // 2. Real-time Cloud Sync (Consistency path)
    // Only set up listeners if we have a real Firebase UID and aren't in pure mock mode
    if (!auth.isMock || user.authType === 'firebase') {
      console.log('Initializing Real-time Sync for UID:', user.uid);
      
      // Simulate real-time updates via window events (works across tabs in same browser)
      const handleStorageChange = (e: StorageEvent) => {
        if (!user.uid) return;
        if (e.key === `tradepulse_balance_v1_${user.uid}`) {
          setBalance(StorageService.getBalance(user.uid));
        }
        if (e.key === `tradepulse_trades_v1_${user.uid}`) {
          setTradeHistory(StorageService.getTrades(user.uid));
        }
        if (e.key === `tradepulse_transactions_v1_${user.uid}`) {
          setTransactions(StorageService.getTransactions(user.uid));
        }
      };

      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, [user?.uid]);

  // Firebase Auth Listener
  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          const userData = {
            name: firebaseUser.displayName || 'User',
            email: firebaseUser.email,
            uid: firebaseUser.uid,
            id: user?.id || `CR${Math.floor(Math.random() * 9000 + 1000)}`
          };
          setUser(userData);
          localStorage.setItem('tradepulse_user', JSON.stringify(userData));
        }
      });
      return () => unsubscribe();
    } catch (error) {
      console.error("Auth listener failed to initialize", error);
    }
  }, []);

  // Trade Lifecycle Manager
  useEffect(() => {
    if (!user?.uid || activeTrades.length === 0 || !currentTick) return;

    const now = Date.now();
    const finishedTrades = activeTrades.filter(t => (t.timestamp + (t.duration * 1000)) <= now);

    if (finishedTrades.length > 0) {
      console.log(`Processing ${finishedTrades.length} finished trades`);
      
      let balanceAdjustment = 0;
      const tradeIdsToRemove = finishedTrades.map(t => t.id);

      const processTrades = async () => {
        let totalPayout = 0;
        for (const trade of finishedTrades) {
          const tradeAmount = Number(trade.amount) || 0;
          const entryPrice = Number(trade.entryPrice || trade.entry || 0);
          
          // Use current price if it's for the same symbol, otherwise fallback to entry (Tie) 
          // to avoid settling a Forex trade with a Crypto price.
          const isSymbolMatch = trade.symbol === currentTick.symbol;
          const exitPrice = isSymbolMatch ? (Number(currentTick.quote) || entryPrice) : entryPrice;

          // Calculate result
          const isWin = trade.type === 'buy' 
            ? exitPrice > entryPrice 
            : exitPrice < entryPrice;
          
          const result = isWin ? 'win' : 'loss';
          const payout = isWin ? tradeAmount * 1.95 : tradeAmount * 0.5; // 50% loss guard
          totalPayout += payout;

          const completedTrade = {
            ...trade,
            status: 'CLOSED',
            result,
            payout,
            exit: exitPrice,
            exitPrice: exitPrice,
            profit: payout - tradeAmount,
            closedAt: now
          };

          // Save Locally
          StorageService.addTrade(completedTrade, user.uid);
          
          // Generate Transaction
          StorageService.addTransaction({
            userId: user.uid,
            type: result === 'win' ? 'trade_win' : 'trade_loss',
            label: `${trade.type.toUpperCase()} ${trade.symbol} (${tradeAmount}$)`,
            amount: payout,
            displayAmount: `${result === 'win' ? '+' : '-'}$${Math.abs(payout - tradeAmount).toFixed(2)}`,
            status: 'COMPLETED',
            timestamp: now
          }, user.uid);

          // Save to Firestore (optional/quiet)
          if (!auth.isMock) {
            try {
              await setDoc(doc(db, 'trades', trade.id), completedTrade);
            } catch (e) { /* ignore */ }
          }
          
          setNotification({ type: result, amount: payout });
        }

        // Batch state updates
        const currentBalance = StorageService.getBalance(user.uid);
        const newBalanceValue = currentBalance + totalPayout;
        
        setBalance(newBalanceValue);
        StorageService.saveBalance(newBalanceValue, user.uid);
        
        setActiveTrades(prev => prev.filter(t => !tradeIdsToRemove.includes(t.id)));
        setTradeHistory(StorageService.getTrades(user.uid));
        setTransactions(StorageService.getTransactions(user.uid));

        setTimeout(() => setNotification(null), 3000);
      };

      processTrades();
    }
  }, [user?.uid, activeTrades, currentTick]);

  // Sync local balance whenever it changes
  useEffect(() => {
    if (user?.uid) {
      StorageService.saveBalance(balance, user.uid);
    }
  }, [balance, user?.uid]);

  // Firebase Trade Sync
  useEffect(() => {
    if (!user?.uid || auth.isMock) return;

    const tradesRef = collection(db, 'trades');
    const q = query(
      tradesRef, 
      where('userId', '==', user.uid),
      limit(200)
    );
    
    const unsubscribeTrades = onSnapshot(q, (snapshot) => {
      const allTrades = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      
      const active = allTrades.filter(t => t.status === 'OPEN');
      const closed = allTrades.filter(t => t.status === 'CLOSED')
        .sort((a, b) => (b.closedAt || b.timestamp) - (a.closedAt || a.timestamp));
      
      setActiveTrades(active);
      setTradeHistory(closed);
      localStorage.setItem('tradepulse_history', JSON.stringify(closed));
    }, (error) => {
      console.error("Trades listener error:", error);
    });
    
    return () => unsubscribeTrades();
  }, [user?.uid]);

  // Firebase Transaction Sync
  useEffect(() => {
    if (!user?.uid || auth.isMock) return;

    const txRef = collection(db, 'transactions');
    const q = query(
      txRef, 
      where('userId', '==', user.uid),
      limit(200)
    );
    
    const unsubscribeTx = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      
      const sortedTxs = txs.sort((a, b) => b.timestamp - a.timestamp);
      setTransactions(sortedTxs);
    }, (error) => {
      console.error("Transactions listener error:", error);
    });
    
    return () => unsubscribeTx();
  }, [user?.uid]);

  // Theme management
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Handle Deriv OAuth Callback (Modern logic handled in top-level effects)
  
  useEffect(() => {
    if (!user && import.meta.env.VITE_DERIV_TOKEN || '884e') {
      const envToken = import.meta.env.VITE_DERIV_TOKEN || '884e';
      const initEnvSession = async () => {
        try {
          const firebaseUser = await signInAnonymously();
          const userData = {
            name: 'Deriv Pro User',
            id: `PAT-${envToken.substring(Math.max(0, envToken.length - 4))}`,
            email: 'deriv-pro-account',
            uid: firebaseUser.uid,
            authType: 'deriv',
            derivToken: envToken
          };
          setUser(userData);
          localStorage.setItem('tradepulse_user', JSON.stringify(userData));
          await derivApi.authorize(envToken);
        } catch (error) {
          console.error("Environment session init failed:", error);
        }
      };
      initEnvSession();
    }
  }, [user]);

  // Initialize market data
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let isActive = true;

    const initMarket = async () => {
      setIsReady(false);
      try {
        console.log(`Initializing market for ${selectedSymbol} with ${timeframe} candles...`);
        
        const granularityMap: Record<string, number> = {
          '1M': 60,
          '5M': 300,
          '15M': 900,
          '1H': 3600,
          '1D': 86400
        };
        const granularity = granularityMap[timeframe] || 60;

        // Try to get history and candles
        const [initialHistory, initialCandles] = await Promise.all([
          derivApi.getHistory(selectedSymbol, 100),
          derivApi.getCandles(selectedSymbol, granularity, 100)
        ]);

        if (!isActive) return;

        setHistory(initialHistory);
        setCandles(initialCandles);
        setIsReady(true);

        // Subscribe to ticks
        unsubscribe = derivApi.subscribeTicks(selectedSymbol, (tick) => {
          if (!isActive) return;
          setCurrentTick(tick);
          
          // Update history
          setHistory(prev => {
            const newHistory = [...prev, { epoch: tick.epoch, quote: tick.quote }];
            return newHistory.slice(-100);
          });

          // Update candles
          setCandles(prev => {
            if (prev.length === 0) return prev;
            const lastCandle = prev[prev.length - 1];
            
            const granularityMap: Record<string, number> = {
              '1M': 60,
              '5M': 300,
              '15M': 900,
              '1H': 3600,
              '1D': 86400
            };
            const candleInterval = granularityMap[timeframe] || 60;
            
            if (tick.epoch < lastCandle.epoch + candleInterval) {
              // Update current candle
              const updatedCandle = {
                ...lastCandle,
                high: Math.max(lastCandle.high, tick.quote),
                low: Math.min(lastCandle.low, tick.quote),
                close: tick.quote
              };
              return [...prev.slice(0, -1), updatedCandle];
            } else {
              // Start new candle
              const newCandle = {
                epoch: Math.floor(tick.epoch / candleInterval) * candleInterval,
                open: tick.quote,
                high: tick.quote,
                low: tick.quote,
                close: tick.quote
              };
              return [...prev.slice(1), newCandle];
            }
          });
        });
      } catch (error) {
        if (!isActive) return;
        console.error('Failed to initialize market:', error);
        
        // If it's a timeout or connection error, we might want to retry once
        setTimeout(() => {
          if (!isActive || isReady) return;
          console.log('Retrying market initialization...');
          // Fallback to ensure UI isn't stuck if retry also fails
          setIsReady(true);
          if (history.length === 0) {
            // Provide a base price based on the symbol if possible
            const basePrice = selectedSymbol.startsWith('R_') ? 1000 : 1.0;
            const now = Math.floor(Date.now() / 1000);
            setHistory([{ epoch: now, quote: basePrice }]);
            setCandles([{ epoch: now, open: basePrice, high: basePrice * 1.01, low: basePrice * 0.99, close: basePrice }]);
          }
        }, 5000);
      }
    };

    initMarket();

    return () => {
      isActive = false;
      if (unsubscribe) unsubscribe();
    };
  }, [selectedSymbol, timeframe]);

  const handleLogout = async () => {
    console.log('Logging out...');
    try {
      StorageService.clearAll();
      await firebaseLogout();
      derivApi.logout();
      setUser(null);
      setTradeHistory([]);
      setTransactions([]);
      setActiveTab('dashboard');
    } catch (error) {
      console.error('Logout failed:', error);
      setUser(null);
    }
  };

  const handleReturnToLogin = () => {
    setAuthError(null);
    window.history.replaceState({}, document.title, "/");
    // Clear potentially corrupt params
    const url = new URL(window.location.href);
    url.search = '';
    window.location.href = url.toString();
  };

  if (!user) {
    return (
      <ErrorBoundary>
        <Auth onLogin={(u) => {
          setUser(u);
          setActiveTab('dashboard');
          if (u.derivToken) derivApi.authorize(u.derivToken);
        }} />
        {/* Transparent Overlay for background handshake if redirect happened */}
        {window.location.search.includes('code=') && !authError && (
          <div className="fixed inset-0 bg-background/50 backdrop-blur-sm flex flex-col items-center justify-center z-50">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-20 h-20 bg-brand rounded-2xl flex items-center justify-center mb-6 shadow-2xl shadow-brand/20"
            >
              <Zap className="text-background w-10 h-10 fill-background animate-pulse" />
            </motion.div>
            <h2 className="text-xl font-black italic uppercase tracking-tighter text-text-primary mb-1">Handshaking</h2>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Securing Cloud Terminal...</p>
          </div>
        )}
        
        {/* Error Modal for handshake failures */}
        <AnimatePresence>
          {authError && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-[100] p-6"
            >
              <div className="bg-card border border-red-500/30 p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl shadow-red-500/10">
                <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Zap className="text-white w-8 h-8" />
                </div>
                <h2 className="text-xl font-black italic uppercase tracking-tighter text-text-primary mb-2">Access Denied</h2>
                <p className="text-xs font-bold text-red-400 uppercase tracking-widest leading-relaxed mb-8">
                  {authError}
                </p>
                <button 
                  onClick={handleReturnToLogin}
                  className="w-full py-4 bg-red-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                >
                  Restart Handshake
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </ErrorBoundary>
    );
  }

  const renderDashboard = () => (
    <div className="flex flex-col h-full">
      <MarketStats 
        symbol={selectedSymbol}
        currentPrice={currentTick?.quote || history[history.length - 1]?.quote || 0}
        change={2.45}
        changePercent={0.15}
        stats={dashboardStats}
      />
      
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Main Chart Area */}
        <div className="flex-1 flex flex-col min-w-0 border-b lg:border-b-0 lg:border-r border-border">
          <div className="h-[300px] sm:h-[400px] lg:flex-1 min-h-0">
            <TradingChart 
              data={history} 
              candles={candles} 
              symbol={selectedSymbol}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
            />
          </div>
          <div className="hidden sm:block">
            <BottomPanel 
              activeTrades={activeTrades} 
              tradeHistory={tradeHistory} 
              transactions={transactions}
              user={user} 
              currentPrice={currentTick?.quote}
            />
          </div>
        </div>

        {/* Right Order Panel */}
        <div className="w-full lg:w-80 bg-card flex flex-col shrink-0">
          <TradePanel 
            currentPrice={currentTick?.quote || 0} 
            balance={balance} 
            setBalance={setBalance}
            symbol={selectedSymbol}
            history={history}
            onTrade={async (trade) => {
              const newTrade = { ...trade, userId: user.uid };
              
              // Place real trade if Deriv is connected
              if (user.authType === 'deriv') {
                try {
                  const contractType = trade.type === 'buy' ? 'CALL' : 'PUT';
                  const result = await derivApi.buyContract(
                    trade.symbol,
                    trade.amount,
                    contractType,
                    trade.duration
                  );
                  console.log('Trade placed successfully on Deriv:', result);
                  newTrade.id = (result as any).contract_id;
                } catch (error: any) {
                  console.error('Failed to place trade on Deriv:', error);
                  alert(`Trade Failed: ${error.message}`);
                  return; // Don't save trade if it failed on Deriv
                }
              }

              setActiveTrades(prev => [newTrade, ...prev]);
              
              // Local Persistence
              StorageService.addTrade(newTrade, user.uid);

              // Persist as OPEN trade if not mock
              try {
                if (!auth.isMock) {
                  await setDoc(doc(db, 'trades', newTrade.id), newTrade);
                }
              } catch (error) {
                // Background trade placement
              }
            }}
            onTradeComplete={() => {
              // Now handled by background lifecycle manager
            }}
          />
          {/* Mobile version of BottomPanel or just show it below */}
          <div className="sm:hidden border-t border-border">
            <BottomPanel 
              activeTrades={activeTrades} 
              tradeHistory={tradeHistory} 
              transactions={transactions}
              user={user} 
              currentPrice={currentTick?.quote}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return renderDashboard();
      case 'markets':
        return (
          <div className="p-8">
            <Markets 
              initialCategory={marketCategory}
              balance={balance}
              onSelect={(symbol) => {
                setSelectedSymbol(symbol);
                setActiveTab('dashboard');
              }} 
            />
          </div>
        );
      case 'assets':
        return (
          <div className="p-8">
            <Assets 
              user={user}
              balance={balance} 
              setBalance={setBalance} 
              transactions={transactions}
              onTransaction={(tx) => {
                StorageService.addTransaction(tx, user.uid);
                StorageService.saveBalance(tx.balance, user.uid);
                setTransactions(StorageService.getTransactions(user.uid));
              }}
            />
          </div>
        );
      case 'history':
        return (
          <div className="p-8">
            <History tradeHistory={tradeHistory} transactionHistory={transactions} />
          </div>
        );
      case 'analytics':
        return (
          <div className="p-8 h-full overflow-y-auto">
            <Analytics tradeHistory={tradeHistory} />
          </div>
        );
      case 'settings':
        return (
          <div className="p-8">
            <Settings 
              user={user} 
              onLogout={handleLogout}
              isDarkMode={isDarkMode} 
              setIsDarkMode={setIsDarkMode} 
            />
          </div>
        );
      case 'chat':
        return (
          <div className="p-8 h-screen overflow-hidden pb-32">
            <Chat 
              user={user} 
              marketContext={{ 
                symbol: selectedSymbol, 
                price: currentTick?.quote || history[history.length - 1]?.quote || 0 
              }} 
            />
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-6 border border-border">
              <span className="text-3xl">🚧</span>
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2 uppercase tracking-widest">Section Under Construction</h2>
            <p className="text-text-muted max-w-sm text-sm">Our AI is currently optimizing this module for professional trading standards.</p>
          </div>
        );
    }
  };

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-background text-text-primary font-sans selection:bg-brand/30 transition-colors duration-300 overflow-hidden">
        {/* Sidebar - Responsive */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Sidebar 
          user={user}
          activeTab={activeTab} 
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setIsSidebarOpen(false);
          }} 
          onClose={() => setIsSidebarOpen(false)} 
        />
      </div>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>
      
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        <Header 
          user={user} 
          balance={balance}
          onMenuClick={() => setIsSidebarOpen(true)} 
          onCategorySelect={(cat) => {
            setMarketCategory(cat);
            setActiveTab('markets');
          }}
          onLogout={handleLogout}
          onSettingsClick={() => setActiveTab('settings')}
        />
        
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full overflow-y-auto"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Trade Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: 50, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 50, x: '-50%' }}
              className={cn(
                "fixed bottom-24 left-1/2 z-[100] px-6 py-3 rounded-2xl border shadow-2xl flex items-center gap-3 min-w-[280px]",
                notification.type === 'win' ? "bg-bullish border-bullish/20 text-background" : "bg-bearish border-bearish/20 text-text-primary"
              )}
            >
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">
                {notification.type === 'win' ? '🏆' : '📉'}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Trade Settled</p>
                <p className="text-lg font-black italic uppercase tracking-tight">
                  {notification.type === 'win' ? `Profit: +$${(notification.amount - (notification.amount / 1.95)).toFixed(2)}` : 'Loss Guard Active'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
    </ErrorBoundary>
  );
}
