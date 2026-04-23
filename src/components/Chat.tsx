import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Trash2, Maximize2, Minimize2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { getChatResponse } from '@/services/geminiService';

interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

interface ChatProps {
  user: any;
  marketContext?: {
    symbol: string;
    price: number;
  };
}

export function Chat({ user, marketContext }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('tradepulse_chat_history');
    return saved ? JSON.parse(saved) : [{
      role: 'model',
      content: `Hello ${user?.name || 'Trader'}, I am PulseAI. How can I assist your trading strategy today?`,
      timestamp: Date.now()
    }];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    localStorage.setItem('tradepulse_chat_history', JSON.stringify(messages));
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.concat(userMessage).map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await getChatResponse(history, marketContext);
      
      const aiMessage: Message = {
        role: 'model',
        content: response,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    if (confirm('Are you sure you want to clear the conversation?')) {
      const initialMessage: Message = {
        role: 'model',
        content: `Conversation cleared. Ready for your next inquiry, ${user?.name || 'Trader'}.`,
        timestamp: Date.now()
      };
      setMessages([initialMessage]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="p-6 border-b border-border bg-background/30 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center">
            <Bot className="w-6 h-6 text-brand" />
          </div>
          <div>
            <h2 className="text-xl font-black italic uppercase tracking-widest text-text-primary">PulseAI</h2>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-bullish animate-pulse" />
              <span className="text-[10px] font-bold text-text-muted uppercase">Neural Link Established</span>
            </div>
          </div>
        </div>
        <button 
          onClick={clearChat}
          className="p-2.5 hover:bg-rose-500/10 text-text-muted hover:text-rose-500 rounded-xl transition-all"
          title="Clear Conversation"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {messages.map((msg, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex gap-4 max-w-[85%]",
              msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
              msg.role === 'user' ? "bg-secondary border-border" : "bg-card border-brand/20"
            )}>
              {msg.role === 'user' ? <User className="w-5 h-5 text-text-primary" /> : <Bot className="w-5 h-5 text-brand" />}
            </div>
            <div className={cn(
              "flex flex-col",
              msg.role === 'user' ? "items-end" : ""
            )}>
              <div className={cn(
                "p-4 rounded-2xl text-sm leading-relaxed",
                msg.role === 'user' 
                  ? "bg-secondary text-text-primary rounded-tr-none" 
                  : "bg-background border border-border text-text-secondary rounded-tl-none"
              )}>
                {msg.content}
              </div>
              <span className="text-[9px] font-bold text-text-muted uppercase mt-1 px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <div className="flex gap-4 max-w-[85%]">
            <div className="w-10 h-10 rounded-xl bg-card border border-brand/20 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-brand animate-pulse" />
            </div>
            <div className="bg-background border border-border p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
              <div className="w-1 h-1 bg-brand rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-1 h-1 bg-brand rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1 h-1 bg-brand rounded-full animate-bounce" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-6 border-t border-border bg-background/50">
        <div className="relative group">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type your trading inquiry..."
            className="w-full bg-secondary/50 border border-border rounded-2xl py-4 pl-4 pr-16 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all resize-none min-h-[56px] max-h-[120px]"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-2 p-2.5 bg-brand text-white rounded-xl shadow-lg shadow-brand/20 hover:bg-brand-hover transition-all disabled:opacity-50 disabled:shadow-none"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between px-1">
          <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-brand" />
            Empowered by Gemini 2.0
          </p>
          <p className="text-[10px] text-text-muted font-medium">Shift + Enter for new line</p>
        </div>
      </div>
    </div>
  );
}
