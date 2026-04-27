import React, { useMemo, useState } from 'react';
import { 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
  Cell,
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
  candles?: { epoch: number; open: number; high: number; low: number; close: number }[];
  symbol: string;
  timeframe: string;
  onTimeframeChange: (t: string) => void;
}

// Custom Candle Shape component
const CandleShape = (props: any) => {
  const { x, y, width, height, low, high, open, close, isUp } = props;
  
  // y is the top of the body, height is the height of the body
  // low and high are absolute price values
  // We need to convert low/high to SVG coordinates
  // But Recharts Bar already provides the coordinate range in some props or we calculate it
  
  // For simplicity in a Bar component,Recharts gives us x, y, width, height for the bar itself
  // If we use 'wick' as the dataKey, [low, high] defines the bar's y and height
  // If we use 'body' as the dataKey, [open, close] defines the bar's y and height
  
  // To render a full candle, we can use the Bar for 'body' and draw the wick internally
  // Or better: use a specialized Bar shape for the body that also draws the wick.
  
  const fill = isUp ? 'var(--color-bullish)' : 'var(--color-bearish-fill)';
  const stroke = isUp ? 'var(--color-bullish)' : 'var(--color-bearish)';
  
  // Calculate wick coordinates relative to x, y, width, height
  // This is tricky because Bar 'y' and 'height' are for the body OR the wick depending on dataKey
  // Let's assume this shape is called for the 'body' bar
  
  return (
    <g>
      {/* Wick (vertical line) */}
      <line 
        x1={x + width / 2} 
        y1={props.wickY1} // We'll pass these in the data
        x2={x + width / 2} 
        y2={props.wickY2} 
        stroke={stroke} 
        strokeWidth={1} 
      />
      {/* Body */}
      <rect 
        x={x} 
        y={y} 
        width={width} 
        height={height} 
        fill={fill} 
        stroke={stroke}
        strokeWidth={1}
      />
    </g>
  );
};

