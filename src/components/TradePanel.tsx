import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Clock, DollarSign, ChevronRight, Info, RefreshCw, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

import { AISentiment } from './AISentiment';

interface TradePanelProps {
  currentPrice: number;
  balance: number;
  setBalance: React.Dispatch<React.SetStateAction<number>>;
  symbol: string;
  history: { epoch: number; quote: number }[];
  onTrade?: (trade: any) => void;
  onTradeComplete?: (trade: any, result: 'win' | 'loss', payout: number) => void;
}

export function TradePanel({ currentPrice, balance, setBalance, symbol, history, onTrade, onTradeComplete }: TradePanelProps) {
  const [amount, setAmount] = useState('100');
  const [duration, setDuration] = useState('60');

  const getDurationLabel = (s: string) => {
    const val = parseInt(s);
    if (val < 60) return `${val}s`;
    if (val < 3600) return `${Math.floor(val / 60)}m`;
    if (val < 86400) return `${Math.floor(val / 3600)}h`;
    if (val < 604800) return `${Math.floor(val / 86400)}d`;
    if (val < 2592000) return `${Math.floor(val / 604800)}w`;
    return '1mo';
  };

  const handleTrade = (type: 'buy' | 'sell') => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;
    if (val > balance) {
      alert('Insufficient balance');
      return;
    }

    // Deduct stake immediately
    setBalance(balance - val);
    
    // Create trade object
    const tradeId = Math.random().toString(36).substring(2, 10).toUpperCase();
    const trade = {
      id: tradeId,
      type,
      amount: val,
      entryPrice: currentPrice,
      duration: parseInt(duration),
      symbol: symbol,
      timestamp: Date.now(),
      status: 'OPEN',
      lossGuardActive: true
    };

    // Emit trade immediately for instant recording
    onTrade?.(trade);
  };

  return (
    <div className="w-full h-full flex flex-col bg-card">
      {/* Order Entry */}
      <div className="p-4 border-b border-border space-y-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Order Entry</span>
          <Info className="w-3 h-3 text-text-muted cursor-help" />
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-text-muted uppercase ml-1">Investment (USD)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-background border border-border rounded-lg py-2 pl-9 pr-4 text-sm font-mono focus:outline-none focus:border-brand transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-medium text-text-muted uppercase ml-1">Duration</label>
            <div className="grid grid-cols-3 gap-1">
              {['60', '300', '3600', '86400', '604800', '2592000'].map((d) => (
                <button 
                  key={d}
                  onClick={() => setDuration(d)}
                  className={cn(
                    "py-1.5 text-[10px] font-bold rounded border transition-all whitespace-nowrap",
                    duration === d ? "bg-brand/10 border-brand text-brand" : "bg-background border-border text-text-muted hover:border-text-muted"
                  )}
                >
                  {getDurationLabel(d)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loss Guard Status (Permanent) */}
        <div className="bg-brand/5 border border-brand/20 rounded-xl p-3 flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-brand/10 rounded-lg">
              <Zap className="w-4 h-4 text-brand fill-brand" />
            </div>
            <div>
              <p className="text-[11px] font-black text-brand uppercase tracking-wider">Loss Guard Active</p>
              <p className="text-[9px] text-text-muted">50% Protection Guaranteed</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            <span className="text-[8px] font-bold text-brand uppercase">Secured</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button 
            onClick={() => handleTrade('buy')}
            className="flex flex-col items-center justify-center gap-1 py-3 bg-bullish hover:bg-bullish/90 text-background rounded-lg transition-all active:scale-[0.98]"
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs font-bold uppercase">Buy / Call</span>
          </button>
          <button 
            onClick={() => handleTrade('sell')}
            className="flex flex-col items-center justify-center gap-1 py-3 bg-bearish hover:bg-bearish/90 text-text-primary rounded-lg transition-all active:scale-[0.98]"
          >
            <TrendingDown className="w-5 h-5" />
            <span className="text-xs font-bold uppercase">Sell / Put</span>
          </button>
        </div>

        <div className="pt-2">
          <AISentiment symbol={symbol} history={history} />
        </div>
      </div>

      {/* Order Book */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 py-2 bg-background/30 border-b border-border flex items-center justify-between">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Order Book</span>
          <div className="flex gap-2">
            <div className="w-2 h-2 rounded-full bg-bullish/20" />
            <div className="w-2 h-2 rounded-full bg-bearish/20" />
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden font-mono text-[10px] flex flex-col">
          {/* Sells (Red) */}
          <div className="flex-1 flex flex-col-reverse justify-end">
            {[...Array(8)].map((_, i) => (
              <OrderBookRow key={i} side="sell" price={currentPrice + (8-i) * 0.12} amount={Math.random() * 2.5} />
            ))}
          </div>

          {/* Spread */}
          <div className="py-1 px-4 bg-secondary/10 border-y border-border flex justify-between items-center">
            <span className="font-bold text-text-primary text-xs">${currentPrice.toFixed(2)}</span>
            <span className="text-text-muted">Spread: 0.08</span>
          </div>

          {/* Buys (Green) */}
          <div className="flex-1">
            {[...Array(8)].map((_, i) => (
              <OrderBookRow key={i} side="buy" price={currentPrice - (i+1) * 0.12} amount={Math.random() * 2.5} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface OrderBookRowProps {
  side: 'buy' | 'sell';
  price: number;
  amount: number;
  key?: React.Key;
}

function OrderBookRow({ side, price, amount }: OrderBookRowProps) {
  const depth = Math.min(amount * 40, 100);
  return (
    <div className="relative flex justify-between px-4 py-0.5 group hover:bg-secondary/10 transition-colors cursor-default">
      <div 
        className={cn(
          "absolute inset-y-0 right-0 opacity-10 transition-all duration-500",
          side === 'buy' ? "bg-bullish" : "bg-bearish"
        )} 
        style={{ width: `${depth}%` }} 
      />
      <span className={cn("relative z-10 font-medium", side === 'buy' ? "text-bullish" : "text-bearish")}>
        {price.toFixed(2)}
      </span>
      <span className="relative z-10 text-text-secondary">
        {amount.toFixed(4)}
      </span>
    </div>
  );
}
