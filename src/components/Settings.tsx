import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, LogIn, UserPlus, Moon, Sun, Bell, Shield, Globe, RefreshCw, Key, ExternalLink, CheckCircle2, Zap, Monitor, Smartphone, Tablet } from 'lucide-react';
import { cn } from '../lib/utils';
import { derivApi } from '../services/derivApi';

interface SettingsProps {
  user: {
    name: string;
    id: string;
    email: string;
    derivToken?: string;
  };
  onLogout: () => void;
  isDarkMode: boolean;
  setIsDarkMode: (isDark: boolean) => void;
}

export function Settings({ user, onLogout, isDarkMode, setIsDarkMode }: SettingsProps) {
  const [activeSection, setActiveSection] = useState('profile');
  const [apiKey, setApiKey] = useState(user?.derivToken || '');
  const [appId, setAppId] = useState(localStorage.getItem('deriv_app_id') || import.meta.env.VITE_DERIV_APP_ID || '333ttXJvMqziMT0ErTbKd');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState< 'idle' | 'connected' | 'error'>(user?.derivToken ? 'connected' : 'idle');
  
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleConnectDeriv = async () => {
    if (!apiKey) {
      // If no API Key manually entered, try the OAuth flow
      setIsConnecting(true);
      try {
        const response = await fetch('/api/auth/url');
        if (response.ok) {
          const { url } = await response.json();
          const width = 600;
          const height = 700;
          const left = window.screenX + (window.outerWidth - width) / 2;
          const top = window.screenY + (window.outerHeight - height) / 2;
          
          window.open(
            url,
            'DerivAuth',
            `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
          );
        }
      } catch (error) {
        console.error("OAuth initiation failed:", error);
      } finally {
        setIsConnecting(false);
      }
      return;
    };

    // Validate App ID - must be numeric
    const cleanAppId = appId.trim();
    if (cleanAppId.startsWith('pat_')) {
      alert("Error: The string starting with 'pat_' is an API Token, not an App ID. Please use your numeric or alphanumeric App ID (e.g. 333ttXJvMqziMT0ErTbKd).");
      return;
    }

    setIsConnecting(true);
    
    try {
      // Set App ID if it changed
      derivApi.setAppId(cleanAppId || '333ttXJvMqziMT0ErTbKd');
      
      // Authorize with new token
      derivApi.authorize(apiKey.trim());
      
      // Refresh user data with new token
      if (user) {
        const updatedUser = { ...user, derivToken: apiKey.trim() };
        localStorage.setItem('tradepulse_user', JSON.stringify(updatedUser));
      }
      
      setTimeout(() => {
        setIsConnecting(false);
        setConnectionStatus('connected');
      }, 1000);
    } catch (error) {
      console.error(error);
      setIsConnecting(false);
      setConnectionStatus('error');
    }
  };

  // Add message listener to Settings as well for OAuth completion
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const { token } = event.data;
        setApiKey(token);
        setConnectionStatus('connected');
        
        // Trigger actual connection
        derivApi.authorize(token);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const redirectUri = window.location.origin;

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
            label="API Configuration" 
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
                  <Key className="w-6 h-6 text-brand" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-text-primary">Deriv API Configuration</h4>
                  <p className="text-sm text-text-muted">Connect your live Deriv account to start trading.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-secondary/30 border border-border rounded-2xl p-4 space-y-4">
                  <div>
                    <h5 className="text-sm font-bold text-text-primary mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      OAuth Redirect URL:
                    </h5>
                    <div className="flex items-center gap-2 bg-background p-2 rounded-lg border border-border">
                      <code className="text-[10px] text-brand font-mono truncate flex-1">{redirectUri}</code>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(redirectUri);
                          alert('URL copied to clipboard!');
                        }}
                        className="p-1 hover:bg-secondary rounded text-text-muted"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-[10px] text-text-muted mt-2 uppercase font-bold tracking-widest">Register this URL in your Deriv Dashboard to enable OAuth login.</p>
                  </div>

                  <div>
                    <h5 className="text-sm font-bold text-text-primary mb-2">How to get your API Token:</h5>
                    <ol className="text-xs text-text-muted space-y-1 list-decimal ml-4">
                      <li>Log in to Deriv account {'>'} Settings {'>'} API Token.</li>
                      <li>Create a token with 'Read' and 'Trade' scopes.</li>
                    </ol>
                    <a 
                      href="https://app.deriv.com/account/api-token" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-2 text-xs text-brand font-bold hover:underline"
                    >
                      Deriv Token Settings <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">App ID</label>
                    <div className="relative">
                      <Monitor className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                      <input 
                        type="text" 
                        placeholder="333ttXJvMqziMT0ErTbKd"
                        value={appId}
                        onChange={(e) => setAppId(e.target.value)}
                        className="w-full bg-secondary/50 border border-border rounded-2xl py-3 pl-12 pr-4 text-text-primary focus:outline-none focus:ring-1 focus:ring-brand font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">API Token</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                      <input 
                        type="password" 
                        placeholder="Paste Token..."
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full bg-secondary/50 border border-border rounded-2xl py-3 pl-12 pr-4 text-text-primary focus:outline-none focus:ring-1 focus:ring-brand font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleConnectDeriv}
                  disabled={isConnecting}
                  className={cn(
                    "w-full py-5 rounded-2xl font-bold text-lg shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50",
                    connectionStatus === 'connected' ? "bg-emerald-500 text-white shadow-emerald-500/20" : "bg-brand text-white shadow-brand/20 hover:bg-brand-hover"
                  )}
                >
                  {isConnecting ? (
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  ) : (
                    connectionStatus === 'connected' ? <CheckCircle2 className="w-6 h-6" /> : <Zap className="w-6 h-6" />
                  )}
                  {isConnecting ? 'Connecting...' : (
                    connectionStatus === 'connected' ? 'Connected & Live' : (apiKey ? 'Authorize Manual Token' : 'Connect with OAuth 2.0')
                  )}
                </button>
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
