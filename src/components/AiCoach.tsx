import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Calendar, CheckCircle2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Play, Settings, Loader2, Lightbulb } from 'lucide-react';
import { WeeklyPlan, PlannedWorkout, CoachSettings, Activity } from '../types.js';

export default function AiCoach() {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [settings, setSettings] = useState<CoachSettings>({ availableDays: [0, 2, 4, 6] });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [notes, setNotes] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [expandedFeedback, setExpandedFeedback] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [linkModalWorkout, setLinkModalWorkout] = useState<PlannedWorkout | null>(null);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -260, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 260, behavior: 'smooth' });
    }
  };

  const fetchPlanAndSettings = async () => {
    try {
      const [planRes, setRes, actRes] = await Promise.all([
        fetch('/api/coach/plan'),
        fetch('/api/coach/settings'),
        fetch('/api/activities')
      ]);
      const p = await planRes.json();
      const s = await setRes.json();
      const a = await actRes.json();
      setPlan(p);
      setSettings(s);
      setActivities(a.activities || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlanAndSettings();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/coach/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      });
      const newPlan = await res.json();
      setPlan(newPlan);
      setNotes('');
    } catch (e) {
      console.error(e);
      alert('Errore durante la generazione del piano.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveSettings = async (days: number[]) => {
    try {
      await fetch('/api/coach/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availableDays: days })
      });
      setSettings({ availableDays: days });
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkCompleted = async (workoutId: string) => {
    try {
      await fetch('/api/coach/link-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plannedWorkoutId: workoutId, completedManually: true })
      });
      // Aggiorna UI localmente
      if (plan) {
        setPlan({
          ...plan,
          workouts: plan.workouts.map(w => 
            w.id === workoutId ? { ...w, completedManually: true } : w
          )
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLinkTcx = async (workoutId: string, activityId: string) => {
    try {
      await fetch('/api/coach/link-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plannedWorkoutId: workoutId, activityId })
      });
      if (plan) {
        setPlan({
          ...plan,
          workouts: plan.workouts.map(w => 
            w.id === workoutId ? { ...w, linkedActivityId: activityId } : w
          )
        });
      }
      setActivities(prev => prev.map(a => a.id === activityId ? { ...a, plannedWorkoutId: workoutId } : a));
      setLinkModalWorkout(null);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin text-muted h-6 w-6" /></div>;
  }

  const isNewWeek = !plan || (() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff)).toISOString().split('T')[0];
    return plan.weekStartDate !== monday;
  })();

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  const dayInitials = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];
  const fullDayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

  return (
    <div className="clean-panel flex flex-col overflow-hidden relative">
      <div className="p-5 sm:p-6 border-b border-subtle flex justify-between items-start bg-[var(--surface-inset)]">
        <div>
          <h2 className="text-xl font-black text-primary tracking-tight flex items-center gap-2">
            <Bot className="h-6 w-6 text-accent-cyan" />
            AI Coach <span className="text-xs font-bold text-accent-cyan uppercase tracking-widest ml-2 bg-accent-cyan/10 px-2 py-0.5 rounded-full">Mezza Ottobre</span>
          </h2>
          <p className="text-xs text-secondary mt-1 font-medium">Piano strutturato per il passo 4:50 - 5:10/km</p>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-[var(--surface-hover)] rounded-full transition-colors">
          <Settings className="h-5 w-5 text-muted" />
        </button>
      </div>

      {showSettings && (
        <div className="p-5 bg-[var(--surface-popover)] border-b border-subtle">
          <h3 className="text-sm font-bold text-primary mb-3">Giorni di Allenamento</h3>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 0].map(d => {
              const isActive = settings.availableDays.includes(d);
              return (
                <button 
                  key={d}
                  onClick={() => {
                    const newDays = isActive 
                      ? settings.availableDays.filter(day => day !== d)
                      : [...settings.availableDays, d];
                    handleSaveSettings(newDays);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    isActive ? 'bg-primary text-inverted' : 'bg-[var(--surface-inset)] text-muted hover:text-primary'
                  }`}
                >
                  {fullDayNames[d]}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted mt-3">L'IA posizionerà le corse solo nei giorni selezionati.</p>
        </div>
      )}

      {isNewWeek ? (
        <div className="p-6 sm:p-8 flex flex-col items-center justify-center text-center">
          <Calendar className="h-12 w-12 text-muted mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-primary mb-2">Nuova Settimana</h3>
          <p className="text-sm text-secondary max-w-md mx-auto mb-6">È il momento di pianificare i prossimi allenamenti. Il coach analizzerà i dati dei tuoi ultimi 30 giorni e adatterà il carico di lavoro.</p>
          
          <textarea 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Note per il coach? (es. 'Giovedì ho un viaggio', 'Ho le gambe pesanti')"
            className="w-full max-w-md bg-[var(--surface-inset)] border border-subtle rounded-xl p-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent-cyan mb-4 resize-none h-20 transition-colors"
          />
          
          <button 
            onClick={handleGenerate}
            disabled={generating}
            className="bg-primary text-inverted px-6 py-3 rounded-full text-sm font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center gap-2 shadow-lg mx-auto"
          >
            {generating ? (
              <><Loader2 className="animate-spin h-4 w-4" /> Generazione in corso...</>
            ) : (
              <><Play className="h-4 w-4" /> Genera Piano</>
            )}
          </button>
        </div>
      ) : plan ? (
        <div className="flex flex-col">
          {/* Analysis Feedback */}
          <div className="p-5 sm:p-6 border-b border-subtle">
            <h3 className="text-lg font-black text-primary mb-1">Tema: {plan.theme}</h3>
            <div 
              className="mt-3 bg-[var(--window-bg)] p-4 rounded-xl border border-subtle relative cursor-pointer group"
              onClick={() => setExpandedFeedback(!expandedFeedback)}
            >
              <h4 className="text-[10px] uppercase font-bold tracking-widest text-muted mb-2">Analisi del Coach</h4>
              <p className={`text-sm text-secondary font-medium leading-relaxed ${expandedFeedback ? '' : 'line-clamp-2'}`}>
                {plan.analysisFeedback}
              </p>
              <div className="absolute top-4 right-4 text-muted group-hover:text-primary transition-colors">
                {expandedFeedback ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </div>

          {/* Horizontal Cards Layout */}
          <div className="pt-4 pb-2 bg-[var(--window-bg)] relative group">
            {/* Mobile Carousel Controls */}
            <button 
              onClick={scrollLeft}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-[var(--surface-popover)] border border-subtle shadow-md rounded-full text-secondary hover:text-primary sm:hidden"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button 
              onClick={scrollRight}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-[var(--surface-popover)] border border-subtle shadow-md rounded-full text-secondary hover:text-primary sm:hidden"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div 
              ref={scrollContainerRef}
              className="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory hide-scrollbar px-5 sm:px-6"
            >
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const workout = plan.workouts.find(w => w.dayOfWeek === d);
                const isToday = new Date().getDay() === d;
                const isCompleted = workout?.completedManually || workout?.linkedActivityId;
                const isRest = !workout || workout.type === 'Riposo';

                const cardClasses = isRest 
                  ? "w-[110px] bg-[var(--surface-popover)] border-subtle opacity-60 items-center justify-center py-6" 
                  : `w-[260px] ${isToday ? 'border-accent-cyan shadow-sm bg-[var(--surface-popover)]' : 'border-subtle bg-[var(--surface-popover)]'}`;

                return (
                  <div key={d} className={`snap-start shrink-0 flex flex-col p-5 rounded-2xl border transition-colors ${cardClasses}`}>
                    
                    {!isRest && (
                      <div className="flex justify-between items-center w-full mb-4">
                         <span className={`text-[10px] uppercase font-bold tracking-widest ${isToday ? 'text-accent-cyan' : 'text-muted'}`}>
                           {fullDayNames[d].substring(0, 3)} {isToday && '• Oggi'}
                         </span>
                         {isCompleted && <CheckCircle2 className="h-4 w-4 text-accent-lime" />}
                      </div>
                    )}

                    {isRest ? (
                      <>
                        <span className={`text-[10px] uppercase font-bold tracking-widest ${isToday ? 'text-accent-cyan' : 'text-muted'} mb-2`}>
                          {fullDayNames[d].substring(0, 3)} {isToday && '• Oggi'}
                        </span>
                        <span className="text-xs font-bold text-secondary uppercase tracking-widest">Riposo</span>
                      </>
                    ) : (
                      <div className="flex flex-col flex-1">
                        <h3 className="text-lg font-bold text-primary leading-tight mb-3">{workout.type}</h3>
                        
                        <div className="flex gap-2 mb-4">
                          {workout.targetDistanceKm && (
                            <div className="bg-[var(--surface-inset)] px-2.5 py-1 rounded-md border border-subtle">
                              <span className="text-sm font-bold text-primary font-mono">{workout.targetDistanceKm}</span>
                              <span className="text-[9px] uppercase font-bold text-muted ml-1">km</span>
                            </div>
                          )}
                          {workout.targetHrZone && (
                            <div className="bg-accent-rose/10 border border-accent-rose/20 px-2.5 py-1 rounded-md text-accent-rose">
                              <span className="text-sm font-bold font-mono">{workout.targetHrZone}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 mb-6 flex flex-col mt-2">
                          {workout.description.split('|').map((block, i, arr) => {
                            const isLast = i === arr.length - 1;
                            const text = block.trim();
                            if (!text) return null;
                            
                            return (
                              <div key={i} className="relative flex items-stretch gap-3 group">
                                {/* Linea verticale di connessione (se non è l'ultimo elemento) */}
                                {!isLast && <div className="absolute left-[7px] top-4 bottom-[-4px] w-[2px] bg-[var(--border-subtle)] group-hover:bg-accent-cyan/30 transition-colors" />}
                                
                                {/* Nodo circolare */}
                                <div className="flex-none mt-1.5 z-10">
                                  <div className="w-4 h-4 rounded-full border-2 border-[var(--border-subtle)] bg-[var(--surface-popover)] group-hover:border-accent-cyan flex items-center justify-center transition-colors">
                                    <div className="w-1.5 h-1.5 bg-[var(--border-subtle)] group-hover:bg-accent-cyan rounded-full transition-colors" />
                                  </div>
                                </div>
                                
                                {/* Testo del blocco */}
                                <div className="flex-1 pb-3">
                                  <div className="bg-[var(--surface-inset)] px-3 py-2.5 rounded-xl border border-subtle group-hover:border-accent-cyan/40 shadow-sm transition-all">
                                    <span className="text-[11px] font-medium text-primary leading-relaxed block">{text}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {!isCompleted && !workout.targetDistanceKm && (
                          <button 
                            onClick={() => handleMarkCompleted(workout.id)}
                            className="w-full py-2.5 bg-[var(--surface-inset)] hover:bg-[var(--surface-hover)] text-[11px] uppercase font-bold tracking-widest text-primary rounded-lg transition-colors border border-subtle mt-auto"
                          >
                            Segna Fatto
                          </button>
                        )}
                        {!isCompleted && workout.targetDistanceKm && (
                          <button 
                            onClick={() => setLinkModalWorkout(workout)}
                            className="w-full py-2.5 bg-transparent hover:bg-[var(--surface-hover)] text-[10px] font-bold text-muted hover:text-primary rounded-lg border border-dashed border-subtle transition-colors uppercase tracking-widest mt-auto"
                          >
                            Seleziona TCX
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* AI Tips Section */}
          {plan.tips && plan.tips.length > 0 && (
            <div className="p-5 sm:p-6 bg-[var(--surface-inset)] border-t border-subtle">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="h-5 w-5 text-accent-cyan" />
                <h3 className="text-sm font-black text-primary tracking-wide uppercase">Consigli del Coach</h3>
              </div>
              <ul className="space-y-3">
                {plan.tips.map((tip, idx) => (
                  <li key={idx} className="flex gap-3 text-sm text-secondary">
                    <span className="text-accent-cyan opacity-50 font-black flex-shrink-0">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
      {/* Modal Associazione TCX tramite Portal per bypassare i stacking context di Framer Motion */}
      {linkModalWorkout && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-[var(--window-bg)] rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[var(--border-subtle)] relative">
            <button 
              onClick={() => setLinkModalWorkout(null)}
              className="absolute top-4 right-4 p-2 text-muted hover:text-primary transition-colors bg-[var(--surface-inset)] rounded-full"
            >
              <CheckCircle2 className="h-5 w-5 opacity-0" /> {/* Per occupare spazio */}
              <span className="absolute inset-0 flex items-center justify-center text-xl leading-none">&times;</span>
            </button>
            
            <h3 className="text-xl font-black text-primary mb-2">Associa Allenamento</h3>
            <p className="text-sm text-secondary mb-6">
              Seleziona un'attività TCX caricata da associare a: <strong>{linkModalWorkout.type}</strong>
            </p>
            
            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2">
              {activities.filter(a => !a.plannedWorkoutId).length === 0 ? (
                <div className="text-center p-6 bg-[var(--surface-inset)] rounded-xl border border-dashed border-subtle">
                  <p className="text-sm text-secondary">Nessuna attività TCX disponibile.</p>
                  <p className="text-xs text-muted mt-2">Carica prima un file dal pannello Admin.</p>
                </div>
              ) : (
                activities.filter(a => !a.plannedWorkoutId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(act => (
                  <button
                    key={act.id}
                    onClick={() => handleLinkTcx(linkModalWorkout.id, act.id)}
                    className="flex flex-col text-left p-4 rounded-xl bg-[var(--surface-inset)] border border-subtle hover:border-accent-cyan/50 hover:shadow-md transition-all group"
                  >
                    <span className="text-sm font-bold text-primary group-hover:text-accent-cyan transition-colors">{act.name}</span>
                    <div className="flex gap-4 mt-2 text-xs font-mono text-secondary">
                      <span>{act.distanceKm} km</span>
                      <span>{act.durationMin} min</span>
                      <span>{new Date(act.date).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
