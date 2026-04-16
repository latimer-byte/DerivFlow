import React, { useEffect, useState, useRef } from 'react';
import { TrendingUp, TrendingDown, Activity, Globe, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarketStatsProps {
  symbol: string;
  currentPrice: number;
  change: number;
  changePercent: number;
}

const getMarketName = (symbol: string) => {
  const names: Record<string, string> = {
    'R_100': 'Volatility 100 Index',
    'R_50': 'Volatility 50 Index',
    'R_25': 'Volatility 25 Index',
    'R_10': 'Volatility 10 Index',
    'frxEURUSD': 'EUR/USD',
    'frxGBPUSD': 'GBP/USD',
    'frxUSDJPY': 'USD/JPY',
    'cryBTCUSD': 'Bitcoin/USD',
    'cryETHUSD': 'Ethereum/USD',
    'crySOLUSD': 'Solana/USD',
    'frxXAUUSD': 'Gold/USD',
    'frxXAGUSD': 'Silver/USD',
    'frxAUDUSD': 'AUD/USD',
    'frxUSDCAD': 'USD/CAD',
  };
  return names[symbol] || symbol;
};

export function MarketStats({ symbol, currentPrice, change, changePercent }: MarketStatsProps) {
  const [tickDirection, setTickDirection] = useState<'up' | 'down' | null>(null);
  const prevPrice = useRef(currentPrice);

  useEffect(() => {
    if (currentPrice > prevPrice.current) {
      setTickDirection('up');
    } else if (currentPrice < prevPrice.current) {
      setTickDirection('down');
    }
    
    const timer = setTimeout(() => setTickDirection(null), 500);
    prevPrice.current = currentPrice;
    
    return () => clearTimeout(timer);
  }, [currentPrice]);

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-card border-b border-border gap-4 sm:gap-0">
      <div className="flex items-center gap-4 sm:gap-8 w-full sm:w-auto">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] sm:text-[10px] font-bold text-text-muted uppercase tracking-widest">{getMarketName(symbol)}</span>
            <span className="px-1.5 py-0.5 bg-bullish/10 text-bullish text-[8px] sm:text-[9px] font-bold rounded">OPEN</span>
          </div>
          <div className={cn(
            "text-2xl sm:text-3xl font-bold font-price tracking-tighter transition-colors duration-300",
            tickDirection === 'up' ? "text-bullish" : tickDirection === 'down' ? "text-bearish" : "text-text-primary"
          )}>
            ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="hidden sm:block h-10 w-[1px] bg-border" />

        <div className="flex flex-wrap gap-4 sm:gap-8">
          <StatItem 
            label="24h Change" 
            value={`${change > 0 ? '+' : ''}${change.toFixed(2)}`} 
            subValue={`${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%`}
            trend={change >= 0 ? 'up' : 'down'}
          />
          <StatItem 
            label="24h High" 
            value={`$${(currentPrice * 1.02).toFixed(2)}`} 
            className="hidden xs:flex"
          />
          <StatItem 
            label="24h Low" 
            value={`$${(currentPrice * 0.98).toFixed(2)}`} 
            className="hidden xs:flex"
          />
        </div>
      </div>

      <div className="hidden lg:flex items-center gap-6">
        <div className="flex flex-col items-end">
          <div className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1">Market Sentiment</div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-bearish uppercase">42%</span>
            <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden flex">
              <div className="h-full bg-bullish" style={{ width: '58%' }} />
              <div className="h-full bg-bearish" style={{ width: '42%' }} />
            </div>
            <span className="text-[10px] font-bold text-bullish uppercase">58%</span>
          </div>
        </div>

        <div className="h-10 w-[1px] bg-border" />

        <div className="flex flex-col items-end">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Market Status</div>
          <div className="flex items-center gap-2 text-xs font-medium text-bullish">
            <div className="w-1.5 h-1.5 rounded-full bg-bullish animate-pulse" />
            Live Feed
          </div>
        </div>
      </div>
    </div>
  );
}

function StatItem({ label, value, subValue, trend, className }: { label: string, value: string, subValue?: string, trend?: 'up' | 'down', className?: string }) {
  return (
    <div className={cn("flex flex-col", className)}>
      <span className="text-[9px] sm:text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-xs sm:text-sm font-bold font-price text-text-primary">{value}</span>
        {subValue && (
          <span className={cn(
            "text-[9px] sm:text-[10px] font-bold",
            trend === 'up' ? "text-bullish" : "text-bearish"
          )}>
            {subValue}
          </span>
        )}
      </div>
    </div>
  );
}
