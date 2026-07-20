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
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());

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

          {/* Master/Detail Layout */}
          <div className="p-5 sm:p-6 bg-[var(--window-bg)]">
            
            {/* Top Mini Calendar Picker */}
            <div className="flex justify-between items-center bg-[var(--surface-popover)] p-2 rounded-2xl border border-subtle mb-6 max-w-sm mx-auto shadow-sm">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const isSelected = selectedDay === d;
                const workout = plan.workouts.find(w => w.dayOfWeek === d);
                const hasRealWorkout = workout && workout.type !== 'Riposo';
                const isCompleted = workout?.completedManually || workout?.linkedActivityId;

                return (
                  <button 
                    key={d} 
                    onClick={() => setSelectedDay(d)}
                    className={`relative flex flex-col items-center justify-center w-10 h-11 rounded-xl transition-all ${isSelected ? 'bg-primary text-inverted shadow-md scale-105' : 'text-secondary hover:bg-[var(--surface-inset)] hover:text-primary'}`}
                  >
                    <span className="text-[11px] font-bold">{dayInitials[d]}</span>
                    {hasRealWorkout && (
                      <span className={`absolute bottom-1.5 w-1 h-1 rounded-full ${isCompleted ? 'bg-accent-lime' : isSelected ? 'bg-inverted opacity-70' : 'bg-accent-cyan'}`} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Detail Focus Area */}
            {(() => {
              const workout = plan.workouts.find(w => w.dayOfWeek === selectedDay);
              const isToday = new Date().getDay() === selectedDay;
              const isCompleted = workout?.completedManually || workout?.linkedActivityId;
              const isRest = !workout || workout.type === 'Riposo';

              return (
                <div className={`relative max-w-lg mx-auto p-6 sm:p-8 rounded-[2rem] border ${isToday ? 'border-accent-cyan bg-[var(--surface-popover)] shadow-lg' : 'border-subtle bg-[var(--surface-popover)] shadow-md'}`}>
                  {isToday && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent-cyan text-black text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
                      Oggi
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center mb-6">
                    <h4 className="text-sm font-bold text-muted uppercase tracking-widest">{fullDayNames[selectedDay]}</h4>
                    {isCompleted && <div className="flex items-center gap-1.5 bg-accent-lime/10 text-accent-lime px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider"><CheckCircle2 className="h-3.5 w-3.5" /> Completato</div>}
                  </div>

                  {isRest ? (
                    <div className="py-10 flex flex-col items-center text-center opacity-50">
                      <span className="text-2xl font-bold text-secondary mb-2">Riposo</span>
                      <p className="text-xs font-medium text-muted">Nessun allenamento programmato per oggi.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <h2 className="text-3xl sm:text-4xl font-black text-primary leading-tight mb-4 tracking-tight">{workout.type}</h2>
                      
                      <div className="flex flex-wrap gap-3 mb-6">
                        {workout.targetDistanceKm && (
                          <div className="bg-[var(--surface-inset)] px-4 py-2.5 rounded-xl border border-subtle">
                            <span className="block text-[9px] text-muted uppercase tracking-widest font-bold mb-0.5">Distanza</span>
                            <span className="text-xl font-bold text-primary font-mono">{workout.targetDistanceKm} <span className="text-xs text-secondary font-sans font-medium">km</span></span>
                          </div>
                        )}
                        {workout.targetHrZone && (
                          <div className="bg-accent-rose/5 px-4 py-2.5 rounded-xl border border-accent-rose/20">
                            <span className="block text-[9px] text-accent-rose/70 uppercase tracking-widest font-bold mb-0.5">Zona Target</span>
                            <span className="text-xl font-bold text-accent-rose font-mono">{workout.targetHrZone}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="bg-[var(--surface-inset)] p-4 rounded-xl border border-subtle mb-6">
                        <p className="text-sm text-secondary font-medium leading-relaxed">{workout.description}</p>
                      </div>
                      
                      {!isCompleted && (
                        <button 
                          onClick={() => handleMarkCompleted(workout.id)}
                          className="w-full py-3.5 bg-primary hover:scale-[1.02] active:scale-[0.98] text-inverted text-sm font-bold rounded-xl transition-all shadow-md uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Segna come Fatto
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

          </div>
        </div>
      ) : null}
    </div>
  );
}
