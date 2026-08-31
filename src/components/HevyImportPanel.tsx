import React, { useState, useEffect } from 'react';
import { Save, CheckCircle, AlertCircle, Link, Clock, Eye, EyeOff } from 'lucide-react';
import { DateTime } from 'luxon';

// ── Italian months ────────────────────────────────────────────────────────────
const IT_MONTHS: Record<string, number> = {
  gen:1,gennaio:1, feb:2,febbraio:2, mar:3,marzo:3,
  apr:4,aprile:4, mag:5,maggio:5, giu:6,giugno:6,
  lug:7,luglio:7, ago:8,agosto:8, set:9,settembre:9,
  ott:10,ottobre:10, nov:11,novembre:11, dic:12,dicembre:12,
};

// ── Date parsing (timezone-aware, Europe/Rome → UTC) ─────────────────────────
function parseDateLine(line: string): string {
  const lower = line.toLowerCase();
  const timeMatch = lower.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/);
  if (!timeMatch) throw new Error(`Orario non trovato in: "${line}"`);
  let hour = parseInt(timeMatch[1]);
  const minute = parseInt(timeMatch[2]);
  const ampm = timeMatch[3];
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;

  const yearMatch = lower.match(/\b(20\d\d)\b/);
  if (!yearMatch) throw new Error(`Anno non trovato`);
  const year = parseInt(yearMatch[1]);

  let stripped = lower.replace(yearMatch[0], ' ').replace(timeMatch[0], ' ');
  const monthKey = Object.keys(IT_MONTHS)
    .sort((a, b) => b.length - a.length)
    .find(m => new RegExp(`(^|[^a-z])${m}([^a-z]|$)`).test(stripped));
  if (!monthKey) throw new Error(`Mese non trovato`);
  const month = IT_MONTHS[monthKey];

  stripped = stripped.replace(new RegExp(`(^|[^a-z])${monthKey}([^a-z]|$)`), ' ');
  const dayMatch = stripped.match(/\b(\d{1,2})\b/);
  if (!dayMatch) throw new Error(`Giorno non trovato`);
  const day = parseInt(dayMatch[1]);

  // luxon handles DST: CEST (UTC+2) in estate, CET (UTC+1) in inverno
  const dt = DateTime.fromObject({ year, month, day, hour, minute, second: 0 }, { zone: 'Europe/Rome' });
  if (!dt.isValid) throw new Error(`Data non valida: ${dt.invalidReason}`);
  return dt.toUTC().toISO()!;
}

// ── Set parsing ───────────────────────────────────────────────────────────────
interface SetData { index: number; type: string; reps?: number; weight_kg?: number; distance_km?: number; duration_seconds?: number; }
interface ExerciseData { title: string; sets: SetData[]; }

function parseSetContent(content: string, idx: number): SetData {
  // "14 kg x 9 [Riscaldamento]" or "14,6 kg x 10"
  const weighted = content.match(/^([\d.,]+)\s*(kg|lbs)\s*x\s*(\d+)(.*)/i);
  if (weighted) {
    let w = parseFloat(weighted[1].replace(',', '.'));
    if (weighted[2].toLowerCase() === 'lbs') w = parseFloat((w * 0.453592).toFixed(2));
    const reps = parseInt(weighted[3]);
    const flags = weighted[4].toLowerCase();
    let type = 'normal';
    if (flags.includes('riscaldamento') || flags.includes('warmup')) type = 'warmup';
    else if (flags.includes('fallimento') || flags.includes('failure')) type = 'failure';
    else if (flags.includes('drop')) type = 'dropset';
    return { index: idx, type, reps, weight_kg: w };
  }
  // "4.3 km - 10min 20s"
  const cardio = content.match(/^([\d.,]+)\s*km\s*[-–]\s*(\d+)min\s*(\d+)s/i);
  if (cardio) return { index: idx, type: 'cardio',
    distance_km: parseFloat(cardio[1].replace(',', '.')),
    duration_seconds: parseInt(cardio[2]) * 60 + parseInt(cardio[3]) };
  // "10min 20s"
  const dur = content.match(/^(\d+)min\s*(\d+)s/i);
  if (dur) return { index: idx, type: 'warmup', duration_seconds: parseInt(dur[1]) * 60 + parseInt(dur[2]) };
  // "6 ripetizioni"
  const bw = content.match(/^(\d+)\s*(ripetizioni?|reps?)/i);
  if (bw) return { index: idx, type: 'bodyweight', reps: parseInt(bw[1]) };
  throw new Error(`Serie non riconosciuta: "${content}"`);
}

