import React, { useState } from 'react';
import { Dumbbell, Save, CheckCircle } from 'lucide-react';

const itMonths: Record<string, string> = {
  'gennaio': '01', 'gen': '01',
  'febbraio': '02', 'feb': '02',
  'marzo': '03', 'mar': '03',
  'aprile': '04', 'apr': '04',
  'maggio': '05', 'mag': '05',
  'giugno': '06', 'giu': '06',
  'luglio': '07', 'lug': '07',
  'agosto': '08', 'ago': '08',
  'settembre': '09', 'set': '09',
  'ottobre': '10', 'ott': '10',
  'novembre': '11', 'nov': '11',
  'dicembre': '12', 'dic': '12'
};

export function isDateLine(line: string): boolean {
  const clean = line.toLowerCase();
  if (clean.includes('giorno') || clean.includes('alle ore') || clean.includes('ore ')) return true;
  if (/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(clean)) return true;
  
  const monthKeys = Object.keys(itMonths);
  const hasMonth = monthKeys.some(m => new RegExp('(^|[^a-z])' + m + '([^a-z]|$)', 'i').test(clean));
  const hasYear = /\b(20\d\d)\b/.test(clean);
  const hasDay = /\b(\d{1,2})\b/.test(clean);
  
  return hasMonth && (hasYear || hasDay);
}

