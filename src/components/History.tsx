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

const traverseFileTree = async (entry: any, fileList: File[]): Promise<void> => {
  if (entry.isFile) {
    if (entry.name.toLowerCase().endsWith('.tcx')) {
      const file = await new Promise<File>((resolve, reject) => entry.file(resolve, reject));
      fileList.push(file);
    }
  } else if (entry.isDirectory) {
    const dirReader = entry.createReader();
    const readEntries = (): Promise<any[]> => new Promise((resolve, reject) => {
      const all: any[] = [];
      const read = () => dirReader.readEntries((es: any[]) => {
        if (es.length === 0) resolve(all);
        else { all.push(...es); read(); }
      }, reject);
      read();
    });
    try {
      const entries = await readEntries();
      await Promise.all(entries.map(e => traverseFileTree(e, fileList)));
    } catch (err) { console.error(err); }
  }
};

export default function History({ activities, onUploadTcx, isUploading, uploadError, uploadSuccess, onActivitySelect }: HistoryProps) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sliderIndex, setSliderIndex] = useState(0);
  const ITEMS_PER_SLIDE = 3;

  const latestActivity = activities[0];
  const pastActivities = activities.slice(1);
  const totalSlides = Math.ceil(pastActivities.length / ITEMS_PER_SLIDE);
  const visibleActivities = pastActivities.slice(
    sliderIndex * ITEMS_PER_SLIDE,
    sliderIndex * ITEMS_PER_SLIDE + ITEMS_PER_SLIDE
  );

  const calendarGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const activeDatesMap = new Map<string, ActivityType>();
    activities.forEach(a => {
      const d = new Date(a.date);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      activeDatesMap.set(k, a);
    });
    const grid: any[] = [];
    for (let i = 0; i < startDay; i++) grid.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const k = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const now = new Date();
      grid.push({ day: i, activity: activeDatesMap.get(k), isToday: now.getFullYear() === year && now.getMonth() === month && now.getDate() === i });
    }
    return grid;
  }, [activities, currentDate]);

  const handleMonthChange = (d: 'prev' | 'next') => setCurrentDate(p => { const nd = new Date(p); nd.setMonth(nd.getMonth() + (d === 'next' ? 1 : -1)); return nd; });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    const files: File[] = [];
    if (e.dataTransfer.items) {
      const ps: Promise<void>[] = [];
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.kind === 'file') { const entry = item.webkitGetAsEntry(); if (entry) ps.push(traverseFileTree(entry, files)); }
      }
      await Promise.all(ps);
    } else {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const f = e.dataTransfer.files[i];
        if (f.name.toLowerCase().endsWith('.tcx')) files.push(f);
      }
    }
    if (files.length > 0) await onUploadTcx(files);
    else alert('Nessun file .tcx valido trovato.');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files).filter(f => f.name.toLowerCase().endsWith('.tcx'));
    if (files.length) await onUploadTcx(files);
    else alert('Seleziona file .tcx validi.');
  };

  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files).filter(f => f.name.toLowerCase().endsWith('.tcx'));
    if (files.length) await onUploadTcx(files);
    else alert('Nessun .tcx nella cartella selezionata.');
  };

  return (
    <div className="space-y-12 pb-8" id="history-tab">

      <div className="border-b border-subtle pb-5 flex items-center justify-between">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-primary">History</h1>
      </div>

      {/* Hero: Latest Activity */}
      {latestActivity ? (
        <section>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold text-secondary uppercase tracking-widest flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-accent-lime" />
              Ultima Sessione
            </span>
            <button
              onClick={() => onActivitySelect(latestActivity.id)}
              className="text-[10px] font-bold text-accent-lime uppercase tracking-widest hover:opacity-70 transition-opacity flex items-center gap-1 cursor-pointer"
            >
              Dettagli <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="clean-panel overflow-hidden transition-shadow hover:shadow-md cursor-pointer" onClick={() => onActivitySelect(latestActivity.id)}>
            {latestActivity.trackpoints && latestActivity.trackpoints.length > 0 && (
              <div className="w-full surface-inset" style={{ height: 320 }}>
                <ActivityCharts
                  trackpoints={latestActivity.trackpoints}
                  distanceKm={latestActivity.distanceKm}
                  mapHeight={320}
                  compact={true}
                />
              </div>
            )}
            <div className="px-6 pt-5 pb-5">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Distanza', value: latestActivity.distanceKm.toFixed(1), unit: 'km', cls: 'text-accent-lime text-3xl sm:text-4xl' },
                  { label: 'Passo', value: latestActivity.avgPace, unit: '/km', cls: 'text-primary text-2xl sm:text-3xl' },
                  { label: 'Durata', value: `${latestActivity.durationMin}m`, unit: '', cls: 'text-primary text-2xl sm:text-3xl' },
                  { label: 'BPM', value: latestActivity.avgHeartRate ? String(latestActivity.avgHeartRate) : '--', unit: '', cls: 'text-accent-rose text-2xl sm:text-3xl' },
                ].map(m => (
                  <div key={m.label}>
                    <span className="text-[9px] text-muted uppercase tracking-widest font-sans block mb-1">{m.label}</span>
                    <div className="flex items-end gap-0.5">
                      <span className={`font-display font-bold leading-none tracking-tighter ${m.cls}`}>{m.value}</span>
                      {m.unit && <span className="text-[10px] font-bold uppercase text-muted mb-0.5">{m.unit}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="clean-panel text-center py-16">
          <Calendar className="h-8 w-8 mx-auto mb-3 text-muted" />
          <p className="text-secondary italic text-sm">Nessun allenamento registrato. Carica un file TCX per iniziare.</p>
        </div>
      )}

      {/* Slider: Previous Activities */}
      {pastActivities.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-secondary uppercase tracking-widest flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              Sessioni Precedenti
              <span className="text-muted">({pastActivities.length})</span>
            </span>
            {totalSlides > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSliderIndex(i => Math.max(0, i - 1))}
                  disabled={sliderIndex === 0}
                  className="h-7 w-7 flex items-center justify-center rounded-lg border border-subtle text-secondary hover:text-primary disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-[10px] font-mono text-muted tabular-nums">
                  {sliderIndex + 1}/{totalSlides}
                </span>
                <button
                  onClick={() => setSliderIndex(i => Math.min(totalSlides - 1, i + 1))}
                  disabled={sliderIndex >= totalSlides - 1}
                  className="h-7 w-7 flex items-center justify-center rounded-lg border border-subtle text-secondary hover:text-primary disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={sliderIndex}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.18 }}
              className="space-y-2"
            >
              {visibleActivities.map(act => (
                <div
                  key={act.id}
                  onClick={() => onActivitySelect(act.id)}
                  className="clean-panel flex items-center justify-between gap-4 px-5 py-4 hover:shadow-sm cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-5 min-w-0">
                    <div className="flex items-end gap-0.5 shrink-0 w-[68px]">
                      <span className="text-3xl font-display font-bold text-primary group-hover:text-accent-lime transition-colors tracking-tighter">
                        {act.distanceKm.toFixed(1)}
                      </span>
                      <span className="text-[10px] font-bold uppercase text-muted mb-0.5">km</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-primary truncate">{act.name}</p>
                      <p className="text-[10px] text-secondary mt-0.5 uppercase tracking-wider">
                        {new Date(act.date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 shrink-0">
                    <div className="hidden sm:block text-right">
                      <span className="text-[9px] block text-muted uppercase font-sans tracking-widest">Passo</span>
                      <span className="font-bold text-secondary font-mono text-sm block">{act.avgPace}</span>
                    </div>
                    <div className="hidden sm:block text-right">
                      <span className="text-[9px] block text-muted uppercase font-sans tracking-widest">BPM</span>
                      <span className="font-bold text-accent-rose font-mono text-sm block">{act.avgHeartRate || '--'}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted group-hover:text-primary transition-colors" />
                  </div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </section>
      )}

      {/* Bottom: Upload + Calendar */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-subtle">
        
        {/* Upload Dropzone */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`relative rounded-2xl border-2 border-dashed p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[200px] ${
            dragActive ? 'border-accent-lime bg-surface-inset' : 'border-subtle hover:border-default'
          }`}
        >
          <input ref={fileInputRef} type="file" accept=".tcx" multiple onChange={handleFileChange} className="hidden" />
          <input ref={folderInputRef} type="file" accept=".tcx" {...{ webkitdirectory: "" }} multiple onChange={handleFolderChange} className="hidden" />

          <div className="clean-panel h-12 w-12 flex items-center justify-center mb-4 text-accent-lime shadow-sm">
            {isUploading ? (
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : <UploadCloud className="h-5 w-5" />}
          </div>

          <p className="text-sm font-bold text-primary mb-1">
            {isUploading ? 'Caricamento...' : 'Upload TCX'}
          </p>
          <p className="text-[11px] text-secondary leading-relaxed max-w-[180px]">
            Trascina qui i file o seleziona dal dispositivo
          </p>

          {!isUploading && (
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="clean-panel flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-secondary hover:text-primary transition-colors"
              >
                <UploadCloud className="h-3 w-3" /> File
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); folderInputRef.current?.click(); }}
                className="clean-panel flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-secondary hover:text-primary transition-colors"
              >
                <FolderOpen className="h-3 w-3" /> Cartella
              </button>
            </div>
          )}

          <AnimatePresence>
            {uploadError && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute bottom-3 left-3 right-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-[10px] text-red-600 dark:text-red-400 text-center font-mono">
                {uploadError}
              </motion.div>
            )}
            {uploadSuccess && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute bottom-3 left-3 right-3 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 text-[10px] text-green-700 dark:text-green-400 text-center font-mono">
                {uploadSuccess}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Calendar Widget */}
        <div className="clean-panel p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold text-secondary uppercase tracking-widest flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" /> Calendario
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => handleMonthChange('prev')} className="h-7 w-7 flex items-center justify-center rounded-lg border border-subtle text-secondary hover:text-primary transition-all">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-mono font-bold text-primary uppercase min-w-[90px] text-center">
                {currentDate.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })}
              </span>
              <button onClick={() => handleMonthChange('next')} className="h-7 w-7 flex items-center justify-center rounded-lg border border-subtle text-secondary hover:text-primary transition-all">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
                <div key={i} className="text-[9px] font-bold text-muted text-center uppercase">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {calendarGrid.map((dayObj, i) => (
                <div key={i} className="aspect-square">
                  {dayObj === null ? <div className="w-full h-full" /> :
                    dayObj.activity ? (
                      <button
                        onClick={() => onActivitySelect(dayObj.activity!.id)}
                        className="w-full h-full rounded-md bg-[#CCFF00] text-black font-extrabold shadow-[0_0_8px_rgba(204,255,0,0.4)] hover:opacity-90 transition-opacity flex items-center justify-center text-[10px] font-mono"
                        title={dayObj.activity.name}
                      >
                        {dayObj.day}
                      </button>
                    ) : (
                      <div className={`w-full h-full rounded-md flex items-center justify-center text-[10px] font-mono transition-colors ${
                        dayObj.isToday ? 'bg-primary text-white dark:bg-white dark:text-black font-bold' : 'text-muted hover:bg-surface-inset'
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
