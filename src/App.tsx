import React, { useState, useEffect, useCallback } from 'react';
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
import { auth, logout as firebaseLogout, db, handleFirestoreError, OperationType, onAuthStateChanged, signInAnonymously } from './lib/firebase';
import { doc, setDoc, getDoc, onSnapshot, collection, query, where, orderBy, limit, addDoc } from 'firebase/firestore';
import { derivApi, Tick, HistoryPoint, Candle } from './services/derivApi';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [marketCategory, setMarketCategory] = useState('Derived');
  const [selectedSymbol, setSelectedSymbol] = useState('R_100');
  const [currentTick, setCurrentTick] = useState<Tick | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [balance, setBalance] = useState(10000.00);
  const [user, setUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('tradepulse_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error('Failed to parse user from localStorage', e);
      return null;
    }
  });
  const [activeTrades, setActiveTrades] = useState<any[]>([]);
  const [tradeHistory, setTradeHistory] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('tradepulse_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to parse history from localStorage', e);
      return [];
    }
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [notification, setNotification] = useState<{ type: 'win' | 'loss', amount: number } | null>(null);

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

  // Trade History Listener
  useEffect(() => {
    if (!user?.uid) return;

    console.log('Setting up history listener for:', user.uid);
    const tradesRef = collection(db, 'trades');
    // Removed orderBy to avoid index requirements, sorting client-side instead
    const q = query(
      tradesRef, 
      where('userId', '==', user.uid),
      limit(100)
    );
    
    const unsubscribeTrades = onSnapshot(q, (snapshot) => {
      const trades = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      
      // Sort client-side by timestamp descending
      const sortedTrades = trades.sort((a, b) => b.timestamp - a.timestamp);
      
      setTradeHistory(sortedTrades);
      localStorage.setItem('tradepulse_history', JSON.stringify(sortedTrades));
    }, (error) => {
      console.error("History listener error:", error);
      // Only log, don't throw to avoid crashing the app
    });
    
    return () => unsubscribeTrades();
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

    const initMarket = async () => {
      setIsReady(false);
      try {
        console.log(`Initializing market for ${selectedSymbol}...`);
        
        // Try to get history and candles
        const [initialHistory, initialCandles] = await Promise.all([
          derivApi.getHistory(selectedSymbol, 100),
          derivApi.getCandles(selectedSymbol, 60, 100)
        ]);

        setHistory(initialHistory);
        setCandles(initialCandles);
        setIsReady(true);

        // Subscribe to ticks
        unsubscribe = derivApi.subscribeTicks(selectedSymbol, (tick) => {
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
            const candleInterval = 60; // 1 minute
            
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
        console.error('Failed to initialize market:', error);
        
        // If it's a timeout or connection error, we might want to retry once
        setTimeout(() => {
          if (!isReady) {
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
          }
        }, 5000);
      }
    };

    initMarket();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedSymbol]);

  const handleLogout = async () => {
    console.log('Logging out...');
    try {
      localStorage.removeItem('tradepulse_user');
      localStorage.removeItem('tradepulse_history');
      await firebaseLogout();
      derivApi.logout();
      setUser(null);
      setTradeHistory([]);
      setActiveTab('dashboard'); // Reset tab for next login
    } catch (error) {
      console.error('Logout failed:', error);
      // Force clear state anyway
      setUser(null);
    }
  };

  if (!user) {
    return (
      <ErrorBoundary>
        <Auth onLogin={(u) => {
          setUser(u);
          setActiveTab('dashboard');
        }} />
      </ErrorBoundary>
    );
  }

  const renderDashboard = () => (
    <div className="flex flex-col h-full lg:overflow-hidden">
      <MarketStats 
        symbol={selectedSymbol}
        currentPrice={currentTick?.quote || history[history.length - 1]?.quote || 0}
        change={2.45}
        changePercent={0.15}
      />
      
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Main Chart Area */}
        <div className="flex-1 flex flex-col min-w-0 border-b lg:border-b-0 lg:border-r border-border">
          <div className="h-[300px] sm:h-[400px] lg:flex-1 min-h-0">
            <TradingChart data={history} candles={candles} symbol={selectedSymbol} />
          </div>
          <div className="hidden sm:block">
            <BottomPanel activeTrades={activeTrades} tradeHistory={tradeHistory} user={user} />
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
            onTrade={(trade) => {
              setActiveTrades(prev => [trade, ...prev]);
            }}
            onTradeComplete={async (trade, result, payout) => {
              setActiveTrades(prev => prev.filter(t => t.id !== trade.id));
              const newHistoryItem = {
                ...trade,
                entry: trade.entryPrice, // Map entryPrice to entry for History component
                result,
                payout,
                exit: currentTick?.quote || trade.entryPrice,
                profit: payout - trade.amount,
                timestamp: Date.now(),
                userId: user?.uid || 'anonymous'
              };
              
              // Save to Firestore if logged in
              if (user?.uid) {
                try {
                  await addDoc(collection(db, 'trades'), newHistoryItem);
                } catch (error) {
                  handleFirestoreError(error, OperationType.CREATE, 'trades');
                }
              } else {
                // Fallback to local state if not logged in
                setTradeHistory(prev => {
                  const updated = [newHistoryItem, ...prev];
                  localStorage.setItem('tradepulse_history', JSON.stringify(updated));
                  return updated;
                });
              }

              // Show notification
              setNotification({ type: result, amount: payout });
              setTimeout(() => setNotification(null), 3000);
            }}
          />
          {/* Mobile version of BottomPanel or just show it below */}
          <div className="sm:hidden border-t border-border">
            <BottomPanel activeTrades={activeTrades} tradeHistory={tradeHistory} user={user} />
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
            <Assets balance={balance} setBalance={setBalance} />
          </div>
        );
      case 'history':
        return (
          <div className="p-8">
            <History tradeHistory={tradeHistory} />
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
              className="h-full overflow-y-auto lg:overflow-hidden"
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
