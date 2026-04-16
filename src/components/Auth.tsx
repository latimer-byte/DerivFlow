import React, { useState } from 'react';
import { Zap, Mail, Lock, User, ArrowRight, Github, Chrome } from 'lucide-react';
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
    const appId = import.meta.env.VITE_DERIV_APP_ID || '1089';
    const redirectUrl = window.location.origin;
    const derivLoginUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&l=en&brand=deriv`;
    window.location.href = derivLoginUrl;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      const newUser = {
        name: isLogin ? (email.split('@')[0] || 'User') : name,
        id: `CR${Math.floor(Math.random() * 9000 + 1000)}-${Math.random().toString(36).substring(2, 4).toUpperCase()}`,
        email: email
      };
      
      localStorage.setItem('tradepulse_user', JSON.stringify(newUser));
      onLogin(newUser);
      setLoading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-brand/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-rose-500/10 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 1, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-card border border-border rounded-[2rem] p-8 shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 bg-brand rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-brand/20">
            <Zap className="text-background w-7 h-7 fill-background" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-text-muted text-sm mt-2">
            {isLogin ? 'Enter your credentials to access your terminal' : 'Join thousands of traders on the pulse of the market'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input 
                  type="text" 
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-4 text-sm text-text-primary focus:outline-none focus:border-brand transition-all"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-4 text-sm text-text-primary focus:outline-none focus:border-brand transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Password</label>
              {isLogin && <button type="button" className="text-[10px] font-bold text-brand hover:underline">Forgot?</button>}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-4 text-sm text-text-primary focus:outline-none focus:border-brand transition-all"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-brand text-white rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 hover:bg-brand-hover transition-all shadow-lg shadow-brand/20 disabled:opacity-50 mt-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {isLogin ? 'Sign In' : 'Create Account'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8">
          <div className="relative flex items-center justify-center mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <span className="relative px-4 bg-card text-[10px] font-bold text-text-muted uppercase tracking-widest">Or continue with</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <button 
              type="button"
              onClick={handleDerivLogin}
              disabled={loading}
              className="flex items-center justify-center gap-3 py-3 bg-[#ff444f] hover:bg-[#e63e46] rounded-xl transition-all text-sm font-bold text-white shadow-lg shadow-[#ff444f]/20 disabled:opacity-50"
            >
              <Zap className="w-5 h-5 fill-white" />
              Login with Deriv
            </button>
            
            <div className="grid grid-cols-2 gap-4">
              <button 
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="flex items-center justify-center gap-2 py-2.5 border border-border rounded-xl hover:bg-secondary transition-all text-xs font-bold text-text-primary disabled:opacity-50"
              >
                <Chrome className="w-4 h-4" />
                Google
              </button>
              <button className="flex items-center justify-center gap-2 py-2.5 border border-border rounded-xl hover:bg-secondary transition-all text-xs font-bold text-text-primary">
                <Github className="w-4 h-4" />
                GitHub
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-text-muted mt-8">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-brand font-bold hover:underline"
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