export function TradingChart({ data, candles, symbol, timeframe, onTimeframeChange }: TradingChartProps) {
  const [chartType, setChartType] = useState<'area' | 'candle'>('candle');
  const [showSMA, setShowSMA] = useState(false);
  const [showRSI, setShowRSI] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const { domain } = useMemo(() => {
    let prices: number[] = [];
    if (chartType === 'candle' && candles && candles.length > 0) {
      prices = candles.flatMap(c => [c.high, c.low]);
    } else if (data && data.length > 0) {
      prices = data.map(d => d.quote);
    }

    if (prices.length === 0) {
      return { domain: [0, 100] };
    }

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.15; // 15% padding
    
    if (min === max) {
      return { domain: [min * 0.99, max * 1.01] };
    }
    
    return {
      domain: [min - padding, max + padding]
    };
  }, [data, candles, chartType]);

  const chartData = useMemo(() => {
    const calculateRSI = (prices: number[], period = 14) => {
      if (prices.length <= period) return null;
      
      let gains = 0;
      let losses = 0;
      
      for (let i = 1; i <= period; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;
      }
      
      let avgGain = gains / period;
      let avgLoss = losses / period;
      
      for (let i = period + 1; i < prices.length; i++) {
        const diff = prices[i] - prices[i - 1];
        avgGain = (avgGain * (period - 1) + (diff >= 0 ? diff : 0)) / period;
        avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
      }
      
      if (avgLoss === 0) return 100;
      const rs = avgGain / avgLoss;
      return 100 - (100 / (1 + rs));
    };

    if (chartType === 'candle' && candles && candles.length > 0) {
      return candles.map((c, idx) => {
        let sma = null;
        if (idx >= 10) {
          const slice = candles.slice(idx - 10, idx + 1);
          sma = slice.reduce((acc, curr) => acc + curr.close, 0) / slice.length;
        }

        let rsi = null;
        if (idx >= 14) {
          const prices = candles.slice(0, idx + 1).map(x => x.close);
          rsi = calculateRSI(prices);
        }

        return {
          time: format(new Date(c.epoch * 1000), 'HH:mm'),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          // Recharts specific mapping for range bar
          body: [Math.min(c.open, c.close), Math.max(c.open, c.close)],
          wick: [c.low, c.high],
          isUp: c.close >= c.open,
          sma: sma,
          rsi: rsi,
          timestamp: c.epoch
        };
      });
    }

    if (!data || data.length === 0) return [];
    
    return data.map((point, idx) => {
      let sma = null;
      if (idx >= 10) {
        const slice = data.slice(idx - 10, idx + 1);
        sma = slice.reduce((acc, curr) => acc + curr.quote, 0) / slice.length;
      }

      let rsi = null;
      if (idx >= 14) {
        const prices = data.slice(0, idx + 1).map(x => x.quote);
        rsi = calculateRSI(prices);
      }

      return {
        time: format(new Date(point.epoch * 1000), 'HH:mm:ss'),
        price: point.quote,
        sma: sma,
        rsi: rsi,
        timestamp: point.epoch
      };
    });
  }, [data, candles, chartType]);

  const currentPrice = data[data.length - 1]?.quote || (candles && candles[candles.length - 1]?.close) || 0;

  return (
    <div className="w-full h-full bg-card flex flex-col border-r border-border">
      {/* Chart Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-border bg-background/30">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-bold tracking-tight text-text-primary">{symbol}</span>
            <span className="hidden xs:inline text-[9px] sm:text-[10px] font-medium text-text-muted uppercase tracking-widest">Live</span>
          </div>
          
          <div className="flex bg-background border border-border rounded p-0.5">
            <ChartTypeBtn active={chartType === 'candle'} onClick={() => setChartType('candle')} label="Candles" />
            <ChartTypeBtn active={chartType === 'area'} onClick={() => setChartType('area')} label="Line" />
          </div>

          <div className="hidden sm:flex gap-1">
            {['1M', '5M', '15M', '1H', '1D'].map((t) => (
              <button 
                key={t} 
                onClick={() => onTimeframeChange(t)}
                className={cn(
                  "px-2 py-1 text-[10px] font-bold rounded transition-all",
                  timeframe === t 
                    ? "bg-brand/10 text-brand border border-brand/20" 
                    : "text-text-muted hover:text-text-primary hover:bg-secondary/20"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <button 
              onClick={() => setShowRSI(!showRSI)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded border transition-all text-[9px] sm:text-[10px] font-bold",
                showRSI ? "bg-brand/10 border-brand/30 text-brand" : "bg-background border-border text-text-muted hover:text-text-secondary"
              )}
            >
              <Activity className="w-3 h-3" />
              <span className="hidden xs:inline">RSI</span>
            </button>
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
          <button 
            onClick={toggleFullscreen}
            className={cn(
              "p-1.5 transition-colors hidden sm:block",
              isFullscreen ? "text-brand" : "text-text-muted hover:text-text-primary"
            )}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button className="p-1.5 text-text-muted hover:text-text-primary transition-colors">
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Chart Body */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        <div className={cn("flex-1 min-h-0 p-4", showRSI && "h-[70%]")}>
          {(!data || data.length === 0) ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
            <div className="w-8 h-8 border-2 border-brand/20 border-t-brand rounded-full animate-spin" />
            <p className="text-[11px] text-text-muted font-mono uppercase tracking-widest">Initializing Feed...</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData as any[]} margin={{ top: 10, right: 60, left: 10, bottom: 0 }} barGap="-100%" barCategoryGap="20%">
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-chart-line, var(--color-brand))" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="var(--color-chart-line, var(--color-brand))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 2" vertical={true} stroke="var(--color-chart-grid, var(--color-border))" strokeOpacity={0.8} />
              <XAxis 
                dataKey="time" 
                axisLine={{ stroke: 'var(--color-text-secondary)', strokeWidth: 1 }} 
                tickLine={{ stroke: 'var(--color-text-secondary)' }} 
                tick={{ fill: 'var(--color-text-secondary)', fontSize: 10, fontFamily: 'Inter' }}
                minTickGap={50}
              />
              <YAxis 
                orientation="right"
                domain={domain}
                axisLine={{ stroke: 'var(--color-text-secondary)', strokeWidth: 1 }}
                tickLine={{ stroke: 'var(--color-text-secondary)' }}
                tick={{ fill: 'var(--color-text-secondary)', fontSize: 10, fontFamily: 'Roboto Mono' }}
                mirror={false}
                width={60}
              />
              <Tooltip 
                content={<CustomTooltip chartType={chartType} showSMA={showSMA} showRSI={showRSI} />}
                cursor={{ stroke: 'var(--color-text-muted)', strokeDasharray: '3 3' }}
              />
              
              {/* Current Price Line */}
              <ReferenceLine 
                y={currentPrice} 
                stroke="var(--color-text-primary)" 
                strokeDasharray="3 3" 
                label={{ 
                  position: 'right', 
                  value: currentPrice.toFixed(4), 
                  fill: 'var(--color-text-primary)', 
                  fontSize: 10, 
                  fontFamily: 'Roboto Mono',
                  fontWeight: 'bold',
                  className: "bg-background px-1"
                }} 
              />

              {chartType === 'area' ? (
                <Area 
                  type="monotone" 
                  dataKey="price" 
                  stroke="var(--color-chart-line, var(--color-brand))" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorPrice)" 
                  isAnimationActive={false}
                />
              ) : (
                <>
                  {/* Wick */}
                  <Bar 
                    dataKey="wick" 
                    isAnimationActive={false}
                    barSize={1}
                  >
                    {chartData.map((entry: any, index: number) => (
                      <Cell 
                        key={`wick-${index}`}
                        fill={entry.isUp ? 'var(--color-bullish)' : 'var(--color-bearish)'}
                      />
                    ))}
                  </Bar>
                  {/* Body */}
                  <Bar 
                    dataKey="body" 
                    isAnimationActive={false}
                    barSize={8}
                  >
                    {chartData.map((entry: any, index: number) => (
                      <Cell 
                        key={`body-${index}`}
                        fill={entry.isUp ? 'var(--color-bullish)' : 'var(--color-bearish-fill)'}
                        stroke={entry.isUp ? 'var(--color-bullish)' : 'var(--color-bearish)'}
                        strokeWidth={1}
                      />
                    ))}
                  </Bar>
                </>
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

        {/* RSI Sub-chart */}
        {showRSI && data && data.length > 0 && (
          <div className="h-[30%] border-t border-border p-4 pt-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold text-text-muted uppercase">RSI (14)</span>
              <div className="flex gap-2">
                <span className="text-[9px] font-mono text-rose-500">70</span>
                <span className="text-[9px] font-mono text-emerald-500">30</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData as any[]} margin={{ top: 5, right: 60, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" vertical={true} stroke="var(--color-border)" strokeOpacity={0.3} />
                <XAxis dataKey="time" hide />
                <YAxis 
                  orientation="right"
                  domain={[0, 100]}
                  ticks={[30, 70]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--color-text-muted)', fontSize: 8, fontFamily: 'Roboto Mono' }}
                  width={60}
                />
                <ReferenceLine y={70} stroke="var(--color-bearish)" strokeDasharray="3 3" strokeOpacity={0.3} />
                <ReferenceLine y={30} stroke="var(--color-bullish)" strokeDasharray="3 3" strokeOpacity={0.3} />
                <Line 
                  type="monotone" 
                  dataKey="rsi" 
                  stroke="var(--color-brand)" 
                  strokeWidth={1.5} 
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
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

const CustomTooltip = ({ active, payload, label, chartType, showSMA, showRSI }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const hasOHLC = data.open !== undefined && data.close !== undefined;
    
    return (
      <div className="bg-card/95 backdrop-blur-md border border-white/10 p-3 rounded-lg shadow-2xl min-w-[150px] pointer-events-none z-50">
        <div className="flex items-center justify-between gap-4 mb-2 border-b border-white/5 pb-1.5">
          <span className="text-[10px] font-black text-brand uppercase tracking-widest">{label}</span>
          {data.timestamp && (
            <span className="text-[8px] font-mono text-text-muted">{format(new Date(data.timestamp * 1000), 'HH:mm:ss')}</span>
          )}
        </div>
        
        <div className="space-y-1.5">
          {/* Main Data Section */}
          {!hasOHLC ? (
            <TooltipRow label="PRICE" value={data.price} color="text-brand" />
          ) : (
            <div className="space-y-1">
              <TooltipRow label="OPEN" value={data.open} />
              <TooltipRow label="HIGH" value={data.high} />
              <TooltipRow label="LOW" value={data.low} />
              <TooltipRow label="CLOSE" value={data.close} color={data.isUp ? 'text-bullish' : 'text-bearish'} />
            </div>
          )}

          {/* Indicators Section */}
          {(showSMA || showRSI) && (
            <div className="pt-2 border-t border-white/5 space-y-1.5">
              {showSMA && data.sma !== undefined && data.sma !== null && (
                <TooltipRow label="SMA(10)" value={data.sma} color="text-sky-400" />
              )}
              {showRSI && data.rsi !== undefined && data.rsi !== null && (
                <TooltipRow label="RSI(14)" value={data.rsi} color="text-amber-400" />
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

function TooltipRow({ label, value, color = 'text-text-primary' }: any) {
  if (value === undefined || value === null) return null;
  
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-tight">{label}</span>
      <span className={cn("text-[10px] font-mono font-bold", color)}>
        {typeof value === 'number' 
          ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
          : value}
      </span>
    </div>
  );
}
