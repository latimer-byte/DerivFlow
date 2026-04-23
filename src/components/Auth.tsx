import React, { useState } from 'react';
import { Zap, Mail, Lock, User, ArrowRight, Github, Chrome, Fingerprint, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { signInWithGoogle } from '@/lib/firebase';

interface AuthProps {
  onLogin: (user: any) => void;
}

export function Auth({ onLogin }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      const userData = {
        name: user.displayName || 'User',
        id: `CR${Math.floor(Math.random() * 9000 + 1000)}-${Math.random().toString(36).substring(2, 4).toUpperCase()}`,
        email: user.email,
        uid: user.uid,
        authType: 'firebase'
      };
      localStorage.setItem('tradepulse_user', JSON.stringify(userData));
      onLogin(userData);
    } catch (error) {
      console.error("Google login failed", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDerivLogin = () => {
    // Priority: Env variable > Local storage > Default fallback
    const appId = import.meta.env.VITE_DERIV_APP_ID || localStorage.getItem('deriv_app_id') || '33433';
    
    // Dynamically determine redirect URL
    const callbackPath = '/callback';
    const redirectUrl = window.location.origin + callbackPath;
    
    if (!appId) {
      const manualId = window.prompt("Deriv App ID is missing. Please enter your App ID from api.deriv.com:");
      if (manualId) {
        localStorage.setItem('deriv_app_id', manualId);
        const derivLoginUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${manualId}&l=en&brand=deriv&redirect_uri=${encodeURIComponent(redirectUrl)}`;
        window.location.href = derivLoginUrl;
      }
      return;
    }
    
    const derivLoginUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&l=en&brand=deriv&redirect_uri=${encodeURIComponent(redirectUrl)}`;
    
    console.log('Redirecting to:', derivLoginUrl);
    window.location.href = derivLoginUrl;
  };

  const handleBiometricLogin = async () => {
    setLoading(true);
    try {
      // Simulate WebAuthn / Biometric flow
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const savedUser = localStorage.getItem('tradepulse_user');
      if (savedUser) {
        onLogin(JSON.parse(savedUser));
      } else {
        // Fallback for demo if no user saved
        const demoUser = {
          name: 'Biometric User',
          id: `CR8842`,
          uid: 'mock_biometric_user',
          email: 'biometric@example.com'
        };
        onLogin(demoUser);
      }
    } catch (error) {
      console.error("Biometric login failed", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      // Create a stable UID and ID from email for mock persistence
      const mockUid = email ? `mock_${btoa(email).substring(0, 12)}` : `mock_${Math.random().toString(36).substring(2, 10)}`;
      const stableId = email ? `CR${(email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 9000) + 1000}` : `CR${Math.floor(Math.random() * 9000 + 1000)}`;

      const newUser = {
        name: isLogin ? (email.split('@')[0] || 'User') : name,
        id: stableId,
        uid: mockUid,
        email: email
      };
      
      localStorage.setItem('tradepulse_user', JSON.stringify(newUser));
      onLogin(newUser);
      setLoading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row items-stretch justify-center overflow-hidden">
      {/* Visual Side (Left) - Inspired by modern trading platforms */}
      <div className="hidden md:flex md:w-1/2 bg-card relative items-center justify-center p-12 overflow-hidden border-r border-border">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand/20 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-rose-500/10 rounded-full blur-[100px]" />
          <div className="absolute inset-0 technical-grid opacity-10" />
        </div>
        
        <div className="relative z-10 max-w-md text-center">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="mb-8 flex justify-center"
          >
            <div className="w-20 h-20 bg-brand rounded-[2rem] flex items-center justify-center shadow-2xl shadow-brand/40">
              <Zap className="text-background w-10 h-10 fill-background" />
            </div>
          </motion.div>
          <motion.h2 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-4xl font-black italic uppercase tracking-tighter text-brand mb-2"
          >
            TradePulse
          </motion.h2>
          <motion.h3 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-xl font-bold italic uppercase tracking-tighter text-text-primary mb-4"
          >
            Master the Market Pulse
          </motion.h3>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-text-muted text-sm font-medium uppercase tracking-widest leading-relaxed"
          >
            Join the elite tier of traders using AI-driven insights and low-latency execution.
          </motion.p>
        </div>

        {/* Floating Stats Mockup */}
        <div className="absolute bottom-12 left-12 right-12 flex justify-between gap-4">
          <div className="bg-background/40 backdrop-blur-md border border-border/50 p-4 rounded-2xl flex-1">
            <p className="text-[10px] font-bold text-text-muted uppercase mb-1">Live Traders</p>
            <p className="text-xl font-black text-text-primary italic">14,204+</p>
          </div>
          <div className="bg-background/40 backdrop-blur-md border border-border/50 p-4 rounded-2xl flex-1">
            <p className="text-[10px] font-bold text-text-muted uppercase mb-1">24h Volume</p>
            <p className="text-xl font-black text-brand italic">$2.4B</p>
          </div>
        </div>
      </div>

      {/* Auth Side (Right) */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-12 bg-background">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-sm space-y-8"
        >
          {/* Mobile Logo */}
          <div className="md:hidden flex flex-col items-center mb-12">
            <div className="w-12 h-12 bg-brand rounded-2xl flex items-center justify-center mb-4">
              <Zap className="text-background w-6 h-6 fill-background" />
            </div>
            <h1 className="text-2xl font-black italic uppercase tracking-tighter text-text-primary">TradePulse</h1>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-text-primary">
              {isLogin ? 'Welcome Back' : 'Get Started'}
            </h1>
            <p className="text-text-muted text-xs font-bold uppercase tracking-widest">
              {isLogin ? 'Log in to your professional terminal' : 'Create your pro trading account'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full bg-card border border-border rounded-xl py-4 pl-12 pr-4 text-sm text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all font-medium"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-card border border-border rounded-xl py-4 pl-12 pr-4 text-sm text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Password</label>
                {isLogin && <button type="button" className="text-[10px] font-black text-brand hover:underline tracking-widest uppercase">Forgot?</button>}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-card border border-border rounded-xl py-4 pl-12 pr-12 text-sm text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-secondary rounded-lg transition-colors text-text-muted"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-brand text-white rounded-xl py-4 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-brand-hover transition-all shadow-xl shadow-brand/20 disabled:opacity-50 mt-6 italic"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Enter Terminal' : 'Initialize Account'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-6">
            <div className="relative flex items-center justify-center mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/50"></div>
              </div>
              <span className="relative px-4 bg-background text-[10px] font-black text-text-muted uppercase tracking-widest">Global Auth</span>
            </div>

            <div className="space-y-3">
              <button 
                type="button"
                onClick={handleDerivLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-3.5 bg-[#ff444f] hover:bg-[#e63e46] rounded-xl transition-all text-[11px] font-black text-white uppercase tracking-widest italic"
              >
                <Zap className="w-4 h-4 fill-white" />
                Connect Deriv Account
              </button>
              
              <div className="grid grid-cols-2 gap-3">
                <button 
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 py-3 border border-border rounded-xl hover:bg-card transition-all text-[10px] font-black text-text-primary uppercase tracking-widest disabled:opacity-50"
                >
                  <Chrome className="w-3.5 h-3.5" />
                  Google
                </button>
                <button 
                  type="button"
                  onClick={handleBiometricLogin}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 py-3 border border-border rounded-xl hover:bg-card transition-all text-[10px] font-black text-text-primary uppercase tracking-widest disabled:opacity-50"
                >
                  <Fingerprint className="w-3.5 h-3.5" />
                  Bio-ID
                </button>
              </div>
            </div>
          </div>

          <p className="text-center text-[11px] font-black text-text-muted uppercase tracking-widest pt-8">
            {isLogin ? "New to the pulse?" : "Authorized member?"}{' '}
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-brand hover:underline"
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
