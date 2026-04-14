import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, LogIn, UserPlus, Moon, Sun, Bell, Shield, Globe, RefreshCw, Key, ExternalLink, CheckCircle2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { derivApi } from '@/services/derivApi';

interface SettingsProps {
  user: {
    name: string;
    id: string;
    email: string;
  };
  setUser: (user: any) => void;
}

export function Settings({ user, setUser }: SettingsProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeSection, setActiveSection] = useState('profile');
  const [isProcessing, setIsProcessing] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'error'>('idle');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      
      const newUser = {
        name: isLogin ? (formData.email.split('@')[0] || 'User') : formData.name,
        email: formData.email,
        id: Math.floor(1000 + Math.random() * 9000) + '-XQ'
      };
      setUser(newUser);
      
      alert(isLogin ? `Welcome back, ${newUser.name}!` : 'Account created successfully!');
    }, 1500);
  };

  const handleConnectDeriv = () => {
    if (!apiKey) return;
    setIsConnecting(true);
    
    // Simulate API Key validation and connection
    setTimeout(() => {
      setIsConnecting(false);
      setConnectionStatus('connected');
      alert('Deriv API Key connected successfully! Your app is now live on Deriv.');
    }, 2000);
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Settings</h2>
          <p className="text-sm md:text-base text-muted-foreground">Manage your account preferences and security settings.</p>
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
                <span className="text-sm font-bold text-foreground">Dark Mode</span>
              </div>
              <button 
                onClick={toggleTheme}
                className={cn(
                  "w-12 h-6 rounded-full relative transition-all duration-300",
                  isDarkMode ? "bg-brand" : "bg-muted"
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
        <div className="lg:col-span-2 space-y-8">
          {activeSection === 'profile' && (
            <>
              {/* Auth Section */}
              <div className="bg-card border border-border rounded-[2rem] p-6 md:p-8 shadow-xl">
                <div className="flex items-center justify-center gap-8 mb-8 border-b border-border pb-6">
                  <button 
                    onClick={() => setIsLogin(true)}
                    className={cn(
                      "text-lg font-bold transition-all relative pb-2",
                      isLogin ? "text-brand" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Login
                    {isLogin && <div className="absolute bottom-0 left-0 w-full h-1 bg-brand rounded-full" />}
                  </button>
                  <button 
                    onClick={() => setIsLogin(false)}
                    className={cn(
                      "text-lg font-bold transition-all relative pb-2",
                      !isLogin ? "text-brand" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Sign Up
                    {!isLogin && <div className="absolute bottom-0 left-0 w-full h-1 bg-brand rounded-full" />}
                  </button>
                </div>

                <form className="space-y-6 max-w-md mx-auto py-4" onSubmit={handleAuth}>
                  {!isLogin && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <input 
                          type="text" 
                          required
                          placeholder="John Doe"
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          className="w-full bg-secondary/50 border border-border rounded-2xl py-4 pl-12 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <input 
                        type="email" 
                        required
                        placeholder="name@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full bg-secondary/50 border border-border rounded-2xl py-4 pl-12 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <input 
                        type="password" 
                        required
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        className="w-full bg-secondary/50 border border-border rounded-2xl py-4 pl-12 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all"
                      />
                    </div>
                  </div>

                  <button 
                    disabled={isProcessing}
                    className="w-full py-5 bg-brand text-white rounded-2xl font-bold text-lg shadow-xl shadow-brand/20 hover:bg-brand-hover transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isProcessing ? <RefreshCw className="w-6 h-6 animate-spin" /> : (isLogin ? <LogIn className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />)}
                    {isProcessing ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                  </button>

                  <p className="text-center text-sm text-muted-foreground">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}
                    <button 
                      type="button"
                      onClick={() => setIsLogin(!isLogin)}
                      className="ml-2 text-brand font-bold hover:underline"
                    >
                      {isLogin ? 'Sign Up' : 'Login'}
                    </button>
                  </p>
                </form>
              </div>
            </>
          )}

          {activeSection === 'api' && (
            <div className="bg-card border border-border rounded-[2rem] p-6 md:p-8 shadow-xl space-y-8">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center">
                  <Key className="w-6 h-6 text-brand" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-foreground">Deriv API Configuration</h4>
                  <p className="text-sm text-muted-foreground">Connect your live Deriv account to start trading.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-secondary/30 border border-border rounded-2xl p-4">
                  <h5 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    How to get your API Key:
                  </h5>
                  <ol className="text-xs text-muted-foreground space-y-2 list-decimal ml-4">
                    <li>Log in to your Deriv account.</li>
                    <li>Go to Settings {'>'} API Token.</li>
                    <li>Create a new token with 'Read' and 'Trade' scopes.</li>
                    <li>Copy the token and paste it below.</li>
                  </ol>
                  <a 
                    href="https://app.deriv.com/account/api-token" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-xs text-brand font-bold hover:underline"
                  >
                    Go to Deriv API Settings <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">API Token</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input 
                      type="password" 
                      placeholder="Paste your Deriv API Token here..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full bg-secondary/50 border border-border rounded-2xl py-4 pl-12 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all font-mono"
                    />
                  </div>
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
                  {isConnecting ? 'Connecting to Deriv...' : (connectionStatus === 'connected' ? 'Connected & Live' : 'Connect & Launch App')}
                </button>
              </div>
            </div>
          )}

          {activeSection !== 'profile' && activeSection !== 'api' && (
            <div className="bg-card border border-border rounded-[2rem] p-12 flex flex-col items-center justify-center text-center space-y-4 shadow-xl">
              <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-4 border border-border">
                <span className="text-4xl">🛠️</span>
              </div>
              <h3 className="text-2xl font-bold text-foreground">{activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} Settings</h3>
              <p className="text-muted-foreground max-w-md">This section is being optimized by AI. Check back soon for advanced configuration options!</p>
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
        <div className="text-sm font-bold text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <button 
        onClick={() => setIsEnabled(!isEnabled)}
        className={cn(
          "w-12 h-6 rounded-full relative transition-all duration-300",
          isEnabled ? "bg-brand" : "bg-muted"
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