interface ParsedWorkout {
  id: string;
  title: string;
  startTime: string;
  exercises: ExerciseData[];
  slug: string | null;
}

function parseHevyText(raw: string): ParsedWorkout {
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l);

  // Extract slug from URL
  let slug: string | null = null;
  for (const l of lines) {
    const m = l.match(/https:\/\/hevy\.com\/workout\/([A-Za-z0-9]+)/);
    if (m) { slug = m[1]; break; }
  }

  // Find date line
  let dateIdx = -1;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const l = lines[i].toLowerCase();
    if (l.includes('giorno') || l.includes('alle ore') ||
        /\b(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)\w*\b/.test(l)) {
      dateIdx = i; break;
    }
  }
  if (dateIdx < 0) throw new Error('Riga data non trovata. Incolla il testo completo da Hevy (deve contenere la riga con data/ora).');

  const title = dateIdx > 0 ? lines[dateIdx - 1] : lines[0];
  const startTime = parseDateLine(lines[dateIdx]);

  const exercises: ExerciseData[] = [];
  let cur: ExerciseData | null = null;
  let si = 0;
  for (let i = dateIdx + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l === '...' || l.startsWith('@') || l.startsWith('http')) continue;
    const serieMatch = l.match(/^(Serie|Set)\s+\d+:\s*(.*)/i);
    if (serieMatch) {
      if (!cur) continue;
      try { cur.sets.push(parseSetContent(serieMatch[2], si++)); }
      catch { /* skip unparseable sets */ }
    } else {
      cur = { title: l, sets: [] }; exercises.push(cur); si = 0;
    }
  }

  const id = slug ? `hevy_${slug}` : `hevy_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return { id, title, startTime, exercises, slug };
}

function calcVolume(exercises: ExerciseData[]): number {
  return parseFloat(exercises.flatMap(e => e.sets)
    .filter(s => s.reps != null && s.weight_kg != null)
    .reduce((acc, s) => acc + s.reps! * s.weight_kg!, 0).toFixed(2));
}

function parseDuration(raw: string): number {
  let min = 0;
  const hm = raw.match(/(\d+)\s*h/i); const mm = raw.match(/(\d+)\s*min/i);
  const pm = raw.match(/^(\d+)$/);
  if (hm) min += parseInt(hm[1]) * 60;
  if (mm) min += parseInt(mm[1]);
  if (pm) min = parseInt(pm[1]);
  return min;
}

// ── Component ─────────────────────────────────────────────────────────────────
interface HevyImportPanelProps {
  onSuccess?: () => void;
}

export default function HevyImportPanel({ onSuccess }: HevyImportPanelProps = {}) {
  const [text, setText] = useState('');
  const [duration, setDuration] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [preview, setPreview] = useState<ParsedWorkout | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showExercises, setShowExercises] = useState(false);

  // Live preview while typing
  useEffect(() => {
    if (!text.trim()) { setPreview(null); setParseError(null); return; }
    try {
      const p = parseHevyText(text);
      setPreview(p);
      setParseError(null);
    } catch (e: any) {
      setPreview(null);
      setParseError(e.message);
    }
  }, [text]);

  const handleImport = async () => {
    if (!preview) return;
    const durMin = parseDuration(duration);
    if (durMin <= 0) {
      setMessage({ type: 'error', text: 'Inserisci la durata dell\'allenamento (es. "63" o "1h 3min")' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const endTime = DateTime.fromISO(preview.startTime, { zone: 'utc' })
        .plus({ minutes: durMin }).toUTC().toISO()!;

      const session = {
        id: preview.id,
        title: preview.title,
        start_time: preview.startTime,
        end_time: endTime,
        volume_kg: calcVolume(preview.exercises),
        exercise_count: preview.exercises.length,
        exercises: preview.exercises,
      };

      const res = await fetch('/api/hevy/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: `✓ "${preview.title}" salvato (${preview.exercises.length} esercizi, ${calcVolume(preview.exercises)} kg volume)` });
        setText('');
        setDuration('');
        setPreview(null);
        if (onSuccess) onSuccess();
      } else {
        const data = await res.json().catch(() => ({}));
        const errMsg = data.error || 'Errore server';
        // Specific duplicate error handling
        if (errMsg.includes('duplicate') || errMsg.includes('unique') || errMsg.includes('23505')) {
          setMessage({ type: 'error', text: `Questo allenamento è già presente nel database (ID: ${preview.id})` });
        } else {
          setMessage({ type: 'error', text: errMsg });
        }
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const volumeKg = preview ? calcVolume(preview.exercises) : 0;
  const durMin = parseDuration(duration);
  const endTime = preview && durMin > 0
    ? DateTime.fromISO(preview.startTime, { zone: 'utc' }).plus({ minutes: durMin }).toUTC().setZone('Europe/Rome').toFormat('HH:mm')
    : null;

  return (
    <div className="space-y-5">
      <p className="text-sm text-secondary">
        Incolla il testo condiviso dall'app Hevy (deve includere l'URL <code className="text-accent-cyan text-xs">hevy.com/workout/...</code>).
      </p>

      {/* Text input */}
      <textarea
        value={text}
        onChange={e => { setText(e.target.value); setMessage(null); }}
        placeholder={`Es:\nChest&Shoulders\nIl giorno lunedì, ago 31, 2026 alle ore 7:16pm\nPanca Inclinata (Manubrio)\nSerie 1: 14 kg x 9 [Riscaldamento]\nSerie 2: 16 kg x 10\n@hevyapp\nhttps://hevy.com/workout/4uoKFZjqQaR`}
        className="w-full h-56 bg-surface-inset border border-subtle rounded-xl p-4 text-sm font-mono text-primary placeholder:text-muted focus:outline-none focus:border-accent-cyan resize-y custom-scrollbar shadow-inner"
      />

      {/* Duration input */}
      <div className="flex items-center gap-3">
        <Clock className="w-4 h-4 text-secondary shrink-0" />
        <div className="flex-1">
          <input
            type="text"
            value={duration}
            onChange={e => setDuration(e.target.value)}
            placeholder='Durata allenamento — es. "1h 3min" o "63"'
            className="w-full bg-surface-inset border border-subtle rounded-xl px-4 py-2.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent-cyan shadow-inner"
          />
        </div>
        {endTime && (
          <span className="text-xs text-accent-lime font-mono shrink-0">fine: {endTime}</span>
        )}
      </div>

      {/* Live preview */}
      {parseError && (
        <div className="flex items-start gap-2 text-sm text-accent-rose bg-accent-rose/5 border border-accent-rose/20 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{parseError}</span>
        </div>
      )}

      {preview && !parseError && (
        <div className="bg-surface-inset border border-subtle rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-secondary">Anteprima</span>
            <button
              onClick={() => setShowExercises(v => !v)}
              className="flex items-center gap-1 text-xs text-secondary hover:text-primary transition-colors"
            >
              {showExercises ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {showExercises ? 'nascondi' : 'mostra esercizi'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted text-xs">Titolo</span><div className="font-semibold text-primary">{preview.title}</div></div>
            <div><span className="text-muted text-xs">Data</span><div className="font-mono text-primary text-xs">{DateTime.fromISO(preview.startTime, {zone:'utc'}).setZone('Europe/Rome').toFormat('dd MMM yyyy, HH:mm')}</div></div>
            <div><span className="text-muted text-xs">Esercizi</span><div className="font-semibold text-primary">{preview.exercises.length}</div></div>
            <div><span className="text-muted text-xs">Volume totale</span><div className="font-semibold text-accent-cyan">{volumeKg} kg</div></div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Link className="w-3 h-3 text-secondary" />
            <span className="text-muted">ID:</span>
            <code className="text-accent-lime">{preview.id}</code>
            {!preview.slug && <span className="text-accent-rose">(⚠ URL Hevy assente — ID generato casualmente)</span>}
          </div>

          {showExercises && (
            <div className="mt-2 space-y-1 border-t border-subtle pt-2">
              {preview.exercises.map((ex, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-primary">{ex.title}</span>
                  <span className="text-secondary">{ex.sets.length} serie</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Result message */}
      {message && (
        <div className={`flex items-start gap-2 text-sm rounded-xl p-3 border ${
          message.type === 'success'
            ? 'text-accent-lime bg-accent-lime/5 border-accent-lime/20'
            : 'text-accent-rose bg-accent-rose/5 border-accent-rose/20'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <button
          onClick={handleImport}
          disabled={loading || !preview || !!parseError || durMin <= 0}
          className="flex items-center gap-2 bg-accent-cyan text-[var(--window-bg)] px-6 py-2.5 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-accent-cyan/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm cursor-pointer"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-[var(--window-bg)] border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Salva Allenamento
        </button>
      </div>
    </div>
  );
}
