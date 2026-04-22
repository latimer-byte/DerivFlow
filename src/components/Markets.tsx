import React from 'react';
import { TrendingUp, TrendingDown, Star, Search, Filter } from 'lucide-react';
import { cn } from '../lib/utils';

const allMarkets = [
  // Derived Indices
  { symbol: 'R_100', name: 'Volatility 100 Index', price: 1245.20, change: 2.4, category: 'Derived', volatility: 'High' },
  { symbol: 'R_75', name: 'Volatility 75 Index', price: 850.40, change: 1.8, category: 'Derived', volatility: 'High' },
  { symbol: 'R_50', name: 'Volatility 50 Index', price: 450.15, change: -1.2, category: 'Derived', volatility: 'Medium' },
  { symbol: 'R_25', name: 'Volatility 25 Index', price: 210.45, change: 0.8, category: 'Derived', volatility: 'Low' },
  { symbol: 'R_10', name: 'Volatility 10 Index', price: 95.30, change: -0.5, category: 'Derived', volatility: 'Low' },
  { symbol: '1HZ100V', name: 'Volatility 100 (1s) Index', price: 1245.20, change: 2.4, category: 'Derived', volatility: 'High' },
  { symbol: '1HZ75V', name: 'Volatility 75 (1s) Index', price: 850.40, change: 1.8, category: 'Derived', volatility: 'High' },
  { symbol: 'JD10', name: 'Jump 10 Index', price: 1050.20, change: 0.4, category: 'Derived', volatility: 'High' },
  { symbol: 'JD25', name: 'Jump 25 Index', price: 2100.45, change: -0.8, category: 'Derived', volatility: 'High' },
  
  // Forex
  { symbol: 'frxEURUSD', name: 'Euro / US Dollar', price: 1.0842, change: 0.05, category: 'Forex', volatility: 'Medium' },
  { symbol: 'frxGBPUSD', name: 'British Pound / US Dollar', price: 1.2650, change: -0.12, category: 'Forex', volatility: 'Medium' },
  { symbol: 'frxUSDJPY', name: 'US Dollar / Japanese Yen', price: 151.20, change: 0.35, category: 'Forex', volatility: 'Medium' },
  { symbol: 'frxAUDUSD', name: 'Australian Dollar / US Dollar', price: 0.6540, change: 0.15, category: 'Forex', volatility: 'Medium' },
  { symbol: 'frxUSDCAD', name: 'US Dollar / Canadian Dollar', price: 1.3520, change: -0.10, category: 'Forex', volatility: 'Medium' },
  { symbol: 'frxUSDCHF', name: 'US Dollar / Swiss Franc', price: 0.9050, change: 0.20, category: 'Forex', volatility: 'Medium' },
  { symbol: 'frxEURGBP', name: 'Euro / British Pound', price: 0.8570, change: -0.05, category: 'Forex', volatility: 'Low' },
  
  // Crypto
  { symbol: 'cryBTCUSD', name: 'Bitcoin / US Dollar', price: 64200.50, change: 4.8, category: 'Crypto', volatility: 'Extreme' },
  { symbol: 'cryETHUSD', name: 'Ethereum / US Dollar', price: 3450.20, change: 3.2, category: 'Crypto', volatility: 'High' },
  { symbol: 'crySOLUSD', name: 'Solana / US Dollar', price: 145.60, change: 7.4, category: 'Crypto', volatility: 'Extreme' },
  { symbol: 'cryXRPUSD', name: 'XRP / US Dollar', price: 0.62, change: 1.5, category: 'Crypto', volatility: 'High' },
  
  // Metals
  { symbol: 'frxXAUUSD', name: 'Gold / US Dollar', price: 2350.40, change: 0.25, category: 'Metals', volatility: 'Medium' },
  { symbol: 'frxXAGUSD', name: 'Silver / US Dollar', price: 28.15, change: -0.8, category: 'Metals', volatility: 'High' },
  { symbol: 'frxXPDUSD', name: 'Palladium / US Dollar', price: 1050.20, change: -1.4, category: 'Metals', volatility: 'High' },
  { symbol: 'frxXPTUSD', name: 'Platinum / US Dollar', price: 980.45, change: 0.6, category: 'Metals', volatility: 'Medium' },
  { symbol: 'XCU/USD', name: 'Copper / US Dollar', price: 4.25, change: 0.4, category: 'Metals', volatility: 'Medium' },
  { symbol: 'XNI/USD', name: 'Nickel / US Dollar', price: 17500.00, change: -0.9, category: 'Metals', volatility: 'High' },
  { symbol: 'XPB/USD', name: 'Lead / US Dollar', price: 2100.00, change: -0.2, category: 'Metals', volatility: 'Medium' },
  { symbol: 'XZN/USD', name: 'Zinc / US Dollar', price: 2500.00, change: 0.5, category: 'Metals', volatility: 'Medium' },
  { symbol: 'XAL/USD', name: 'Aluminum / US Dollar', price: 2300.00, change: 0.3, category: 'Metals', volatility: 'Medium' },

  // Commodities
  { symbol: 'WTI', name: 'WTI Oil', price: 85.30, change: 1.2, category: 'Commodities', volatility: 'High' },
  { symbol: 'BRENT', name: 'Brent Oil', price: 89.45, change: 1.1, category: 'Commodities', volatility: 'High' },
  
  // Indices
  { symbol: 'SP500', name: 'S&P 500', price: 5200.50, change: 1.2, category: 'Indices', volatility: 'Medium' },
  { symbol: 'NAS100', name: 'Nasdaq 100', price: 18200.30, change: 1.5, category: 'Indices', volatility: 'High' },
  { symbol: 'DJI', name: 'Dow Jones', price: 39100.20, change: 0.8, category: 'Indices', volatility: 'Medium' },
  { symbol: 'FTSE 100', name: 'FTSE 100', price: 7950.40, change: 0.4, category: 'Indices', volatility: 'Medium' },
  { symbol: 'DAX 40', name: 'DAX 40', price: 18100.20, change: 0.6, category: 'Indices', volatility: 'Medium' },
];

