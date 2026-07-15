import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft, Watch, Clock, Thermometer, Droplets,
  CloudSun, Flame, Activity as ActivityIcon, ChevronDown, ChevronUp
} from 'lucide-react';
import { Activity as ActivityType } from '../types.js';
import ActivityCharts from './ActivityCharts.tsx';

interface ActivityDetailProps {
  activity: ActivityType;
  onBack: () => void;
}

export default function ActivityDetail({ activity, onBack }: ActivityDetailProps) {
  const [lapsOpen, setLapsOpen] = useState(false);

  const formatDuration = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  };

  const dateStr = new Date(activity.date).toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  const timeStr = new Date(activity.date).toLocaleTimeString('it-IT', {
    hour: '2-digit', minute: '2-digit'
  });

  const weatherRegex = /^\[Partenza ore ([^|\]]+)(?: \| Condizioni: ([^,]+), Temp: ([^,]+), Umidità: ([^,]+), Vento: ([^\]]+))?\]/;
  const weatherMatch = activity.notes ? activity.notes.match(weatherRegex) : null;

  let departureTime = '';
  let weatherCond = '';
  let tempVal = '';
  let humidityVal = '';
  let cleanNotes = activity.notes || '';

  if (weatherMatch) {
    departureTime = weatherMatch[1];
    let condRaw = (weatherMatch[2] || '')
      .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '')
      .replace(/^[^\wÀ-ÿ]+/g, '').trim();
    const itToEn: Record<string, string> = {
      'Sereno': 'Clear', 'Parzialmente Nuvoloso': 'Partly Cloudy', 'Nebbia': 'Fog',
      'Pioggerellina': 'Drizzle', 'Pioggia': 'Rain', 'Neve': 'Snow',
      'Rovesci di Pioggia': 'Rain Showers', 'Temporale': 'Thunderstorm', 'Coperto': 'Overcast'
    };
    weatherCond = itToEn[condRaw] || condRaw;
    tempVal = weatherMatch[3] || '';
    humidityVal = weatherMatch[4] || '';
    cleanNotes = activity.notes.replace(weatherRegex, '').trim();
  }

  const isDefaultNote = !cleanNotes || cleanNotes.trim() === '' ||
    /File TCX caricato correttamente/i.test(cleanNotes) ||
    (/Rilevati/i.test(cleanNotes) && /giri/i.test(cleanNotes));

  const hasGps = activity.trackpoints && activity.trackpoints.length > 0 &&
    activity.trackpoints.some(tp => tp.latitude !== undefined);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="pb-16"
      id="activity-detail-page"
    >
      {/* ── Top Nav ─────────────────────────────────────────── */}
      <div className="flex items-start gap-4 mb-6">
        <button
          onClick={onBack}
          className="h-10 w-10 shrink-0 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white rounded-full transition-colors cursor-pointer mt-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-display font-black text-white uppercase tracking-wide truncate leading-tight">
            {activity.name}
          </h1>
          <p className="text-xs text-zinc-500 font-medium flex flex-wrap items-center gap-2 mt-1 uppercase tracking-wider">
            <span>{dateStr}</span>
            {departureTime && <><span className="text-zinc-700">·</span><span className="flex items-center gap-1"><Clock className="h-3 w-3" />{departureTime}</span></>}
            {activity.deviceModel && <><span className="text-zinc-700">·</span><span className="flex items-center gap-1 text-lime-400/70"><Watch className="h-3 w-3" />{activity.deviceModel}</span></>}
          </p>
        </div>
      </div>

      {/* ── KEY METRICS ROW — always at top ──────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Distanza', value: activity.distanceKm.toFixed(2), unit: 'km', color: 'text-lime-400' },
          { label: 'Passo', value: activity.avgPace, unit: '/km', color: 'text-white' },
          { label: 'Durata', value: `${activity.durationMin}m`, unit: '', color: 'text-white' },
          { label: 'BPM', value: activity.avgHeartRate ? String(activity.avgHeartRate) : '--', unit: '', color: 'text-rose-400' },
        ].map(m => (
          <div key={m.label} className="px-4 py-4 rounded-[20px] bg-zinc-950/80 border border-white/5">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-sans block mb-2">{m.label}</span>
            <div className="flex items-end gap-1">
              <span className={`text-2xl sm:text-3xl font-display font-bold leading-none tracking-tighter ${m.color}`}>{m.value}</span>
              {m.unit && <span className="text-[10px] font-bold uppercase text-zinc-600 mb-0.5">{m.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* ── MAP — full width, no card wrapper ────────────────── */}
      {hasGps && (
        <div className="w-full rounded-[24px] overflow-hidden mb-6" style={{ height: 420 }}>
          <ActivityCharts
            trackpoints={activity.trackpoints!}
            distanceKm={activity.distanceKm}
            mapHeight={420}
            compact={true}
          />
        </div>
      )}

      {/* ── CHARTS — flat, directly on the page ──────────────── */}
      {activity.trackpoints && activity.trackpoints.length > 0 && (
        <div className="rounded-[24px] bg-zinc-950/60 border border-white/5 px-4 py-6 mb-6 overflow-hidden">
          <ActivityCharts
            trackpoints={activity.trackpoints}
            distanceKm={activity.distanceKm}
            mapHeight={0}
            compact={false}
          />
        </div>
      )}

      {/* ── SECONDARY ROW: Weather + Extra Stats ─────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {activity.calories != null && (
          <div className="px-4 py-4 rounded-[20px] bg-zinc-950/80 border border-white/5">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-sans flex items-center gap-1 mb-2">
              <Flame className="h-3.5 w-3.5 text-orange-400" /> Calorie
            </span>
            <div className="flex items-end gap-1">
              <span className="text-2xl font-display font-bold text-white">{activity.calories}</span>
              <span className="text-[10px] font-bold uppercase text-zinc-600 mb-0.5">kcal</span>
            </div>
          </div>
        )}
        {activity.avgCadence != null && (
          <div className="px-4 py-4 rounded-[20px] bg-zinc-950/80 border border-white/5">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-sans flex items-center gap-1 mb-2">
              <ActivityIcon className="h-3.5 w-3.5 text-cyan-400" /> Cadenza
            </span>
            <div className="flex items-end gap-1">
              <span className="text-2xl font-display font-bold text-cyan-400">{activity.avgCadence}</span>
              <span className="text-[10px] font-bold uppercase text-zinc-600 mb-0.5">ppm</span>
            </div>
          </div>
        )}
        {tempVal && (
          <div className="px-4 py-4 rounded-[20px] bg-zinc-950/80 border border-white/5">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-sans flex items-center gap-1 mb-2">
              <Thermometer className="h-3.5 w-3.5 text-amber-400" /> Temperatura
            </span>
            <span className="text-2xl font-display font-bold text-white">{tempVal}</span>
          </div>
        )}
        {humidityVal && (
          <div className="px-4 py-4 rounded-[20px] bg-zinc-950/80 border border-white/5">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-sans flex items-center gap-1 mb-2">
              <Droplets className="h-3.5 w-3.5 text-blue-400" /> Umidità
            </span>
            <span className="text-2xl font-display font-bold text-white">{humidityVal}</span>
          </div>
        )}
        {weatherCond && (
          <div className="px-4 py-4 rounded-[20px] bg-zinc-950/80 border border-white/5 col-span-2 sm:col-span-1">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-sans flex items-center gap-1 mb-2">
              <CloudSun className="h-3.5 w-3.5 text-amber-400" /> Meteo
            </span>
            <span className="text-lg font-display font-bold text-white">{weatherCond}</span>
          </div>
        )}
      </div>

      {/* ── NOTES ───────────────────────────────────────────── */}
      {!isDefaultNote && (
        <div className="px-5 py-4 rounded-[20px] bg-zinc-950/80 border border-white/5 mb-6">
          <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-sans block mb-2">Note Sessione</span>
          <p className="text-sm text-zinc-300 leading-relaxed italic">{cleanNotes}</p>
        </div>
      )}

      {/* ── LAPS — collapsible ──────────────────────────────── */}
      {activity.laps && activity.laps.length > 0 && (
        <div className="rounded-[24px] bg-zinc-950/60 border border-white/5 overflow-hidden">
          <button
            onClick={() => setLapsOpen(o => !o)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
              Giri · {activity.laps.length} lap{activity.laps.length > 1 ? 's' : ''}
            </span>
            {lapsOpen ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
          </button>

          {lapsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-x-auto border-t border-white/5"
            >
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-[9px] text-zinc-500 uppercase tracking-widest bg-white/[0.03]">
                    <th className="py-3 px-5 font-bold">#</th>
                    <th className="py-3 px-5 font-bold">Dist</th>
                    <th className="py-3 px-5 font-bold">Tempo</th>
                    <th className="py-3 px-5 font-bold">Passo</th>
                    <th className="py-3 px-5 font-bold">BPM</th>
                    <th className="py-3 px-5 font-bold">PPM</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-zinc-300">
                  {activity.laps.map(lap => {
                    const paceSeconds = lap.distanceKm > 0 ? (lap.durationSec / lap.distanceKm) : 0;
                    let lapPaceStr = '--:--';
                    if (paceSeconds > 0) {
                      const min = Math.floor(paceSeconds / 60);
                      const sec = Math.round(paceSeconds % 60);
                      lapPaceStr = `${min}:${sec.toString().padStart(2, '0')}`;
                    }
                    return (
                      <tr key={lap.lapIndex} className="border-t border-white/5 hover:bg-white/[0.03] transition-colors last:border-b-0">
                        <td className="py-3.5 px-5 text-zinc-600 font-bold">{lap.lapIndex}</td>
                        <td className="py-3.5 px-5 font-bold text-white">{lap.distanceKm.toFixed(2)} km</td>
                        <td className="py-3.5 px-5 text-zinc-400">{formatDuration(lap.durationSec)}</td>
                        <td className="py-3.5 px-5 text-lime-400 font-bold">{lapPaceStr}</td>
                        <td className="py-3.5 px-5 text-rose-400 font-bold">{lap.avgHeartRate || '--'}</td>
                        <td className="py-3.5 px-5 text-cyan-400">{lap.avgCadence || '--'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
}
