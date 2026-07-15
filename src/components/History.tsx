/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UploadCloud, FolderOpen, ChevronRight, ChevronLeft, Calendar, FileText, Activity } from 'lucide-react';
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

  // Slider state for activity list
  const [sliderIndex, setSliderIndex] = useState(0);
  const ITEMS_PER_SLIDE = 3;

  const latestActivity = activities[0];
  const pastActivities = activities.slice(1);
  const totalSlides = Math.ceil(pastActivities.length / ITEMS_PER_SLIDE);
  const visibleActivities = pastActivities.slice(sliderIndex * ITEMS_PER_SLIDE, sliderIndex * ITEMS_PER_SLIDE + ITEMS_PER_SLIDE);

  // Calendar grid
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

  // Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
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
          if (entry) promises.push(traverseFileTree(entry, files));
        }
      }
      await Promise.all(promises);
    } else if (e.dataTransfer.files) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        if (file.name.toLowerCase().endsWith('.tcx')) files.push(file);
      }
    }
    if (files.length > 0) await onUploadTcx(files);
    else alert('Nessun file .tcx valido trovato nella selezione trascinata.');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      const files: File[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        if (file.name.toLowerCase().endsWith('.tcx')) files.push(file);
      }
      if (files.length > 0) await onUploadTcx(files);
      else alert('Seleziona almeno un file .tcx di Garmin o Strava.');
    }
  };

  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      const files: File[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        if (file.name.toLowerCase().endsWith('.tcx')) files.push(file);
      }
      if (files.length > 0) await onUploadTcx(files);
      else alert('Nessun file .tcx trovato nella cartella selezionata.');
    }
  };

  return (
    <div className="space-y-12 pb-8" id="history-tab">

      {/* Page Header */}
      <div className="border-b border-zinc-800/60 pb-5">
        <h1 className="text-5xl sm:text-6xl font-black tracking-tighter text-white lowercase">history</h1>
      </div>

      {/* ────────────────────────────────────────────────────── */}
      {/* HERO: Last Activity — map bleeds to the edge, data below */}
      {/* ────────────────────────────────────────────────────── */}
      {latestActivity ? (
        <section className="space-y-0">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-lime-400" />
              Ultima Sessione
            </span>
            <button
              onClick={() => onActivitySelect(latestActivity.id)}
              className="text-[10px] font-bold text-lime-400 uppercase tracking-widest hover:text-lime-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              Dettagli <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Map — full-width, no card around it */}
          {latestActivity.trackpoints && latestActivity.trackpoints.length > 0 && (
            <div
              className="w-full rounded-[24px] overflow-hidden cursor-pointer group"
              style={{ height: 340 }}
              onClick={() => onActivitySelect(latestActivity.id)}
            >
              <ActivityCharts
                trackpoints={latestActivity.trackpoints}
                distanceKm={latestActivity.distanceKm}
                mapHeight={340}
                compact={true}
              />
            </div>
          )}

          {/* Stats strip below the map */}
          <div
            className="glass-panel rounded-b-[24px] -mt-3 pt-6 pb-5 px-6 grid grid-cols-4 gap-4 cursor-pointer hover:bg-white/5 transition-colors"
            style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
            onClick={() => onActivitySelect(latestActivity.id)}
          >
            <div>
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-sans block mb-1">Distanza</span>
              <div className="flex items-end gap-0.5">
                <span className="text-3xl font-display font-bold text-lime-400 leading-none tracking-tighter">{latestActivity.distanceKm.toFixed(1)}</span>
                <span className="text-xs font-bold uppercase text-zinc-500 mb-0.5">km</span>
              </div>
            </div>
            <div>
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-sans block mb-1">Passo</span>
              <span className="text-2xl font-display font-bold text-white leading-none">{latestActivity.avgPace}</span>
            </div>
            <div>
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-sans block mb-1">Durata</span>
              <span className="text-2xl font-display font-bold text-white leading-none">{latestActivity.durationMin}m</span>
            </div>
            <div>
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-sans block mb-1">BPM</span>
              <span className="text-2xl font-display font-bold text-rose-400 leading-none">{latestActivity.avgHeartRate || '--'}</span>
            </div>
          </div>
        </section>
      ) : (
        <div className="text-center py-16 text-zinc-500 italic border border-white/5 rounded-[24px]">
          <Calendar className="h-8 w-8 mx-auto mb-3 opacity-20" />
          Nessun allenamento registrato. Carica un file TCX per iniziare.
        </div>
      )}

      {/* ────────────────────────────────────────────────────── */}
      {/* SLIDER: Previous activities */}
      {/* ────────────────────────────────────────────────────── */}
      {pastActivities.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              Sessioni Precedenti
              <span className="text-zinc-700 ml-1">({activities.length - 1})</span>
            </span>
            {totalSlides > 1 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSliderIndex(i => Math.max(0, i - 1))}
                  disabled={sliderIndex === 0}
                  className="h-7 w-7 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-[10px] font-mono text-zinc-500">
                  {sliderIndex + 1} / {totalSlides}
                </span>
                <button
                  onClick={() => setSliderIndex(i => Math.min(totalSlides - 1, i + 1))}
                  disabled={sliderIndex >= totalSlides - 1}
                  className="h-7 w-7 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Slide dots */}
          {totalSlides > 1 && (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalSlides }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSliderIndex(i)}
                  className={`h-1 rounded-full transition-all cursor-pointer ${
                    i === sliderIndex ? 'w-6 bg-lime-400' : 'w-1.5 bg-zinc-700 hover:bg-zinc-500'
                  }`}
                />
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={sliderIndex}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              {visibleActivities.map(act => (
                <div
                  key={act.id}
                  onClick={() => onActivitySelect(act.id)}
                  className="flex items-center justify-between gap-4 px-5 py-4 rounded-[18px] border border-white/5 bg-zinc-950/60 hover:border-white/15 hover:bg-zinc-900/70 cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-5 min-w-0">
                    <div className="flex items-end gap-0.5 shrink-0 w-[70px]">
                      <span className="text-3xl font-display font-bold text-white group-hover:text-lime-400 transition-colors tracking-tighter">{act.distanceKm.toFixed(1)}</span>
                      <span className="text-[10px] font-bold uppercase text-zinc-600 mb-0.5">km</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white font-display uppercase tracking-wide truncate">{act.name}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wider">{new Date(act.date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 shrink-0">
                    <div className="hidden sm:block text-right">
                      <span className="text-[9px] block text-zinc-600 uppercase font-sans tracking-widest">Passo</span>
                      <span className="font-bold text-zinc-300 font-mono text-sm block">{act.avgPace}</span>
                    </div>
                    <div className="hidden sm:block text-right">
                      <span className="text-[9px] block text-zinc-600 uppercase font-sans tracking-widest">BPM</span>
                      <span className="font-bold text-rose-400 font-mono text-sm block">{act.avgHeartRate || '--'}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-white transition-colors" />
                  </div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </section>
      )}

      {/* ────────────────────────────────────────────────────── */}
      {/* BOTTOM: Upload + Calendar */}
      {/* ────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-zinc-800/40">

        {/* Upload */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`relative rounded-[24px] border-2 border-dashed p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[220px] ${
            dragActive
              ? 'border-lime-400 bg-lime-400/5'
              : 'border-zinc-800 hover:border-zinc-700 hover:bg-white/[0.02]'
          }`}
          id="tcx-upload-zone"
        >
          <input ref={fileInputRef} type="file" accept=".tcx" multiple onChange={handleFileChange} className="hidden" />
          <input ref={folderInputRef} type="file" accept=".tcx" {...{ webkitdirectory: "" }} multiple onChange={handleFolderChange} className="hidden" />

          <div className="h-11 w-11 rounded-[12px] bg-zinc-900 border border-zinc-800 text-lime-400 flex items-center justify-center mb-4">
            {isUploading ? (
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <UploadCloud className="h-5 w-5" />
            )}
          </div>
          <p className="text-xs font-semibold text-white uppercase tracking-wide mb-1">
            {isUploading ? 'Caricamento in corso...' : 'Trascina file .tcx'}
          </p>
          <p className="text-[11px] text-zinc-500 leading-relaxed max-w-[200px]">
            Garmin, Strava o una cartella intera
          </p>
          {!isUploading && (
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-300 transition-all cursor-pointer"
              >
                <UploadCloud className="h-3.5 w-3.5 text-lime-400" />
                File
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); folderInputRef.current?.click(); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-300 transition-all cursor-pointer"
              >
                <FolderOpen className="h-3.5 w-3.5 text-lime-400" />
                Cartella
              </button>
            </div>
          )}

          <AnimatePresence>
            {uploadError && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute bottom-3 left-3 right-3 bg-rose-950/80 border border-rose-900/50 rounded-xl px-3 py-2 text-[10px] text-rose-400 text-center font-mono">
                {uploadError}
              </motion.div>
            )}
            {uploadSuccess && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute bottom-3 left-3 right-3 bg-zinc-950/80 border border-lime-500/30 rounded-xl px-3 py-2 text-[10px] text-lime-400 text-center font-mono">
                ✓ Caricato
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Calendar */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" /> Calendario
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => handleMonthChange('prev')} className="h-7 w-7 flex items-center justify-center hover:bg-zinc-800 rounded-full transition-colors text-zinc-500 hover:text-white cursor-pointer">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-mono font-bold text-white uppercase min-w-[90px] text-center">
                {currentDate.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })}
              </span>
              <button onClick={() => handleMonthChange('next')} className="h-7 w-7 flex items-center justify-center hover:bg-zinc-800 rounded-full transition-colors text-zinc-500 hover:text-white cursor-pointer">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
                <div key={i} className="text-[9px] font-bold text-zinc-600 text-center uppercase">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {calendarGrid.map((dayObj, i) => (
                <div key={i} className="aspect-square">
                  {dayObj === null ? <div className="w-full h-full opacity-0" /> :
                    dayObj.activity ? (
                      <button
                        onClick={() => onActivitySelect(dayObj.activity!.id)}
                        className="w-full h-full rounded-[8px] bg-lime-400 text-black font-bold hover:bg-lime-300 hover:scale-110 transition-all cursor-pointer flex items-center justify-center text-[10px] font-mono shadow-sm shadow-lime-400/20"
                        title={dayObj.activity.name}
                      >
                        {dayObj.day}
                      </button>
                    ) : (
                      <div className={`w-full h-full rounded-[8px] flex items-center justify-center text-[10px] font-mono ${
                        dayObj.isToday ? 'bg-zinc-800 text-white border border-zinc-700 font-bold' : 'text-zinc-600 hover:bg-zinc-800/40 transition-colors'
                      }`}>
                        {dayObj.day}
                      </div>
                    )
                  }
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