interface MarketsProps {
  onSelect?: (symbol: string) => void;
  initialCategory?: string;
  balance?: number;
}

export function Markets({ onSelect, initialCategory = 'Derived', balance }: MarketsProps) {
  const [selectedCategory, setSelectedCategory] = React.useState(initialCategory);
  const [searchQuery, setSearchQuery] = React.useState('');

  React.useEffect(() => {
    setSelectedCategory(initialCategory);
  }, [initialCategory]);

  const filteredMarkets = React.useMemo(() => {
    return allMarkets.filter(market => {
      const matchesCategory = selectedCategory === 'All' || market.category === selectedCategory;
      const matchesSearch = market.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            market.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-2">Market Explorer</h2>
          <p className="text-sm md:text-base text-text-secondary">Discover and analyze over 100+ assets in real-time.</p>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search assets..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-card border border-border rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all w-full sm:w-64 text-text-primary"
            />
          </div>
          <button className="p-2 bg-card border border-border rounded-xl hover:bg-secondary transition-colors shrink-0">
            <Filter className="w-5 h-5 text-text-muted" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 md:gap-4">
        {['All', 'Derived', 'Forex', 'Indices', 'Crypto', 'Metals', 'Commodities'].map((cat) => (
          <button 
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              "px-4 md:px-6 py-2 md:py-3 border rounded-xl md:rounded-2xl font-semibold text-xs md:text-sm transition-all whitespace-nowrap",
              selectedCategory === cat 
                ? "bg-brand text-white border-brand shadow-lg shadow-brand/20" 
                : "bg-card border-border text-text-secondary hover:bg-brand/10 hover:border-brand/30 hover:text-brand"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl md:rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px] md:min-w-0">
            <thead>
              <tr className="bg-background/50 border-b border-border">
                <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-bold text-text-muted uppercase tracking-wider">Asset</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-bold text-text-muted uppercase tracking-wider">Price</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-bold text-text-muted uppercase tracking-wider">24h Change</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-bold text-text-muted uppercase tracking-wider hidden sm:table-cell">Volatility</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-bold text-text-muted uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredMarkets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-text-muted italic">
                    No assets found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredMarkets.map((market) => (
                  <tr key={market.symbol} className="hover:bg-secondary/20 transition-colors group">
                    <td className="px-4 md:px-6 py-3 md:py-4">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-background flex items-center justify-center group-hover:bg-brand/10 transition-colors">
                          <Star className="w-3 h-3 md:w-4 md:h-4 text-text-muted group-hover:text-brand transition-colors" />
                        </div>
                        <div>
                          <div className="font-bold text-text-primary text-xs md:text-sm">{market.symbol}</div>
                          <div className="text-[10px] md:text-xs text-text-secondary">{market.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 font-mono font-bold text-text-primary text-xs md:text-sm">
                      ${market.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4">
                      <div className={cn(
                        "flex items-center gap-1 font-bold text-xs md:text-sm",
                        market.change >= 0 ? "text-bullish" : "text-bearish"
                      )}>
                        {market.change >= 0 ? <TrendingUp className="w-3 h-3 md:w-4 md:h-4" /> : <TrendingDown className="w-3 h-3 md:w-4 md:h-4" />}
                        {market.change >= 0 ? '+' : ''}{market.change}%
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 hidden sm:table-cell">
                      <span className={cn(
                        "text-[9px] md:text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider",
                        market.volatility === 'Extreme' ? "bg-bearish/10 text-bearish" :
                        market.volatility === 'High' ? "bg-amber-500/10 text-amber-500" :
                        "bg-bullish/10 text-bullish"
                      )}>
                        {market.volatility}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                      <button 
                        onClick={() => onSelect?.(market.symbol)}
                        className="px-3 md:px-4 py-1.5 md:py-2 bg-brand text-white rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold hover:bg-brand-hover transition-all shadow-lg shadow-brand/20"
                      >
                        Trade
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
