import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  constructor(props: Props) {
    super(props);
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Handshake/Terminal Crash:', error, errorInfo);
  }

  private handleReset = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      let errorMessage = "A critical system error occurred.";
      
      try {
        const errorStr = this.state.error?.message || "";
        if (errorStr.startsWith('{')) {
          const parsed = JSON.parse(errorStr);
          if (parsed.error) {
            errorMessage = `System Logic Fault: ${parsed.error}`;
          }
        } else {
          errorMessage = errorStr || errorMessage;
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4" id="error-screen">
          <div className="bg-card border border-border rounded-[2rem] p-8 max-w-md w-full text-center shadow-2xl glass-effect">
            <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-500/20">
              <span className="text-3xl text-rose-500">⚡</span>
            </div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">Terminal Offline</h2>
            <p className="text-text-muted text-sm mb-8 leading-relaxed">
              We've encountered a logic synchronization error: <br/>
              <span className="text-rose-500 font-mono mt-2 block">{errorMessage}</span>
            </p>
            <div className="space-y-3">
              <button 
                id="reload-button"
                onClick={() => window.location.reload()}
                className="w-full bg-brand text-white rounded-xl py-4 font-bold text-sm hover:bg-brand-hover transition-all shadow-lg shadow-brand/20 active:scale-95"
              >
                Reload Application
              </button>
              <button 
                id="reset-button"
                onClick={this.handleReset}
                className="w-full bg-secondary text-text-primary border border-border rounded-xl py-4 font-bold text-sm hover:bg-secondary/80 transition-all active:scale-95"
              >
                Reset App & Clear Cache
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
