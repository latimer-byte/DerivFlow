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
import { derivApi, Tick, HistoryPoint } from './services/derivApi';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [marketCategory, setMarketCategory] = useState('Derived');
  const [selectedSymbol, setSelectedSymbol] = useState('R_100');
  const [currentTick, setCurrentTick] = useState<Tick | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [balance, setBalance] = useState(12450.00);
  const [user, setUser] = useState({
    name: 'Alex Rivera',
    id: 'CR8492-XQ',
    email: 'alex@example.com'
  });
  const [activeTrades, setActiveTrades] = useState<any[]>([]);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Initialize market data
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initMarket = async () => {
      setIsReady(false);
      try {
        console.log(`Initializing market for ${selectedSymbol}...`);
        
        // Try to get history
        const initialHistory = await derivApi.getHistory(selectedSymbol, 100);
        setHistory(initialHistory);
        setIsReady(true);

        // Subscribe to ticks
        unsubscribe = derivApi.subscribeTicks(selectedSymbol, (tick) => {
          setCurrentTick(tick);
          setHistory(prev => {
            const newHistory = [...prev, { epoch: tick.epoch, quote: tick.quote }];
            return newHistory.slice(-100);
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
              setHistory([{ epoch: Math.floor(Date.now() / 1000), quote: basePrice }]);
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
            <TradingChart data={history} symbol={selectedSymbol} />
          </div>
          <div className="hidden sm:block">
            <BottomPanel activeTrades={activeTrades} tradeHistory={tradeHistory} />
          </div>
        </div>

        {/* Right Order Panel */}
        <div className="w-full lg:w-80 bg-card flex flex-col shrink-0">
          <TradePanel 
            currentPrice={currentTick?.quote || 0} 
            balance={balance} 
            setBalance={setBalance}
            onTrade={(trade) => {
              setActiveTrades(prev => [trade, ...prev]);
            }}
          />
          {/* Mobile version of BottomPanel or just show it below */}
          <div className="sm:hidden border-t border-border">
            <BottomPanel activeTrades={activeTrades} tradeHistory={tradeHistory} />
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
      case 'settings':
        return (
          <div className="p-8">
            <Settings user={user} setUser={setUser} />
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
    <div className="flex h-screen bg-background text-text-primary font-sans selection:bg-brand/30 transition-colors duration-300 overflow-hidden">
      {/* Sidebar - Responsive */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Sidebar activeTab={activeTab} setActiveTab={(tab) => {
          setActiveTab(tab);
          setIsSidebarOpen(false);
        }} onClose={() => setIsSidebarOpen(false)} />
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
      
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header 
          user={user} 
          onMenuClick={() => setIsSidebarOpen(true)} 
          onCategorySelect={(cat) => {
            setMarketCategory(cat);
            setActiveTab('markets');
          }}
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
      </main>
    </div>
  );
}
