import React, { useState, useMemo } from 'react';
import { History as HistoryIcon, ArrowUpRight, ArrowDownLeft, Calendar, Filter as FilterIcon, Download, Search, X } from 'lucide-react';
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
  transactionHistory: any[];
}

export function History({ tradeHistory, transactionHistory }: HistoryProps) {
  const [activeTab, setActiveTab] = useState<'trades' | 'transactions'>('trades');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'buy' | 'sell' | 'deposit' | 'withdraw'>('all');
  const [isExporting, setIsExporting] = useState(false);

  const filteredHistory = useMemo(() => {
    if (activeTab === 'trades') {
      return tradeHistory.filter(trade => {
        const matchesSearch = trade.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             trade.id.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filterType === 'all' || trade.type === filterType;
        return matchesSearch && matchesFilter;
      });
    } else {
      return transactionHistory.filter(tx => {
        const matchesSearch = tx.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             (tx.id && tx.id.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesFilter = filterType === 'all' || tx.type === filterType;
        return matchesSearch && matchesFilter;
      });
    }
  }, [activeTab, tradeHistory, transactionHistory, searchQuery, filterType]);

  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      const headers = ['ID', 'Symbol', 'Type', 'Entry', 'Exit', 'Amount', 'Profit', 'Time'];
      const rows = filteredHistory.map(t => [
        t.id,
        t.symbol,
        t.type,
        t.entry,
        t.exit,
        t.amount,
        t.profit,
        format(new Date(t.timestamp), 'yyyy-MM-dd HH:mm:ss')
      ]);

      const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `trade_history_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setTimeout(() => setIsExporting(false), 1000);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <HistoryIcon className="w-6 h-6 text-brand" />
            Activity History
          </h2>
          <p className="text-text-muted text-sm mt-1">Review your past performance and account activity.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-secondary/50 p-1 rounded-xl border border-border">
            <button 
              onClick={() => { setActiveTab('trades'); setFilterType('all'); }}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all",
                activeTab === 'trades' ? "bg-card text-text-primary shadow-sm" : "text-text-muted hover:text-text-secondary"
              )}
            >
              Trades
            </button>
            <button 
              onClick={() => { setActiveTab('transactions'); setFilterType('all'); }}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all",
                activeTab === 'transactions' ? "bg-card text-text-primary shadow-sm" : "text-text-muted hover:text-text-secondary"
              )}
            >
              Finance
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative group">
              <button className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg text-xs font-bold text-text-secondary hover:text-text-primary transition-all">
                <FilterIcon className="w-3.5 h-3.5" />
                {filterType === 'all' ? 'Filter' : filterType.toUpperCase()}
              </button>
              <div className="absolute right-0 top-full mt-1 w-32 bg-card border border-border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 overflow-hidden">
                {activeTab === 'trades' ? ['all', 'buy', 'sell'].map((type) => (
                  <button 
                    key={type}
                    onClick={() => setFilterType(type as any)}
                    className={cn(
                      "w-full text-left px-4 py-2 text-[10px] font-bold uppercase transition-colors",
                      filterType === type ? "bg-brand/10 text-brand" : "hover:bg-secondary text-text-muted"
                    )}
                  >
                    {type}
                  </button>
                )) : ['all', 'deposit', 'withdraw'].map((type) => (
                  <button 
                    key={type}
                    onClick={() => setFilterType(type as any)}
                    className={cn(
                      "w-full text-left px-4 py-2 text-[10px] font-bold uppercase transition-colors",
                      filterType === type ? "bg-brand/10 text-brand" : "hover:bg-secondary text-text-muted"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            
            <button 
              onClick={handleExportCSV}
              disabled={isExporting}
              className="flex items-center gap-2 px-3 py-2 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand-hover transition-all shadow-lg shadow-brand/20 disabled:opacity-50"
            >
              {isExporting ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {isExporting ? '...' : 'CSV'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Trades" value={filteredHistory.length.toString()} />
        <StatCard 
          label="Win Rate" 
          value={`${filteredHistory.length > 0 ? ((filteredHistory.filter(t => t.profit > 0).length / filteredHistory.length) * 100).toFixed(1) : '0.0'}%`} 
        />
        <StatCard 
          label="Net Profit" 
          value={`$${filteredHistory.reduce((acc, t) => acc + t.profit, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          isPositive={filteredHistory.reduce((acc, t) => acc + t.profit, 0) >= 0}
        />
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-border bg-background/30 flex items-center justify-between">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by symbol or ID..."
              className="w-full bg-background border border-border rounded-lg py-1.5 pl-9 pr-4 text-xs text-text-primary focus:outline-none focus:border-brand transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-secondary rounded-full transition-colors"
              >
                <X className="w-3 h-3 text-text-muted" />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background/50">
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">{activeTab === 'trades' ? 'Asset' : 'Description'}</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">{activeTab === 'trades' ? 'Entry / Exit' : 'Reference'}</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Amount</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">{activeTab === 'trades' ? 'Profit/Loss' : 'Status'}</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-muted text-sm italic">
                    No activity found.
                  </td>
                </tr>
              ) : activeTab === 'trades' ? (
                filteredHistory.map((trade) => (
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
                        <span className="text-xs font-mono text-text-secondary">{(trade.entry || trade.entryPrice || 0).toFixed(4)}</span>
                        <span className="text-xs font-mono text-text-muted">{(trade.exit || trade.exitPrice || 0).toFixed(4)}</span>
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
              ) : (
                filteredHistory.map((tx) => (
                  <tr key={tx.id} className="hover:bg-secondary/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-text-primary">{tx.label}</span>
                        <span className="text-[9px] text-text-muted font-mono">#{tx.id?.slice(0, 8)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                        tx.type === 'deposit' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                      )}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono text-text-muted uppercase">TX-{tx.symbol || 'DIRECT'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-text-primary">{tx.displayAmount}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">{tx.status}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] text-text-muted">{format(new Date(tx.timestamp), 'MMM dd, HH:mm')}</span>
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
