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
                className={`bg-zinc-900 border rounded-lg overflow-hidden transition-all duration-200 ${
                  isExpanded ? 'border-zinc-700 shadow-lg' : 'border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                {/* Collapsible Header */}
                <div 
                  onClick={() => toggleExpand(act.id)}
                  className="p-4 flex items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Distance Circular Indicator */}
                    <div className="h-10 w-10 rounded bg-zinc-950 border border-zinc-800 text-lime-400 flex flex-col items-center justify-center shrink-0">
                      <span className="text-sm font-bold tracking-tight font-mono leading-none">{act.distanceKm.toFixed(1)}</span>
                      <span className="text-[7px] font-medium uppercase mt-0.5 text-zinc-500">km</span>
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate">
                        {act.name}
                      </h4>
                      <p className="text-[10px] text-zinc-500 flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="capitalize">{dateStr}</span>
                        <span>•</span>
                        <span>{timeStr}</span>
                        {act.deviceModel && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Watch className="h-3 w-3 text-zinc-500" />
                              {act.deviceModel}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Summary Metric Strip */}
                  <div className="flex items-center gap-4 shrink-0 font-mono text-xs text-zinc-400">
                    <div className="hidden sm:grid grid-cols-4 gap-6 text-right mr-2">
                      <div>
                        <span className="text-[9px] text-zinc-500 block">PASSO</span>
                        <span className="font-bold text-white block mt-0.5">{act.avgPace}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-500 block">DURATA</span>
                        <span className="font-bold text-white block mt-0.5">{act.durationMin}m</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-500 block">BATTITO</span>
                        <span className="font-bold text-rose-400 block mt-0.5">
                          {act.avgHeartRate ? `${act.avgHeartRate} bpm` : '--'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-500 block">CADENZA</span>
                        <span className="font-bold text-cyan-400 block mt-0.5">
                          {act.avgCadence ? `${act.avgCadence} ppm` : '--'}
                        </span>
                      </div>
                    </div>

                    <div className="text-zinc-500 p-1 hover:bg-zinc-800 rounded transition-colors">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </div>

                {/* Collapsible Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-zinc-800/60 bg-zinc-950/40"
                    >
                      <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* Summary Block */}
                        <div className="space-y-4">
                          {/* Weather & Time Widget - same card style as Calorie/Cadenza */}
                          {weatherMatch && (
                            <section aria-labelledby={`weather-heading-${act.id}`} className="space-y-3">
                              <h5 id={`weather-heading-${act.id}`} className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                <CloudSun aria-hidden="true" className="h-3.5 w-3.5 text-amber-400" />
                                Meteo & Orario
                              </h5>
                              <div className="grid grid-cols-2 gap-4 font-mono text-xs" role="group" aria-label="Dettagli meteorologici e orario">
                                <div className="bg-zinc-900 border border-zinc-800/50 p-4 rounded-lg flex flex-col justify-between">
                                  <span className="text-[9px] text-zinc-500 flex items-center gap-1.5 uppercase">
                                    <Clock aria-hidden="true" className="h-3.5 w-3.5 text-zinc-400" />
                                    Partenza
                                  </span>
                                  <span className="text-base font-bold text-white block mt-1.5">{departureTime}</span>
                                </div>
                                {weatherCond && (
                                  <div className="bg-zinc-900 border border-zinc-800/50 p-4 rounded-lg flex flex-col justify-between">
                                    <span className="text-[9px] text-zinc-500 flex items-center gap-1.5 uppercase">
                                      <CloudSun aria-hidden="true" className="h-3.5 w-3.5 text-amber-400" />
                                      Condizioni
                                    </span>
                                    <span className="text-sm font-bold text-white block mt-1.5 leading-tight">{weatherCond}</span>
                                  </div>
                                )}
                                {tempVal && (
                                  <div className="bg-zinc-900 border border-zinc-800/50 p-4 rounded-lg flex flex-col justify-between">
                                    <span className="text-[9px] text-zinc-500 flex items-center gap-1.5 uppercase">
                                      <Thermometer aria-hidden="true" className="h-3.5 w-3.5 text-orange-400" />
                                      Temperatura
                                    </span>
                                    <span className="text-base font-bold text-white block mt-1.5">{tempVal}</span>
                                  </div>
                                )}
                                {humidityVal && (
                                  <div className="bg-zinc-900 border border-zinc-800/50 p-4 rounded-lg flex flex-col justify-between">
                                    <span className="text-[9px] text-zinc-500 flex items-center gap-1.5 uppercase">
                                      <Droplets aria-hidden="true" className="h-3.5 w-3.5 text-cyan-400" />
                                      Umidità
                                    </span>
                                    <span className="text-base font-bold text-white block mt-1.5">{humidityVal}</span>
                                  </div>
                                )}
                                {windVal && (
                                  <div className="bg-zinc-900 border border-zinc-800/50 p-4 rounded-lg col-span-2 flex flex-col justify-between">
                                    <span className="text-[9px] text-zinc-500 flex items-center gap-1.5 uppercase">
                                      <Wind aria-hidden="true" className="h-3.5 w-3.5 text-teal-400" />
                                      Vento
                                    </span>
                                    <span className="text-base font-bold text-white block mt-1.5">{windVal}</span>
                                  </div>
                                )}
                              </div>
                            </section>
                          )}

                          {(() => {
                            const isDefaultNote = !cleanNotes || 
                              cleanNotes.trim() === '' || 
                              /File TCX caricato correttamente/i.test(cleanNotes) || 
                              (/Rilevati/i.test(cleanNotes) && /giri/i.test(cleanNotes));
                            
                            if (isDefaultNote) return null;

                            return (
                              <div>
                                <h5 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Note della sessione</h5>
                                <div className="bg-zinc-900 border border-zinc-800/50 rounded-lg p-4 text-xs text-zinc-300 leading-relaxed font-sans">
                                  <p className="italic">{cleanNotes}</p>
                                </div>
                              </div>
                            );
                          })()}

                          <div className="grid grid-cols-2 gap-4 font-mono text-xs" role="group" aria-label="Statistiche aggiuntive">
                            <div className="bg-zinc-900 border border-zinc-800/50 p-4 rounded-lg flex flex-col justify-between">
                              <span className="text-[9px] text-zinc-500 flex items-center gap-1.5 uppercase">
                                <Flame aria-hidden="true" className="h-3.5 w-3.5 text-orange-400" />
                                Calorie
                              </span>
                              <span className="text-base font-bold text-white block mt-1.5">{act.calories} <span className="text-xs font-normal text-zinc-500">kcal</span></span>
                            </div>
                            <div className="bg-zinc-900 border border-zinc-800/50 p-4 rounded-lg flex flex-col justify-between">
                              <span className="text-[9px] text-zinc-500 flex items-center gap-1.5 uppercase">
                                <Activity aria-hidden="true" className="h-3.5 w-3.5 text-cyan-400" />
                                Cadenza
                              </span>
                              <span className="text-base font-bold text-white block mt-1.5">{act.avgCadence || '--'} <span className="text-xs font-normal text-zinc-500">ppm</span></span>
                            </div>
                          </div>
                        </div>

                        {/* Splits Table Block */}
                        <div className="lg:col-span-2 space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                              <Layers className="h-3.5 w-3.5 text-lime-400" />
                              Intervalli di Giro (Lap)
                            </h5>
                          </div>

                          <div className="overflow-hidden border border-zinc-800/80 bg-zinc-900/30 rounded-lg">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-zinc-800 text-[10px] text-zinc-500 uppercase font-medium bg-zinc-900/60">
                                  <th className="py-2 px-3 text-center w-12">Giro</th>
                                  <th className="py-2 px-3">Distanza</th>
                                  <th className="py-2 px-3">Tempo</th>
                                  <th className="py-2 px-3">Passo</th>
                                  <th className="py-2 px-3">Battiti Medi</th>
                                  <th className="py-2 px-3">Cadenza</th>
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
                                    <tr key={lap.lapIndex} className="border-b border-zinc-800/40 hover:bg-zinc-900/40 last:border-0 transition-colors">
                                      <td className="py-2 px-3 text-center font-bold text-zinc-500 bg-zinc-900/20">{lap.lapIndex}</td>
                                      <td className="py-2 px-3 font-semibold text-white">{lap.distanceKm.toFixed(2)} km</td>
                                      <td className="py-2 px-3 text-zinc-400">{formatDuration(lap.durationSec)}</td>
                                      <td className="py-2 px-3 text-cyan-400 font-semibold">{lapPaceStr}/km</td>
                                      <td className="py-2 px-3 text-rose-400 font-semibold">{lap.avgHeartRate ? `${lap.avgHeartRate} bpm` : '--'}</td>
                                      <td className="py-2 px-3 text-zinc-400">{lap.avgCadence ? `${lap.avgCadence} ppm` : '--'}</td>
                                    </tr>
                                  );
                                })}

                                {(!act.laps || act.laps.length === 0) && (
                                  <tr>
                                    <td colSpan={6} className="py-8 text-center text-zinc-500 italic">
                                      Nessun dettaglio giro registrato nel file TCX.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      {/* Metriche GPS e Grafici */}
                      {act.trackpoints && act.trackpoints.length > 0 && (
                        <div className="border-t border-zinc-800/60 p-5 bg-zinc-950/20">
                          <h5 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                            <Activity className="h-3.5 w-3.5 text-lime-400" />
                            Metriche GPS e Grafici di Sessione
                          </h5>
                          <ActivityCharts
                            trackpoints={act.trackpoints}
                            distanceKm={act.distanceKm}
                          />
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
