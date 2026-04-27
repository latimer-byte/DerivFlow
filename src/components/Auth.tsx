import React, { useState, useEffect } from 'react';
import { Zap, Lock, ArrowRight, Key, CheckCircle2 } from 'lucide-react';
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
  const [customAppId, setCustomAppId] = useState('336Jcj20DczhY7sKLv2Ri');
  const [expectedRedirectUri, setExpectedRedirectUri] = useState('');
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin.replace(/\/$/, '');
      const uri = `${origin}/callback`;
      setExpectedRedirectUri(uri);
      setCustomRedirectUri(prev => (!prev || prev.includes('deriv-flow.vercel.app')) ? uri : prev);
    }
  }, []);

  const [customRedirectUri, setCustomRedirectUri] = useState('');
  const [registeredRedirectUri, setRegisteredRedirectUri] = useState('');
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [showWhitelistingHelp, setShowWhitelistingHelp] = useState(false);
  const [uriMismatch, setUriMismatch] = useState(false);

  useEffect(() => {
    setUriMismatch(customRedirectUri !== expectedRedirectUri);
  }, [customRedirectUri, expectedRedirectUri]);

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
      const appId = customAppId;
      const redirectUri = customRedirectUri;
      
      console.log(`Deriv OAuth Handshake Initiation:`);
      console.log(`- Client ID: ${clientId}`);
      console.log(`- Legacy App ID: ${appId}`);
      console.log(`- Redirect URI: ${redirectUri}`);
      
      // 1. Generate a random code_verifier
      const array = crypto.getRandomValues(new Uint8Array(64));
      const codeVerifier = Array.from(array)
        .map(v => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[v % 66])
        .join('');

      // 2. Derive the code_challenge
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
      const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // 3. Generate a random state for CSRF protection
      const state = crypto.getRandomValues(new Uint8Array(16))
        .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');

      // 4. Store code_verifier and state before redirecting
      sessionStorage.setItem('pkce_code_verifier', codeVerifier);
      sessionStorage.setItem('oauth_state', state);
      sessionStorage.setItem('oauth_client_id', clientId);
      sessionStorage.setItem('oauth_redirect_uri', redirectUri);

      const baseUrl = "https://auth.deriv.com/oauth2/auth";
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'trade account_manage',
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        app_id: appId // Legacy App ID mapping
      });

      if (forceSignup) params.append('prompt', 'registration');

      const derivLoginUrl = `${baseUrl}?${params.toString()}`;
      console.log(`Deriv OAuth URL: ${derivLoginUrl}`);
      
      const width = 600;
      const height = 750;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const whitelistNotice = `Handshake Security Required.
      
Ensure this Redirect URI is whitelisted in your Deriv API Dashboard (https://api.deriv.com/app-registration):
${redirectUri}

Client ID: ${clientId}
Legacy App ID: ${appId}

${registeredRedirectUri && registeredRedirectUri !== redirectUri ? 
  `CRITICAL MISMATCH DETECTED: 
