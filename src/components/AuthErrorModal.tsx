import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, ArrowRight, X, AlertOctagon } from 'lucide-react';

interface AuthErrorModalProps {
  error: string | null;
  onClear: () => void;
  onRetry: () => void;
}

export const AuthErrorModal: React.FC<AuthErrorModalProps> = ({ error, onClear, onRetry }) => {
  if (!error) return null;

  // Semantic analysis of common Deriv errors
  const isSecurityReject = error.toLowerCase().includes('security') || error.toLowerCase().includes('reject');
  const isRedirectMismatch = error.toLowerCase().includes('redirect') || error.toLowerCase().includes('invalid_request');
  const isAppIdIssue = error.toLowerCase().includes('app id') || error.toLowerCase().includes('405');

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-card border border-rose-500/30 p-8 rounded-[2.5rem] max-w-md w-full shadow-2xl shadow-rose-500/10 overflow-hidden relative glass-effect"
        >
          {/* Cyberpunk accent */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]" />
          
          <button 
            onClick={onClear}
            className="absolute top-6 right-6 p-2 text-text-muted hover:text-text-primary transition-colors hover:bg-white/5 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-20 h-20 bg-rose-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
            <AlertOctagon className="text-rose-500 w-10 h-10 animate-pulse" />
          </div>
          
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-text-primary mb-2 text-center leading-none">
            Handshake Error
          </h2>
          
          <div className="bg-black/40 rounded-2xl p-5 mb-8 border border-white/5 inner-shadow">
            <p className="text-[10px] font-mono text-rose-400 uppercase tracking-widest leading-relaxed text-center font-bold break-words">
              {error}
            </p>
          </div>

          <div className="space-y-4 mb-10">
            <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] mb-4 text-center">Troubleshooting Sequence</h3>
            
            <div className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${isRedirectMismatch ? 'bg-rose-500/10 border-rose-500/50' : 'bg-white/5 border-white/5'}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${isRedirectMismatch ? 'bg-rose-500 text-white' : 'bg-white/10 text-white'}`}>
                <span className="text-xs font-bold font-mono">01</span>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest mb-1 text-text-primary">Redirect URI Conflict</p>
                <p className="text-[10px] text-text-secondary uppercase leading-relaxed font-medium">
                  Ensure your Deriv Dashboard matches this terminal's origin URL exactly. No trailing slashes.
                </p>
              </div>
            </div>

            <div className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${isSecurityReject || isAppIdIssue ? 'bg-rose-500/10 border-rose-500/50' : 'bg-white/5 border-white/5'}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${isSecurityReject || isAppIdIssue ? 'bg-rose-500 text-white' : 'bg-white/10 text-white'}`}>
                <span className="text-xs font-bold font-mono">02</span>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest mb-1 text-text-primary">Entity Authentication</p>
                <p className="text-[10px] text-text-secondary uppercase leading-relaxed font-medium">
                  Verify your App ID (numeric or alphanumeric) is registered and whitelisted for this domain.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold font-mono">03</span>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest mb-1 text-text-primary">Protocol mismatch</p>
                <p className="text-[10px] text-text-secondary uppercase leading-relaxed font-medium">
                  Confirm you are using an "Authorization Code" grant type in the Deriv API control panel.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <a 
              href="https://api.deriv.com/app-registration" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-5 bg-brand text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-brand-hover transition-all shadow-lg shadow-brand/20"
            >
              Access API Dashboard
              <ArrowRight className="w-4 h-4" />
            </a>
            <button 
              onClick={onRetry}
              className="w-full py-5 bg-white/5 text-text-primary border border-border rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              Reset Protocol & Login
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
