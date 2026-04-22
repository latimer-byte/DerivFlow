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
import { History } from './components/History';
import { Analytics } from './components/Analytics';
import { Auth } from './components/Auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { auth, logout as firebaseLogout, db, handleFirestoreError, OperationType, onAuthStateChanged, signInAnonymously } from '@/lib/firebase';
import { doc, setDoc, getDoc, onSnapshot, collection, query, where, orderBy, limit, addDoc } from 'firebase/firestore';
import { derivApi, Tick, HistoryPoint, Candle } from '@/services/derivApi';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

import { StorageService } from '@/lib/storage';

interface Trade {
  id: string;
  userId: string;
  symbol: string;
  type: 'buy' | 'sell';
  amount: number;
  duration: number;
  entry: number;
  entryPrice: number;
  status: 'OPEN' | 'CLOSED';
  timestamp: number;
  result?: 'win' | 'loss';
  payout?: number;
  exit?: number;
  exitPrice?: number;
  profit?: number;
  closedAt?: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [marketCategory, setMarketCategory] = useState('Derived');
  const [selectedSymbol, setSelectedSymbol] = useState('R_100');
  const [currentTick, setCurrentTick] = useState<Tick | null>(null);
  const [symbolPrices, setSymbolPrices] = useState<Record<string, number>>({});
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
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [tradeHistory, setTradeHistory] = useState<Trade[]>(() => StorageService.getTrades(user?.uid));
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
    if (!user?.uid || activeTrades.length === 0) return;

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
          
          // Use price for the specific symbol if available, otherwise entry (Tie)
          const exitPrice = symbolPrices[trade.symbol] || entryPrice;

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
  }, [user?.uid, activeTrades, symbolPrices]);

  // Dynamic Subscriptions for Active Trades
  useEffect(() => {
    if (!user?.uid || activeTrades.length === 0) return;

    const unsubs: (() => void)[] = [];
    const symbolsToSubscribe = Array.from(new Set(activeTrades.map(t => t.symbol))) as string[];

    symbolsToSubscribe.forEach((symbol) => {
      // Don't duplicate selected symbol subscription (handled elsewhere)
      if (symbol === selectedSymbol) return;

      console.log(`Subscribing to active trade symbol: ${symbol}`);
      const unsub = derivApi.subscribeTicks(symbol, (tick: Tick) => {
        setSymbolPrices(prev => ({ ...prev, [symbol]: tick.quote }));
      });
      unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
  }, [user?.uid, activeTrades.map(t => t.id).join(','), selectedSymbol]);

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
      
      const active = allTrades.filter(t => t.status === 'OPEN') as Trade[];
      const closed = allTrades.filter(t => t.status === 'CLOSED')
        .sort((a, b) => (b.closedAt || b.timestamp) - (a.timestamp || 0)) as Trade[];
      
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

  // Handle Deriv OAuth Callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token1');
    const acct = urlParams.get('acct1');
    
    if (token) {
      console.log('Deriv OAuth callback detected');
      
      // If we are in a popup, send the message to the opener and close
      if (window.opener && window.opener !== window) {
        window.opener.postMessage({ type: 'DERIV_AUTH_SUCCESS', token, acct }, window.location.origin);
        window.close();
        return;
      }
      
      // Silent anonymous sign-in to Firebase to enable Firestore for Deriv users
      const initFirebaseForDeriv = async () => {
        try {
          const firebaseUser = await signInAnonymously();
          const userData = {
            name: acct || 'Deriv Trader',
            id: acct || `CR${Math.floor(Math.random() * 9000 + 1000)}`,
            email: 'deriv-account',
            uid: firebaseUser.uid, // Use Firebase UID for Firestore persistence
            authType: 'deriv',
            derivToken: token
          };
          
          setUser(userData);
          localStorage.setItem('tradepulse_user', JSON.stringify(userData));
          derivApi.authorize(token);
        } catch (error) {
          console.error("Failed to link Deriv to Firebase", error);
          // Fallback to local-only if Firebase fails
          const userData = {
            name: acct || 'Deriv Trader',
            id: acct || `CR${Math.floor(Math.random() * 9000 + 1000)}`,
            email: 'deriv-account',
            uid: acct || token,
            authType: 'deriv',
            derivToken: token
          };
          setUser(userData);
        }
      };

      initFirebaseForDeriv();
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Initialize market data
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let retryTimeout: NodeJS.Timeout | undefined;
    let isActive = true;
    let retryCount = 0;
    const MAX_RETRIES = 5;

    const initMarket = async () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      setIsReady(false);
      try {
        console.log(`Initializing market for ${selectedSymbol} with ${timeframe} (Attempt ${retryCount + 1})...`);
        
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
        retryCount = 0; // Reset on success

        // Subscribe to ticks
        unsubscribe = derivApi.subscribeTicks(selectedSymbol, (tick) => {
          if (!isActive) return;
          setCurrentTick(tick);
          setSymbolPrices(prev => ({ ...prev, [selectedSymbol]: tick.quote }));
          
          setHistory(prev => {
            const newHistory = [...prev, { epoch: tick.epoch, quote: tick.quote }];
            return newHistory.slice(-100);
          });

          setCandles(prev => {
            if (prev.length === 0) return prev;
            const lastCandle = prev[prev.length - 1];
            const candleInterval = granularityMap[timeframe] || 60;
            
            if (tick.epoch < lastCandle.epoch + candleInterval) {
              const updatedCandle = {
                ...lastCandle,
                high: Math.max(lastCandle.high, tick.quote),
                low: Math.min(lastCandle.low, tick.quote),
                close: tick.quote
              };
              return [...prev.slice(0, -1), updatedCandle];
            } else {
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
        
        const delay = Math.min(1000 * Math.pow(2, retryCount), 15000);
        retryCount++;

        if (retryCount <= MAX_RETRIES) {
          console.log(`Retrying market initialization in ${delay}ms...`);
          retryTimeout = setTimeout(() => {
            if (!isActive || isReady) return;
            initMarket();
          }, delay);
        } else {
          console.error("Max market retries reached. Please check your connection.");
        }
      }
    };

    initMarket();

    return () => {
      isActive = false;
      if (unsubscribe) unsubscribe();
      if (retryTimeout) clearTimeout(retryTimeout);
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

  if (!user) {
    return (
      <ErrorBoundary>
        <Auth onLogin={(u) => {
          setUser(u);
          if (u.derivToken) {
            derivApi.authorize(u.derivToken);
          }
          setActiveTab('dashboard');
        }} />
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
