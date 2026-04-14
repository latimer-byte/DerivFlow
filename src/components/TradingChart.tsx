import React, { useMemo, useState } from 'react';
import { 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ComposedChart,
  Line,
  ReferenceLine
} from 'recharts';
import { format } from 'date-fns';
import { Settings2, Activity, Eye, EyeOff, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TradingChartProps {
  data: { epoch: number; quote: number }[];
  symbol: string;
}

export function TradingChart({ data, symbol }: TradingChartProps) {
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const [showSMA, setShowSMA] = useState(false);

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data.map((point, idx) => {
      let sma = null;
      if (idx >= 10) {
        const slice = data.slice(idx - 10, idx + 1);
        sma = slice.reduce((acc, curr) => acc + curr.quote, 0) / slice.length;
      }

      return {
        time: format(new Date(point.epoch * 1000), 'HH:mm:ss'),
        price: point.quote,
        sma: sma,
        timestamp: point.epoch
      };
    });
  }, [data]);

  const { minPrice, maxPrice, domain } = useMemo(() => {
    if (!data || data.length === 0) {
      return { minPrice: 0, maxPrice: 0, domain: [0, 100] };
    }
    const prices = data.map(d => d.quote);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    
    if (min === max) {
      return { minPrice: min, maxPrice: max, domain: [min * 0.99, max * 1.01] };
    }
    
    return {
      minPrice: min,
      maxPrice: max,
      domain: [min * 0.9998, max * 1.0002]
    };
  }, [data]);

  const currentPrice = data[data.length - 1]?.quote || 0;

  return (
    <div className="w-full h-full bg-card flex flex-col border-r border-border">
      {/* Chart Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-border bg-background/30">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-bold tracking-tight text-text-primary">{symbol}</span>
            <span className="hidden xs:inline text-[9px] sm:text-[10px] font-medium text-text-muted uppercase tracking-widest">Index</span>
          </div>
          
          <div className="flex bg-background border border-border rounded p-0.5">
            <ChartTypeBtn active={chartType === 'area'} onClick={() => setChartType('area')} label="Area" />
            <ChartTypeBtn active={chartType === 'bar'} onClick={() => setChartType('bar')} label="Bars" />
          </div>

          <div className="hidden sm:flex gap-1">
            {['1M', '5M', '15M', '1H', '1D'].map((t) => (
              <button key={t} className="px-2 py-1 text-[10px] font-bold rounded text-text-muted hover:text-text-primary hover:bg-secondary/20 transition-all">
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <button 
            onClick={() => setShowSMA(!showSMA)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded border transition-all text-[9px] sm:text-[10px] font-bold",
              showSMA ? "bg-brand/10 border-brand/30 text-brand" : "bg-background border-border text-text-muted hover:text-text-secondary"
            )}
          >
            <Activity className="w-3 h-3" />
            <span className="hidden xs:inline">SMA</span>
          </button>
          <button className="p-1.5 text-text-muted hover:text-text-primary transition-colors hidden sm:block">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button className="p-1.5 text-text-muted hover:text-text-primary transition-colors">
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Chart Body */}
      <div className="flex-1 min-h-0 relative p-4">
        {(!data || data.length === 0) ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
            <div className="w-8 h-8 border-2 border-brand/20 border-t-brand rounded-full animate-spin" />
            <p className="text-[11px] text-text-muted font-mono uppercase tracking-widest">Initializing Feed...</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 60, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1E90FF" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#1E90FF" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2A2F36" strokeOpacity={0.5} />
              <XAxis 
                dataKey="time" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#6E7681', fontSize: 10, fontFamily: 'Inter' }}
                minTickGap={50}
              />
              <YAxis 
                orientation="right"
                domain={domain}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#8B949E', fontSize: 10, fontFamily: 'Roboto Mono' }}
                mirror={false}
                width={50}
              />
              <Tooltip 
                content={<CustomTooltip />}
                cursor={{ stroke: '#6E7681', strokeDasharray: '3 3' }}
              />
              
              <ReferenceLine 
                y={currentPrice} 
                stroke="#1E90FF" 
                strokeDasharray="3 3" 
                label={{ 
                  position: 'right', 
                  value: currentPrice.toFixed(2), 
                  fill: '#1E90FF', 
                  fontSize: 10, 
                  fontFamily: 'Roboto Mono',
                  fontWeight: 'bold',
                  backgroundColor: '#0D1117'
                }} 
              />

              {chartType === 'area' ? (
                <Area 
                  type="monotone" 
                  dataKey="price" 
                  stroke="#1E90FF" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorPrice)" 
                  isAnimationActive={false}
                />
              ) : (
                <Bar 
                  dataKey="price" 
                  fill="#1E90FF" 
                  barSize={2}
                  isAnimationActive={false}
                />
              )}

              {showSMA && (
                <Line 
                  type="monotone" 
                  dataKey="sma" 
                  stroke="#8B949E" 
                  strokeWidth={1} 
                  dot={false}
                  strokeOpacity={0.5}
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function ChartTypeBtn({ active, onClick, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 text-[9px] font-bold rounded transition-all",
        active ? "bg-secondary text-text-primary" : "text-text-muted hover:text-text-secondary"
      )}
    >
      {label}
    </button>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border p-2 rounded shadow-2xl">
        <p className="text-[10px] text-text-muted mb-1 font-mono">{label}</p>
        <p className="text-xs font-bold font-mono text-text-primary">
          PRICE: <span className="text-brand">${payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </p>
      </div>
    );
  }
  return null;
};
