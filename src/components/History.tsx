import React from 'react';
import { History as HistoryIcon, ArrowUpRight, ArrowDownLeft, Calendar, Filter, Download, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface TradeHistoryItem {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  entry: number;
  exit: number;
  amount: number;
  profit: number;
  timestamp: number;
}

interface HistoryProps {
  tradeHistory: TradeHistoryItem[];
}

export function History({ tradeHistory }: HistoryProps) {
  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <HistoryIcon className="w-6 h-6 text-brand" />
            Trade History
          </h2>
          <p className="text-text-muted text-sm mt-1">Review your past performance and trading activity.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg text-xs font-bold text-text-secondary hover:text-text-primary transition-all">
            <Calendar className="w-3.5 h-3.5" />
            Last 30 Days
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg text-xs font-bold text-text-secondary hover:text-text-primary transition-all">
            <Filter className="w-3.5 h-3.5" />
            Filter
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand-hover transition-all shadow-lg shadow-brand/20">
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Trades" value={tradeHistory.length.toString()} />
        <StatCard 
          label="Win Rate" 
          value={`${tradeHistory.length > 0 ? ((tradeHistory.filter(t => t.profit > 0).length / tradeHistory.length) * 100).toFixed(1) : '0.0'}%`} 
        />
        <StatCard 
          label="Net Profit" 
          value={`$${tradeHistory.reduce((acc, t) => acc + t.profit, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          isPositive={tradeHistory.reduce((acc, t) => acc + t.profit, 0) >= 0}
        />
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-border bg-background/30 flex items-center justify-between">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search by symbol or ID..."
              className="w-full bg-background border border-border rounded-lg py-1.5 pl-9 pr-4 text-xs text-text-primary focus:outline-none focus:border-brand transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background/50">
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Asset</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Entry / Exit</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Amount</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Profit/Loss</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tradeHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-muted text-sm italic">
                    No trade history found. Start trading to see your results here.
                  </td>
                </tr>
              ) : (
                tradeHistory.map((trade) => (
                  <tr key={trade.id} className="hover:bg-secondary/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-text-primary">{trade.symbol}</span>
                        <span className="text-[9px] text-text-muted font-mono">#{trade.id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                        trade.type === 'buy' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                      )}>
                        {trade.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-mono text-text-secondary">{(trade.entry || 0).toFixed(4)}</span>
                        <span className="text-xs font-mono text-text-muted">{(trade.exit || 0).toFixed(4)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-text-primary">${(trade.amount || 0).toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-xs font-bold font-mono",
                        (trade.profit || 0) >= 0 ? "text-emerald-500" : "text-rose-500"
                      )}>
                        {(trade.profit || 0) >= 0 ? '+' : ''}${Math.abs(trade.profit || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] text-text-muted">{format(new Date(trade.timestamp), 'MMM dd, HH:mm')}</span>
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

function StatCard({ label, value, isPositive }: { label: string, value: string, isPositive?: boolean }) {
  return (
    <div className="bg-card border border-border p-6 rounded-2xl shadow-lg">
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest block mb-1">{label}</span>
      <span className={cn(
        "text-2xl font-bold font-mono",
        isPositive === true ? "text-emerald-500" : isPositive === false ? "text-rose-500" : "text-text-primary"
      )}>
        {value}
      </span>
    </div>
  );
}
