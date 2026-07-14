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

// Convert "MM:SS" pace string to decimal minutes
function paceToMinutes(pace: string): number {
  const [m, s] = pace.split(':').map(Number);
  if (isNaN(m) || isNaN(s)) return 0;
  return m + s / 60;
}
// Convert decimal minutes back to "MM:SS"
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
    <div className="bg-zinc-900 border border-zinc-700 rounded-md px-2.5 py-1.5 text-xs font-mono shadow-lg z-[5000]">
      <span className="text-zinc-400 block text-[10px] mb-0.5">{label}</span>
      <span className="text-white font-bold">{formatValue ? formatValue(v) : v}{unit ? ` ${unit}` : ''}</span>
    </div>
  );
}

// Helper to get local date string YYYY-MM-DD
function getLocalDateStr(date: Date | string) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calculateStreak(activities: ActivityType[]) {
  const dates = [...new Set(activities.map(a => getLocalDateStr(a.date)))].sort().reverse();
  if (dates.length === 0) return { streak: 0, totalThisMonth: 0 };

  // Helper to get Monday's date string YYYY-MM-DD
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

    // If no workouts in both the current and the previous week, the streak is broken
    if (!workoutWeeks.has(currentWeekMonday) && !workoutWeeks.has(prevWeekMonday)) {
      streak = 0;
    } else {
      // Start counting backwards from the most recent active week
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

  return { streak, totalThisMonth };
}

interface MiniChartCardProps {
  title: string;
  subtitle: string;
  value: string;
  unit: string;
  delta?: number | null;   // positive = improvement depends on metric
  deltaLabel?: string;
  accentColor: string;
  children: React.ReactNode;
}

function MiniChartCard({ title, subtitle, value, unit, delta, deltaLabel, accentColor, children }: MiniChartCardProps) {
  const isPositiveDelta = delta !== undefined && delta !== null && delta > 0;
  const isNegativeDelta = delta !== undefined && delta !== null && delta < 0;
  return (
    <div className="bg-zinc-900 border border-zinc-800/80 rounded-lg p-5 flex flex-col gap-4 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">{title}</p>
          <div className="flex items-end gap-1.5 mt-1">
            <span className="text-2xl font-bold font-mono text-white">{value}</span>
            <span className="text-xs text-zinc-500 mb-0.5">{unit}</span>
          </div>
          {delta !== undefined && delta !== null && (
            <div className={`flex items-center gap-1 mt-1 text-[10px] font-mono ${isPositiveDelta ? 'text-lime-400' : isNegativeDelta ? 'text-rose-400' : 'text-zinc-500'}`}>
              {isPositiveDelta ? <TrendingUp className="h-3 w-3" /> : isNegativeDelta ? <TrendingDown className="h-3 w-3" /> : null}
              <span>{isPositiveDelta ? '+' : ''}{delta.toFixed(1)} {deltaLabel}</span>
            </div>
          )}
        </div>
        <p className="text-[10px] text-zinc-600 mt-1">{subtitle}</p>
      </div>
      <div className="h-24 w-full">
        {children}
      </div>
    </div>
  );
}

export default function Dashboard({ stats, activities, onNavigateToHistory, onSecretUnlock }: DashboardProps) {
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
      }, 1000); // 1 second window to do 5 taps
    }
  };

  const filtered = useMemo(() => {
    const cut = cutoffDate(range);
    return [...activities]
      .filter(a => new Date(a.date) >= cut)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [activities, range]);

  // Chart data
  const chartData = useMemo(() => filtered.map(a => ({
    date: new Date(a.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }),
    km: parseFloat(a.distanceKm.toFixed(2)),
    paceMin: paceToMinutes(a.avgPace),
    hr: a.avgHeartRate || null,
    kcal: a.calories || null,
    cadence: a.avgCadence || null,
  })), [filtered]);

  // Derived stats for the selected range
  const rangeStats = useMemo(() => {
    const count = filtered.length;
    const totalKm = filtered.reduce((s, a) => s + a.distanceKm, 0);
    const totalMin = filtered.reduce((s, a) => s + a.durationMin, 0);
    const avgHr = count > 0 ? Math.round(filtered.filter(a => a.avgHeartRate).reduce((s, a) => s + (a.avgHeartRate || 0), 0) / (filtered.filter(a => a.avgHeartRate).length || 1)) : 0;
    const avgPaceMin = count > 0 ? filtered.reduce((s, a) => s + paceToMinutes(a.avgPace), 0) / count : 0;
    const totalKcal = filtered.reduce((s, a) => s + (a.calories || 0), 0);

    // Delta vs previous period
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

  const { streak, totalThisMonth } = useMemo(() => calculateStreak(activities), [activities]);

  // Generate Calendar Grid
  const calendarGrid = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // 0 = Mon, 6 = Sun

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

  const tickStyle = { fill: '#52525b', fontSize: 9, fontFamily: 'monospace' };
  const gridColor = 'rgba(255,255,255,0.04)';

  // Latest Activity for Hero Section
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
    <div className="space-y-12" id="dashboard-tab">

      <div>
        <h1 
          onClick={handleTitleTap}
          className="text-5xl sm:text-6xl font-black tracking-tighter text-white lowercase select-none"
        >
          running app
        </h1>
      </div>

      {/* --- HERO SECTION --- */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* Left: Streak & Timeline */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="bg-zinc-900 border border-zinc-800/80 p-6 rounded-2xl flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-lime-400/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
            <h2 className="text-zinc-500 font-bold uppercase tracking-wider text-xs mb-1 flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-orange-500" />
              Weekly Streak
            </h2>
            <div className="flex items-end gap-2 mt-2">
              <span className="text-6xl font-black text-lime-400 leading-none tracking-tighter drop-shadow-[0_0_15px_rgba(204,255,0,0.15)]">{streak}</span>
              <span className="text-zinc-400 font-bold mb-1.5 uppercase text-xs">settimane<br />di fila</span>
            </div>
            <p className="text-zinc-400 text-sm mt-4 font-medium">Hai registrato <strong className="text-white">{totalThisMonth} allenamenti</strong> in questo mese. Continua così!</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 py-8 flex-1 flex flex-col justify-between min-h-[160px]">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-6">Timeline Recenti Allenamenti</h3>
            <div className="relative flex justify-between items-center px-4 w-full my-auto py-2">
              <div className="absolute top-1/2 left-4 right-4 h-[1px] bg-zinc-800 -translate-y-1/2 z-0"></div>
              {activities.slice(0, 5).reverse().map((act, i) => (
                <div key={act.id} className="relative z-10 flex flex-col items-center group cursor-pointer" onClick={onNavigateToHistory}>
                  <span className={`text-[11px] font-bold font-mono absolute -top-7 whitespace-nowrap transition-colors ${i === 4 ? 'text-lime-400' : 'text-zinc-300 group-hover:text-white'}`}>
                    {act.distanceKm.toFixed(1)} <span className="text-[9px] text-zinc-500 font-normal">km</span>
                  </span>
                  <div className={`h-4.5 w-4.5 rounded-full border-[3.5px] border-zinc-900 ${i === 4 ? 'bg-lime-400 ring-4 ring-lime-400/20' : 'bg-zinc-700 group-hover:bg-zinc-500'} transition-all duration-300`}></div>
                  <span className={`text-[9px] font-mono absolute -bottom-7 whitespace-nowrap transition-colors ${i === 4 ? 'text-white font-semibold' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                    {new Date(act.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Latest Activity Map */}
        {latestActivity && (
          <div className="lg:w-[45%] bg-zinc-900 border border-zinc-800/80 rounded-2xl overflow-hidden flex flex-col shadow-2xl group cursor-pointer" onClick={onNavigateToHistory}>
            <div className="h-[220px] w-full relative bg-zinc-950/50">
              {mapBounds && latestTrackCoords ? (
                <MapContainer bounds={mapBounds} scrollWheelZoom={true} dragging={false} zoomControl={false} className="h-full w-full" attributionControl={false}>
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                  <Polyline positions={latestTrackCoords} color="#ccff00" weight={5} opacity={0.9} />
                </MapContainer>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-zinc-700">
                  <MapPin className="h-10 w-10 opacity-30 mb-2" />
                  <span className="text-xs uppercase font-bold tracking-widest text-zinc-600">Nessun GPS</span>
                </div>
              )}
              <div className="absolute top-4 left-4 bg-zinc-900/90 backdrop-blur-sm border border-zinc-700/80 text-white text-[10px] px-2.5 py-1.5 rounded-md font-bold uppercase tracking-wider flex items-center gap-1.5 z-[1000] shadow-lg">
                <MapPin className="h-3 w-3 text-lime-400" />
                Ultima Attività
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-1 truncate group-hover:text-lime-400 transition-colors">{latestActivity.name}</h3>
                <p className="text-xs text-zinc-400">{new Date(latestActivity.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-5 pt-5 border-t border-zinc-800/60">
                <div>
                  <span className="text-[9px] text-zinc-500 uppercase block tracking-wider font-semibold">Distanza</span>
                  <span className="font-mono font-bold text-lg text-white mt-0.5 block">{latestActivity.distanceKm.toFixed(2)} <span className="text-[10px] text-zinc-500 font-normal">km</span></span>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 uppercase block tracking-wider font-semibold">Passo Medio</span>
                  <span className="font-mono font-bold text-lg text-white mt-0.5 block">{latestActivity.avgPace} <span className="text-[10px] text-zinc-500 font-normal">/km</span></span>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 uppercase block tracking-wider font-semibold">FC Media</span>
                  <span className="font-mono font-bold text-lg text-white mt-0.5 block">{latestActivity.avgHeartRate || '--'} <span className="text-[10px] text-zinc-500 font-normal">bpm</span></span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- ANALYTICS SECTION --- */}
      <div className="pt-6 border-t border-zinc-800/50 space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-zinc-800 pb-5">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-lime-400" />
              Analisi e Andamento
            </h2>
            <p className="text-[11px] text-zinc-500 mt-1 uppercase tracking-wider font-semibold">Esplora i dati storici delle tue corse</p>
          </div>

          {/* Range Selector */}
          <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-lg p-1 self-start sm:self-auto" role="group" aria-label="Intervallo temporale">
            {RANGES.map(r => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`px-3 py-1 rounded text-[11px] font-mono font-medium transition-all ${range === r.value
                  ? 'bg-zinc-700 text-white shadow'
                  : 'text-zinc-500 hover:text-zinc-300'
                  }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-lg flex flex-col justify-between h-28 hover:border-zinc-700 transition-colors">
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-xs font-medium tracking-tight">Distanza</span>
              <Zap className="h-4 w-4 text-lime-400" aria-hidden="true" />
            </div>
            <div className="flex flex-wrap items-baseline gap-x-1.5 mt-2">
              <span className="text-2xl font-semibold font-mono text-white tracking-tight">{rangeStats.totalKm.toFixed(1)}</span>
              <span className="text-xs text-zinc-500">km</span>
              {rangeStats.deltaKm !== null && (
                <span className={`text-[10px] font-mono whitespace-nowrap ${rangeStats.deltaKm >= 0 ? 'text-lime-400' : 'text-rose-400'}`}>
                  {rangeStats.deltaKm >= 0 ? '+' : ''}{rangeStats.deltaKm.toFixed(1)}
                </span>
              )}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-lg flex flex-col justify-between h-28 hover:border-zinc-700 transition-colors">
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-xs font-medium tracking-tight">Tempo Totale</span>
              <Clock className="h-4 w-4 text-zinc-400" aria-hidden="true" />
            </div>
            <div>
              <span className="text-2xl font-semibold font-mono text-white tracking-tight">{(rangeStats.totalMin / 60).toFixed(1)}</span>
              <span className="text-xs text-zinc-500 ml-1">ore</span>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-lg flex flex-col justify-between h-28 hover:border-zinc-700 transition-colors">
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-xs font-medium tracking-tight">Passo Medio</span>
              <Activity className="h-4 w-4 text-cyan-400" aria-hidden="true" />
            </div>
            <div>
              <span className="text-2xl font-semibold font-mono text-white tracking-tight">{rangeStats.avgPaceMin > 0 ? minutesToPace(rangeStats.avgPaceMin) : '--'}</span>
              <span className="text-xs text-zinc-500 ml-1">/km</span>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-lg flex flex-col justify-between h-28 hover:border-zinc-700 transition-colors">
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-xs font-medium tracking-tight">Battito Medio</span>
              <Heart className="h-4 w-4 text-rose-500" aria-hidden="true" />
            </div>
            <div>
              <span className="text-2xl font-semibold font-mono text-white tracking-tight">{rangeStats.avgHr || '--'}</span>
              <span className="text-xs text-zinc-500 ml-1">bpm</span>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-lg flex flex-col justify-between h-28 hover:border-zinc-700 transition-colors col-span-2 md:col-span-1">
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-xs font-medium tracking-tight">Sessioni</span>
              <Calendar className="h-4 w-4 text-zinc-400" aria-hidden="true" />
            </div>
            <div>
              <span className="text-2xl font-semibold font-mono text-white tracking-tight">{rangeStats.count}</span>
              <span className="text-xs text-zinc-500 ml-1">corse</span>
            </div>
          </div>
        </div>

        {/* Charts 2×2 Grid */}
        {chartData.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* 1. Distanza per sessione */}
            <MiniChartCard
              title="Distanza per Sessione"
              subtitle="km"
              value={rangeStats.totalKm.toFixed(1)}
              unit="km tot."
              accentColor="#a3e635"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradKm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a3e635" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#a3e635" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={gridColor} />
                  <XAxis dataKey="date" tick={tickStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={28} />
                  <Tooltip content={(props: any) => <MinimalTooltip {...props} unit="km" />} />
                  <Area type="monotone" dataKey="km" stroke="#a3e635" strokeWidth={1.5} fill="url(#gradKm)" dot={false} activeDot={{ r: 3, fill: '#a3e635' }} />
                </AreaChart>
              </ResponsiveContainer>
            </MiniChartCard>

            {/* 2. Passo Medio */}
            <MiniChartCard
              title="Passo Medio"
              subtitle="min/km"
              value={rangeStats.avgPaceMin > 0 ? minutesToPace(rangeStats.avgPaceMin) : '--'}
              unit="min/km"
              accentColor="#22d3ee"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={gridColor} />
                  <XAxis dataKey="date" tick={tickStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis
                    tick={tickStyle} tickLine={false} axisLine={false} width={28}
                    domain={['auto', 'auto']}
                    reversed
                    tickFormatter={(v: number) => minutesToPace(v)}
                  />
                  <Tooltip content={(props: any) => <MinimalTooltip {...props} formatValue={minutesToPace} unit="min/km" />} />
                  <Line type="monotone" dataKey="paceMin" stroke="#22d3ee" strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: '#22d3ee' }} />
                </LineChart>
              </ResponsiveContainer>
            </MiniChartCard>

            {/* 3. Battito Cardiaco */}
            <MiniChartCard
              title="Battito Cardiaco Medio"
              subtitle="bpm"
              value={rangeStats.avgHr > 0 ? String(rangeStats.avgHr) : '--'}
              unit="bpm"
              accentColor="#f43f5e"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }} barSize={8}>
                  <CartesianGrid vertical={false} stroke={gridColor} />
                  <XAxis dataKey="date" tick={tickStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={28} domain={['auto', 'auto']} />
                  <Tooltip content={(props: any) => <MinimalTooltip {...props} unit="bpm" />} />
                  <Bar dataKey="hr" fill="#f43f5e" opacity={0.8} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </MiniChartCard>

            {/* 4. Calorie Bruciate */}
            <MiniChartCard
              title="Calorie Bruciate"
              subtitle="kcal"
              value={rangeStats.totalKcal > 0 ? rangeStats.totalKcal.toLocaleString('it-IT') : '--'}
              unit="kcal tot."
              accentColor="#fb923c"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }} barSize={8}>
                  <defs>
                    <linearGradient id="gradKcal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fb923c" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#fb923c" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={gridColor} />
                  <XAxis dataKey="date" tick={tickStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={28} />
                  <Tooltip content={(props: any) => <MinimalTooltip {...props} unit="kcal" />} />
                  <Bar dataKey="kcal" fill="url(#gradKcal)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </MiniChartCard>

          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800/80 rounded-lg p-10 text-center text-zinc-500 text-xs font-mono uppercase">
            Nessun dato nel periodo selezionato
          </div>
        )}

        {/* Bottom row: Recent list + Coach tip */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Recent runs */}
          <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800/80 rounded-lg p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white mb-4 border-b border-zinc-800/50 pb-3">Attività Recenti</h3>
              <div className="space-y-2.5">
                {activities.slice(0, 5).map((act) => (
                  <div
                    key={act.id}
                    className="bg-zinc-950 border border-zinc-800/50 p-3 rounded-lg flex items-center justify-between group hover:border-zinc-700 transition-colors cursor-pointer"
                    onClick={onNavigateToHistory}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 bg-zinc-900 border border-zinc-800 text-lime-400 flex flex-col items-center justify-center font-mono font-bold text-xs rounded shrink-0">
                        {act.distanceKm.toFixed(0)}
                        <span className="text-[8px] font-normal uppercase -mt-1">km</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate group-hover:text-lime-400 transition-colors">{act.name}</h4>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          {new Date(act.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} • {act.durationMin} min
                        </p>
                      </div>
                    </div>
                    <div className="text-right font-mono text-xs shrink-0">
                      <p className="font-bold text-white">{act.avgPace}</p>
                      <p className="text-[9px] text-zinc-500">/km</p>
                      {act.avgHeartRate && <p className="text-[9px] text-rose-400 mt-0.5">{act.avgHeartRate} bpm</p>}
                    </div>
                  </div>
                ))}
                {activities.length === 0 && (
                  <div className="text-center py-10 text-zinc-500 text-xs">Nessuna corsa registrata.</div>
                )}
              </div>
            </div>
            <button
              onClick={onNavigateToHistory}
              className="w-full mt-4 bg-zinc-950 border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white text-xs font-medium py-2 rounded transition-colors flex items-center justify-center gap-1"
            >
              Gestisci Attività
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Streak & Calendar */}
          <div className="lg:col-span-5 flex flex-col gap-4">

            {/* Calendar Widget */}
            <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-lg flex flex-col flex-1">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                  <Flame className={`h-4 w-4 ${streak > 0 ? 'text-orange-500' : 'text-zinc-500'}`} />
                  Weekly Streak
                </h4>
                <div className="text-right">
                  <span className="text-2xl font-bold font-mono text-white leading-none">{streak}</span>
                  <span className="text-[10px] text-zinc-500 ml-1 uppercase">sett.</span>
                </div>
              </div>

              <div className="bg-zinc-950 border border-zinc-800/50 p-4 rounded-lg flex-1">
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
                    <div key={i} className="text-[9px] font-medium text-zinc-500">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {calendarGrid.map((dayObj, i) => (
                    <div
                      key={i}
                      className={`aspect-square rounded flex items-center justify-center text-[10px] font-mono transition-all ${dayObj === null
                        ? 'opacity-0'
                        : dayObj.active
                          ? 'bg-lime-400 text-black font-bold shadow-sm shadow-lime-400/20 scale-105 z-10'
                          : dayObj.isToday
                            ? 'bg-zinc-800 text-white border border-zinc-700 font-bold'
                            : 'bg-zinc-900/50 text-zinc-600 hover:bg-zinc-800'
                        }`}
                    >
                      {dayObj?.day}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-zinc-500">Corse questo mese:</span>
                <span className="font-mono text-lime-400 font-bold">{totalThisMonth}</span>
              </div>
            </div>

            {/* Quick stats for range */}
            <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-lg">
              <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
                Riepilogo Periodo Selezionato
              </h4>
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div>
                  <span className="text-[9px] text-zinc-500 block uppercase">Calorie</span>
                  <span className="text-sm font-bold text-white mt-0.5 block">{rangeStats.totalKcal.toLocaleString('it-IT')} <span className="text-zinc-500 text-[10px] font-normal">kcal</span></span>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block uppercase">Km/Sessione</span>
                  <span className="text-sm font-bold text-white mt-0.5 block">{rangeStats.count > 0 ? (rangeStats.totalKm / rangeStats.count).toFixed(1) : '--'} <span className="text-zinc-500 text-[10px] font-normal">km</span></span>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block uppercase">Min/Sessione</span>
                  <span className="text-sm font-bold text-white mt-0.5 block">{rangeStats.count > 0 ? Math.round(rangeStats.totalMin / rangeStats.count) : '--'} <span className="text-zinc-500 text-[10px] font-normal">min</span></span>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block uppercase">Freq. Sett.</span>
                  <span className="text-sm font-bold text-white mt-0.5 block">
                    {rangeStats.count > 0 ? (() => {
                      const weeks = range === '4W' ? 4 : range === '3M' ? 13 : range === '6M' ? 26 : range === '1Y' ? 52 : Math.max(1, Math.ceil(rangeStats.count / 2));
                      return (rangeStats.count / weeks).toFixed(1);
                    })() : '--'}
                    <span className="text-zinc-500 text-[10px] font-normal"> /sett.</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
