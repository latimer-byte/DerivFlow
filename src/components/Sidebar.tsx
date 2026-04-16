import React from 'react';
import { LayoutDashboard, BarChart3, Wallet, Settings, History, Zap, MessageSquareCode, Star, TrendingUp, TrendingDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  { icon: BarChart3, label: 'Markets', id: 'markets' },
  { icon: Zap, label: 'Analytics', id: 'analytics' },
  { icon: Wallet, label: 'Assets', id: 'assets' },
  { icon: History, label: 'History', id: 'history' },
  { icon: Star, label: 'Leaderboard', id: 'leaderboard' },
  { icon: MessageSquareCode, label: 'Vibe Logs', id: 'vibe-logs' },
  { icon: Settings, label: 'Settings', id: 'settings' },
];

const watchlist = [
  { symbol: 'R_100', name: 'Vol 100', price: 1245.20, change: +2.45 },
  { symbol: 'R_50', name: 'Vol 50', price: 842.10, change: -1.12 },
  { symbol: 'R_25', name: 'Vol 25', price: 412.50, change: +0.85 },
  { symbol: 'R_10', name: 'Vol 10', price: 124.80, change: -0.42 },
];

interface SidebarProps {
  user: {
    name: string;
    id: string;
  };
  activeTab: string;
  setActiveTab: (id: string) => void;
  onClose?: () => void;
}

export function Sidebar({ user, activeTab, setActiveTab, onClose }: SidebarProps) {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col h-screen sticky top-0 transition-colors duration-300">
      <div className="p-4 flex items-center justify-between border-b border-border bg-background/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand rounded flex items-center justify-center">
            <Zap className="text-background w-5 h-5 fill-background" />
          </div>
          <span className="text-lg font-bold text-text-primary tracking-tight">TradePulse</span>
        </div>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-secondary rounded lg:hidden text-text-muted hover:text-text-primary transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <nav className="px-2 py-4 space-y-1">
          <div className="px-3 mb-2 text-[10px] font-bold text-text-muted uppercase tracking-widest">Navigation</div>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded transition-all duration-200 group",
                activeTab === item.id 
                  ? "bg-secondary text-text-primary" 
                  : "text-text-secondary hover:text-text-primary hover:bg-secondary/50"
              )}
            >
              <item.icon className={cn(
                "w-4 h-4 transition-colors",
                activeTab === item.id ? "text-brand" : "text-text-muted group-hover:text-text-secondary"
              )} />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="px-2 py-4 border-t border-border">
          <div className="px-3 mb-3 flex items-center justify-between">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Watchlist</span>
            <Star className="w-3 h-3 text-text-muted cursor-pointer hover:text-brand" />
          </div>
          <div className="space-y-1">
            {watchlist.map((item) => (
              <div 
                key={item.symbol}
                className="px-3 py-2 rounded hover:bg-secondary/30 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-bold text-text-primary">{item.symbol}</span>
                  <span className={cn(
                    "text-[10px] font-bold font-price",
                    item.change >= 0 ? "text-bullish" : "text-bearish"
                  )}>
                    {item.change >= 0 ? '+' : ''}{item.change}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-text-muted">{item.name}</span>
                  <span className="text-[10px] text-text-secondary font-price">${item.price.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
