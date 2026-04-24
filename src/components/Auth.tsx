import React, { useState, useEffect } from 'react';
import { Zap, Lock, ArrowRight, Key } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface AuthProps {
  onLogin: (user: any) => void;
}

export function Auth({ onLogin }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [customClientId, setCustomClientId] = useState(import.meta.env.VITE_DERIV_CLIENT_ID || '33433jm6aon9vgTQHB9vn');
  const [customRedirectUri, setCustomRedirectUri] = useState(() => {
    if (import.meta.env.VITE_DERIV_REDIRECT_URI) return import.meta.env.VITE_DERIV_REDIRECT_URI;
    const origin = typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : 'http://localhost:3000';
    return `${origin}/callback`;
  });

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Listen for message from OAuth popup to stop local loading state
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'DERIV_AUTH_COMPLETE') {
        const { error } = event.data;
        if (error) {
          setLoading(false);
        }
        // App.tsx handles the success/exchange
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) return;
    
    setLoading(true);
    try {
      // Direct Firebase Login
      const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('@/lib/firebase');
      let userCredential;
      
      // If it's a phone number or username, we might need a different lookup, 
      // but for simplicity we'll assume identifier is used as email for login
      // or the user provides email.
      const emailValue = identifier.includes('@') ? identifier : `${identifier}@tradepulse.local`;

      if (isLogin) {
        userCredential = await signInWithEmailAndPassword(emailValue, password);
      } else {
        userCredential = await createUserWithEmailAndPassword(emailValue, password);
      }

      const userData = {
        name: identifier.split('@')[0],
        email: emailValue,
        uid: userCredential.user.uid,
        authType: 'firebase' as const
      };
      
      // Directly log in - the app will handle any background deriv sync if needed
      onLogin(userData);
      localStorage.setItem('tradepulse_user', JSON.stringify(userData));
    } catch (error: any) {
      console.error('Credentials login failed:', error);
      alert(`Terminal Access Denied: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDerivLogin = async (isSignup = false) => {
    setLoading(true);
    try {
      const clientId = customClientId;
      const redirectUri = customRedirectUri;
      
      // 1. PKCE
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

      sessionStorage.setItem('pkce_code_verifier', codeVerifier);
      sessionStorage.setItem('oauth_state', state);
      sessionStorage.setItem('oauth_redirect_uri', redirectUri);
      sessionStorage.setItem('oauth_client_id', clientId);

      // Using auth.deriv.com as per the provided guide
      const baseUrl = "https://auth.deriv.com/oauth2/auth";
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'trade account_manage', // Standard scopes from the guide
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });

      // If legacy app support is needed
      if (clientId.match(/^\d+$/)) {
        params.append('app_id', clientId);
      }

      if (isSignup) params.append('prompt', 'registration');

      const derivLoginUrl = `${baseUrl}?${params.toString()}`;
      
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        derivLoginUrl, 
        'DerivLogin', 
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,toolbar=no,menubar=no,scrollbars=yes`
      );

      if (popup) {
        // Check periodically if the popup is closed to reset loading state
        const timer = setInterval(() => {
          if (popup.closed) {
            clearInterval(timer);
            setLoading(false);
          }
        }, 1000);
      } else {
        alert('Popup blocked! Please allow popups to continue authentication.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Deriv OAuth initiation failed:', error);
      setLoading(false);
    }
  };

  const handleManualTokenLogin = () => {
    if (!manualToken.trim()) return;
    
    // Simulate successful OAuth result with direct token
    const userData = {
      name: 'Deriv Trader',
      id: `CR${Math.floor(Math.random() * 9000 + 1000)}`,
      email: 'manual-token',
      uid: `manual_${Date.now()}`,
      authType: 'deriv' as const,
      derivToken: manualToken.trim()
    };
    
    onLogin(userData);
    localStorage.setItem('tradepulse_user', JSON.stringify(userData));
    localStorage.setItem('deriv_token', manualToken.trim());
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
            <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 space-y-3 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-brand font-black uppercase tracking-widest">OAuth Config Check</p>
                <div className="flex gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand animate-ping" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="space-y-1">
                  <p className="text-[9px] text-text-muted font-bold uppercase">Active Redirect URI:</p>
                  <code className="text-[9px] text-text-primary bg-background p-1.5 rounded border border-border block break-all leading-relaxed font-mono">
                    {customRedirectUri}
                  </code>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] text-text-muted font-bold uppercase">Active OAuth Client ID:</p>
                  <code className="text-[9px] text-text-primary bg-background p-1.5 rounded border border-border block font-mono">
                    {customClientId}
                  </code>
                </div>
              </div>
              <p className="text-[9px] text-text-muted italic leading-relaxed pt-1">
                Note: Ensure the exact URL above is registered in your <a href="https://api.deriv.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline font-bold">Deriv Developer Dashboard</a>.
              </p>

              {!showConfig ? (
                <button 
                  onClick={() => setShowConfig(true)}
                  className="w-full text-[9px] font-black text-brand uppercase tracking-tighter hover:underline text-left pt-1"
                >
                  + Troubleshoot & Override Config
                </button>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-2 pt-2 border-t border-brand/10"
                >
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-text-muted">OAuth Client ID (Alphanumeric)</label>
                    <input 
                      value={customClientId}
                      onChange={(e) => setCustomClientId(e.target.value)}
                      className="w-full bg-background/50 border border-brand/20 rounded p-1.5 text-[9px] font-mono text-text-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-text-muted">Numeric App ID (Required for domain authorization)</label>
                    <input 
                      placeholder="e.g. 1089"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^\d*$/.test(val)) {
                          import('@/services/derivApi').then(({ derivApi }) => {
                            derivApi.setAppId(val);
                          });
                        }
                      }}
                      defaultValue={localStorage.getItem('deriv_app_id') || ''}
                      className="w-full bg-background/50 border border-brand/20 rounded p-1.5 text-[9px] font-mono text-text-primary"
                    />
                    <p className="text-[7px] text-text-muted italic">
                      Generate this at api.deriv.com. This domain ({window.location.hostname}) MUST be whitelisted.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[8px] font-black uppercase text-text-muted">Override Redirect URI</label>
                      <button 
                        onClick={() => setCustomRedirectUri(`${window.location.origin}/callback`)}
                        className="text-[7px] text-brand hover:underline font-bold"
                      >
                        Reset to Origin
                      </button>
                    </div>
                    <input 
                      value={customRedirectUri}
                      onChange={(e) => setCustomRedirectUri(e.target.value)}
                      className="w-full bg-background/50 border border-brand/20 rounded p-1.5 text-[9px] font-mono text-text-primary"
                    />
                  </div>
                  <button 
                    onClick={() => setShowConfig(false)}
                    className="text-[8px] font-bold text-text-muted hover:text-brand uppercase"
                  >
                    Close Overrides
                  </button>
                </motion.div>
              )}
            </div>
          </div>

          <div className="space-y-6 pt-4">
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-4">
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="USERNAME / EMAIL / PHONE"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    className="w-full bg-secondary/30 border border-border focus:border-brand rounded-2xl py-4 px-5 text-xs font-bold text-text-primary outline-none transition-all placeholder:text-text-muted/50"
                  />
                </div>
                <div className="relative">
                  <input 
                    type="password"
                    placeholder="PASSWORD"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-secondary/30 border border-border focus:border-brand rounded-2xl py-4 px-5 text-xs font-bold text-text-primary outline-none transition-all placeholder:text-text-muted/50"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-brand text-background rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-brand/20 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Initialize Access</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-[9px] uppercase font-black tracking-[0.3em]">
                <span className="bg-background px-3 text-text-muted">Or cloud handshake</span>
              </div>
            </div>

            <button 
              type="button"
              onClick={() => handleDerivLogin(!isLogin)}
              disabled={loading}
              className="w-full flex items-center justify-center gap-4 py-4 border border-brand/30 bg-brand/5 hover:bg-brand/10 rounded-2xl transition-all text-[11px] font-black text-brand uppercase tracking-[0.2em] italic group relative overflow-hidden"
            >
              <Zap className="w-4 h-4 fill-brand" />
              <span>Sync with Deriv Cloud</span>
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest">
                <span className="bg-background px-3 text-text-muted">Or sync via API Token</span>
              </div>
            </div>

            {!showManual ? (
              <button 
                onClick={() => setShowManual(true)}
                className="w-full py-4 border border-border hover:border-brand/40 rounded-2xl text-[10px] font-black text-text-muted hover:text-brand uppercase tracking-widest transition-all"
              >
                Enter API Token Manually
              </button>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input 
                    type="password"
                    placeholder="PASTE DERIV API TOKEN"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    className="w-full bg-secondary/30 border border-border focus:border-brand rounded-2xl py-4 pl-12 pr-4 text-xs font-mono text-text-primary outline-none transition-all"
                  />
                </div>
                <button 
                  onClick={handleManualTokenLogin}
                  disabled={!manualToken.trim()}
                  className="w-full py-4 bg-brand text-background rounded-2xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  Verify $ Authorized Session
                </button>
                <button 
                  onClick={() => setShowManual(false)}
                  className="w-full text-[9px] font-bold text-text-muted hover:text-text-primary uppercase tracking-widest text-center"
                >
                  Cancel
                </button>
              </motion.div>
            )}

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
