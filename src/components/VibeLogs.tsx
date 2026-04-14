import React from 'react';
import { Terminal, Code2, Cpu, Zap, Bug, Lightbulb } from 'lucide-react';
import { motion } from 'motion/react';

const logs = [
  {
    icon: Lightbulb,
    title: "Architecting the Flow",
    content: "Prompted Gemini to design a real-time WebSocket architecture for Deriv API. Decided on a singleton service pattern to manage the persistent connection and event listeners.",
    time: "Turn 1",
    color: "text-amber-400"
  },
  {
    icon: Cpu,
    title: "AI-Driven Service Layer",
    content: "Used Gemini to scaffold the DerivService. It handled the complex WebSocket handshake and subscription logic perfectly. Added a message queue for pre-connection reliability.",
    time: "Turn 2",
    color: "text-indigo-400"
  },
  {
    icon: Code2,
    title: "Visual Vibe-Coding",
    content: "Fed the UI reference image to the model. It suggested the 'Technical Dashboard' recipe from the design guidelines, focusing on high information density and neon accents.",
    time: "Turn 3",
    color: "text-emerald-400"
  },
  {
    icon: Bug,
    title: "Troubleshooting Latency",
    content: "Encountered a race condition in chart updates. Prompted for a solution: Gemini suggested using useMemo for data transformation and a throttled state update for the tick feed.",
    time: "Turn 4",
    color: "text-rose-400"
  },
  {
    icon: Zap,
    title: "Gemini Insights Integration",
    content: "Implemented the AI Insights panel. The model now analyzes real-time tick data to provide sentiment analysis, making the app feel truly 'smart'.",
    time: "Turn 5",
    color: "text-purple-400"
  }
];

export function VibeLogs() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-white mb-4 flex items-center gap-3">
          <Terminal className="w-8 h-8 text-indigo-500" />
          Vibe-Coding Documentation
        </h2>
        <p className="text-gray-400 text-lg">
          A transparent look at how AI helped architect, code, and troubleshoot TradePulse.
        </p>
      </div>

      <div className="space-y-6">
        {logs.map((log, index) => (
          <motion.div 
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-[#15181E] border border-white/5 rounded-3xl p-6 relative overflow-hidden group hover:border-indigo-500/30 transition-all"
          >
            <div className="absolute top-0 right-0 p-4">
              <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest bg-white/5 px-2 py-1 rounded-md">
                {log.time}
              </span>
            </div>
            
            <div className="flex gap-6">
              <div className={cn("p-4 rounded-2xl bg-white/5 h-fit", log.color)}>
                <log.icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="text-xl font-bold text-white mb-2">{log.title}</h4>
                <p className="text-gray-400 leading-relaxed italic">
                  "{log.content}"
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-12 p-8 bg-indigo-600/10 border border-indigo-500/20 rounded-3xl text-center">
        <h3 className="text-xl font-bold text-white mb-2">The "Vibe" Verdict</h3>
        <p className="text-gray-400">
          Building with AI isn't just about speed; it's about expanding the horizon of what's possible. 
          TradePulse was built in record time by treating the AI as a senior architect and a tireless pair programmer.
        </p>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
