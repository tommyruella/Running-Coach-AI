import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Watch, Clock, Thermometer, Droplets,
  CloudSun, Flame, Activity as ActivityIcon, ChevronDown, ChevronUp, Dumbbell
} from 'lucide-react';
import { Activity as ActivityType } from '../types.js';
import ActivityCharts from './ActivityCharts.tsx';

interface ActivityDetailProps {
  activity?: ActivityType;
  hevySession?: any;
  onBack: () => void;
}

export default function ActivityDetail({ activity: initialActivity, hevySession, onBack }: ActivityDetailProps) {
  const [lapsOpen, setLapsOpen] = useState(false);
  const [activity, setActivity] = useState<ActivityType | undefined>(initialActivity);
  const [isLoading, setIsLoading] = useState(!!initialActivity && !initialActivity.trackpoints);

  React.useEffect(() => {
    if (initialActivity && !initialActivity.trackpoints) {
      setIsLoading(true);
      fetch(`/api/activities/${initialActivity.id}`)
        .then(res => res.json())
        .then(data => {
          setActivity(data);
          setIsLoading(false);
        })
        .catch(err => {
          console.error(err);
          setIsLoading(false);
        });
    } else {
      setActivity(initialActivity);
      setIsLoading(false);
    }
  }, [initialActivity]);

  if (hevySession) {
    const dateStr = new Date(hevySession.start_time).toLocaleDateString('it-IT', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    const startTimeStr = new Date(hevySession.start_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const durationMin = Math.round((new Date(hevySession.end_time).getTime() - new Date(hevySession.start_time).getTime()) / 60000);

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.25 }}
        className="pb-16"
      >
        <div className="flex items-start gap-4 mb-6">
          <button
            onClick={onBack}
            className="h-10 w-10 shrink-0 flex items-center justify-center clean-panel text-primary hover:bg-surface-inset rounded-xl transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>

        <div className="clean-panel relative overflow-hidden mb-6 p-6 sm:p-8">
          <div className="absolute -right-10 -top-10 opacity-5 pointer-events-none">
            <Dumbbell className="w-64 h-64 text-accent-cyan" strokeWidth={1} />
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="mac-popover bg-[var(--surface-popover)] text-primary text-[9px] px-2.5 py-1.5 rounded-full font-bold uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                  <Dumbbell className="h-3 w-3 text-accent-cyan" />
                  Forza (Hevy)
                </span>
                <p className="text-xs font-medium text-secondary flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  {startTimeStr}
                </p>
              </div>
              <h1 className="text-3xl sm:text-5xl font-display font-black text-primary tracking-tight leading-tight mb-2">
                {hevySession.title}
              </h1>
              <p className="text-sm font-medium text-secondary">
                {dateStr}
              </p>
            </div>
            
            <div className="flex items-center gap-6 sm:gap-8 border-t sm:border-t-0 sm:border-l border-subtle pt-4 sm:pt-0 sm:pl-8 shrink-0">
              <div>
                <span className="text-[9px] text-muted uppercase block tracking-widest font-bold mb-1">Volume</span>
                <span className="font-display font-bold text-3xl sm:text-4xl text-accent-cyan block leading-none tracking-tighter">
                  {hevySession.volume_kg > 1000 ? (hevySession.volume_kg / 1000).toFixed(1) : hevySession.volume_kg}
                  <span className="text-[12px] text-secondary font-sans font-medium uppercase tracking-normal ml-1">
                    {hevySession.volume_kg > 1000 ? 't' : 'kg'}
                  </span>
                </span>
              </div>
              <div>
                <span className="text-[9px] text-muted uppercase block tracking-widest font-bold mb-1">Durata</span>
                <span className="font-display font-bold text-3xl sm:text-4xl text-primary block leading-none tracking-tighter">
                  {durationMin}
                  <span className="text-[12px] text-secondary font-sans font-medium uppercase tracking-normal ml-1">m</span>
                </span>
              </div>
              <div>
                <span className="text-[9px] text-muted uppercase block tracking-widest font-bold mb-1">Esercizi</span>
                <span className="font-display font-bold text-3xl sm:text-4xl text-primary block leading-none tracking-tighter">
                  {hevySession.exercise_count}
                </span>
              </div>
            </div>
          </div>
        </div>

        {hevySession.exercises && hevySession.exercises.length > 0 ? (
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-secondary uppercase tracking-widest flex items-center gap-2 mb-3">
              Dettaglio Esercizi
            </h3>
            {hevySession.exercises.map((ex: any, idx: number) => (
              <div key={idx} className="clean-panel overflow-hidden">
                <div className="px-5 py-3 bg-surface-inset border-b border-subtle">
                  <span className="text-sm font-bold text-primary">{ex.title}</span>
                </div>
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="text-[9px] text-muted uppercase tracking-widest">
                      <th className="py-2.5 px-5 font-bold">Set</th>
                      <th className="py-2.5 px-5 font-bold">Kg</th>
                      <th className="py-2.5 px-5 font-bold">Reps</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-secondary">
                    {ex.sets.map((set: any, sIdx: number) => (
                      <tr key={sIdx} className="border-t border-subtle hover:bg-surface-inset transition-colors">
                        <td className="py-2.5 px-5 text-muted font-bold flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${set.type === 'warmup' ? 'bg-accent-amber' : 'bg-accent-cyan'}`} />
                          {set.index + 1}
                        </td>
                        <td className="py-2.5 px-5 font-bold text-primary">{set.weight_kg > 0 ? set.weight_kg : '--'}</td>
                        <td className="py-2.5 px-5 font-bold">{set.reps}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : (
          <div className="clean-panel px-5 py-8 text-center text-secondary">
            <ActivityIcon className="h-8 w-8 mx-auto mb-3 text-muted" />
            <p className="text-sm">I dettagli degli esercizi non sono stati salvati per questa sessione.</p>
          </div>
        )}
      </motion.div>
    );
  }

  if (!activity) return null;

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
      <div className="flex items-start gap-4 mb-6">
        <button
          onClick={onBack}
          className="h-10 w-10 shrink-0 flex items-center justify-center clean-panel text-primary hover:bg-surface-inset rounded-xl transition-all cursor-pointer shadow-sm"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-secondary">
          <ActivityIcon className="w-10 h-10 mb-4 animate-pulse text-accent" />
          <p className="text-sm font-medium">Caricamento dettagli e mappa...</p>
        </div>
      ) : (
        <>
          <div className="clean-panel relative overflow-hidden mb-6 p-6 sm:p-8">
            <div className="absolute -right-10 -top-10 opacity-5 pointer-events-none">
              <ActivityIcon className="w-64 h-64 text-accent-lime" strokeWidth={1} />
            </div>
            
            <div className="relative z-10 flex flex-col xl:flex-row xl:items-end justify-between gap-6">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="mac-popover bg-[var(--surface-popover)] text-primary text-[9px] px-2.5 py-1.5 rounded-full font-bold uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                    <ActivityIcon className="h-3 w-3 text-accent-lime" />
                    Corsa
                  </span>
                  <p className="text-xs font-medium text-secondary flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {departureTime || '--:--'}
                  </p>
                  {activity.deviceModel && (
                    <span className="text-xs font-medium text-primary flex items-center gap-1.5">
                      <Watch className="h-3 w-3 text-muted" />
                      {activity.deviceModel}
                    </span>
                  )}
                </div>
                <h1 className="text-3xl sm:text-5xl font-display font-black text-primary tracking-tight leading-tight mb-2 truncate" title={activity.name}>
                  {activity.name}
                </h1>
                <p className="text-sm font-medium text-secondary">
                  {dateStr}
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-6 sm:gap-8 border-t xl:border-t-0 xl:border-l border-subtle pt-4 xl:pt-0 xl:pl-8 shrink-0">
                {metrics.map(m => (
                  <div key={m.label}>
                    <span className="text-[9px] text-muted uppercase block tracking-widest font-bold mb-1">{m.label}</span>
                    <span className={`font-display font-bold text-3xl sm:text-4xl block leading-none tracking-tighter ${m.accent || 'text-primary'}`}>
                      {m.value}
                      {m.unit && <span className="text-[12px] text-secondary font-sans font-medium uppercase tracking-normal ml-1">{m.unit}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

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

          {activity.trackpoints && activity.trackpoints.length > 0 && (
            <div className="mb-6">
              <ActivityCharts
                trackpoints={activity.trackpoints}
                distanceKm={activity.distanceKm}
                mapHeight={0}
                compact={false}
              />
            </div>
          )}

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

          {!isDefaultNote && (
            <div className="clean-panel px-5 py-4 mb-6">
              <span className="text-[10px] text-muted uppercase tracking-widest font-sans block mb-2 font-medium">Note Sessione</span>
              <p className="text-sm text-secondary leading-relaxed italic">{cleanNotes}</p>
            </div>
          )}

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

              <AnimatePresence>
                {lapsOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
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
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
