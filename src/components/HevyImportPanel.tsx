import React, { useState } from 'react';
import { Dumbbell, Save, CheckCircle } from 'lucide-react';

const itMonths: Record<string, string> = {
  'gen': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'mag': '05', 'giu': '06',
  'lug': '07', 'ago': '08', 'set': '09', 'ott': '10', 'nov': '11', 'dic': '12'
};

export default function HevyImportPanel() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleImport = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setMessage('');
    
    try {
      const lines = text.split('\n').map(l => l.trim());
      
      const title = lines[0];
      const dateLine = lines[1];
      
      // Parse date: "Il giorno martedì, lug 14, 2026 alle ore 6:37pm"
      // or similar formats. Let's try to extract month, day, year, time.
      let startTime = new Date().toISOString();
      const dateMatch = dateLine.match(/([a-z]{3})\s+(\d+),\s+(\d+)\s+alle ore\s+(\d+):(\d+)(am|pm)/i);
      
      if (dateMatch) {
        const month = itMonths[dateMatch[1].toLowerCase()] || '01';
        const day = dateMatch[2].padStart(2, '0');
        const year = dateMatch[3];
        let h = parseInt(dateMatch[4], 10);
        const m = dateMatch[5].padStart(2, '0');
        const ampm = dateMatch[6].toLowerCase();
        
        if (ampm === 'pm' && h < 12) h += 12;
        if (ampm === 'am' && h === 12) h = 0;
        
        const hour = h.toString().padStart(2, '0');
        startTime = new Date(`${year}-${month}-${day}T${hour}:${m}:00`).toISOString();
      }

      // We don't have exact duration from text, so we assume 1h end time for now
      const endTime = new Date(new Date(startTime).getTime() + 3600000).toISOString();
      
      const exercises = [];
      let currentExercise = null;
      let totalVolume = 0;
      
      for(let i = 2; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        
        if (line.startsWith('Serie ')) {
          if (!currentExercise) continue; // safety
          // "Serie 1: 13.6 kg x 10 [Riscaldamento]"
          const setMatch = line.match(/Serie (\d+):\s+([\d.]+)\s+(kg|lbs)\s+x\s+(\d+)(.*)/i);
          if (setMatch) {
            const index = parseInt(setMatch[1], 10) - 1;
            let weight = parseFloat(setMatch[2]);
            const unit = setMatch[3].toLowerCase();
            const reps = parseInt(setMatch[4], 10);
            const extra = setMatch[5].toLowerCase();
            
            if (unit === 'lbs') {
              weight = weight * 0.453592; // to kg
            }
            
            let type = 'normal';
            if (extra.includes('riscaldamento')) type = 'warmup';
            if (extra.includes('drop')) type = 'drop';
            if (extra.includes('fallimento')) type = 'failure';
            
            currentExercise.sets.push({
              index,
              type,
              weight_kg: parseFloat(weight.toFixed(1)),
              reps
            });
            
            totalVolume += (weight * reps);
          }
        } else if (!line.startsWith('@') && !line.startsWith('http')) {
          // This is an exercise title
          currentExercise = {
            title: line,
            sets: []
          };
          exercises.push(currentExercise);
        }
      }
      
      const session = {
        id: "hevy_txt_" + btoa(startTime).replace(/[^a-zA-Z0-9]/g, '').substring(0, 8),
        title,
        start_time: startTime,
        end_time: endTime,
        volume_kg: parseFloat(totalVolume.toFixed(1)),
        exercise_count: exercises.length,
        exercises
      };
      
      const res = await fetch('/api/hevy/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session })
      });
      
      if (res.ok) {
        setMessage('Allenamento importato con successo!');
        setText('');
      } else {
        setMessage('Errore durante il salvataggio.');
      }
    } catch (e) {
      console.error(e);
      setMessage('Errore nel formato del testo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-secondary mb-4">
        Incolla qui il testo condiviso dall'app Hevy. L'allenamento verrà analizzato, calcoleremo il volume totale e i dettagli per ogni serie e lo aggiungeremo al tuo storico.
      </p>
      
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Es:&#10;Allenamento serale 🏋️&#10;Il giorno martedì, lug 14, 2026 alle ore 6:37pm&#10;&#10;Pushdown Tricipiti con Corda&#10;Serie 1: 13.6 kg x 10 [Riscaldamento]&#10;Serie 2: 15.9 kg x 10"
        className="w-full h-64 bg-surface-inset border border-subtle rounded-xl p-4 text-sm font-mono text-primary placeholder:text-muted focus:outline-none focus:border-accent-cyan resize-y custom-scrollbar shadow-inner"
      />
      
      <div className="flex items-center gap-4 justify-between">
        {message ? (
          <span className={`text-sm font-medium flex items-center gap-2 ${message.includes('successo') ? 'text-accent-lime' : 'text-accent-rose'}`}>
            <CheckCircle className="w-4 h-4" />
            {message}
          </span>
        ) : <span />}
        
        <button
          onClick={handleImport}
          disabled={loading || !text.trim()}
          className="flex items-center gap-2 bg-accent-cyan text-[var(--window-bg)] px-6 py-2.5 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-[var(--window-bg)] border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Save className="w-4 h-4" />
          )}
          Importa Dati
        </button>
      </div>
    </div>
  );
}
