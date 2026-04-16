import React from 'react';
import { Award, TrendingUp, Star, Crown, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';

const leaders = [
  { name: 'AlphaTrader_99', profit: 45230.50, winRate: 78.4, rank: 1, avatar: '🦁' },
  { name: 'MarketWizard', profit: 38120.20, winRate: 72.1, rank: 2, avatar: '🧙' },
  { name: 'BullRun_Expert', profit: 31450.80, winRate: 69.5, rank: 3, avatar: '🐂' },
  { name: 'CryptoQueen', profit: 28900.00, winRate: 65.2, rank: 4, avatar: '👑' },
  { name: 'ScalperPro', profit: 24500.15, winRate: 82.1, rank: 5, avatar: '⚡' },
  { name: 'TrendFollower', profit: 21200.40, winRate: 61.8, rank: 6, avatar: '🌊' },
  { name: 'VibeTrader', profit: 18900.60, winRate: 58.4, rank: 7, avatar: '🌈' },
  { name: 'DerivMaster', profit: 15400.25, winRate: 55.9, rank: 8, avatar: '🎯' },
];

export function Leaderboard() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-5xl font-black italic uppercase tracking-tighter text-text-primary mb-2">Global Leaderboard</h1>
        <p className="text-text-muted text-sm font-medium uppercase tracking-[0.3em]">Top Performers of the Week</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {leaders.slice(0, 3).map((leader) => (
          <div 
            key={leader.name}
            className={cn(
              "relative bg-card border border-border rounded-2xl p-6 text-center transition-all hover:scale-[1.02]",
              leader.rank === 1 ? "ring-2 ring-brand/50 bg-brand/5 scale-110 z-10" : ""
            )}
          >
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              {leader.rank === 1 && <Crown className="w-8 h-8 text-amber-400 fill-amber-400" />}
              {leader.rank === 2 && <Medal className="w-8 h-8 text-slate-300 fill-slate-300" />}
              {leader.rank === 3 && <Medal className="w-8 h-8 text-amber-700 fill-amber-700" />}
            </div>
            
            <div className="text-4xl mb-4">{leader.avatar}</div>
            <h3 className="text-lg font-black italic uppercase text-text-primary mb-1">{leader.name}</h3>
            <p className="text-xs font-bold text-text-muted uppercase mb-4">Rank #{leader.rank}</p>
            
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase text-text-muted">
                <span>Profit</span>
                <span className="text-bullish">${leader.profit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold uppercase text-text-muted">
                <span>Win Rate</span>
                <span className="text-text-primary">{leader.winRate}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-background/30">
              <th className="px-6 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest">Rank</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest">Trader</th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-text-muted uppercase tracking-widest">Win Rate</th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-text-muted uppercase tracking-widest">Total Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {leaders.map((leader) => (
              <tr key={leader.name} className="hover:bg-secondary/20 transition-colors group">
                <td className="px-6 py-4">
                  <span className="text-xs font-black italic text-text-muted group-hover:text-text-primary">#{leader.rank}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{leader.avatar}</span>
                    <span className="text-xs font-bold text-text-primary uppercase">{leader.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-xs font-mono font-bold text-text-secondary">{leader.winRate}%</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-xs font-mono font-bold text-bullish">${leader.profit.toLocaleString()}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
