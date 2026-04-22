import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, BrainCircuit } from 'lucide-react';
import { getMarketInsights } from '../services/geminiService';
import { motion, AnimatePresence } from 'motion/react';

interface AIInsightsPanelProps {
  symbol: string;
  currentPrice: number;
  history: any[];
}

export function AIInsightsPanel({ symbol, currentPrice, history }: AIInsightsPanelProps) {
  const [insights, setInsights] = useState<string>('Analyzing market patterns...');
  const [loading, setLoading] = useState(false);

  const fetchInsights = async () => {
    if (loading) return;
    setLoading(true);
    const result = await getMarketInsights(symbol, currentPrice, history);
    setInsights(result);
    setLoading(false);
  };

  useEffect(() => {
    fetchInsights();
  }, [symbol]);

  return (
    <div className="bg-card border border-border rounded-3xl p-6 shadow-xl h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-brand/10 rounded-lg">
            <BrainCircuit className="w-5 h-5 text-brand" />
          </div>
          <h3 className="text-lg font-bold text-foreground">AI Market Insights</h3>
        </div>
        <button 
          onClick={fetchInsights}
          disabled={loading}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 relative">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center text-center p-4"
            >
              <Sparkles className="w-8 h-8 text-brand mb-4 animate-pulse" />
              <p className="text-sm text-muted-foreground font-medium">Gemini is processing real-time market signals...</p>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="bg-brand/5 border border-brand/10 rounded-2xl p-4">
                <p className="text-sm text-foreground leading-relaxed italic">
                  "{insights}"
                </p>
              </div>
              
              <div className="space-y-3">
                <InsightBadge label="Sentiment" value="Bullish" color="emerald" />
                <InsightBadge label="Volatility" value="High" color="amber" />
                <InsightBadge label="Confidence" value="84%" color="brand" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-6 pt-6 border-t border-border">
        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Powered by Google Gemini 2.0</p>
      </div>
    </div>
  );
}

function InsightBadge({ label, value, color }: any) {
  const colors: any = {
    emerald: "text-emerald-500 bg-emerald-500/10",
    amber: "text-amber-500 bg-amber-500/10",
    brand: "text-brand bg-brand/10",
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${colors[color]}`}>
        {value}
      </span>
    </div>
  );
}
