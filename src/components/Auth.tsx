import React, { useState, useEffect } from 'react';
import { Zap, Lock, ArrowRight, Key } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { derivApi } from '@/services/derivApi';

interface AuthProps {
  onLogin: (user: any) => void;
}

export function Auth({ onLogin }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [customClientId, setCustomClientId] = useState('336Jcj20DczhY7sKLv2Ri');
  const [customRedirectUri, setCustomRedirectUri] = useState(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://deriv-flow.vercel.app';
    return `${origin}/callback`;
  });

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

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
    
    if (!isLogin && password !== confirmPassword) {
      alert("Terminal Security Violation: Secret keys do not match.");
      return;
    }
    
    setLoading(true);
    try {
      // Direct Firebase Login
      const { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } = await import('@/lib/firebase');
      let userCredential;
      
      const emailValue = identifier.includes('@') ? identifier : `${identifier}@tradepulse.io`;

      if (isLogin) {
        userCredential = await signInWithEmailAndPassword(emailValue, password);
      } else {
        userCredential = await createUserWithEmailAndPassword(emailValue, password);
        // @ts-ignore
        await updateProfile(userCredential.user, {
          displayName: displayName || identifier.split('@')[0]
        });
      }

      const userData = {
        name: displayName || userCredential.user.displayName || identifier.split('@')[0],
        email: emailValue,
        uid: userCredential.user.uid,
        authType: 'firebase' as const
      };
      
      onLogin(userData);
      localStorage.setItem('tradepulse_user', JSON.stringify(userData));
    } catch (error: any) {
      console.error('Credentials login failed:', error);
      alert(`Terminal Access Denied: ${error.code === 'auth/user-not-found' ? 'Account not discovered.' : error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDerivLogin = async (forceSignup = false) => {
    setLoading(true);
    try {
      const clientId = customClientId;
      const redirectUri = customRedirectUri;
      
      console.log(`Deriv OAuth Invitation:`);
      console.log(`- Client ID: ${clientId}`);
      console.log(`- Redirect URI: ${redirectUri}`);
      console.log(`- Note: Ensure this Redirect URI is whitelisted in your Deriv API Dashboard (https://api.deriv.com/app-registration)`);
      
      // PKCE
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
      
      // Use the full client ID for OAuth, don't truncate alphanumeric ones
      const oauthClientId = clientId; 
      sessionStorage.setItem('oauth_client_id', oauthClientId);
      sessionStorage.setItem('oauth_redirect_uri', redirectUri);

      const baseUrl = "https://auth.deriv.com/oauth2/auth";
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: oauthClientId,
        redirect_uri: redirectUri,
        scope: 'trade account_manage',
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        app_id: oauthClientId // In some cases app_id is also alphanumeric in newer Deriv API
      });

      if (forceSignup) params.append('prompt', 'registration');

      const derivLoginUrl = `${baseUrl}?${params.toString()}`;
      
      const width = 600;
      const height = 750;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        derivLoginUrl, 
        'DerivLogin', 
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,toolbar=no,menubar=no,scrollbars=yes`
      );

      if (popup) {
        const timer = setInterval(() => {
          if (popup.closed) {
            clearInterval(timer);
            setLoading(false);
          }
        }, 1000);
      } else {
        alert('Universal Handshake Interrupted: Please enable popups to sync with Deriv Cloud.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Deriv OAuth initiation failed:', error);
      setLoading(false);
    }
  };

  const handleManualTokenLogin = () => {
    if (!manualToken.trim()) return;
    
    setLoading(true);
    // Simulate successful OAuth result with direct token
    const userData = {
      name: 'Deriv Trader',
      id: `CR${Math.floor(Math.random() * 9000 + 1000)}`,
      email: 'manual-token',
      uid: `manual_${Date.now()}`,
      authType: 'deriv' as const,
      derivToken: manualToken.trim()
    };
    
    setTimeout(() => {
      onLogin(userData);
      localStorage.setItem('tradepulse_user', JSON.stringify(userData));
      localStorage.setItem('deriv_token', manualToken.trim());
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row items-stretch justify-center overflow-hidden">
      {/* Visual Side (Left) */}
      <div className="hidden md:flex md:w-1/2 bg-[#0a0a0a] relative items-center justify-center p-12 overflow-hidden border-r border-[#1a1a1a]">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-rose-500/5 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />
          <div className="absolute inset-0 technical-grid opacity-[0.03]" />
          
          {/* Animated Matrix-like lines */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
             {[...Array(6)].map((_, i) => (
               <motion.div
                 key={i}
                 initial={{ y: -100, opacity: 0 }}
                 animate={{ y: 800, opacity: [0, 1, 0] }}
                 transition={{ 
                   duration: 5 + i, 
                   repeat: Infinity, 
                   ease: "linear",
                   delay: i * 0.8
                 }}
                 style={{ left: `${(i + 1) * 15}%` }}
                 className="absolute w-[1px] h-32 bg-gradient-to-b from-transparent via-brand to-transparent"
               />
             ))}
          </div>
        </div>
        
        <div className="relative z-10 max-w-md">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
            className="mb-10"
          >
            <div className="w-16 h-16 bg-brand rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(255,68,0,0.3)]">
              <Zap className="text-black w-8 h-8 fill-black" />
            </div>
          </motion.div>
          
          <div className="space-y-6">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-6xl font-black italic uppercase tracking-tighter text-white leading-none mb-1">
                Trade<span className="text-brand">Pulse</span>
              </h1>
              <p className="text-brand text-xs font-black uppercase tracking-[0.4em] mb-4">Autonomous Intelligence</p>
            </motion.div>

            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-text-muted text-sm font-medium uppercase tracking-widest leading-relaxed max-w-xs"
            >
              The definitive frontier for synthetic assets and low-latency algorithmic execution.
            </motion.p>
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-16 flex flex-wrap gap-4"
          >
            <div className="px-4 py-2 border border-white/5 bg-white/[0.02] rounded-xl flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Network: Live</span>
            </div>
            <div className="px-4 py-2 border border-white/5 bg-white/[0.02] rounded-xl flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Latency: 12ms</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Auth Side (Right) */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-12 bg-background">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          {/* Header */}
          <div className="mb-10 text-center md:text-left transition-all">
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-text-primary mb-2">
              {isLogin ? 'Access System' : 'Initialize Node'}
            </h2>
            <p className="text-text-muted text-[10px] font-black uppercase tracking-widest">
              {isLogin ? 'Standard Authentication Protocol' : 'New User Onboarding Sequence'}
            </p>
          </div>

          <div className="space-y-6">
            {/* Primary Action: Deriv Sync */}
            <div className="space-y-3">
               <button 
                onClick={() => handleDerivLogin(!isLogin)}
                disabled={loading}
                className="w-full relative group flex items-center justify-center gap-4 py-5 bg-brand text-black rounded-2xl transition-all shadow-[0_0_20px_rgba(255,68,0,0.15)] hover:shadow-[0_0_30px_rgba(255,68,0,0.25)] hover:-translate-y-0.5 active:translate-y-0"
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                <Zap className="w-5 h-5 fill-black" />
                <span className="text-xs font-black uppercase tracking-[0.2em]">Sync with Deriv Node</span>
                {loading && (
                   <div className="absolute right-6 w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                )}
              </button>
              
              {!showConfig ? (
                <div className="flex justify-center">
                  <button 
                    onClick={() => setShowConfig(true)}
                    className="text-[9px] font-black text-text-muted hover:text-brand uppercase tracking-tighter transition-colors"
                  >
                    Handshake Settings
                  </button>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card/50 border border-border rounded-xl p-4 space-y-3"
                >
                  <div className="flex justify-between items-center px-1">
                    <p className="text-[9px] font-black text-brand uppercase">Node Config</p>
                    <button onClick={() => setShowConfig(false)} className="text-[9px] text-text-muted hover:text-white">✕</button>
                  </div>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-text-muted uppercase">Client ID</label>
                      <input 
                        value={customClientId}
                        onChange={(e) => {
                          setCustomClientId(e.target.value);
                          const numericAppId = e.target.value.match(/^(\d+)/)?.[1];
                          if (numericAppId) derivApi.setAppId(numericAppId);
                        }}
                        className="w-full bg-background border border-border/50 rounded-lg p-2 text-[10px] font-mono text-text-primary focus:border-brand outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-text-muted uppercase">Redirect URI</label>
                      <input 
                        value={customRedirectUri}
                        onChange={(e) => setCustomRedirectUri(e.target.value)}
                        className="w-full bg-background border border-border/50 rounded-lg p-2 text-[10px] font-mono text-text-primary focus:border-brand outline-none"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-black tracking-[0.3em]">
                <span className="bg-background px-3 text-text-muted">Legacy Route</span>
              </div>
            </div>

            {/* Email/Password Flow */}
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-4">
                {!isLogin && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-1"
                  >
                    <label className="text-[9px] font-black text-text-muted uppercase tracking-widest pl-1">Full Name</label>
                    <input 
                      type="text"
                      placeholder="YOUR NAME"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required={!isLogin}
                      className="w-full bg-secondary/20 border border-border focus:border-brand/40 hover:border-border-strong rounded-2xl py-4 px-5 text-xs font-bold text-text-primary outline-none transition-all placeholder:text-text-muted/30"
                    />
                  </motion.div>
                )}
                
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-text-muted uppercase tracking-widest pl-1">
                    {isLogin ? 'Identifier' : 'Email Address'}
                  </label>
                  <input 
                    type={isLogin ? "text" : "email"}
                    placeholder={isLogin ? "USERNAME / EMAIL" : "user@example.com"}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    className="w-full bg-secondary/20 border border-border focus:border-brand/40 hover:border-border-strong rounded-2xl py-4 px-5 text-xs font-bold text-text-primary outline-none transition-all placeholder:text-text-muted/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-text-muted uppercase tracking-widest pl-1">Secret Key</label>
                  <input 
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-secondary/20 border border-border focus:border-brand/40 hover:border-border-strong rounded-2xl py-4 px-5 text-xs font-bold text-text-primary outline-none transition-all placeholder:text-text-muted/30"
                  />
                </div>
                
                {!isLogin && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-1"
                  >
                    <label className="text-[9px] font-black text-text-muted uppercase tracking-widest pl-1">Confirm Secret Key</label>
                    <input 
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required={!isLogin}
                      className="w-full bg-secondary/20 border border-border focus:border-brand/40 hover:border-border-strong rounded-2xl py-4 px-5 text-xs font-bold text-text-primary outline-none transition-all placeholder:text-text-muted/30"
                    />
                  </motion.div>
                )}
                
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 border border-border hover:border-text-primary bg-transparent text-text-primary rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                >
                  {isLogin ? 'Execute Login' : 'Register Node'}
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </form>

            {/* Manual Token Fallback */}
            <div className="pt-2">
              {!showManual ? (
                <button 
                  onClick={() => setShowManual(true)}
                  className="w-full text-center text-[9px] font-black text-text-muted hover:text-brand uppercase tracking-[0.15em] transition-colors"
                >
                  Manual API Token Authorization
                </button>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-3 pt-2"
                >
                  <input 
                    type="password"
                    placeholder="PASTE AUTHORIZATION CODE"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    className="w-full bg-secondary/20 border border-border focus:border-brand/40 rounded-2xl py-3 px-5 text-[10px] font-mono text-text-primary outline-none transition-all"
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={handleManualTokenLogin}
                      className="flex-1 py-3 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl text-[9px] font-black text-white uppercase tracking-widest"
                    >
                      Auth Token
                    </button>
                    <button 
                      onClick={() => setShowManual(false)}
                      className="px-4 py-3 text-[9px] font-black text-text-muted hover:text-white uppercase"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-border flex flex-col items-center gap-4">
             <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-[10px] font-black text-text-muted hover:text-brand uppercase tracking-widest transition-colors"
            >
              {isLogin ? "Need a terminal node?" : "Already synchronized?"}{' '}
              <span className="text-brand ml-1">
                {isLogin ? 'Create Account' : 'Sign In Instead'}
              </span>
            </button>
            
            <div className="flex items-center gap-6 opacity-40">
               <div className="flex items-center gap-1.5">
                  <Lock className="w-2.5 h-2.5" />
                  <span className="text-[8px] font-black uppercase tracking-tighter">AES-256</span>
               </div>
               <div className="flex items-center gap-1.5">
                  <Zap className="w-2.5 h-2.5" />
                  <span className="text-[8px] font-black uppercase tracking-tighter">Real-time</span>
               </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
