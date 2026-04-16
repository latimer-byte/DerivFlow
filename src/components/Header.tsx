import React, { useState } from 'react';
import { Search, Bell, User, ChevronDown, Menu, Globe, Shield, HelpCircle, LogOut, Settings, Wallet, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface HeaderProps {
  user: {
    name: string;
    id: string;
    email: string;
  };
  balance: number;
  onMenuClick?: () => void;
  onCategorySelect?: (category: string) => void;
  onLogout?: () => void;
  onSettingsClick?: () => void;
}

export function Header({ user, balance, onMenuClick, onCategorySelect, onLogout, onSettingsClick }: HeaderProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullScreen(false);
      }
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

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
            {['Derived', 'Forex', 'Indices', 'Crypto', 'Metals', 'Commodities'].map((cat) => (
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

        <div className="hidden xl:flex items-center gap-2 ml-4 px-3 py-1 bg-brand/5 border border-brand/20 rounded-full">
          <div className="w-1 h-1 rounded-full bg-brand animate-ping" />
          <span className="text-[9px] font-black text-brand uppercase tracking-widest">Pro Mode Active</span>
        </div>

        {/* Prominent Balance and Name for Desktop */}
        <div className="hidden lg:flex items-center gap-6 ml-auto mr-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Account Balance</span>
            <span className="text-sm font-black text-text-primary font-price tracking-tight">
              ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="h-8 w-[1px] bg-border/50" />
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Trader</span>
            <span className="text-sm font-bold text-text-primary tracking-tight">{user.name}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Mobile Balance Display */}
        <div className="flex lg:hidden flex-col items-end mr-2">
          <span className="text-[8px] font-bold text-text-muted uppercase tracking-widest">Balance</span>
          <span className="text-[11px] font-bold text-brand font-price">${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <HeaderIcon 
            icon={isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />} 
            onClick={toggleFullScreen}
            className="hidden sm:flex" 
          />
          <HeaderIcon icon={<Shield className="w-3.5 h-3.5" />} className="hidden sm:flex" />
          <HeaderIcon icon={<Globe className="w-3.5 h-3.5" />} className="hidden sm:flex" />
          <HeaderIcon icon={<HelpCircle className="w-3.5 h-3.5" />} />
          <div className="relative">
            <HeaderIcon icon={<Bell className="w-3.5 h-3.5" />} />
            <span className="absolute top-1 right-1 w-1 h-1 sm:w-1.5 sm:h-1.5 bg-brand rounded-full border border-card" />
          </div>
        </div>
        
        <div className="h-6 w-[1px] bg-border" />
        
        <div className="relative">
          <div 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 pl-1 sm:pl-2 cursor-pointer group"
          >
            <div className="hidden xs:flex flex-col items-end">
              <span className="text-[10px] sm:text-[11px] font-bold text-text-primary group-hover:text-brand transition-colors">{user.name}</span>
              <span className="text-[8px] sm:text-[9px] text-text-muted font-mono uppercase tracking-widest">{user.id}</span>
            </div>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-secondary border border-border flex items-center justify-center overflow-hidden group-hover:border-brand transition-colors">
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-text-muted group-hover:text-brand transition-colors" />
            </div>
            <ChevronDown className={cn("w-3 h-3 text-text-muted transition-transform duration-200", isProfileOpen && "rotate-180")} />
          </div>

          <AnimatePresence>
            {isProfileOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsProfileOpen(false)} 
                />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
                >
                  <div className="p-4 border-b border-border bg-background/30">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center text-brand font-bold">
                        {getInitials(user.name)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-text-primary">{user.name}</span>
                        <span className="text-[10px] text-text-muted font-mono">{user.id}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-background rounded-lg border border-border">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-3.5 h-3.5 text-brand" />
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Balance</span>
                      </div>
                      <span className="text-sm font-bold text-text-primary font-price">${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  <div className="p-2">
                    <DropdownItem 
                      icon={<Settings className="w-4 h-4" />} 
                      label="Account Settings" 
                      onClick={() => {
                        onSettingsClick?.();
                        setIsProfileOpen(false);
                      }}
                    />
                    <div className="h-[1px] bg-border my-1" />
                    <DropdownItem 
                      icon={<LogOut className="w-4 h-4" />} 
                      label="Logout" 
                      variant="danger"
                      onClick={() => {
                        onLogout?.();
                        setIsProfileOpen(false);
                      }}
                    />
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

function DropdownItem({ icon, label, onClick, variant = 'default' }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all",
        variant === 'danger' 
          ? "text-rose-500 hover:bg-rose-500/10" 
          : "text-text-secondary hover:text-text-primary hover:bg-secondary"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function HeaderIcon({ icon, className, onClick }: { icon: React.ReactNode, className?: string, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn("p-1.5 text-text-muted hover:text-text-primary hover:bg-secondary/50 rounded transition-all", className)}
    >
      {icon}
    </button>
  );
}
