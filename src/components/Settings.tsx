import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, LogIn, UserPlus, Moon, Sun, Bell, Shield, Globe, RefreshCw, Key, ExternalLink, CheckCircle2, Zap, Monitor, Smartphone, Tablet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { derivApi } from '@/services/derivApi';

interface SettingsProps {
  user: {
    name: string;
    id: string;
    email: string;
  };
  onLogout: () => void;
  isDarkMode: boolean;
  setIsDarkMode: (isDark: boolean) => void;
}

export function Settings({ user, onLogout, isDarkMode, setIsDarkMode }: SettingsProps) {
  const [activeSection, setActiveSection] = useState('profile');
  const [apiKey, setApiKey] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'error'>('idle');
  
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleConnectDeriv = async () => {
    if (!apiKey) return;
    setIsConnecting(true);
    setConnectionStatus('idle');
    
    try {
      await derivApi.authorize(apiKey);
      setIsConnecting(false);
      setConnectionStatus('connected');
      alert('Deriv API Token authorized! Your terminal is now live.');
    } catch (error: any) {
      console.error('Failed to connect via settings:', error);
      setIsConnecting(false);
      setConnectionStatus('error');
      alert(`Handshake Failed: ${error.message || 'Unknown Error'}`);
    }
  };

  const [viewMode, setViewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-2">Settings</h2>
          <p className="text-sm md:text-base text-text-muted">Manage your account preferences and security settings.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar Navigation */}
        <div className="space-y-2">
          <SettingsNavItem 
            icon={User} 
            label="Profile & Security" 
            active={activeSection === 'profile'} 
            onClick={() => setActiveSection('profile')}
          />
          <SettingsNavItem 
            icon={Monitor} 
            label="Interface & Display" 
            active={activeSection === 'display'} 
            onClick={() => setActiveSection('display')}
          />
          <SettingsNavItem 
            icon={Key} 
            label="Integrations" 
            active={activeSection === 'api'} 
            onClick={() => setActiveSection('api')}
          />
          <SettingsNavItem 
            icon={Bell} 
            label="Notifications" 
            active={activeSection === 'notifications'} 
            onClick={() => setActiveSection('notifications')}
          />
          <SettingsNavItem 
            icon={Shield} 
            label="Privacy" 
            active={activeSection === 'privacy'} 
            onClick={() => setActiveSection('privacy')}
          />
          
          <div className="pt-8 px-4">
            <div className="flex items-center justify-between p-4 bg-secondary/30 border border-border rounded-2xl">
              <div className="flex items-center gap-3">
                {isDarkMode ? <Moon className="w-5 h-5 text-brand" /> : <Sun className="w-5 h-5 text-brand" />}
                <span className="text-sm font-bold text-text-primary">Dark Mode</span>
              </div>
              <button 
                onClick={toggleTheme}
                className={cn(
                  "w-12 h-6 rounded-full relative transition-all duration-300",
                  isDarkMode ? "bg-brand" : "bg-text-muted"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                  isDarkMode ? "left-7" : "left-1"
                )} />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8 min-h-[500px]">
          {activeSection === 'profile' && (
            <div className="bg-card border border-border rounded-[2rem] p-6 md:p-8 shadow-xl space-y-6">
              <h4 className="text-xl font-bold text-text-primary mb-4">Security Settings</h4>
              <div className="space-y-4">
                <ToggleSetting 
                  label="Password Discovery" 
                  description="Require password confirmation for sensitive actions."
                  active={true}
                />
                <ToggleSetting 
                  label="Login Notifications" 
                  description="Alert me on every successful login."
                  active={true}
                />
              </div>
            </div>
          )}

          {activeSection === 'display' && (
            <div className="bg-card border border-border rounded-[2rem] p-6 md:p-8 shadow-xl space-y-8 animate-in zoom-in-95 duration-300">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center">
                  <Monitor className="w-6 h-6 text-brand" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-text-primary">Interface & Display</h4>
                  <p className="text-sm text-text-muted">Customize how the terminal looks on your device.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ViewModeOption 
                  active={viewMode === 'desktop'} 
                  onClick={() => setViewMode('desktop')}
                  icon={Monitor}
                  label="Desktop View"
                  desc="Full professional layout"
                />
                <ViewModeOption 
                  active={viewMode === 'tablet'} 
                  onClick={() => setViewMode('tablet')}
                  icon={Tablet}
                  label="Tablet View"
                  desc="Balanced sidebar layout"
                />
                <ViewModeOption 
                  active={viewMode === 'mobile'} 
                  onClick={() => setViewMode('mobile')}
                  icon={Smartphone}
                  label="Mobile View"
                  desc="Condensed single column"
                />
              </div>

              <div className="pt-6 border-t border-border">
                <h5 className="text-sm font-bold text-text-primary mb-4 uppercase tracking-widest">Scaling & Density</h5>
                <div className="space-y-4">
                  <ToggleSetting 
                    label="Ultra-Low Latency UI" 
                    description="Reduce animations for faster layout transitions."
                    active={false}
                  />
                  <ToggleSetting 
                    label="High Contrast Modes" 
                    description="Increase text visibility for accessibility."
                    active={true}
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'api' && (
            <div className="bg-card border border-border rounded-[2rem] p-6 md:p-8 shadow-xl space-y-8 animate-in zoom-in-95 duration-300">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center">
                  <Globe className="w-6 h-6 text-brand" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-text-primary">Integrations</h4>
                  <p className="text-sm text-text-muted">Manage your connections with external platforms.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-secondary/30 border border-border rounded-2xl p-4">
                  <h5 className="text-sm font-bold text-text-primary mb-2 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-brand" />
                    Deriv OAuth Configuration
                  </h5>
                  <p className="text-xs text-text-muted mb-4">
                    To enable professional trading, register this app at <a href="https://api.deriv.com" target="_blank" className="text-brand hover:underline">api.deriv.com</a> and use the following Redirect URI:
                  </p>
                  <div className="flex items-center gap-2 p-3 bg-background rounded-xl border border-border group">
                    <code className="text-[10px] font-mono text-brand break-all flex-1">
                      {window.location.origin}/callback
                    </code>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[8px] font-black text-emerald-500 uppercase">Live Path</span>
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/callback`);
                        alert('Redirect URI copied to clipboard!');
                      }}
                      className="p-1.5 hover:bg-secondary rounded-lg transition-colors ml-2"
                      title="Copy URL"
                    >
                      <RefreshCw className="w-3 h-3 text-text-muted" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-xs font-bold text-text-muted uppercase tracking-widest">Deriv App ID</label>
                      <button 
                        onClick={() => {
                          derivApi.resetAppId();
                          // Force local storage reload
                          window.location.reload();
                        }}
                        className="text-[10px] text-brand hover:underline font-bold"
                      >
                        Reset to Default
                      </button>
                    </div>
                    <input 
                      type="text" 
                      placeholder="Enter your Deriv App ID (e.g. 336Jcj20DczhY7sKLv2Ri)"
                      value={localStorage.getItem('deriv_app_id') || ''}
                      onChange={(e) => {
                        const newId = e.target.value;
                        if (/^[0-9]*$/.test(newId)) {
                          derivApi.setAppId(newId);
                          // Trigger local storage change for UI
                          setApiKey(prev => prev + ' ');
                          setApiKey(prev => prev.trim());
                        }
                      }}
                      className="w-full bg-secondary/50 border border-border rounded-2xl py-4 px-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all font-mono"
                    />
                    <p className="text-[10px] text-text-muted px-1">
                      Whitelisted domain check: <span className="text-brand font-mono">{window.location.hostname}</span>
                    </p>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-border">
                  <h5 className="text-sm font-bold text-text-primary mb-4">API Token (Manual)</h5>
                  <div className="relative mb-4">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                    <input 
                      type="password" 
                      placeholder="Paste your Deriv API Token here..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full bg-secondary/50 border border-border rounded-2xl py-4 pl-12 pr-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all font-mono"
                    />
                  </div>

                  <button 
                    onClick={handleConnectDeriv}
                    disabled={isConnecting || !apiKey}
                    className={cn(
                      "w-full py-5 rounded-2xl font-bold text-lg shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50",
                      connectionStatus === 'connected' ? "bg-emerald-500 text-white shadow-emerald-500/20" : "bg-brand text-white shadow-brand/20 hover:bg-brand-hover"
                    )}
                  >
                    {isConnecting ? <RefreshCw className="w-6 h-6 animate-spin" /> : (connectionStatus === 'connected' ? <CheckCircle2 className="w-6 h-6" /> : <Zap className="w-6 h-6" />)}
                    {isConnecting ? 'Connecting...' : (connectionStatus === 'connected' ? 'Authorized' : 'Connect API Token')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="bg-card border border-border rounded-[2rem] p-6 md:p-8 shadow-xl space-y-6">
              <h4 className="text-xl font-bold text-text-primary mb-4">Notification Preferences</h4>
              <div className="space-y-4">
                <ToggleSetting 
                  label="Trade Executions" 
                  description="Receive alerts when your orders are filled or cancelled."
                  active={true}
                />
                <ToggleSetting 
                  label="Price Alerts" 
                  description="Get notified when assets reach your target prices."
                  active={true}
                />
                <ToggleSetting 
                  label="Market News" 
                  description="Daily digest of important market movements and AI insights."
                  active={false}
                />
                <ToggleSetting 
                  label="Security Alerts" 
                  description="Immediate notification on login from new devices or password changes."
                  active={true}
                />
              </div>
            </div>
          )}

          {activeSection === 'privacy' && (
            <div className="bg-card border border-border rounded-[2rem] p-6 md:p-8 shadow-xl space-y-6">
              <h4 className="text-xl font-bold text-text-primary mb-4">Privacy & Security</h4>
              <div className="space-y-4">
                <ToggleSetting 
                  label="Two-Factor Authentication" 
                  description="Add an extra layer of security to your account."
                  active={false}
                />
                <ToggleSetting 
                  label="Public Profile" 
                  description="Allow other traders to see your performance stats."
                  active={true}
                />
                <ToggleSetting 
                  label="Data Sharing" 
                  description="Share anonymous trading data to improve AI insights."
                  active={true}
                />
              </div>
              <div className="pt-6 border-t border-border">
                <button className="text-rose-500 text-sm font-bold hover:underline">Delete Account & Data</button>
              </div>
            </div>
          )}

          {activeSection !== 'profile' && activeSection !== 'api' && activeSection !== 'notifications' && activeSection !== 'privacy' && activeSection !== 'display' && (
            <div className="bg-card border border-border rounded-[2rem] p-12 flex flex-col items-center justify-center text-center space-y-4 shadow-xl">
              <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-4 border border-border">
                <span className="text-4xl">🛠️</span>
              </div>
              <h3 className="text-2xl font-bold text-text-primary">{activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} Settings</h3>
              <p className="text-text-muted max-w-md">This section is being optimized by AI. Check back soon for advanced configuration options!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsNavItem({ icon: Icon, label, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all font-bold text-sm",
        active 
          ? "bg-brand text-white shadow-lg shadow-brand/20" 
          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
      )}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );
}

function ToggleSetting({ label, description, active }: any) {
  const [isEnabled, setIsEnabled] = useState(active);
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-secondary/20 transition-colors">
      <div>
        <div className="text-sm font-bold text-text-primary">{label}</div>
        <div className="text-xs text-text-muted">{description}</div>
      </div>
      <button 
        onClick={() => setIsEnabled(!isEnabled)}
        className={cn(
          "w-12 h-6 rounded-full relative transition-all duration-300",
          isEnabled ? "bg-brand" : "bg-text-muted"
        )}
      >
        <div className={cn(
          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
          isEnabled ? "left-7" : "left-1"
        )} />
      </button>
    </div>
  );
}

function ViewModeOption({ active, onClick, icon: Icon, label, desc }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all",
        active 
          ? "bg-brand/10 border-brand shadow-lg shadow-brand/10" 
          : "bg-secondary/30 border-border hover:border-text-muted text-text-muted hover:text-text-primary"
      )}
    >
      <Icon className={cn("w-8 h-8", active ? "text-brand" : "text-text-muted")} />
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-widest">{label}</p>
        <p className="text-[10px] opacity-60 mt-1">{desc}</p>
      </div>
    </button>
  );
}