export function parseHevyDate(dateLine: string): string {
  let clean = dateLine.toLowerCase();
  
  let hour = 18;
  let minute = 0;
  
  // 1. Extract and remove Time (e.g. 6:37pm, 18:30, 7:00 am, 19:15)
  const timeMatch = clean.match(/(?:alle ore\s+|ore\s+|,\s*|\bat\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (timeMatch) {
    hour = parseInt(timeMatch[1], 10);
    minute = parseInt(timeMatch[2], 10);
    const ampm = timeMatch[3]?.toLowerCase();
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    
    clean = clean.replace(timeMatch[0], ' ');
  }
  
  let year = new Date().getFullYear();
  let month = (new Date().getMonth() + 1).toString().padStart(2, '0');
  let day = new Date().getDate().toString().padStart(2, '0');

  // 2. Extract and remove 4-digit year
  const yearMatch = clean.match(/\b(20\d\d)\b/);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
    clean = clean.replace(yearMatch[0], ' ');
  }

  // 3. Find Month
  const monthKeys = Object.keys(itMonths).sort((a, b) => b.length - a.length);
  const foundMonthKey = monthKeys.find(m => new RegExp('(^|[^a-z])' + m + '([^a-z]|$)', 'i').test(clean));
  
  if (foundMonthKey) {
    month = itMonths[foundMonthKey];
    
    // Any remaining 1-2 digit number in the string is the day
    const dayMatch = clean.match(/\b(\d{1,2})\b/);
    if (dayMatch && parseInt(dayMatch[1], 10) >= 1 && parseInt(dayMatch[1], 10) <= 31) {
      day = dayMatch[1].padStart(2, '0');
    }
  } else {
    const numDateMatch = clean.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (numDateMatch) {
      day = numDateMatch[1].padStart(2, '0');
      month = numDateMatch[2].padStart(2, '0');
      year = parseInt(numDateMatch[3], 10);
    }
  }
  
  const d = new Date(year, parseInt(month, 10) - 1, parseInt(day, 10), hour, minute, 0);
  return d.toISOString();
}

interface HevyImportPanelProps {
  onSuccess?: () => void;
}

export default function HevyImportPanel({ onSuccess }: HevyImportPanelProps = {}) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleImport = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setMessage('');
    
    try {
      const rawLines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('http') && !l.startsWith('@'));
      if (rawLines.length < 2) {
        throw new Error('Testo troppo breve o formato non valido.');
      }
      
      let title = 'Allenamento Hevy';
      let dateLine = '';
      let dateLineIndex = -1;
      
      // Find date line
      for (let i = 0; i < rawLines.length; i++) {
        if (isDateLine(rawLines[i])) {
          dateLine = rawLines[i];
          dateLineIndex = i;
          break;
        }
      }
      
      // Find title line
      if (dateLineIndex > 0) {
        title = rawLines[0];
      } else if (dateLineIndex === 0 && rawLines.length > 1) {
        if (!rawLines[1].toLowerCase().startsWith('serie') && !rawLines[1].toLowerCase().startsWith('set')) {
          title = rawLines[1];
        }
      } else if (rawLines.length > 0) {
        title = rawLines[0];
      }
      
      const startTime = dateLine ? parseHevyDate(dateLine) : new Date().toISOString();
      const endTime = new Date(new Date(startTime).getTime() + 3600000).toISOString();
      
      const exercises: any[] = [];
      let currentExercise: any = null;
      let totalVolume = 0;
      
      // Start parsing exercises after header / date
      const startIndex = Math.max(0, dateLineIndex >= 0 ? dateLineIndex + 1 : 1);
      
      for(let i = 0; i < rawLines.length; i++) {
        if (i === dateLineIndex || (i === 0 && rawLines[i] === title)) continue;
        const line = rawLines[i];
        
        if (line.toLowerCase().startsWith('serie') || line.toLowerCase().startsWith('set')) {
          if (!currentExercise) continue;
          
          let setMatch = line.match(/(?:Serie|Set)\s+(\d+)[:\s]+([\d.,]+)\s*(kg|lbs)?\s*[xX]\s*(\d+)(.*)/i);
          if (setMatch) {
            const index = parseInt(setMatch[1], 10) - 1;
            let weight = parseFloat(setMatch[2].replace(',', '.'));
            const unit = (setMatch[3] || 'kg').toLowerCase();
            const reps = parseInt(setMatch[4], 10);
            const extra = (setMatch[5] || '').toLowerCase();
            
            if (unit === 'lbs') {
              weight = weight * 0.453592;
            }
            
            let type = 'normal';
            if (extra.includes('riscaldamento') || extra.includes('warmup')) type = 'warmup';
            if (extra.includes('drop')) type = 'drop';
            if (extra.includes('fallimento') || extra.includes('failure')) type = 'failure';
            
            currentExercise.sets.push({
              index,
              type,
              weight_kg: parseFloat(weight.toFixed(1)),
              reps
            });
            
            totalVolume += (weight * reps);
          } else {
            const bwMatch = line.match(/(?:Serie|Set)\s+(\d+)[:\s]+(\d+)\s*(?:reps?)?(.*)/i);
            if (bwMatch) {
              const index = parseInt(bwMatch[1], 10) - 1;
              const reps = parseInt(bwMatch[2], 10);
              const extra = (bwMatch[3] || '').toLowerCase();
              let type = 'normal';
              if (extra.includes('riscaldamento') || extra.includes('warmup')) type = 'warmup';
              if (extra.includes('drop')) type = 'drop';
              if (extra.includes('fallimento') || extra.includes('failure')) type = 'failure';
              
              currentExercise.sets.push({
                index,
                type,
                weight_kg: 0,
                reps
              });
            }
          }
        } else {
          // This is an exercise title
          currentExercise = {
            title: line,
            sets: []
          };
          exercises.push(currentExercise);
        }
      }
      
      // Collision-free unique ID based on timestamp and randomness
      const uniqueId = `hevy_txt_${new Date(startTime).getTime()}_${Math.random().toString(36).substring(2, 7)}`;
      
      const session = {
        id: uniqueId,
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
        if (onSuccess) {
          onSuccess();
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage(`Errore durante il salvataggio: ${data.error || 'Server error'}`);
      }
    } catch (e: any) {
      console.error(e);
      setMessage(`Errore nel formato del testo: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-secondary mb-4">
        Incolla qui il testo condiviso dall'app Hevy. L'allenamento verrà analizzato, calcoleremo il volume totale e i dettagli per ogni serie e lo aggiungeremo permanentemente al tuo storico.
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
          className="flex items-center gap-2 bg-accent-cyan text-[var(--window-bg)] px-6 py-2.5 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
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
