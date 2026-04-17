import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { History as HistoryIcon, List, Terminal, Activity, PieChart as PieChartIcon, TrendingUp, TrendingDown, Wallet, Filter, Calendar } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

interface BottomPanelProps {
  activeTrades: any[];
  tradeHistory: any[];
  user: {
    id: string;
  };
  currentPrice?: number;
}

export function BottomPanel({ activeTrades, tradeHistory, user, currentPrice }: BottomPanelProps) {
  const [activeTab, setActiveTab] = React.useState<'active' | 'history' | 'logs'>('active');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'wins' | 'losses' | 'deposits' | 'withdrawals'>('all');

  const stats = useMemo(() => {
    const wins = tradeHistory.filter(t => t.result === 'win').length;
    const losses = tradeHistory.filter(t => t.result === 'loss').length;
    const totalTrades = wins + losses;
    
    const deposits = 5000; // Mock data
    const withdrawals = 1200; // Mock data
    const totalWins = tradeHistory.filter(t => t.result === 'win').reduce((acc, t) => acc + (t.payout || 0), 0);
    const totalLosses = tradeHistory.filter(t => t.result === 'loss').reduce((acc, t) => acc + (t.amount || 0), 0);

    return {
      wins,
      losses,
      winRatio: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
      deposits,
      withdrawals,
      totalWins,
      totalLosses,
      netProfit: totalWins - totalLosses
    };
  }, [tradeHistory]);

  const pieData = [
    { name: 'Wins', value: stats.wins, color: 'var(--color-bullish)' },
    { name: 'Losses', value: stats.losses, color: 'var(--color-bearish)' },
  ];

  const filteredHistory = useMemo(() => {
    const combined = [...tradeHistory].sort((a, b) => b.timestamp - a.timestamp);

    switch (historyFilter) {
      case 'wins': return combined.filter(t => t.result === 'win');
      case 'losses': return combined.filter(t => t.result === 'loss');
      default: return combined;
    }
  }, [tradeHistory, historyFilter]);

  return (
    <div className="h-80 sm:h-64 bg-card border-t border-border flex flex-col">
      <div className="flex items-center bg-background/50 border-b border-border px-2 sm:px-4 overflow-x-auto no-scrollbar">
        <TabButton 
          active={activeTab === 'active'} 
          onClick={() => setActiveTab('active')}
          icon={<Activity className="w-3.5 h-3.5" />}
          label="Active"
          count={activeTrades.length}
        />
        <TabButton 
          active={activeTab === 'history'} 
          onClick={() => setActiveTab('history')}
          icon={<HistoryIcon className="w-3.5 h-3.5" />}
          label="History & Stats"
          count={tradeHistory.length}
        />
        <TabButton 
          active={activeTab === 'logs'} 
          onClick={() => setActiveTab('logs')}
          icon={<Terminal className="w-3.5 h-3.5" />}
          label="Logs"
        />
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar font-mono text-[11px]">
        {activeTab === 'active' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead className="sticky top-0 bg-card text-text-muted uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="px-4 py-2 font-medium">Asset</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Entry</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Duration</th>
                  <th className="px-4 py-2 font-medium">P/L</th>
                </tr>
              </thead>
              <tbody>
                {activeTrades.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-muted italic">
                      No active positions found.
                    </td>
                  </tr>
                ) : (
                  activeTrades.map((trade) => (
                    <tr key={trade.id} className="border-b border-border/50 hover:bg-secondary/10 transition-colors">
                      <td className="px-4 py-2 font-bold text-text-primary">{trade.symbol}</td>
                      <td className="px-4 py-2">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                          trade.type === 'buy' ? "bg-bullish/10 text-bullish" : "bg-bearish/10 text-bearish"
                        )}>
                          {trade.type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-text-secondary">${trade.entryPrice.toLocaleString()}</td>
                      <td className="px-4 py-2 text-text-secondary">${trade.amount.toLocaleString()}</td>
                      <td className="px-4 py-2 text-text-secondary">{trade.duration}s</td>
                      <td className={cn(
                        "px-4 py-2 font-bold",
                        currentPrice && (
                          (trade.type === 'buy' && currentPrice > trade.entryPrice) ||
                          (trade.type === 'sell' && currentPrice < trade.entryPrice)
                        ) ? "text-bullish" : "text-bearish"
                      )}>
                        {currentPrice ? (
                          ((trade.type === 'buy' && currentPrice > trade.entryPrice) ||
                           (trade.type === 'sell' && currentPrice < trade.entryPrice)) ? 
                           `+$${(trade.amount * 0.95).toFixed(2)}` : 
                           `-$${(trade.amount * 0.5).toFixed(2)}`
                        ) : '...'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="flex flex-col lg:flex-row h-full">
            {/* Stats Sidebar */}
            <div className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-border p-4 space-y-4 shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <PieChartIcon className="w-4 h-4 text-brand" />
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Performance</span>
              </div>
              
              <div className="h-32 w-full">
                {stats.wins + stats.losses > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        innerRadius={35}
                        outerRadius={50}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', fontSize: '10px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center border border-dashed border-border rounded-lg text-[10px] text-text-muted">
                    No Trade Data
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <StatBox label="Win Ratio" value={`${stats.winRatio.toFixed(1)}%`} color="text-brand" />
                <StatBox label="Net Profit" value={`$${stats.netProfit.toFixed(2)}`} color={stats.netProfit >= 0 ? "text-bullish" : "text-bearish"} />
              </div>
            </div>

            {/* History Table & Filters */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="p-2 border-b border-border flex items-center gap-2 overflow-x-auto no-scrollbar">
                <Filter className="w-3 h-3 text-text-muted ml-2 shrink-0" />
                <FilterBtn active={historyFilter === 'all'} onClick={() => setHistoryFilter('all')} label="All" />
                <FilterBtn active={historyFilter === 'wins'} onClick={() => setHistoryFilter('wins')} label="Wins" />
                <FilterBtn active={historyFilter === 'losses'} onClick={() => setHistoryFilter('losses')} label="Losses" />
              </div>

              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead className="sticky top-0 bg-card text-text-muted uppercase tracking-wider border-b border-border">
                    <tr>
                      <th className="px-4 py-2 font-medium">Time</th>
                      <th className="px-4 py-2 font-medium">Type</th>
                      <th className="px-4 py-2 font-medium">Asset</th>
                      <th className="px-4 py-2 font-medium">Amount</th>
                      <th className="px-4 py-2 font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-text-muted italic">
                          No records found for this filter.
                        </td>
                      </tr>
                    ) : (
                      filteredHistory.map((item, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-secondary/10 transition-colors">
                          <td className="px-4 py-2 text-text-muted">{new Date(item.timestamp).toLocaleTimeString()}</td>
                          <td className="px-4 py-2">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                              item.type === 'buy' || item.type === 'deposit' ? "bg-bullish/10 text-bullish" : "bg-bearish/10 text-bearish"
                            )}>
                              {item.type}
                            </span>
                          </td>
                          <td className="px-4 py-2 font-bold text-text-primary">{item.symbol}</td>
                          <td className="px-4 py-2 text-text-secondary">${item.amount.toLocaleString()}</td>
                          <td className="px-4 py-2">
                            <span className={cn(
                              "font-bold",
                              item.result === 'win' || item.result === 'success' ? "text-bullish" : "text-bearish"
                            )}>
                              {item.result === 'win' ? `+$${(item.payout || 0).toFixed(2)}` : 
                               item.result === 'loss' ? `-$${item.amount.toFixed(2)}` : 
                               item.result.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="p-4 space-y-1">
            <LogEntry type="info" message="WebSocket connection established with Deriv API" />
            <LogEntry type="success" message={`Authentication successful. Account: ${user.id}`} />
            <LogEntry type="info" message="Subscribed to R_100 real-time feed" />
            <LogEntry type="warning" message="High volatility detected in Volatility 100 Index" />
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, count }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 sm:px-4 py-2.5 text-[10px] sm:text-[11px] font-bold transition-all border-b-2 shrink-0 whitespace-nowrap",
        active 
          ? "text-brand border-brand bg-brand/5" 
          : "text-text-muted border-transparent hover:text-text-secondary hover:bg-secondary/10"
      )}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && (
        <span className={cn(
          "ml-1 px-1 rounded text-[9px]",
          active ? "bg-brand/20 text-brand" : "bg-border text-text-muted"
        )}>
          {count}
        </span>
      )}
    </button>
  );
}

function FilterBtn({ active, onClick, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-2 py-1 rounded text-[9px] font-bold transition-all shrink-0 whitespace-nowrap",
        active ? "bg-brand text-white" : "bg-background border border-border text-text-muted hover:text-text-primary"
      )}
    >
      {label}
    </button>
  );
}

function StatBox({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div className="bg-background/50 border border-border p-2 rounded-lg">
      <div className="text-[8px] text-text-muted uppercase tracking-widest mb-1">{label}</div>
      <div className={cn("text-xs font-bold font-mono", color)}>{value}</div>
    </div>
  );
}

function LogEntry({ type, message }: { type: 'info' | 'success' | 'warning' | 'error', message: string }) {
  const colors = {
    info: 'text-brand',
    success: 'text-bullish',
    warning: 'text-amber-500',
    error: 'text-bearish'
  };

  return (
    <div className="flex gap-3 leading-relaxed">
      <span className="text-text-muted">[{new Date().toLocaleTimeString()}]</span>
      <span className={cn("font-bold uppercase w-16", colors[type])}>{type}</span>
      <span className="text-text-secondary">{message}</span>
    </div>
  );
}
