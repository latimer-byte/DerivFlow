import React, { useMemo, useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Target, Zap, Award, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

interface AnalyticsProps {
  tradeHistory: any[];
}

export function Analytics({ tradeHistory }: AnalyticsProps) {
  const stats = useMemo(() => {
    if (tradeHistory.length === 0) return null;

    const totalTrades = tradeHistory.length;
    const wins = tradeHistory.filter(t => t.result === 'win').length;
    const losses = totalTrades - wins;
    const winRate = (wins / totalTrades) * 100;
    
    const totalProfit = tradeHistory.reduce((acc, t) => acc + (t.profit || 0), 0);
    const avgProfit = totalProfit / totalTrades;
    
    const winningTrades = tradeHistory.filter(t => t.result === 'win');
    const losingTrades = tradeHistory.filter(t => t.result === 'loss');
    
    const avgWin = winningTrades.length > 0 
      ? winningTrades.reduce((acc, t) => acc + t.profit, 0) / winningTrades.length 
      : 0;
    const avgLoss = losingTrades.length > 0 
      ? Math.abs(losingTrades.reduce((acc, t) => acc + t.profit, 0)) / losingTrades.length 
      : 0;
      
    const profitFactor = avgLoss > 0 ? (avgWin * wins) / (avgLoss * losses) : wins > 0 ? 99 : 0;

    return {
      totalTrades,
      wins,
      losses,
      winRate,
      totalProfit,
      avgProfit,
      avgWin,
      avgLoss,
      profitFactor
    };
  }, [tradeHistory]);

  const [isOptimizing, setIsOptimizing] = useState(false);

  const handleOptimize = async () => {
    setIsOptimizing(true);
    // Simulate AI optimization process
    await new Promise(resolve => setTimeout(resolve, 3000));
    setIsOptimizing(false);
    alert("Strategy optimized! AI has updated your risk parameters for better performance.");
  };

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-6 border border-border">
          <BarChart3 className="w-8 h-8 text-text-muted" />
        </div>
        <h2 className="text-xl font-bold text-text-primary mb-2 uppercase tracking-widest">No Data Available</h2>
        <p className="text-text-muted max-w-sm text-sm">Start trading to unlock advanced performance analytics and AI-driven insights.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-text-primary mb-1">Performance Analytics</h1>
          <p className="text-text-muted text-sm font-medium uppercase tracking-widest">Advanced Trading Metrics & Insights</p>
        </div>
        <div className="flex items-center gap-3 bg-card border border-border p-3 rounded-xl">
          <Award className="w-5 h-5 text-brand" />
          <div>
            <p className="text-[10px] font-bold text-text-muted uppercase">Trader Rank</p>
            <p className="text-sm font-black text-text-primary uppercase italic">Elite Strategist</p>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="Total Profit" 
          value={`$${stats.totalProfit.toFixed(2)}`} 
          subValue="Net Earnings"
          icon={<TrendingUp className={cn("w-5 h-5", stats.totalProfit >= 0 ? "text-bullish" : "text-bearish")} />}
          trend={stats.totalProfit >= 0 ? 'up' : 'down'}
        />
        <StatCard 
          label="Win Rate" 
          value={`${stats.winRate.toFixed(1)}%`} 
          subValue={`${stats.wins} Wins / ${stats.losses} Losses`}
          icon={<Target className="w-5 h-5 text-brand" />}
          progress={stats.winRate}
        />
        <StatCard 
          label="Profit Factor" 
          value={stats.profitFactor.toFixed(2)} 
          subValue="Risk/Reward Ratio"
          icon={<Zap className="w-5 h-5 text-amber-500" />}
          highlight={stats.profitFactor > 1.5}
        />
        <StatCard 
          label="Avg. Trade" 
          value={`$${stats.avgProfit.toFixed(2)}`} 
          subValue="Per Execution"
          icon={<BarChart3 className="w-5 h-5 text-blue-500" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Detailed Breakdown */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest mb-6 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand" />
            Execution Breakdown
          </h3>
          
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-[10px] font-bold text-text-muted uppercase mb-1">Average Win</p>
                <p className="text-2xl font-black text-bullish italic tracking-tight">${stats.avgWin.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-text-muted uppercase mb-1">Average Loss</p>
                <p className="text-2xl font-black text-bearish italic tracking-tight">-${stats.avgLoss.toFixed(2)}</p>
              </div>
            </div>

            <div className="pt-6 border-t border-border">
              <p className="text-[10px] font-bold text-text-muted uppercase mb-4">Trade Distribution</p>
              <div className="h-4 w-full bg-secondary rounded-full overflow-hidden flex">
                <div 
                  className="h-full bg-bullish transition-all duration-1000" 
                  style={{ width: `${stats.winRate}%` }}
                />
                <div 
                  className="h-full bg-bearish transition-all duration-1000" 
                  style={{ width: `${100 - stats.winRate}%` }}
                />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[10px] font-bold text-bullish uppercase">{stats.wins} Wins</span>
                <span className="text-[10px] font-bold text-bearish uppercase">{stats.losses} Losses</span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Insights Card */}
        <div className="bg-brand/5 border border-brand/20 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-brand" />
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest">AI Strategy Insight</h3>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed italic">
              {stats.winRate > 60 
                ? "Your high win rate suggests a strong grasp of market momentum. Consider increasing your stake size by 15% to capitalize on this edge."
                : stats.profitFactor > 1.2
                ? "Your risk management is solid despite a lower win rate. Focus on 'Loss Guard' optimization to further protect your capital."
                : "Current data suggests a high-frequency approach. Try extending your trade duration to 5 minutes to filter out market noise."}
            </p>
          </div>
          <div className="mt-6 pt-6 border-t border-brand/10">
            <button 
              onClick={handleOptimize}
              disabled={isOptimizing}
              className="w-full py-3 bg-brand text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-brand/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isOptimizing ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Optimizing...
                </>
              ) : (
                'Optimize Strategy'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, subValue, icon, trend, progress, highlight }: any) {
  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className={cn(
        "bg-card border border-border rounded-2xl p-5 transition-all",
        highlight && "ring-1 ring-brand/50 bg-brand/5"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 bg-secondary/50 rounded-xl border border-border">
          {icon}
        </div>
        {trend && (
          <div className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase",
            trend === 'up' ? "bg-bullish/10 text-bullish" : "bg-bearish/10 text-bearish"
          )}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend === 'up' ? 'Profit' : 'Loss'}
          </div>
        )}
      </div>
      <div>
        <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-black text-text-primary italic tracking-tighter mb-1">{value}</p>
        <p className="text-[10px] text-text-muted font-medium uppercase">{subValue}</p>
      </div>
      {progress !== undefined && (
        <div className="mt-4 h-1 w-full bg-secondary rounded-full overflow-hidden">
          <div 
            className="h-full bg-brand transition-all duration-1000" 
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </motion.div>
  );
}
