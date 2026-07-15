/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UploadCloud, FolderOpen, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Flame, Activity, Layers, Watch, Clock, Thermometer, Droplets, Wind, CloudSun } from 'lucide-react';
import { Activity as ActivityType } from '../types.js';
import ActivityCharts from './ActivityCharts.tsx';

interface HistoryProps {
  activities: ActivityType[];
  onUploadTcx: (files: File[]) => Promise<void>;
  isUploading: boolean;
  uploadError: string | null;
  uploadSuccess: string | null;
}

// Helper to recursively traverse directories and find TCX files
const traverseFileTree = async (entry: any, fileList: File[]): Promise<void> => {
  if (entry.isFile) {
    if (entry.name.toLowerCase().endsWith('.tcx')) {
      const file = await new Promise<File>((resolve, reject) => {
        entry.file(resolve, reject);
      });
      fileList.push(file);
    }
  } else if (entry.isDirectory) {
    const dirReader = entry.createReader();
    const readEntries = async (): Promise<any[]> => {
      return new Promise((resolve, reject) => {
        const allEntries: any[] = [];
        const read = () => {
          dirReader.readEntries((entries: any[]) => {
            if (entries.length === 0) {
              resolve(allEntries);
            } else {
              allEntries.push(...entries);
              read();
            }
          }, reject);
        };
        read();
      });
    };

    try {
      const entries = await readEntries();
      const promises = entries.map(childEntry => traverseFileTree(childEntry, fileList));
      await Promise.all(promises);
    } catch (err) {
      console.error('Error reading directory entry:', err);
    }
  }
};

