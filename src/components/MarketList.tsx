import React from 'react';
import { TrendingUp, TrendingDown, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const markets = [
  { symbol: 'R_100', name: 'Volatility 100 Index', price: 1245.20, change: 2.4, category: 'Derived' },
  { symbol: 'R_50', name: 'Volatility 50 Index', price: 450.15, change: -1.2, category: 'Derived' },
  { symbol: 'frxEURUSD', name: 'EUR/USD', price: 1.0842, change: 0.05, category: 'Forex' },
  { symbol: 'frxGBPUSD', name: 'GBP/USD', price: 1.2650, change: -0.12, category: 'Forex' },
  { symbol: 'cryBTCUSD', name: 'Bitcoin/USD', price: 64200.50, change: 4.8, category: 'Crypto' },
  { symbol: 'cryETHUSD', name: 'Ethereum/USD', price: 3450.20, change: 3.2, category: 'Crypto' },
];

interface MarketListProps {
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
}

export function MarketList({ selectedSymbol, onSelect }: MarketListProps) {
  return (
    <div className="bg-card border border-border rounded-3xl p-6 shadow-xl overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-foreground">Popular Markets</h3>
        <button className="text-xs text-brand font-bold hover:underline">View All</button>
      </div>

      <div className="space-y-2">
        {markets.map((market) => (
          <div 
            key={market.symbol}
            onClick={() => onSelect(market.symbol)}
            className={cn(
              "flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border border-transparent",
              selectedSymbol === market.symbol 
                ? "bg-brand/10 border-brand/30" 
                : "hover:bg-secondary/50"
            )}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <Star className={cn("w-4 h-4", selectedSymbol === market.symbol ? "text-brand fill-brand" : "text-muted-foreground")} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">{market.symbol}</h4>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{market.category}</p>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-sm font-bold text-foreground">${market.price.toLocaleString()}</p>
              <div className={cn(
                "flex items-center justify-end gap-1 text-[10px] font-bold",
                market.change >= 0 ? "text-emerald-500" : "text-rose-500"
              )}>
                {market.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {market.change >= 0 ? '+' : ''}{market.change}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
