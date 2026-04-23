import React, { useState } from 'react';
import { Zap, Lock, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

interface AuthProps {
  onLogin: (user: any) => void;
}

export function Auth({ onLogin }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleDerivLogin = async (isSignup = false) => {
    setLoading(true);
    try {
      // Modern Deriv OAuth uses client_id (alphanumeric)
    // Legacy app_id can be passed as an optional param
    const clientId = '33433jm6aon9vgTQHB9vn';
    const legacyAppId = import.meta.env.VITE_DERIV_APP_ID || localStorage.getItem('deriv_app_id') || '33433';
    
    // 1. Generate PKCE parameters
    const array = crypto.getRandomValues(new Uint8Array(64));
    const codeVerifier = Array.from(array)
      .map(v => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[v % 66])
      .join('');

    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const state = crypto.getRandomValues(new Uint8Array(16))
      .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');

    // 2. Store for later verification
    sessionStorage.setItem('pkce_code_verifier', codeVerifier);
    sessionStorage.setItem('oauth_state', state);

    // 3. Prepare redirect URL
    const callbackPath = '/callback';
    const redirectUri = window.location.origin + callbackPath;
    
    const baseUrl = "https://auth.deriv.com/oauth2/auth";
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'trade account_manage',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      app_id: legacyAppId // Optional legacy support
    });

    if (isSignup) {
      params.append('prompt', 'registration');
    }

    const derivLoginUrl = `${baseUrl}?${params.toString()}`;
    console.log('Redirecting to Deriv OAuth:', derivLoginUrl);
    window.location.href = derivLoginUrl;
    } catch (error) {
      console.error('Deriv OAuth initiation failed:', error);
      setLoading(false);
    }
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
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-text-primary text-center md:text-left">
              {isLogin ? 'Access Terminal' : 'Join Terminal'}
            </h1>
            <p className="text-text-muted text-xs font-bold uppercase tracking-widest text-center md:text-left">
              {isLogin ? 'Authenticate with your Deriv credentials' : 'Create an account via Deriv to start trading'}
            </p>
          </div>

          <div className="space-y-6 pt-4">
            <button 
              type="button"
              onClick={() => handleDerivLogin(!isLogin)}
              disabled={loading}
              className="w-full flex items-center justify-center gap-4 py-5 bg-[#ff444f] hover:bg-[#e63e46] rounded-2xl transition-all text-xs font-black text-white uppercase tracking-widest italic shadow-xl shadow-red-500/20 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Zap className="w-5 h-5 fill-white" />
                  <span>Connect with Deriv Account</span>
                  <ArrowRight className="w-4 h-4 ml-auto" />
                </>
              )}
            </button>

            <div className="bg-card/50 border border-border p-6 rounded-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-brand/10 rounded-lg flex items-center justify-center shrink-0">
                  <Lock className="w-3 h-3 text-brand" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-text-primary uppercase tracking-widest">Secure OAuth 2.0</p>
                  <p className="text-[9px] font-bold text-text-muted uppercase leading-relaxed">Your password remains private. We only request trading permissions.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-brand/10 rounded-lg flex items-center justify-center shrink-0">
                  <Zap className="w-3 h-3 text-brand" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-text-primary uppercase tracking-widest">Instant Sync</p>
                  <p className="text-[9px] font-bold text-text-muted uppercase leading-relaxed">Real-time balance and trade history synchronization.</p>
                </div>
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
