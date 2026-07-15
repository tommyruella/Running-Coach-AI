/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UploadCloud, FolderOpen, ChevronRight, Activity, Calendar, FileText } from 'lucide-react';
import { Activity as ActivityType } from '../types.js';
import ActivityCharts from './ActivityCharts.tsx';

interface HistoryProps {
  activities: ActivityType[];
  onUploadTcx: (files: File[]) => Promise<void>;
  isUploading: boolean;
  uploadError: string | null;
  uploadSuccess: string | null;
  onActivitySelect: (id: string) => void;
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

export default function History({ activities, onUploadTcx, isUploading, uploadError, uploadSuccess, onActivitySelect }: HistoryProps) {
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
    onActivitySelect(actId);
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

  const latestActivity = activities[0];
  const pastActivities = activities.slice(1, 6);

  return (
    <div className="space-y-10" id="history-tab">
      
      {/* Page Header */}
      <div className="border-b border-zinc-800 pb-5">
        <h1 className="text-5xl sm:text-6xl font-black tracking-tighter text-white lowercase">history</h1>
      </div>

      {/* Hero Section: Latest Activity */}
      {latestActivity ? (
        <div className="space-y-4">
          <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-sans flex items-center gap-1.5 mb-2">
            <Activity className="h-4 w-4 text-lime-400" /> Ultimo Allenamento
          </h2>
          <div onClick={() => onActivitySelect(latestActivity.id)} className="cursor-pointer group">
            <div className="glass-panel rounded-[24px] p-6 hover:border-lime-400/50 transition-colors relative overflow-hidden shadow-neon-glow bg-zinc-950/80">
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-1 flex flex-col justify-center space-y-6">
                  <div className="flex items-end gap-2">
                    <span className="text-7xl md:text-8xl font-display font-bold text-lime-400 leading-none tracking-tighter">{latestActivity.distanceKm.toFixed(1)}</span>
                    <span className="text-2xl md:text-3xl font-bold uppercase text-zinc-500 mb-2">km</span>
                  </div>
                  <div>
                    <h3 className="text-2xl md:text-3xl font-display font-bold text-white uppercase tracking-wide">{latestActivity.name}</h3>
                    <p className="text-sm text-zinc-400 font-medium mt-1">{new Date(latestActivity.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-6 pt-6 border-t border-white/5">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-sans mb-1 block">Passo Medio</span>
                      <span className="text-3xl font-display font-bold text-white leading-none">{latestActivity.avgPace}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-sans mb-1 block">Durata</span>
                      <span className="text-3xl font-display font-bold text-white leading-none">{latestActivity.durationMin}m</span>
                    </div>
                  </div>
                </div>
                
                {latestActivity.trackpoints && latestActivity.trackpoints.length > 0 && (
                  <div className="flex-1 min-h-[250px] md:min-h-[350px] rounded-[16px] overflow-hidden border border-white/10 group-hover:border-lime-400/30 transition-colors pointer-events-none bg-black/20">
                    <ActivityCharts trackpoints={latestActivity.trackpoints} distanceKm={latestActivity.distanceKm} />
                  </div>
                )}
              </div>
              
              <div className="absolute top-6 right-6 h-10 w-10 flex items-center justify-center bg-white/5 group-hover:bg-lime-400 text-zinc-400 group-hover:text-black rounded-full transition-all">
                <ChevronRight className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-zinc-500 italic bg-zinc-950/50 rounded-[24px] border border-white/5">
          <Calendar className="h-8 w-8 mx-auto mb-3 opacity-20" />
          Nessun allenamento registrato. Carica un file TCX per iniziare.
        </div>
      )}

      {/* Recent Activities List */}
      {pastActivities.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-sans flex items-center justify-between">
            <span className="flex items-center gap-1.5"><FileText className="h-4 w-4" /> Sessioni Precedenti</span>
            <span className="text-zinc-600">({activities.length - 1} totali)</span>
          </h3>
          <div className="space-y-3">
            {pastActivities.map(act => (
              <div 
                key={act.id} 
                onClick={() => onActivitySelect(act.id)}
                className="glass-panel p-5 rounded-[20px] flex items-center justify-between gap-4 cursor-pointer hover:border-white/20 hover:bg-zinc-900/80 transition-all group"
              >
                <div className="flex items-center gap-6">
                  <div className="flex items-end gap-1 w-20 shrink-0">
                    <span className="text-3xl sm:text-4xl font-display font-bold text-white group-hover:text-lime-400 transition-colors tracking-tighter">{act.distanceKm.toFixed(1)}</span>
                    <span className="text-[10px] font-bold uppercase text-zinc-500 mb-1">km</span>
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-base font-bold text-white font-display uppercase tracking-wide truncate max-w-[150px] sm:max-w-xs">{act.name}</h4>
                    <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">{new Date(act.date).toLocaleDateString('it-IT')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  <div className="hidden sm:block text-right">
                    <span className="text-[9px] block text-zinc-600 uppercase font-sans tracking-widest">Passo</span>
                    <span className="font-bold text-zinc-300 font-mono text-sm mt-0.5 block">{act.avgPace}</span>
                  </div>
                  <div className="h-8 w-8 flex items-center justify-center rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
                    <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:text-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {activities.length > 6 && (
            <div className="text-center pt-2">
              <button className="text-[10px] text-lime-400 font-bold uppercase tracking-widest hover:text-lime-300 transition-colors bg-lime-400/10 px-4 py-2 rounded-full cursor-pointer">
                Vedi tutte le attività
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bottom Section: Upload & Calendar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-zinc-800/50">
        
        {/* Upload Area */}
        <div 
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={handleCardClick}
          className={`glass-panel border border-dashed rounded-[24px] p-8 text-center transition-all relative overflow-hidden flex flex-col items-center justify-center cursor-pointer ${
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
            <div className="mx-auto h-12 w-12 rounded-[12px] bg-zinc-950 border border-zinc-800 text-lime-400 flex items-center justify-center">
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
              <p className="text-xs font-semibold text-white uppercase tracking-wide">
                {isUploading ? 'Analisi e caricamento dei file...' : 'Trascina qui i file .tcx o una cartella intera'}
              </p>
              <p className="text-[11px] text-zinc-500 max-w-sm mx-auto leading-relaxed">
                Sincronizza più corse contemporaneamente o seleziona una cartella locale per importare tutto in un colpo solo.
              </p>
              
              {!isUploading && (
                <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                  <button
                    type="button"
                    onClick={triggerFileInput}
                    className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-300 transition-all cursor-pointer shadow-sm"
                  >
                    <UploadCloud className="h-3.5 w-3.5 text-lime-400" />
                    Seleziona File
                  </button>
                  <button
                    type="button"
                    onClick={triggerFolderInput}
                    className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-300 transition-all cursor-pointer shadow-sm"
                  >
                    <FolderOpen className="h-3.5 w-3.5 text-lime-400" />
                    Carica Cartella
                  </button>
                </div>
              )}
            </div>
          </div>

          <AnimatePresence>
            {uploadError && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-4 left-4 right-4 bg-rose-950/80 backdrop-blur border border-rose-900/60 rounded-[8px] px-3 py-2 text-[10px] text-rose-400 text-center font-mono"
              >
                Errore: {uploadError}
              </motion.div>
            )}

            {uploadSuccess && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-4 left-4 right-4 bg-zinc-950/80 backdrop-blur border border-lime-500/30 rounded-[8px] px-3 py-2 text-[10px] text-lime-400 text-center font-mono"
              >
                File caricato correttamente!
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Calendar Widget */}
        <div className="glass-panel p-6 rounded-[24px] flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-sans flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-zinc-400" /> Naviga Allenamenti
            </h4>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleMonthChange('prev')}
                className="h-7 w-7 flex items-center justify-center hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white cursor-pointer"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
              </button>
              <span className="text-xs font-mono font-bold text-white uppercase whitespace-nowrap min-w-[100px] text-center">
                {currentDate.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })}
              </span>
              <button 
                onClick={() => handleMonthChange('next')}
                className="h-7 w-7 flex items-center justify-center hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="bg-zinc-950/50 border border-white/5 p-4 rounded-[16px] flex-1">
            <div className="grid grid-cols-7 gap-1 text-center mb-3">
              {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
                <div key={i} className="text-[9px] font-bold text-zinc-600 uppercase">{d}</div>
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
                      className="w-full h-full rounded-[8px] bg-lime-400 text-black font-bold shadow-sm shadow-lime-400/20 hover:scale-110 transition-all cursor-pointer flex items-center justify-center text-[10px] font-mono hover:bg-lime-300"
                      title={dayObj.activity.name}
                    >
                      {dayObj.day}
                    </button>
                  ) : (
                    <div 
                      className={`w-full h-full rounded-[8px] flex items-center justify-center text-[10px] font-mono text-zinc-500 transition-colors ${
                        dayObj.isToday 
                          ? 'bg-zinc-800 text-white border border-zinc-700 font-bold' 
                          : 'bg-zinc-900/30 hover:bg-zinc-800/50'
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
    </div>
  );
}
