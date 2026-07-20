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

  const metrics = [
    { label: 'Distanza', value: activity.distanceKm.toFixed(2), unit: 'km', accent: 'text-accent-lime' },
    { label: 'Passo', value: activity.avgPace, unit: '/km', accent: '' },
    { label: 'Durata', value: `${activity.durationMin}m`, unit: '', accent: '' },
    { label: 'BPM', value: activity.avgHeartRate ? String(activity.avgHeartRate) : '--', unit: '', accent: 'text-accent-rose' },
  ];

  const secondaryMetrics = [
    activity.calories != null && { label: 'Calorie', value: String(activity.calories), unit: 'kcal', icon: <Flame className="h-3.5 w-3.5 text-accent-amber" />, accent: '' },
    activity.avgCadence != null && { label: 'Cadenza', value: String(activity.avgCadence), unit: 'ppm', icon: <ActivityIcon className="h-3.5 w-3.5 text-accent-cyan" />, accent: 'text-accent-cyan' },
    tempVal && { label: 'Temperatura', value: tempVal, unit: '', icon: <Thermometer className="h-3.5 w-3.5 text-accent-amber" />, accent: '' },
    humidityVal && { label: 'Umidità', value: humidityVal, unit: '', icon: <Droplets className="h-3.5 w-3.5 text-accent-blue" />, accent: '' },
    weatherCond && { label: 'Meteo', value: weatherCond, unit: '', icon: <CloudSun className="h-3.5 w-3.5 text-accent-amber" />, accent: '' },
  ].filter(Boolean) as Array<{ label: string; value: string; unit: string; icon: React.ReactNode; accent: string }>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="pb-16"
      id="activity-detail-page"
    >
      {/* Top Nav */}
      <div className="flex items-start gap-4 mb-8">
        <button
          onClick={onBack}
          className="h-10 w-10 shrink-0 flex items-center justify-center clean-panel text-primary hover:bg-surface-inset rounded-xl transition-all cursor-pointer mt-1 shadow-sm"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-3xl sm:text-4xl font-display font-black text-primary tracking-tight truncate leading-tight">
            {activity.name}
          </h1>
          <p className="text-xs text-secondary flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 font-medium tracking-wide">
            <span>{dateStr}</span>
            {departureTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {departureTime}
              </span>
            )}
            {activity.deviceModel && (
              <span className="flex items-center gap-1 text-primary">
                <Watch className="h-3 w-3" />
                {activity.deviceModel}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Primary Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {metrics.map(m => (
          <div key={m.label} className="clean-panel px-5 py-4">
            <span className="text-[10px] text-muted uppercase tracking-widest font-sans block mb-2 font-medium">{m.label}</span>
            <div className="flex items-end gap-1">
              <span className={`text-2xl sm:text-3xl font-display font-bold leading-none tracking-tighter ${m.accent || 'text-primary'}`}>
                {m.value}
              </span>
              {m.unit && <span className="text-[10px] font-bold uppercase text-muted mb-0.5">{m.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Map */}
      {hasGps && (
        <div className="w-full rounded-[16px] overflow-hidden mb-6 border border-subtle shadow-sm" style={{ height: 400 }}>
          <ActivityCharts
            trackpoints={activity.trackpoints!}
            distanceKm={activity.distanceKm}
            mapHeight={400}
            compact={true}
          />
        </div>
      )}

      {/* Charts Panel */}
      {activity.trackpoints && activity.trackpoints.length > 0 && (
        <ActivityCharts
          trackpoints={activity.trackpoints}
          distanceKm={activity.distanceKm}
          mapHeight={0}
          compact={false}
        />
      )}

      {/* Secondary Metrics */}
      {secondaryMetrics.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
          {secondaryMetrics.map(m => (
            <div key={m.label} className="clean-panel px-4 py-4">
              <span className="text-[10px] text-muted uppercase tracking-widest font-sans flex items-center gap-1.5 mb-2 font-medium">
                {m.icon} {m.label}
              </span>
              <div className="flex items-end gap-1">
                <span className={`text-xl font-display font-bold leading-none tracking-tight ${m.accent || 'text-primary'}`}>{m.value}</span>
                {m.unit && <span className="text-[10px] font-bold uppercase text-muted mb-0.5">{m.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {!isDefaultNote && (
        <div className="clean-panel px-5 py-4 mb-6">
          <span className="text-[10px] text-muted uppercase tracking-widest font-sans block mb-2 font-medium">Note Sessione</span>
          <p className="text-sm text-secondary leading-relaxed italic">{cleanNotes}</p>
        </div>
      )}

      {/* Laps */}
      {activity.laps && activity.laps.length > 0 && (
        <div className="clean-panel overflow-hidden">
          <button
            onClick={() => setLapsOpen(o => !o)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-inset transition-colors cursor-pointer"
          >
            <span className="text-[10px] font-bold text-muted uppercase tracking-widest flex items-center gap-2">
              Giri
              <span className="text-accent-lime font-mono">× {activity.laps.length}</span>
            </span>
            {lapsOpen
              ? <ChevronUp className="h-4 w-4 text-muted" />
              : <ChevronDown className="h-4 w-4 text-muted" />
            }
          </button>

          {lapsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              transition={{ duration: 0.22 }}
              className="overflow-x-auto border-t border-subtle"
            >
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-[9px] text-muted uppercase tracking-widest bg-surface-inset">
                    {['#', 'Dist', 'Tempo', 'Passo', 'BPM', 'PPM'].map(h => (
                      <th key={h} className="py-3.5 px-5 font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono text-secondary">
                  {activity.laps.map(lap => {
                    const ps = lap.distanceKm > 0 ? (lap.durationSec / lap.distanceKm) : 0;
                    const lapPace = ps > 0
                      ? `${Math.floor(ps / 60)}:${Math.round(ps % 60).toString().padStart(2, '0')}`
                      : '--:--';
                    return (
                      <tr key={lap.lapIndex} className="border-t border-subtle hover:bg-surface-inset transition-colors">
                        <td className="py-3.5 px-5 text-muted font-bold">{lap.lapIndex}</td>
                        <td className="py-3.5 px-5 font-bold text-primary">{lap.distanceKm.toFixed(2)} km</td>
                        <td className="py-3.5 px-5">{formatDuration(lap.durationSec)}</td>
                        <td className="py-3.5 px-5 text-accent-lime font-bold">{lapPace}</td>
                        <td className="py-3.5 px-5 text-accent-rose font-bold">{lap.avgHeartRate || '--'}</td>
                        <td className="py-3.5 px-5 text-accent-cyan">{lap.avgCadence || '--'}</td>
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
