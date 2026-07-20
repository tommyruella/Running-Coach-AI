import React, { useState, useEffect } from 'react';
import { Bot, Calendar, CheckCircle2, ChevronDown, ChevronUp, Play, Settings, Loader2 } from 'lucide-react';
import { WeeklyPlan, PlannedWorkout, CoachSettings } from '../types.js';

export default function AiCoach() {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [settings, setSettings] = useState<CoachSettings>({ availableDays: [0, 2, 4, 6] });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [notes, setNotes] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [expandedFeedback, setExpandedFeedback] = useState(false);

  const fetchPlanAndSettings = async () => {
    try {
      const [planRes, setRes] = await Promise.all([
        fetch('/api/coach/plan'),
        fetch('/api/coach/settings')
      ]);
      const p = await planRes.json();
      const s = await setRes.json();
      setPlan(p);
      setSettings(s);
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

          {/* Horizontal Timeline Layout */}
          <div className="pt-6 pb-2 bg-[var(--window-bg)]">
            <div className="overflow-x-auto pb-8 snap-x hide-scrollbar">
              <div className="flex gap-3 sm:gap-5 relative w-max px-5 sm:px-6">
                
                {/* Continuous Timeline Line */}
                <div className="absolute top-[32px] left-10 right-10 h-0.5 bg-[var(--border-subtle)] z-0 rounded-full" />
                
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const workout = plan.workouts.find(w => w.dayOfWeek === d);
                  const isToday = new Date().getDay() === d;
                  const isCompleted = workout?.completedManually || workout?.linkedActivityId;
                  const isRest = !workout || workout.type === 'Riposo';

                  // I giorni di riposo occupano meno spazio
                  const cardWidth = isRest ? 'w-[120px]' : 'w-[280px] sm:w-[320px]';

                  return (
                    <div key={d} className={`snap-start shrink-0 flex flex-col relative z-10 ${cardWidth} transition-all`}>
                      
                      {/* Node (Day indicator) */}
                      <div className="h-16 flex flex-col items-center justify-center relative mb-2">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-muted mb-1">{fullDayNames[d].substring(0, 3)}</span>
                        <div className={`w-3.5 h-3.5 rounded-full ring-4 ring-[var(--window-bg)] z-10 transition-colors ${
                          isCompleted ? 'bg-accent-lime' : 
                          isToday ? 'bg-accent-cyan shadow-[0_0_12px_rgba(34,211,238,0.8)]' : 
                          isRest ? 'bg-[var(--border-subtle)]' : 'bg-primary'
                        }`} />
                        {isToday && <span className="absolute -bottom-2 text-[9px] font-black uppercase text-accent-cyan tracking-widest">Oggi</span>}
                      </div>

                      {/* Card (Glassmorphism & Neon) */}
                      <div className={`p-5 sm:p-6 rounded-[2rem] border flex flex-col flex-1 transition-all ${
                        isToday ? 'border-accent-cyan bg-[var(--surface-popover)]/90 backdrop-blur-xl shadow-lg' : 
                        isRest ? 'border-transparent bg-transparent opacity-50 justify-center items-center' : 
                        'border-subtle bg-[var(--surface-popover)]/70 backdrop-blur-md shadow-sm'
                      }`}>
                         
                         {isRest ? (
                           <span className="text-sm font-bold text-secondary uppercase tracking-widest">Riposo</span>
                         ) : (
                           <div className="flex flex-col h-full">
                             <div className="flex justify-between items-start mb-4">
                               <h2 className="text-2xl font-black text-primary leading-tight tracking-tight">{workout.type}</h2>
                               {isCompleted && <CheckCircle2 className="h-5 w-5 text-accent-lime shrink-0" />}
                             </div>
                             
                             <div className="flex flex-wrap gap-2 mb-5">
                               {workout.targetDistanceKm && (
                                 <div className="bg-[var(--surface-inset)] px-3 py-1.5 rounded-lg border border-subtle flex items-baseline gap-1">
                                   <span className="text-xl font-bold text-accent-lime font-mono">{workout.targetDistanceKm}</span>
                                   <span className="text-[10px] uppercase font-bold text-muted tracking-wider">km</span>
                                 </div>
                               )}
                               {workout.targetHrZone && (
                                 <div className="bg-accent-rose/5 px-3 py-1.5 rounded-lg border border-accent-rose/20 flex items-baseline gap-1">
                                   <span className="text-xl font-bold text-accent-rose font-mono">{workout.targetHrZone}</span>
                                 </div>
                               )}
                             </div>
                             
                             <div className="bg-[var(--surface-inset)] p-4 rounded-xl border border-subtle mb-6 flex-1">
                               <p className="text-xs text-secondary font-medium leading-relaxed">{workout.description}</p>
                             </div>
                             
                             {/* Azioni */}
                             {!isCompleted && !workout.targetDistanceKm && (
                               <button 
                                 onClick={() => handleMarkCompleted(workout.id)}
                                 className="w-full py-3 bg-primary hover:scale-[1.02] active:scale-[0.98] text-inverted text-xs font-bold rounded-xl transition-all shadow-md uppercase tracking-widest flex items-center justify-center gap-2 mt-auto"
                               >
                                 <CheckCircle2 className="h-4 w-4" />
                                 Segna Fatto
                               </button>
                             )}
                             {!isCompleted && workout.targetDistanceKm && (
                               <div className="w-full py-2.5 bg-[var(--surface-inset)] text-center text-[9px] font-bold text-muted rounded-xl border border-subtle uppercase tracking-widest mt-auto">
                                 Upload TCX per completare
                               </div>
                             )}
                           </div>
                         )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