Your dashboard registered URI "${registeredRedirectUri}" does NOT match the terminal URI "${redirectUri}". 
This WILL result in an "invalid_request" error on Deriv.` : 
  `If you see an "invalid_request" error on Deriv, please verify your whitelisted domains exactly match the URL above.`
}

Connect to Deriv terminal?`;

      if (window.confirm(whitelistNotice)) {
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
          alert('Popup Terminated: Handshake could not be established.');
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Handshake initiation failed:', error);
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
    <div className="min-h-screen bg-background flex flex-col md:flex-row items-stretch justify-center overflow-hidden font-sans">
      {/* Visual Side (Left) */}
      <div className="hidden md:flex md:w-1/2 bg-[#020202] relative items-center justify-center p-12 overflow-hidden border-r border-border">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-rose-500/5 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />
          
          {/* Cyberpunk Grid */}
          <div className="absolute inset-0 technical-grid opacity-[0.05]" />
          
          {/* Scanning Line Animation */}
          <motion.div 
            animate={{ top: ['0%', '100%', '0%'] }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute left-0 right-0 h-[1px] bg-brand/20 z-10"
          />
        </div>
        
        <div className="relative z-10 max-w-md text-center">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-10 inline-block"
          >
            <div className="w-20 h-20 bg-brand rounded-sm flex items-center justify-center shadow-[0_0_50px_rgba(255,68,0,0.4)] rotate-45">
              <Zap className="text-black w-10 h-10 fill-black -rotate-45" />
            </div>
          </motion.div>
          
          <div className="space-y-4">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-7xl font-black italic uppercase tracking-tighter text-white leading-none">
                PULSE<span className="text-brand">O1</span>
              </h1>
              <p className="text-brand text-[10px] font-black uppercase tracking-[0.6em] mt-2">Tactical Trading Node</p>
            </motion.div>

            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-text-secondary text-[11px] font-bold uppercase tracking-widest leading-loose max-w-xs mx-auto"
            >
              High-Frequency Neural Execution Protocol. <br/>
              Standardized for Modern Assets.
            </motion.p>
          </div>
        </div>
      </div>

      {/* Auth Side (Right) */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-12">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-sm"
        >
          {/* Header */}
          <div className="mb-12">
            <div className="inline-block px-2 py-0.5 bg-brand/10 border border-brand/20 mb-4">
              <span className="text-[9px] font-black text-brand uppercase tracking-widest">Auth_Protocol_v4.2</span>
            </div>
            <h2 className="text-4xl font-black italic uppercase tracking-tighter text-text-primary">
              Initialize
            </h2>
            <AnimatePresence>
              {uriMismatch && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex flex-col gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
                      <Lock className="w-4 h-4 text-rose-500" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Security Warning: URI Mismatch</p>
                      <p className="text-[9px] text-text-secondary uppercase leading-relaxed font-bold">
                        The current Redirect URI does not match the browser's origin. Handshake will fail.
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setCustomRedirectUri(expectedRedirectUri);
                      setShowConfig(true);
                    }}
                    className="w-full py-2 bg-rose-500 text-white rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-rose-600 transition-colors"
                  >
                    Auto-Correct Redirect URI
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
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
                      <label className="text-[8px] font-black text-text-muted uppercase">OAuth Client ID (Alphanumeric)</label>
                      <input 
                        value={customClientId}
                        placeholder="e.g. app12345 or 336J..."
                        onChange={(e) => setCustomClientId(e.target.value)}
                        className="w-full bg-background border border-border/50 rounded-lg p-2 text-[10px] font-mono text-text-primary focus:border-brand outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-text-muted uppercase">WebSocket App ID (Numeric)</label>
                      <input 
                        value={customAppId}
                        placeholder="e.g. 1089"
                        onChange={(e) => {
                          setCustomAppId(e.target.value);
                          if (e.target.value.length > 0) derivApi.setAppId(e.target.value);
                        }}
                        className="w-full bg-background border border-border/50 rounded-lg p-2 text-[10px] font-mono text-text-primary focus:border-brand outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[8px] font-black text-text-muted uppercase tracking-tighter">
                          Redirect URI (Required)
                        </label>
                        {customRedirectUri !== expectedRedirectUri && (
                          <button 
                            onClick={() => setCustomRedirectUri(expectedRedirectUri)}
                            className="text-[7px] font-bold text-brand hover:underline uppercase"
                          >
                            Sync with Browser
                          </button>
                        )}
                      </div>
                      <input 
                        value={customRedirectUri}
                        onChange={(e) => setCustomRedirectUri(e.target.value)}
                        className={cn(
                          "w-full bg-background border rounded-lg p-2 text-[10px] font-mono outline-none transition-all",
                          customRedirectUri !== expectedRedirectUri ? "border-rose-500/50 text-rose-500 focus:border-rose-500" : "border-border/50 text-text-primary focus:border-brand"
                        )}
                      />
                    </div>

                    <div className="pt-2">
                       <button 
                        onClick={() => setShowDiagnostic(!showDiagnostic)}
                        className="w-full text-center text-[7px] font-black text-text-muted hover:text-brand uppercase"
                      >
                        {showDiagnostic ? 'Hide Validation Terminal' : 'Run Redirect Validator'}
                      </button>
                    </div>

                    {showDiagnostic && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-2"
                      >
                        <div className="space-y-1">
                          <label className="text-[7px] font-black text-white/40 uppercase">Your Dashboard Registered URI</label>
                          <input 
                            placeholder="PASTE FROM DERIV DASHBOARD"
                            value={registeredRedirectUri}
                            onChange={(e) => setRegisteredRedirectUri(e.target.value)}
                            className="w-full bg-transparent border-b border-white/10 p-1 text-[9px] font-mono text-brand focus:border-brand outline-none"
                          />
                        </div>
                        
                        {registeredRedirectUri && (
                          <div className={cn(
                            "p-2 rounded-lg text-[8px] font-bold flex items-center gap-2",
                            registeredRedirectUri === customRedirectUri ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                          )}>
                            {registeredRedirectUri === customRedirectUri ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                <span>URI ALIGNMENT VERIFIED</span>
                              </>
                            ) : (
                              <>
                                <Zap className="w-3 h-3" />
                                <span>URI MISMATCH: Handshake will fail</span>
                              </>
                            )}
                          </div>
                        )}
                        <p className="text-[7px] leading-relaxed text-text-muted uppercase font-medium">
                          Note: Deriv requires an absolute match including trailing slashes and protocol (https://).
                        </p>
                      </motion.div>
                    )}

                    <div className="pt-1">
                      <button 
                        onClick={() => setShowWhitelistingHelp(!showWhitelistingHelp)}
                        className="w-full text-center text-[7px] font-black text-rose-500/60 hover:text-rose-500 uppercase flex items-center justify-center gap-1"
                      >
                        <Lock className="w-2 h-2" />
                        Whitelisting Diagnostic
                      </button>
                    </div>

                    {showWhitelistingHelp && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-3 bg-rose-500/5 rounded-xl border border-rose-500/10 space-y-2"
                      >
                        <p className="text-[8px] text-text-primary uppercase font-bold text-center">Dashboard Setup Required</p>
                        <div className="space-y-1">
                          <label className="text-[7px] font-black text-text-muted uppercase">Copy this domain to whitelist:</label>
                          <div className="flex items-center gap-2 p-2 bg-black border border-white/5 rounded-lg">
                            <code className="text-[9px] font-mono text-brand break-all flex-1">
                              {typeof window !== 'undefined' ? window.location.hostname : '...'}
                            </code>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(window.location.hostname);
                                alert('Domain copied! Paste this into "Whitelisted Domains" at api.deriv.com');
                              }}
                              className="text-[7px] font-black text-brand uppercase hover:underline"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                        <p className="text-[7px] leading-relaxed text-text-muted uppercase font-medium">
                          Paste the above domain and click "Register" on the Deriv dashboard to fix "Security Reject" errors.
                        </p>
                      </motion.div>
                    )}
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
