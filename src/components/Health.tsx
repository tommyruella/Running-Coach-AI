import React, { useMemo } from 'react';
import { Heart, Zap, TrendingDown, TrendingUp, Moon, Activity } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis,
  Tooltip,
  CartesianGrid,
  LineChart, Line
} from 'recharts';
import { MinimalTooltip, MiniChartCard } from './Dashboard';

interface HealthProps {
  dailyMetrics: any[];
  onSyncGarmin?: () => void;
}

const tickStyle = { fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'monospace' };
const gridColor = 'var(--border-subtle)';

const formatSleepDuration = (mins: number | undefined | null) => {
  if (!mins) return '--';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${m}m`;
};

const getTrend = (key: string, currentVal: number | null | undefined, dailyMetrics: any[], isLowerBetter = false, days = 7) => {
  if (currentVal == null || !dailyMetrics || dailyMetrics.length < 2) return null;
  const previousDays = dailyMetrics.slice(1, days + 1).filter(m => {
    const val = m[key as keyof typeof m];
    return val != null && (typeof val === 'number' ? val > 0 : true);
  });
  if (previousDays.length === 0) return null;
  const avg = previousDays.reduce((sum, m) => sum + (m[key as keyof typeof m] as number), 0) / previousDays.length;
  const diff = currentVal - avg;
  const percent = (diff / avg) * 100;
  const isGood = isLowerBetter ? diff <= 0 : diff >= 0;
  return { percent, isGood };
};

export default function Health({ dailyMetrics = [], onSyncGarmin }: HealthProps) {
  const lastWeight = useMemo(() => {
    if (!dailyMetrics || dailyMetrics.length === 0) return null;
    for (const m of dailyMetrics) {
      if (m.weight_kg != null && m.weight_kg > 0) return m.weight_kg;
    }
    return null;
  }, [dailyMetrics]);

  return (
    <div className="space-y-6" id="health-tab">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-3xl font-bold text-primary tracking-tight flex items-center gap-3 select-none">
            <Heart className="h-8 w-8 text-accent-rose" />
            Salute
          </h2>
          <p className="text-sm text-secondary mt-1">Dati estratti automaticamente da Garmin Connect</p>
        </div>
        {onSyncGarmin && (
          <button
            onClick={onSyncGarmin}
            className="px-4 py-2 bg-[var(--surface-popover)] border border-subtle rounded-md text-xs font-bold text-primary hover:bg-[var(--surface-inset)] transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Activity className="w-4 h-4 text-[#CCFF00]" />
            Sincronizza Garmin
          </button>
        )}
      </div>

      {dailyMetrics && dailyMetrics.length > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { key: 'sleep_duration', label: 'Sonno Ieri', icon: Moon, color: 'text-indigo-400', value: formatSleepDuration(dailyMetrics[0].sleep_duration), unit: '' },
              { key: 'sleep_duration', label: 'Sonno Medio', icon: Moon, color: 'text-indigo-300', value: formatSleepDuration((dailyMetrics.filter(m => m.sleep_duration).reduce((s, m) => s + (m.sleep_duration || 0), 0) / (dailyMetrics.filter(m => m.sleep_duration).length || 1))), unit: '' },
              { key: 'resting_hr', label: 'Battito a Riposo', icon: Heart, color: 'text-accent-rose', value: dailyMetrics[0].resting_hr || '--', unit: 'bpm', isLowerBetter: true },
              { key: 'body_battery_change', label: 'Body Battery', icon: Zap, color: 'text-[#CCFF00]', value: dailyMetrics[0].body_battery_change ? (dailyMetrics[0].body_battery_change > 0 ? `+${dailyMetrics[0].body_battery_change}` : dailyMetrics[0].body_battery_change) : '--', unit: 'pt' },
              { key: 'weight_kg', label: 'Peso', icon: TrendingDown, color: 'text-cyan-400', value: (lastWeight && lastWeight > 0) ? lastWeight.toFixed(1) : '--', unit: 'kg', isLowerBetter: true, refValue: lastWeight },
            ].map((metric, i) => {
              const trend = metric.key !== 'sleep_duration' || metric.label === 'Sonno Ieri' 
                ? getTrend(metric.key, metric.refValue !== undefined ? metric.refValue : dailyMetrics[0][metric.key as keyof typeof dailyMetrics[0]], dailyMetrics, metric.isLowerBetter, metric.key === 'weight_kg' ? 30 : 7)
                : null;

              return (
              <div key={i} className="clean-panel p-5 flex flex-col justify-center gap-2">
                <div className="flex items-center gap-2 text-secondary">
                  <metric.icon className={`w-4 h-4 ${metric.color}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{metric.label}</span>
                </div>
                <div className="flex items-end gap-1 flex-wrap">
                  <span className="text-2xl font-black font-mono text-primary leading-none tracking-tighter whitespace-nowrap">{metric.value}</span>
                  <span className="text-xs font-medium text-muted mb-0.5 whitespace-nowrap">{metric.unit}</span>
                  {trend && (
                    <div className={`flex items-center gap-0.5 text-[10px] font-mono font-bold ${trend.isGood ? 'text-accent-lime' : 'text-accent-rose'} ml-auto mb-0.5`}>
                      {trend.isGood ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(trend.percent).toFixed(1)}%
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-muted">Aggiornato: {dailyMetrics[0].date}</span>
              </div>
            )})}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <MiniChartCard title="Fasi del Sonno" subtitle="ultima notte" value={formatSleepDuration(dailyMetrics[0].sleep_duration)} unit="" accentColor="#818cf8">
              {dailyMetrics[0]?.sleep_timeline && dailyMetrics[0].sleep_timeline.length > 0 ? (() => {
                const timeline = dailyMetrics[0].sleep_timeline;
                const parseDate = (d: string) => new Date(d.endsWith('Z') || d.includes('+') ? d : d + 'Z');
                const firstStart = parseDate(timeline[0].startGMT);
                const lastEnd = parseDate(timeline[timeline.length - 1].endGMT);
                const totalMs = lastEnd.getTime() - firstStart.getTime();

                const midPoint1 = new Date(firstStart.getTime() + totalMs * 0.33);
                const midPoint2 = new Date(firstStart.getTime() + totalMs * 0.66);

                const formatTime = (d: Date) => d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

                return (
                  <div className="w-full h-full flex flex-col justify-end pt-2 pb-1">
                    <div className="w-full h-full flex items-end">
                      {timeline.map((segment: any, i: number) => {
                        const start = parseDate(segment.startGMT).getTime();
                        const end = parseDate(segment.endGMT).getTime();
                        const duration = end - start;
                        const widthPct = `${(duration / totalMs) * 100}%`;
                        const level = segment.activityLevel;
                        let bg = '#94a3b8';
                        let h = '50%';
                        if (level === 0) { bg = '#2563eb'; h = '40%'; } // Deep
                        else if (level === 1) { bg = '#60a5fa'; h = '60%'; } // Light
                        else if (level === 2) { bg = '#d946ef'; h = '80%'; } // REM
                        else if (level === 3) { bg = '#ec4899'; h = '100%'; } // Awake
                        
                        return (
                          <div 
                            key={i}
                            style={{ width: widthPct, backgroundColor: bg, height: h }}
                            className="rounded-t-sm transition-all hover:opacity-80 cursor-pointer"
                            title={`Fase: ${level === 0 ? 'Profondo' : level === 1 ? 'Leggero' : level === 2 ? 'REM' : 'Sveglio'}`}
                          />
                        );
                      })}
                    </div>
                    <div className="w-full flex justify-between text-[10px] text-muted font-mono mt-2 pt-1 border-t border-subtle">
                      <span>{formatTime(firstStart)}</span>
                      <span>{formatTime(midPoint1)}</span>
                      <span>{formatTime(midPoint2)}</span>
                      <span>{formatTime(lastEnd)}</span>
                    </div>
                  </div>
                );
              })() : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...dailyMetrics].reverse().map(m => ({ date: new Date(m.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }), deep: (m.sleep_deep || 0)/60, light: (m.sleep_light || 0)/60, rem: (m.sleep_rem || 0)/60, awake: (m.sleep_awake || 0)/60 }))} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={gridColor} />
                    <XAxis dataKey="date" tick={tickStyle} tickLine={false} axisLine={false} />
                    <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={28} />
                    <Tooltip content={(props: any) => <MinimalTooltip {...props} unit="h" formatValue={(v: number) => v.toFixed(1)} />} />
                    <Bar dataKey="deep" stackId="a" fill="#4338ca" name="Profondo" />
                    <Bar dataKey="rem" stackId="a" fill="#8b5cf6" name="REM" />
                    <Bar dataKey="light" stackId="a" fill="#818cf8" name="Leggero" />
                    <Bar dataKey="awake" stackId="a" fill="#f87171" name="Sveglio" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </MiniChartCard>

            {(() => {
              const deep = dailyMetrics[0].sleep_deep || 0;
              const light = dailyMetrics[0].sleep_light || 0;
              const rem = dailyMetrics[0].sleep_rem || 0;
              const awake = dailyMetrics[0].sleep_awake || 0;
              const total = (deep + light + rem + awake) || 1;

              const formatMins = (mins: number) => {
                if (!mins) return '0m';
                const h = Math.floor(mins / 60);
                const m = Math.round(mins % 60);
                return h > 0 ? `${h}h ${m}m` : `${m}m`;
              };

              const phases = [
                { label: 'Profondo', mins: deep, color: '#2563eb' },
                { label: 'Leggero', mins: light, color: '#60a5fa' },
                { label: 'REM', mins: rem, color: '#d946ef' },
                { label: 'Sveglio', mins: awake, color: '#ec4899' },
              ];

              return (
                <MiniChartCard title="Fasi del Sonno" subtitle="ripartizione" value="" unit="" accentColor="#818cf8">
                  <div className="w-full h-full flex items-center justify-center gap-8 py-2">
                    <div className="w-[120px] h-[120px] flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={phases}
                            cx="50%"
                            cy="50%"
                            innerRadius={30}
                            outerRadius={50}
                            paddingAngle={4}
                            dataKey="mins"
                          >
                            {phases.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip content={(props: any) => (
                            <MinimalTooltip 
                              {...props} 
                              label={props.payload?.[0]?.name}
                              formatValue={(v) => formatMins(v)}
                            />
                          )} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex flex-col justify-center gap-2 font-mono w-[180px]">
                      {phases.map((p, i) => {
                        const pct = Math.round((p.mins / total) * 100);
                        return (
                          <div key={i} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                              <span className="text-primary font-bold truncate text-xs font-sans">{p.label}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs flex-shrink-0">
                              <span className="text-muted text-[11px]">{formatMins(p.mins)}</span>
                              <span className="font-black text-primary w-8 text-right">{pct}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </MiniChartCard>
              );
            })()}

            <MiniChartCard title="Trend del Peso" subtitle="kg" value={dailyMetrics[0].weight_kg ? dailyMetrics[0].weight_kg.toFixed(1) : '--'} unit="kg" accentColor="#22d3ee">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[...dailyMetrics].reverse().map(m => ({ date: new Date(m.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }), weight: m.weight_kg || null }))} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={gridColor} />
                  <XAxis dataKey="date" tick={tickStyle} tickLine={false} axisLine={false} />
                  <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={32} domain={['auto', 'auto']} />
                  <Tooltip content={(props: any) => <MinimalTooltip {...props} unit="kg" />} />
                  <Line type="monotone" dataKey="weight" stroke="#22d3ee" strokeWidth={2} dot={{ r: 3, fill: '#22d3ee' }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </MiniChartCard>

            <MiniChartCard title="Frequenza Cardiaca" subtitle="oggi (intraday)" value={dailyMetrics[0].hr_timeline && dailyMetrics[0].hr_timeline.length > 0 ? dailyMetrics[0].hr_timeline[dailyMetrics[0].hr_timeline.length - 1].hr.toString() : '--'} unit="bpm" accentColor="#f43f5e">
              {dailyMetrics[0]?.hr_timeline && dailyMetrics[0].hr_timeline.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyMetrics[0].hr_timeline.map((h: any) => ({ time: new Date(h.time).getTime(), hr: h.hr }))} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                    <XAxis 
                      type="number" 
                      dataKey="time" 
                      domain={['dataMin', 'dataMax']} 
                      tickFormatter={(v) => new Date(v).toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit'})} 
                      tick={tickStyle} tickLine={false} axisLine={false} 
                    />
                    <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                    <Tooltip 
                      content={(props: any) => (
                        <MinimalTooltip 
                          {...props} 
                          label={props.label ? new Date(props.label).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : ''} 
                          unit="bpm" 
                        />
                      )} 
                    />
                    <Line type="monotone" dataKey="hr" stroke="#f43f5e" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#f43f5e' }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-muted font-mono uppercase">
                  Dati HR non disponibili
                </div>
              )}
            </MiniChartCard>
          </div>
        </div>
      ) : (
        <div className="clean-panel p-10 text-center text-muted text-xs font-mono uppercase">
          Nessuna metrica giornaliera trovata. Effettua la sincronizzazione.
        </div>
      )}
    </div>
  );
}
