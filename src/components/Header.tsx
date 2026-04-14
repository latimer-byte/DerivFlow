import React from 'react';
import { Search, Bell, User, ChevronDown, Menu, Globe, Shield, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  user: {
    name: string;
    id: string;
  };
  onMenuClick?: () => void;
  onCategorySelect?: (category: string) => void;
}

export function Header({ user, onMenuClick, onCategorySelect }: HeaderProps) {
  return (
    <header className="h-12 border-b border-border bg-card flex items-center justify-between px-3 sm:px-4 sticky top-0 z-50">
      <div className="flex items-center gap-3 sm:gap-6 flex-1">
        <button 
          onClick={onMenuClick}
          className="p-1 hover:bg-secondary rounded lg:hidden transition-colors"
        >
          <Menu className="w-5 h-5 text-text-secondary" />
        </button>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-bullish animate-pulse" />
            <span className="text-[9px] sm:text-[10px] font-bold text-text-primary uppercase tracking-widest">Market Live</span>
          </div>
          <div className="hidden sm:block h-4 w-[1px] bg-border" />
          <div className="hidden md:flex items-center gap-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">
            {['Forex', 'Indices', 'Crypto', 'Commodities'].map((cat) => (
              <span 
                key={cat}
                onClick={() => onCategorySelect?.(cat)}
                className="hover:text-text-primary cursor-pointer transition-colors whitespace-nowrap"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>

        <div className="relative w-full max-w-xs group hidden xl:block ml-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted group-focus-within:text-brand transition-colors" />
          <input 
            type="text" 
            placeholder="Search assets (Cmd+K)"
            className="w-full bg-background border border-border rounded py-1.5 pl-9 pr-4 text-[11px] text-text-primary focus:outline-none focus:border-brand transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-1 sm:gap-2">
          <HeaderIcon icon={<Shield className="w-3.5 h-3.5" />} className="hidden sm:flex" />
          <HeaderIcon icon={<Globe className="w-3.5 h-3.5" />} className="hidden sm:flex" />
          <HeaderIcon icon={<HelpCircle className="w-3.5 h-3.5" />} />
          <div className="relative">
            <HeaderIcon icon={<Bell className="w-3.5 h-3.5" />} />
            <span className="absolute top-1 right-1 w-1 h-1 sm:w-1.5 sm:h-1.5 bg-brand rounded-full border border-card" />
          </div>
        </div>
        
        <div className="h-6 w-[1px] bg-border" />
        
        <div className="flex items-center gap-2 pl-1 sm:pl-2 cursor-pointer group">
          <div className="hidden xs:flex flex-col items-end">
            <span className="text-[10px] sm:text-[11px] font-bold text-text-primary group-hover:text-brand transition-colors">{user.name}</span>
            <span className="text-[8px] sm:text-[9px] text-text-muted font-mono uppercase tracking-widest">{user.id}</span>
          </div>
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-secondary border border-border flex items-center justify-center overflow-hidden">
            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-text-muted" />
          </div>
        </div>
      </div>
    </header>
  );
}

function HeaderIcon({ icon, className }: { icon: React.ReactNode, className?: string }) {
  return (
    <button className={cn("p-1.5 text-text-muted hover:text-text-primary hover:bg-secondary/50 rounded transition-all", className)}>
      {icon}
    </button>
  );
}
