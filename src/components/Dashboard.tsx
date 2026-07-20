/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Activity, Calendar, Clock, Heart, Zap, ChevronRight, Flame, TrendingUp, TrendingDown, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Polyline } from 'react-leaflet';
import {
  ResponsiveContainer,
  AreaChart, Area,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Activity as ActivityType, RunningStats } from '../types.js';

interface DashboardProps {
  stats: RunningStats;
  activities: ActivityType[];
  onNavigateToHistory: () => void;
  onSecretUnlock?: () => void;
}

type Range = '4W' | '3M' | '6M' | '1Y' | 'ALL';

const RANGES: { label: string; value: Range }[] = [
  { label: '4 Sett.', value: '4W' },
  { label: '3 Mesi', value: '3M' },
  { label: '6 Mesi', value: '6M' },
  { label: '1 Anno', value: '1Y' },
  { label: 'Tutto', value: 'ALL' },
];

function cutoffDate(range: Range): Date {
  const now = new Date();
  switch (range) {
    case '4W': return new Date(now.getTime() - 28 * 86400_000);
    case '3M': return new Date(now.getTime() - 90 * 86400_000);
    case '6M': return new Date(now.getTime() - 180 * 86400_000);
    case '1Y': return new Date(now.getTime() - 365 * 86400_000);
    case 'ALL': return new Date(0);
  }
}

function paceToMinutes(pace: string): number {
  const [m, s] = pace.split(':').map(Number);
  if (isNaN(m) || isNaN(s)) return 0;
  return m + s / 60;
}