export default function History({ activities, onUploadTcx, isUploading, uploadError, uploadSuccess }: HistoryProps) {
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  
  const [currentDate, setCurrentDate] = useState(new Date());

  // Group activities by date key YYYY-MM-DD
  const calendarGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    
    const activeDatesMap = new Map<string, ActivityType>();
    activities.forEach(a => {
      const d = new Date(a.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      activeDatesMap.set(key, a);
    });

    const grid = [];
    for (let i = 0; i < startingDayOfWeek; i++) grid.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const activity = activeDatesMap.get(dStr);
      grid.push({
        day: i,
        activity,
        isToday: new Date().getFullYear() === year && new Date().getMonth() === month && new Date().getDate() === i
      });
    }
    return grid;
  }, [activities, currentDate]);

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + (direction === 'next' ? 1 : -1));
      return d;
    });
  };

  const handleDayClick = (actId: string) => {
    setExpandedActivityId(actId);
    setTimeout(() => {
      const element = document.getElementById(`act_${actId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const toggleExpand = (id: string) => {
    setExpandedActivityId(prev => (prev === id ? null : id));
  };

  const formatDuration = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files: File[] = [];

    if (e.dataTransfer.items) {
      const promises: Promise<void>[] = [];
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            promises.push(traverseFileTree(entry, files));
          }
        }
      }
      await Promise.all(promises);
    } else if (e.dataTransfer.files) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        if (file.name.toLowerCase().endsWith('.tcx')) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      await onUploadTcx(files);
    } else {
      alert('Nessun file .tcx valido trovato nella selezione trascinata.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      const files: File[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        if (file.name.toLowerCase().endsWith('.tcx')) {
          files.push(file);
        }
      }
      if (files.length > 0) {
        await onUploadTcx(files);
      } else {
        alert('Seleziona almeno un file .tcx di Garmin o Strava.');
      }
    }
  };

  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      const files: File[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        if (file.name.toLowerCase().endsWith('.tcx')) {
          files.push(file);
        }
      }
      if (files.length > 0) {
        await onUploadTcx(files);
      } else {
        alert('Nessun file .tcx trovato nella cartella selezionata.');
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const triggerFolderInput = (e: React.MouseEvent) => {
    e.stopPropagation();
    folderInputRef.current?.click();
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) {
      return;
    }
    triggerFileInput();
  };

  return (
    <div className="space-y-6" id="history-tab">
      
      {/* Page Header */}
      <div className="border-b border-zinc-800 pb-5">
        <h1 className="text-5xl sm:text-6xl font-black tracking-tighter text-white lowercase">history</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Upload & Calendar */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Upload Area */}
          <div 
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={handleCardClick}
            className={`border border-dashed rounded-lg p-8 text-center transition-all relative overflow-hidden flex flex-col items-center justify-center cursor-pointer ${
              dragActive 
                ? 'border-lime-400 bg-lime-400/5' 
                : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900/90'
            }`}
            id="tcx-upload-zone"
          >
        <input 
          ref={fileInputRef}
          type="file"
          accept=".tcx"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        <input 
          ref={folderInputRef}
          type="file"
          accept=".tcx"
          {...{ webkitdirectory: "" }}
          multiple
          onChange={handleFolderChange}
          className="hidden"
        />

        <div className="space-y-4 max-w-md">
          <div className="mx-auto h-12 w-12 rounded-lg bg-zinc-950 border border-zinc-800 text-lime-400 flex items-center justify-center">
            {isUploading ? (
              <svg className="animate-spin h-5 w-5 text-lime-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <UploadCloud className="h-5 w-5" />
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-white">
              {isUploading ? 'Analisi e caricamento dei file...' : 'Trascina qui i file .tcx o una cartella intera'}
            </p>
            <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
              Sincronizza più corse contemporaneamente o seleziona una cartella locale per importare tutto in un colpo solo.
            </p>
            
            {!isUploading && (
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={triggerFileInput}
                  className="flex items-center gap-2 px-3 py-1.5 rounded bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-300 transition-all cursor-pointer"
                >
                  <UploadCloud className="h-3.5 w-3.5 text-lime-400" />
                  Seleziona File
                </button>
                <button
                  type="button"
                  onClick={triggerFolderInput}
                  className="flex items-center gap-2 px-3 py-1.5 rounded bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-300 transition-all cursor-pointer"
                >
                  <FolderOpen className="h-3.5 w-3.5 text-lime-400" />
                  Carica Cartella
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Message Banner (Absolute position inside upload card, or inline) */}
        <AnimatePresence>
          {uploadError && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-2 left-2 right-2 bg-rose-950/40 border border-rose-900/60 rounded-md px-3 py-2 text-[10px] text-rose-400 text-center font-mono"
            >
              Errore: {uploadError}
            </motion.div>
          )}

          {uploadSuccess && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-2 left-2 right-2 bg-zinc-950 border border-lime-500/30 rounded-md px-3 py-2 text-[10px] text-lime-400 text-center font-mono"
            >
              File caricato correttamente!
            </motion.div>
          )}
        </AnimatePresence>
      </div>

          {/* Navigatable Calendar Widget */}
          <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-lg flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Naviga Allenamenti</h4>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleMonthChange('prev')}
                  className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-white cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-mono font-bold text-white uppercase whitespace-nowrap">
                  {currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
                </span>
                <button 
                  onClick={() => handleMonthChange('next')}
                  className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-white cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800/50 p-4 rounded-lg">
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
                  <div key={i} className="text-[9px] font-medium text-zinc-500">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {calendarGrid.map((dayObj, i) => (
                  <div key={i} className="aspect-square">
                    {dayObj === null ? (
                      <div className="w-full h-full opacity-0" />
                    ) : dayObj.activity ? (
                      <button
                        onClick={() => handleDayClick(dayObj.activity!.id)}
                        className="w-full h-full rounded bg-lime-400 text-black font-bold shadow-sm shadow-lime-400/20 scale-105 transition-all cursor-pointer flex items-center justify-center text-[10px] font-mono hover:bg-lime-300"
                        title={dayObj.activity.name}
                      >
                        {dayObj.day}
                      </button>
                    ) : (
                      <div 
                        className={`w-full h-full rounded flex items-center justify-center text-[10px] font-mono text-zinc-600 ${
                          dayObj.isToday 
                            ? 'bg-zinc-800 text-white border border-zinc-700 font-bold' 
                            : 'bg-zinc-900/30'
                        }`}
                      >
                        {dayObj.day}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Right Side: Activities List */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Sessioni Registrate ({activities.length})</h3>
          </div>

          <div className="space-y-3" id="activities-history-list">
          {activities.map((act) => {
            const isExpanded = expandedActivityId === act.id;
            const dateStr = new Date(act.date).toLocaleDateString('it-IT', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            });
            const timeStr = new Date(act.date).toLocaleTimeString('it-IT', {
              hour: '2-digit',
              minute: '2-digit'
            });

            // Match weather pattern: [Partenza ore 18:17 | Condizioni: ☀️ Sereno, Temp: 28.7°C, Umidità: 30%, Vento: 6 km/h]
            const weatherRegex = /^\[Partenza ore ([^|\]]+)(?: \| Condizioni: ([^,]+), Temp: ([^,]+), Umidità: ([^,]+), Vento: ([^\]]+))?\]/;
            const weatherMatch = act.notes ? act.notes.match(weatherRegex) : null;
            
            let departureTime = '';
            let weatherCond = '';
            let tempVal = '';
            let humidityVal = '';
            let windVal = '';
            let cleanNotes = act.notes || '';

            if (weatherMatch) {
              departureTime = weatherMatch[1];
              // Strip emojis using unicode regex property and trim any leading/trailing spaces/symbols
              let condRaw = (weatherMatch[2] || '')
                .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '')
                .replace(/^[^\wÀ-ÿ]+/g, '')
                .trim();
              
              // Map to English for compact layout
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
              cleanNotes = act.notes.replace(weatherRegex, '').trim();
            }

            return (
              <div 
                key={act.id}
                id={`act_${act.id}`}
                className={`glass-panel overflow-hidden transition-all duration-300 ${
                  isExpanded ? 'rounded-[32px] shadow-neon-glow border-lime-400/30 bg-zinc-950/80' : 'rounded-[24px] hover:border-white/20'
                }`}
              >
                {/* Collapsible Header */}
                <div 
                  onClick={() => toggleExpand(act.id)}
                  className="p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-5 min-w-0">
                    {/* Distance Big Metric */}
                    <div className="flex items-end gap-1 shrink-0">
                      <span className="text-4xl sm:text-5xl font-display font-bold text-lime-400 leading-none tracking-tighter">{act.distanceKm.toFixed(1)}</span>
                      <span className="text-xs font-bold uppercase text-zinc-500 mb-1">km</span>
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-base sm:text-lg font-bold text-white truncate font-display uppercase tracking-wide">
                        {act.name}
                      </h4>
                      <p className="text-[10px] text-zinc-400 font-medium flex flex-wrap items-center gap-2 mt-1 uppercase tracking-wider">
                        <span>{dateStr}</span>
                        <span className="text-zinc-700">•</span>
                        <span>{timeStr}</span>
                        {act.deviceModel && (
                          <>
                            <span className="text-zinc-700">•</span>
                            <span className="flex items-center gap-1 text-lime-400/80">
                              <Watch className="h-3 w-3" />
                              {act.deviceModel}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Summary Metric Strip */}
                  <div className="flex items-center gap-4 shrink-0 font-mono text-xs text-zinc-400">
                    <div className="hidden sm:grid grid-cols-4 gap-8 text-right mr-4">
                      <div>
                        <span className="text-[9px] text-zinc-500 block uppercase tracking-widest font-sans">Passo</span>
                        <span className="font-bold text-white block mt-1 text-sm">{act.avgPace}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-500 block uppercase tracking-widest font-sans">Durata</span>
                        <span className="font-bold text-white block mt-1 text-sm">{act.durationMin}m</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-500 block uppercase tracking-widest font-sans">BPM</span>
                        <span className="font-bold text-rose-400 block mt-1 text-sm">
                          {act.avgHeartRate ? act.avgHeartRate : '--'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-500 block uppercase tracking-widest font-sans">PPM</span>
                        <span className="font-bold text-cyan-400 block mt-1 text-sm">
                          {act.avgCadence ? act.avgCadence : '--'}
                        </span>
                      </div>
                    </div>

                    <div className="text-white p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </div>
                </div>

                {/* Collapsible Content - Bento Grid layout */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="border-t border-white/5"
                    >
                      <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
                        
                        {/* Summary Block */}
                        <div className="lg:col-span-4 flex flex-col gap-4">
                          
                          {/* Weather Bento Cell */}
                          {weatherMatch && (
                            <div className="glass-panel p-5 rounded-[16px] space-y-4">
                              <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                                <CloudSun aria-hidden="true" className="h-3.5 w-3.5 text-amber-400" />
                                Meteo & Orario
                              </h5>
                              <div className="grid grid-cols-2 gap-y-4 gap-x-2 font-display">
                                <div>
                                  <span className="text-[9px] text-zinc-500 flex items-center gap-1 uppercase tracking-wider font-sans mb-1">
                                    <Clock aria-hidden="true" className="h-3 w-3" /> Partenza
                                  </span>
                                  <span className="text-lg text-white block">{departureTime}</span>
                                </div>
                                {weatherCond && (
                                  <div>
                                    <span className="text-[9px] text-zinc-500 flex items-center gap-1 uppercase tracking-wider font-sans mb-1">
                                      <CloudSun aria-hidden="true" className="h-3 w-3" /> Condizioni
                                    </span>
                                    <span className="text-lg text-white block truncate">{weatherCond}</span>
                                  </div>
                                )}
                                {tempVal && (
                                  <div>
                                    <span className="text-[9px] text-zinc-500 flex items-center gap-1 uppercase tracking-wider font-sans mb-1">
                                      <Thermometer aria-hidden="true" className="h-3 w-3" /> Temp
                                    </span>
                                    <span className="text-lg text-white block">{tempVal}</span>
                                  </div>
                                )}
                                {humidityVal && (
                                  <div>
                                    <span className="text-[9px] text-zinc-500 flex items-center gap-1 uppercase tracking-wider font-sans mb-1">
                                      <Droplets aria-hidden="true" className="h-3 w-3" /> Umidità
                                    </span>
                                    <span className="text-lg text-white block">{humidityVal}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Stats Mini Bento Cells */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="glass-panel p-4 rounded-[16px]">
                              <span className="text-[9px] text-zinc-500 flex items-center gap-1.5 uppercase tracking-widest font-sans mb-1">
                                <Flame aria-hidden="true" className="h-3.5 w-3.5 text-orange-400" />
                                Calorie
                              </span>
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-display font-bold text-white">{act.calories}</span>
                                <span className="text-[10px] text-zinc-500 font-bold uppercase">kcal</span>
                              </div>
                            </div>
                            <div className="glass-panel p-4 rounded-[16px]">
                              <span className="text-[9px] text-zinc-500 flex items-center gap-1.5 uppercase tracking-widest font-sans mb-1">
                                <Activity aria-hidden="true" className="h-3.5 w-3.5 text-cyan-400" />
                                Cadenza
                              </span>
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-display font-bold text-white">{act.avgCadence || '--'}</span>
                                <span className="text-[10px] text-zinc-500 font-bold uppercase">ppm</span>
                              </div>
                            </div>
                          </div>

                          {/* Notes Cell */}
                          {(() => {
                            const isDefaultNote = !cleanNotes || 
                              cleanNotes.trim() === '' || 
                              /File TCX caricato correttamente/i.test(cleanNotes) || 
                              (/Rilevati/i.test(cleanNotes) && /giri/i.test(cleanNotes));
                            
                            if (isDefaultNote) return null;

                            return (
                              <div className="glass-panel rounded-[16px] p-5">
                                <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-1.5 font-sans">
                                  Note Sessione
                                </h5>
                                <p className="text-sm text-zinc-300 leading-relaxed italic">{cleanNotes}</p>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Splits & Laps Block */}
                        <div className="lg:col-span-8 flex flex-col gap-4">
                          
                          <div className="glass-panel rounded-[16px] overflow-hidden flex-1 flex flex-col">
                            <div className="p-5 border-b border-white/5">
                              <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                                <Layers className="h-3.5 w-3.5 text-lime-400" />
                                Intervalli Giro (Lap)
                              </h5>
                            </div>
                            
                            <div className="overflow-x-auto flex-1">
                              <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
                                <thead>
                                  <tr className="border-b border-white/5 text-[10px] text-zinc-500 uppercase font-sans tracking-wider bg-white/5">
                                    <th className="py-3 px-4 text-center font-bold">Lap</th>
                                    <th className="py-3 px-4 font-bold">Dist</th>
                                    <th className="py-3 px-4 font-bold">Tempo</th>
                                    <th className="py-3 px-4 font-bold">Passo</th>
                                    <th className="py-3 px-4 font-bold">BPM</th>
                                    <th className="py-3 px-4 font-bold">PPM</th>
                                  </tr>
                                </thead>
                                <tbody className="font-mono text-zinc-300">
                                  {act.laps && act.laps.map((lap) => {
                                    const paceSeconds = lap.distanceKm > 0 ? (lap.durationSec / lap.distanceKm) : 0;
                                    let lapPaceStr = '--:--';
                                    if (paceSeconds > 0) {
                                      const min = Math.floor(paceSeconds / 60);
                                      const sec = Math.round(paceSeconds % 60);
                                      lapPaceStr = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
                                    }

                                    return (
                                      <tr key={lap.lapIndex} className="border-b border-white/5 hover:bg-white/5 last:border-0 transition-colors">
                                        <td className="py-3 px-4 text-center font-bold text-zinc-500">{lap.lapIndex}</td>
                                        <td className="py-3 px-4 font-bold text-white">{lap.distanceKm.toFixed(2)} km</td>
                                        <td className="py-3 px-4 text-zinc-400">{formatDuration(lap.durationSec)}</td>
                                        <td className="py-3 px-4 text-lime-400 font-bold">{lapPaceStr}</td>
                                        <td className="py-3 px-4 text-rose-400 font-bold">{lap.avgHeartRate || '--'}</td>
                                        <td className="py-3 px-4 text-cyan-400">{lap.avgCadence || '--'}</td>
                                      </tr>
                                    );
                                  })}

                                  {(!act.laps || act.laps.length === 0) && (
                                    <tr>
                                      <td colSpan={6} className="py-12 text-center text-zinc-500 italic text-xs">
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

                      {/* GPS Charts Full-Width Bento Cell */}
                      {act.trackpoints && act.trackpoints.length > 0 && (
                        <div className="p-5 sm:p-6 pt-0">
                          <div className="glass-panel rounded-[16px] p-5">
                            <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-5 flex items-center gap-1.5 font-sans">
                              <Activity className="h-3.5 w-3.5 text-lime-400" />
                              Metriche GPS
                            </h5>
                            <ActivityCharts
                              trackpoints={act.trackpoints}
                              distanceKm={act.distanceKm}
                            />
                          </div>
                        </div>
                      )}

                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {activities.length === 0 && (
            <div className="text-center py-12 bg-zinc-900/40 border border-zinc-800/80 rounded-lg text-zinc-500 text-xs">
              Nessun allenamento presente. Carica un file .tcx per iniziare.
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);
}
