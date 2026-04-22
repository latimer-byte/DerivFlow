import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Brain, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface AISentimentProps {
  symbol: string;
  history: { epoch: number; quote: number }[];
}

export function AISentiment({ symbol, history }: AISentimentProps) {
  const [sentiment, setSentiment] = useState<{
    score: number;
    label: string;
    reason: string;
    confidence: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const analyzeSentiment = async () => {
    if (history.length < 10) return;
    
    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Prepare data for the model
      const prices = history.slice(-50).map(h => h.quote).join(', ');
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze the following price data for ${symbol} and provide a market sentiment analysis.
        Prices (last 50 ticks): ${prices}
        
        Provide the result in JSON format with:
        - score: a number from -100 (extremely bearish) to 100 (extremely bullish)
        - label: "Bullish", "Bearish", or "Neutral"
        - reason: a concise 1-sentence explanation of the trend
        - confidence: a percentage (0-100)`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              label: { type: Type.STRING },
              reason: { type: Type.STRING },
              confidence: { type: Type.NUMBER }
            },
            required: ["score", "label", "reason", "confidence"]
          }
        }
      });

      const result = JSON.parse(response.text);
      setSentiment(result);
    } catch (error) {
      console.error('AI Sentiment Analysis failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(analyzeSentiment, 30000); // Analyze every 30 seconds
    analyzeSentiment();
    return () => clearInterval(interval);
  }, [symbol]);

  if (!sentiment && !isLoading) return null;

  return (
    <div className="bg-card/50 border border-border rounded-xl p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-brand/10 rounded-lg">
            <Brain className="w-4 h-4 text-brand" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-text-primary">AI Market Sentiment</span>
        </div>
        {isLoading && <Loader2 className="w-3 h-3 animate-spin text-brand" />}
      </div>

      {sentiment && (
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-2">
              {sentiment.label === 'Bullish' && <TrendingUp className="w-5 h-5 text-bullish" />}
              {sentiment.label === 'Bearish' && <TrendingDown className="w-5 h-5 text-bearish" />}
              {sentiment.label === 'Neutral' && <Minus className="w-5 h-5 text-text-muted" />}
              <span className={cn(
                "text-lg font-black uppercase italic",
                sentiment.label === 'Bullish' ? "text-bullish" : 
                sentiment.label === 'Bearish' ? "text-bearish" : "text-text-muted"
              )}>
                {sentiment.label}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-text-muted uppercase font-bold">Confidence</span>
              <p className="text-xs font-mono font-bold text-text-primary">{sentiment.confidence}%</p>
            </div>
          </div>

          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${(sentiment.score + 100) / 2}%` }}
              className={cn(
                "h-full transition-all duration-1000",
                sentiment.score > 20 ? "bg-bullish" : 
                sentiment.score < -20 ? "bg-bearish" : "bg-brand"
              )}
            />
          </div>

          <p className="text-[11px] text-text-secondary leading-relaxed italic">
            "{sentiment.reason}"
          </p>
        </div>
      )}
    </div>
  );
}