function minutesToPace(dec: number): string {
  const m = Math.floor(dec);
  const s = Math.round((dec - m) * 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface TooltipProps {
  active?: boolean;
  payload?: { value: number; name?: string; color?: string }[];
  label?: string;
  unit?: string;
  formatValue?: (v: number) => string;
}

function MinimalTooltip({ active, payload, label, unit, formatValue }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value;
  return (
    <div className="mac-popover px-2.5 py-1.5 text-xs font-mono z-[5000]">
      <span className="text-secondary block text-[10px] mb-0.5">{label}</span>
      <span className="text-primary font-bold">{formatValue ? formatValue(v) : v}{unit ? ` ${unit}` : ''}</span>
    </div>
  );
}

function getLocalDateStr(date: Date | string) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calculateStreak(activities: ActivityType[]) {
  const dates = [...new Set(activities.map(a => getLocalDateStr(a.date)))].sort().reverse();
  if (dates.length === 0) return { streak: 0, totalThisMonth: 0, distanceThisMonth: 0 };

  const getMondayStr = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return getLocalDateStr(monday);
  };

  const workoutWeeks = new Set(activities.map(a => getMondayStr(new Date(a.date))));

  let streak = 0;
  if (workoutWeeks.size > 0) {
    const today = new Date();
    const currentWeekMonday = getMondayStr(today);

    const prevWeek = new Date(today);
    prevWeek.setDate(prevWeek.getDate() - 7);
    const prevWeekMonday = getMondayStr(prevWeek);

    if (!workoutWeeks.has(currentWeekMonday) && !workoutWeeks.has(prevWeekMonday)) {
      streak = 0;
    } else {
      let checkMonday = workoutWeeks.has(currentWeekMonday) ? new Date(currentWeekMonday) : new Date(prevWeekMonday);
      while (true) {
        const monStr = getLocalDateStr(checkMonday);
        if (workoutWeeks.has(monStr)) {
          streak++;
          checkMonday.setDate(checkMonday.getDate() - 7);
        } else {
          break;
        }
      }
    }
  }

  const todayStr = getLocalDateStr(new Date());
  const thisMonthStr = todayStr.substring(0, 7);
  const totalThisMonth = dates.filter(d => d.startsWith(thisMonthStr)).length;
  const distanceThisMonth = activities
    .filter(a => getLocalDateStr(a.date).startsWith(thisMonthStr))
    .reduce((sum, a) => sum + a.distanceKm, 0);

  return { streak, totalThisMonth, distanceThisMonth };
}

interface MiniChartCardProps {
  title: string;
  subtitle: string;
  value: string;
  unit: string;
  delta?: number | null;
  deltaLabel?: string;
  accentColor: string;
  children: React.ReactNode;
}

function MiniChartCard({ title, subtitle, value, unit, delta, deltaLabel, children }: MiniChartCardProps) {
  const isPositiveDelta = delta !== undefined && delta !== null && delta > 0;
  const isNegativeDelta = delta !== undefined && delta !== null && delta < 0;
  return (
    <div className="clean-panel p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] text-secondary uppercase tracking-wider font-medium">{title}</p>
          <div className="flex items-end gap-1.5 mt-1">
            <span className="text-2xl font-bold font-mono text-primary">{value}</span>
            <span className="text-xs text-muted mb-0.5">{unit}</span>
          </div>
          {delta !== undefined && delta !== null && (
            <div className={`flex items-center gap-1 mt-1 text-[10px] font-mono ${isPositiveDelta ? 'text-accent-lime' : isNegativeDelta ? 'text-accent-rose' : 'text-muted'}`}>
              {isPositiveDelta ? <TrendingUp className="h-3 w-3" /> : isNegativeDelta ? <TrendingDown className="h-3 w-3" /> : null}
              <span>{isPositiveDelta ? '+' : ''}{delta.toFixed(1)} {deltaLabel}</span>
            </div>
          )}
        </div>
        <p className="text-[10px] text-muted mt-1">{subtitle}</p>
      </div>
      <div className="h-24 w-full">
        {children}
      </div>
    </div>
  );
}

export default function Dashboard({ activities, onNavigateToHistory, onSecretUnlock }: DashboardProps) {
  const [range, setRange] = useState<Range>('3M');
  const tapCountRef = React.useRef(0);
  const tapTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleTitleTap = () => {
    tapCountRef.current += 1;
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    
    if (tapCountRef.current >= 5) {
      if (onSecretUnlock) onSecretUnlock();
      tapCountRef.current = 0;
    } else {
      tapTimeoutRef.current = setTimeout(() => {
        tapCountRef.current = 0;
      }, 1000);
    }
  };

  const filtered = useMemo(() => {
    const cut = cutoffDate(range);
    return [...activities]
      .filter(a => new Date(a.date) >= cut)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [activities, range]);

  const chartData = useMemo(() => filtered.map(a => ({
    date: new Date(a.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }),
    km: parseFloat(a.distanceKm.toFixed(2)),
    paceMin: paceToMinutes(a.avgPace),
    hr: a.avgHeartRate || null,
    kcal: a.calories || null,
  })), [filtered]);

  const rangeStats = useMemo(() => {
    const count = filtered.length;
    const totalKm = filtered.reduce((s, a) => s + a.distanceKm, 0);
    const totalMin = filtered.reduce((s, a) => s + a.durationMin, 0);
    const avgHr = count > 0 ? Math.round(filtered.filter(a => a.avgHeartRate).reduce((s, a) => s + (a.avgHeartRate || 0), 0) / (filtered.filter(a => a.avgHeartRate).length || 1)) : 0;
    const avgPaceMin = count > 0 ? filtered.reduce((s, a) => s + paceToMinutes(a.avgPace), 0) / count : 0;
    const totalKcal = filtered.reduce((s, a) => s + (a.calories || 0), 0);

    const cut = cutoffDate(range);
    const prevCut = new Date(2 * cut.getTime() - Date.now());
    const prev = activities.filter(a => {
      const d = new Date(a.date);
      return d >= prevCut && d < cut;
    });
    const prevKm = prev.reduce((s, a) => s + a.distanceKm, 0);
    const deltaKm = count > 0 && prev.length > 0 ? totalKm - prevKm : null;

    return { count, totalKm, totalMin, avgHr, avgPaceMin, totalKcal, deltaKm };
  }, [filtered, activities, range]);

  const { streak, totalThisMonth, distanceThisMonth } = useMemo(() => calculateStreak(activities), [activities]);

  const calendarGrid = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    const activeDates = new Set(activities.map(a => getLocalDateStr(a.date)));

    const grid = [];
    for (let i = 0; i < startingDayOfWeek; i++) grid.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      grid.push({
        day: i,
        active: activeDates.has(dStr),
        isToday: today.getDate() === i
      });
    }
    return grid;
  }, [activities]);

  const tickStyle = { fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'monospace' };
  const gridColor = 'var(--border-subtle)';

  const latestActivity = useMemo(() => {
    return activities.length > 0 ? [...activities].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] : null;
  }, [activities]);

  const latestTrackCoords = useMemo(() => {
    if (!latestActivity || !latestActivity.trackpoints) return null;
    const coords: [number, number][] = latestActivity.trackpoints
      .filter(tp => tp.latitude && tp.longitude)
      .map(tp => [tp.latitude!, tp.longitude!]);
    return coords.length > 0 ? coords : null;
  }, [latestActivity]);

  const mapBounds = useMemo(() => {
    if (!latestTrackCoords) return null;
    const lats = latestTrackCoords.map(c => c[0]);
    const lons = latestTrackCoords.map(c => c[1]);
    return [
      [Math.min(...lats), Math.min(...lons)],
      [Math.max(...lats), Math.max(...lons)]
    ] as [[number, number], [number, number]];
  }, [latestTrackCoords]);

  return (
    <div className="space-y-10" id="dashboard-tab">

      {/* Hero Section */}
      <div className="mb-4">
        <h1 
          onClick={handleTitleTap}
          className="text-3xl font-bold tracking-tight text-primary select-none"
        >
          Overview
        </h1>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        
        {/* Left: Athlete Status (Circular Ring) */}
        <div className="flex-1 clean-panel p-6 flex flex-col justify-center items-center relative overflow-hidden">
          <h2 className="absolute top-6 left-6 text-secondary font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-accent-amber" />
            Il tuo Status
          </h2>
          
          <div className="relative w-40 h-40 sm:w-48 sm:h-48 flex items-center justify-center mt-6">
            {/* SVG Ring Background */}
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" stroke="var(--border-subtle)" strokeWidth="7" fill="none" />
              {/* SVG Ring Progress */}
              <circle 
                cx="50" cy="50" r="42" 
                stroke="#CCFF00" 
                strokeWidth="7" 
                fill="none" 
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - Math.min(distanceThisMonth / 50, 1))}`}
                className="transition-all duration-1000 ease-out"
                style={{ filter: 'drop-shadow(0px 0px 4px rgba(204,255,0,0.4))' }}
              />
            </svg>
            <div className="flex flex-col items-center justify-center relative z-10 text-center mt-1">
              <span className="text-4xl sm:text-5xl font-black text-primary leading-none tracking-tighter">{streak}</span>
              <span className="text-muted font-bold uppercase text-[9px] tracking-widest mt-1">Settimane<br/>di Fila</span>
            </div>
          </div>
          
          <div className="text-center mt-6">
            <div className="flex items-end justify-center gap-1.5 mb-2">
              <span className="text-xl font-black tracking-tight text-primary leading-none">{distanceThisMonth.toFixed(1)} <span className="text-sm font-bold text-secondary">km</span></span>
              <span className="text-xs text-muted font-medium mb-0.5">/ 50 km mensili</span>
            </div>
            <p className="text-xs text-secondary font-medium max-w-[220px] mx-auto">
              {distanceThisMonth >= 50 
                ? "Obiettivo mensile raggiunto! Sei inarrestabile. 🚀" 
                : "Ottimo lavoro! Continua così per raggiungere l'obiettivo."}
            </p>
          </div>
        </div>

        {/* Right: Latest Activity Map */}
        {latestActivity && (
          <div className="flex-1 clean-panel overflow-hidden flex flex-col cursor-pointer transition-shadow hover:shadow-lg" onClick={onNavigateToHistory}>
            {/* Full Bleed Map */}
            <div className="h-[200px] sm:h-[220px] w-full relative bg-[var(--window-bg)]">
              {mapBounds && latestTrackCoords ? (
                <MapContainer bounds={mapBounds} scrollWheelZoom={true} dragging={false} zoomControl={false} className="h-full w-full" attributionControl={false}>
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                  <Polyline positions={latestTrackCoords} color="#a3e635" weight={5} opacity={0.9} />
                </MapContainer>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted bg-[var(--surface-inset)]">
                  <MapPin className="h-10 w-10 opacity-30 mb-2" />
                  <span className="text-xs uppercase font-bold tracking-widest text-faint">Nessun GPS</span>
                </div>
              )}
              <div className="absolute top-4 left-4 mac-popover bg-[var(--surface-popover)] text-primary text-[9px] px-2.5 py-1.5 rounded-full font-bold uppercase tracking-widest flex items-center gap-1.5 z-[1000] shadow-sm">
                <MapPin className="h-3 w-3 text-accent-lime" />
                Ultima Attività
              </div>
            </div>
            
            {/* Stats below Map */}
            <div className="p-6 flex flex-col flex-1 bg-[var(--surface-popover)]">
              <div className="mb-5">
                <h3 className="text-xl font-bold text-primary mb-1 truncate">{latestActivity.name}</h3>
                <p className="text-xs font-medium text-secondary">{new Date(latestActivity.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-5 border-t border-subtle mt-auto">
                <div>
                  <span className="text-[9px] text-muted uppercase block tracking-widest font-bold mb-1">Distanza</span>
                  <span className="font-display font-bold text-2xl text-primary block leading-none tracking-tighter">{latestActivity.distanceKm.toFixed(2)} <span className="text-[10px] text-secondary font-sans font-medium uppercase tracking-normal">km</span></span>
                </div>
                <div>
                  <span className="text-[9px] text-muted uppercase block tracking-widest font-bold mb-1">Passo</span>
                  <span className="font-display font-bold text-2xl text-primary block leading-none tracking-tighter">{latestActivity.avgPace} <span className="text-[10px] text-secondary font-sans font-medium uppercase tracking-normal">/km</span></span>
                </div>
                <div>
                  <span className="text-[9px] text-muted uppercase block tracking-widest font-bold mb-1">BPM</span>
                  <span className="font-display font-bold text-2xl text-accent-rose block leading-none tracking-tighter">{latestActivity.avgHeartRate || '--'} <span className="text-[10px] text-secondary font-sans font-medium uppercase tracking-normal">bpm</span></span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Analytics Section */}
      <div className="pt-6 border-t border-subtle space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h2 className="text-lg font-bold text-primary tracking-tight flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent-lime" />
              Performance & Trends
            </h2>
          </div>
          <div className="segmented-control" role="group">
            {RANGES.map(r => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`segmented-item ${range === r.value ? 'active' : ''}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Distanza', icon: Zap, iconColor: 'text-accent-lime', value: rangeStats.totalKm.toFixed(1), unit: 'km', delta: rangeStats.deltaKm, positiveGood: true },
            { label: 'Tempo', icon: Clock, iconColor: 'text-secondary', value: (rangeStats.totalMin / 60).toFixed(1), unit: 'h' },
            { label: 'Passo Medio', icon: Activity, iconColor: 'text-accent-cyan', value: rangeStats.avgPaceMin > 0 ? minutesToPace(rangeStats.avgPaceMin) : '--', unit: '/km' },
            { label: 'Sessioni', icon: Calendar, iconColor: 'text-secondary', value: rangeStats.count, unit: 'corse' },
          ].map((s, i) => (
            <div key={i} className="clean-panel p-5 flex flex-col justify-between h-28 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-xs font-medium tracking-tight">{s.label}</span>
                <s.icon className={`h-4 w-4 ${s.iconColor}`} />
              </div>
              <div className="flex flex-wrap items-baseline gap-x-1.5 mt-2">
                <span className="text-2xl font-semibold font-mono text-primary tracking-tight">{s.value}</span>
                <span className="text-xs text-muted">{s.unit}</span>
                {s.delta !== undefined && s.delta !== null && (
                  <span className={`text-[10px] font-mono whitespace-nowrap ${s.positiveGood ? (s.delta >= 0 ? 'text-accent-lime' : 'text-accent-rose') : ''}`}>
                    {s.delta >= 0 ? '+' : ''}{s.delta.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Charts Grid */}
        {chartData.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <MiniChartCard title="Distanza" subtitle="km per sessione" value={rangeStats.totalKm.toFixed(1)} unit="km" accentColor="#65a30d">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={gridColor} />
                  <XAxis dataKey="date" tick={tickStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={28} />
                  <Tooltip content={(props: any) => <MinimalTooltip {...props} unit="km" />} />
                  <Area type="monotone" dataKey="km" stroke="#65a30d" strokeWidth={2} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </MiniChartCard>

            <MiniChartCard title="Passo" subtitle="min/km" value={rangeStats.avgPaceMin > 0 ? minutesToPace(rangeStats.avgPaceMin) : '--'} unit="min/km" accentColor="#0891b2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={gridColor} />
                  <XAxis dataKey="date" tick={tickStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={28} domain={['auto', 'auto']} reversed tickFormatter={(v: number) => minutesToPace(v)} />
                  <Tooltip content={(props: any) => <MinimalTooltip {...props} formatValue={minutesToPace} unit="min/km" />} />
                  <Line type="monotone" dataKey="paceMin" stroke="#0891b2" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </MiniChartCard>
          </div>
        ) : (
          <div className="clean-panel p-10 text-center text-muted text-xs font-mono uppercase">
            Nessun dato nel periodo
          </div>
        )}

      </div>
    </div>
  );
}
