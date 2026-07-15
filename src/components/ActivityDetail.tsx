import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Watch, Clock, Thermometer, Droplets, Wind, CloudSun, Flame, Activity as ActivityIcon, Layers } from 'lucide-react';
import { Activity as ActivityType } from '../types.js';
import ActivityCharts from './ActivityCharts.tsx';

interface ActivityDetailProps {
  activity: ActivityType;
  onBack: () => void;
}

export default function ActivityDetail({ activity, onBack }: ActivityDetailProps) {
  const formatDuration = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const dateStr = new Date(activity.date).toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const timeStr = new Date(activity.date).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const weatherRegex = /^\[Partenza ore ([^|\]]+)(?: \| Condizioni: ([^,]+), Temp: ([^,]+), Umidità: ([^,]+), Vento: ([^\]]+))?\]/;
  const weatherMatch = activity.notes ? activity.notes.match(weatherRegex) : null;
  
  let departureTime = '';
  let weatherCond = '';
  let tempVal = '';
  let humidityVal = '';
  let windVal = '';
  let cleanNotes = activity.notes || '';

  if (weatherMatch) {
    departureTime = weatherMatch[1];
    let condRaw = (weatherMatch[2] || '')
      .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '')
      .replace(/^[^\wÀ-ÿ]+/g, '')
      .trim();
    
    const itToEn: Record<string, string> = {
      'Sereno': 'Clear',
      'Parzialmente Nuvoloso': 'Partly Cloudy',
      'Nebbia': 'Fog',
      'Pioggerellina': 'Drizzle',
      'Pioggia': 'Rain',
      'Neve': 'Snow',
      'Rovesci di Pioggia': 'Rain Showers',
      'Temporale': 'Thunderstorm',
      'Coperto': 'Overcast'
    };
    weatherCond = itToEn[condRaw] || condRaw;
    tempVal = weatherMatch[3] || '';
    humidityVal = weatherMatch[4] || '';
    windVal = weatherMatch[5] || '';
    cleanNotes = activity.notes.replace(weatherRegex, '').trim();
  }

  const isDefaultNote = !cleanNotes || 
    cleanNotes.trim() === '' || 
    /File TCX caricato correttamente/i.test(cleanNotes) || 
    (/Rilevati/i.test(cleanNotes) && /giri/i.test(cleanNotes));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 pb-12"
      id="activity-detail-page"
    >
      {/* Header / Nav */}
      <div className="flex items-center gap-4 border-b border-white/5 pb-5">
        <button 
          onClick={onBack}
          className="h-10 w-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white rounded-full transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white uppercase tracking-wide truncate">
            {activity.name}
          </h1>
          <p className="text-xs text-zinc-400 font-medium flex items-center gap-2 mt-1 uppercase tracking-wider">
            <span>{dateStr}</span>
            <span className="text-zinc-700">•</span>
            <span>{timeStr}</span>
            {activity.deviceModel && (
              <>
                <span className="text-zinc-700">•</span>
                <span className="flex items-center gap-1 text-lime-400/80">
                  <Watch className="h-3.5 w-3.5" />
                  {activity.deviceModel}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Main Map Focus - Rendered conditionally if GPS data exists */}
      {activity.trackpoints && activity.trackpoints.length > 0 && (
        <div className="glass-panel rounded-[24px] p-2 sm:p-4 overflow-hidden">
          <ActivityCharts
            trackpoints={activity.trackpoints}
            distanceKm={activity.distanceKm}
          />
        </div>
      )}

      {/* Big Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 sm:p-6 rounded-[24px] flex flex-col justify-center">
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-sans mb-1">Distanza</span>
          <div className="flex items-end gap-1">
            <span className="text-4xl sm:text-5xl font-display font-bold text-lime-400 leading-none tracking-tighter">{activity.distanceKm.toFixed(2)}</span>
            <span className="text-sm font-bold uppercase text-zinc-500 mb-1">km</span>
          </div>
        </div>
        <div className="glass-panel p-5 sm:p-6 rounded-[24px] flex flex-col justify-center">
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-sans mb-1">Passo</span>
          <span className="text-3xl sm:text-4xl font-display font-bold text-white leading-none tracking-tighter">{activity.avgPace}</span>
        </div>
        <div className="glass-panel p-5 sm:p-6 rounded-[24px] flex flex-col justify-center">
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-sans mb-1">Durata</span>
          <span className="text-3xl sm:text-4xl font-display font-bold text-white leading-none tracking-tighter">{activity.durationMin}m</span>
        </div>
        <div className="glass-panel p-5 sm:p-6 rounded-[24px] flex flex-col justify-center">
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-sans mb-1">BPM / PPM</span>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-2xl font-display font-bold text-rose-400 leading-none">{activity.avgHeartRate || '--'}</span>
            <span className="text-2xl font-display font-bold text-cyan-400 leading-none">{activity.avgCadence || '--'}</span>
          </div>
        </div>
      </div>

      {/* Bento Grid layout for secondary details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Summary Block */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          
          {/* Weather Bento Cell */}
          {weatherMatch && (
            <div className="glass-panel p-5 rounded-[24px] space-y-4">
              <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                <CloudSun aria-hidden="true" className="h-4 w-4 text-amber-400" />
                Meteo & Orario
              </h5>
              <div className="grid grid-cols-2 gap-y-5 gap-x-2 font-display">
                <div>
                  <span className="text-[9px] text-zinc-500 flex items-center gap-1 uppercase tracking-wider font-sans mb-1">
                    <Clock aria-hidden="true" className="h-3 w-3" /> Partenza
                  </span>
                  <span className="text-xl text-white block">{departureTime}</span>
                </div>
                {weatherCond && (
                  <div>
                    <span className="text-[9px] text-zinc-500 flex items-center gap-1 uppercase tracking-wider font-sans mb-1">
                      <CloudSun aria-hidden="true" className="h-3 w-3" /> Cond
                    </span>
                    <span className="text-xl text-white block truncate">{weatherCond}</span>
                  </div>
                )}
                {tempVal && (
                  <div>
                    <span className="text-[9px] text-zinc-500 flex items-center gap-1 uppercase tracking-wider font-sans mb-1">
                      <Thermometer aria-hidden="true" className="h-3 w-3" /> Temp
                    </span>
                    <span className="text-xl text-white block">{tempVal}</span>
                  </div>
                )}
                {humidityVal && (
                  <div>
                    <span className="text-[9px] text-zinc-500 flex items-center gap-1 uppercase tracking-wider font-sans mb-1">
                      <Droplets aria-hidden="true" className="h-3 w-3" /> Umidità
                    </span>
                    <span className="text-xl text-white block">{humidityVal}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stats Mini Bento Cells */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-panel p-5 rounded-[24px]">
              <span className="text-[9px] text-zinc-500 flex items-center gap-1.5 uppercase tracking-widest font-sans mb-2">
                <Flame aria-hidden="true" className="h-4 w-4 text-orange-400" />
                Calorie
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-display font-bold text-white">{activity.calories}</span>
                <span className="text-xs text-zinc-500 font-bold uppercase">kcal</span>
              </div>
            </div>
            <div className="glass-panel p-5 rounded-[24px]">
              <span className="text-[9px] text-zinc-500 flex items-center gap-1.5 uppercase tracking-widest font-sans mb-2">
                <ActivityIcon aria-hidden="true" className="h-4 w-4 text-cyan-400" />
                Cadenza
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-display font-bold text-white">{activity.avgCadence || '--'}</span>
                <span className="text-xs text-zinc-500 font-bold uppercase">ppm</span>
              </div>
            </div>
          </div>

          {/* Notes Cell */}
          {!isDefaultNote && (
            <div className="glass-panel rounded-[24px] p-6">
              <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-1.5 font-sans">
                Note Sessione
              </h5>
              <p className="text-sm text-zinc-300 leading-relaxed italic">{cleanNotes}</p>
            </div>
          )}
        </div>

        {/* Splits & Laps Block */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="glass-panel rounded-[24px] overflow-hidden flex-1 flex flex-col">
            <div className="p-6 border-b border-white/5">
              <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                <Layers className="h-4 w-4 text-lime-400" />
                Intervalli Giro (Lap)
              </h5>
            </div>
            
            <div className="overflow-x-auto flex-1 p-2">
              <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] text-zinc-500 uppercase font-sans tracking-wider bg-white/5">
                    <th className="py-4 px-5 text-center font-bold">Lap</th>
                    <th className="py-4 px-5 font-bold">Dist</th>
                    <th className="py-4 px-5 font-bold">Tempo</th>
                    <th className="py-4 px-5 font-bold">Passo</th>
                    <th className="py-4 px-5 font-bold">BPM</th>
                    <th className="py-4 px-5 font-bold">PPM</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-zinc-300">
                  {activity.laps && activity.laps.map((lap) => {
                    const paceSeconds = lap.distanceKm > 0 ? (lap.durationSec / lap.distanceKm) : 0;
                    let lapPaceStr = '--:--';
                    if (paceSeconds > 0) {
                      const min = Math.floor(paceSeconds / 60);
                      const sec = Math.round(paceSeconds % 60);
                      lapPaceStr = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
                    }

                    return (
                      <tr key={lap.lapIndex} className="border-b border-white/5 hover:bg-white/5 last:border-0 transition-colors">
                        <td className="py-4 px-5 text-center font-bold text-zinc-500">{lap.lapIndex}</td>
                        <td className="py-4 px-5 font-bold text-white">{lap.distanceKm.toFixed(2)} km</td>
                        <td className="py-4 px-5 text-zinc-400">{formatDuration(lap.durationSec)}</td>
                        <td className="py-4 px-5 text-lime-400 font-bold">{lapPaceStr}</td>
                        <td className="py-4 px-5 text-rose-400 font-bold">{lap.avgHeartRate || '--'}</td>
                        <td className="py-4 px-5 text-cyan-400">{lap.avgCadence || '--'}</td>
                      </tr>
                    );
                  })}

                  {(!activity.laps || activity.laps.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-zinc-500 italic text-sm">
                        Nessun dettaglio giro registrato nel file TCX.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
