#!/usr/bin/env npx tsx
/**
 * Hevy → Supabase CLI importer v3
 *
 * Modalità 1 (interattiva):
 *   npx tsx scripts/hevy-import.ts
 *
 * Modalità 2 (da file):
 *   npx tsx scripts/hevy-import.ts workout.txt 63
 *   (file testo + durata in minuti come 2° argomento)
 */

import * as fs from 'fs';
import * as readline from 'readline';
import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Date parsing ──────────────────────────────
const IT_MONTHS: Record<string, number> = {
  gen:1,gennaio:1, feb:2,febbraio:2, mar:3,marzo:3,
  apr:4,aprile:4, mag:5,maggio:5, giu:6,giugno:6,
  lug:7,luglio:7, ago:8,agosto:8, set:9,settembre:9,
  ott:10,ottobre:10, nov:11,novembre:11, dic:12,dicembre:12,
};

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
  if (!yearMatch) throw new Error(`Anno non trovato in: "${line}"`);
  const year = parseInt(yearMatch[1]);

  let stripped = lower.replace(yearMatch[0], ' ').replace(timeMatch[0], ' ');
  const monthKey = Object.keys(IT_MONTHS)
    .sort((a,b) => b.length - a.length)
    .find(m => new RegExp(`(^|[^a-z])${m}([^a-z]|$)`).test(stripped));
  if (!monthKey) throw new Error(`Mese non trovato in: "${line}"`);
  const month = IT_MONTHS[monthKey];

  stripped = stripped.replace(new RegExp(`(^|[^a-z])${monthKey}([^a-z]|$)`), ' ');
  const dayMatch = stripped.match(/\b(\d{1,2})\b/);
  if (!dayMatch) throw new Error(`Giorno non trovato in: "${line}"`);
  const day = parseInt(dayMatch[1]);

  // Europe/Rome handles DST automatically (CEST=UTC+2 estate, CET=UTC+1 inverno)
  const dt = DateTime.fromObject({ year, month, day, hour, minute, second: 0 }, { zone: 'Europe/Rome' });
  if (!dt.isValid) throw new Error(`Data non valida: ${dt.invalidReason}`);
  return dt.toUTC().toISO()!;
}

// ── Set parsing ───────────────────────────────
interface SetData { index:number; type:string; reps?:number; weight_kg?:number; distance_km?:number; duration_seconds?:number; }
interface ExerciseData { title:string; sets:SetData[]; }

function parseSetContent(content: string, idx: number): SetData {
  // "14 kg x 9 [Riscaldamento]" or "14,6 kg x 10"
  const weighted = content.match(/^([\d.,]+)\s*(kg|lbs)\s*x\s*(\d+)(.*)/i);
  if (weighted) {
    let w = parseFloat(weighted[1].replace(',','.'));
    if (weighted[2].toLowerCase() === 'lbs') w = parseFloat((w*0.453592).toFixed(2));
    const reps = parseInt(weighted[3]);
    const flags = weighted[4].toLowerCase();
    let type = 'normal';
    if (flags.includes('riscaldamento') || flags.includes('warmup')) type = 'warmup';
    else if (flags.includes('fallimento') || flags.includes('failure')) type = 'failure';
    else if (flags.includes('drop')) type = 'dropset';
    return { index:idx, type, reps, weight_kg:w };
  }
  // "4.3 km - 10min 20s"
  const cardio = content.match(/^([\d.,]+)\s*km\s*[-–]\s*(\d+)min\s*(\d+)s/i);
  if (cardio) return { index:idx, type:'cardio',
    distance_km: parseFloat(cardio[1].replace(',','.')),
    duration_seconds: parseInt(cardio[2])*60+parseInt(cardio[3]) };
  // "10min 20s"
  const dur = content.match(/^(\d+)min\s*(\d+)s/i);
  if (dur) return { index:idx, type:'warmup', duration_seconds: parseInt(dur[1])*60+parseInt(dur[2]) };
  // "6 ripetizioni"
  const bw = content.match(/^(\d+)\s*(ripetizioni?|reps?)/i);
  if (bw) return { index:idx, type:'bodyweight', reps: parseInt(bw[1]) };
  throw new Error(`Serie non riconosciuta: "${content}"`);
}

function parseHevyText(raw: string) {
  const lines = raw.split('\n').map(l=>l.trim()).filter(l=>l);

  let slug: string|null = null;
  for (const l of lines) {
    const m = l.match(/https:\/\/hevy\.com\/workout\/([A-Za-z0-9]+)/);
    if (m) { slug = m[1]; break; }
  }

  let dateIdx = -1;
  for (let i=0; i<Math.min(5, lines.length); i++) {
    const l = lines[i].toLowerCase();
    if (l.includes('giorno') || l.includes('alle ore') ||
        /\b(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)\w*\b/.test(l)) {
      dateIdx = i; break;
    }
  }
  if (dateIdx < 0) throw new Error('Riga data non trovata. Incolla il testo completo da Hevy.');

  const title = dateIdx > 0 ? lines[dateIdx-1] : lines[0];
  const startLine = lines[dateIdx];

  const exercises: ExerciseData[] = [];
  let cur: ExerciseData|null = null;
  let si = 0;
  for (let i=dateIdx+1; i<lines.length; i++) {
    const l = lines[i];
    if (l==='...' || l.startsWith('@') || l.startsWith('http')) continue;
    const serieMatch = l.match(/^(Serie|Set)\s+\d+:\s*(.*)/i);
    if (serieMatch) {
      if (!cur) continue;
      try { cur.sets.push(parseSetContent(serieMatch[2], si++)); }
      catch(e:any) { console.warn(`  ⚠️  ${e.message}`); }
    } else {
      cur = { title: l, sets: [] }; exercises.push(cur); si=0;
    }
  }
  return { title, startLine, exercises, slug };
}

function calcVolume(exercises: ExerciseData[]) {
  return parseFloat(exercises.flatMap(e=>e.sets)
    .filter(s=>s.reps!=null && s.weight_kg!=null)
    .reduce((acc,s)=>acc + s.reps!*s.weight_kg!, 0).toFixed(2));
}

function parseDuration(raw: string): number {
  let min = 0;
  const hm = raw.match(/(\d+)\s*h/i); const mm = raw.match(/(\d+)\s*min/i);
  const pm = raw.match(/^(\d+)$/);
  if (hm) min += parseInt(hm[1])*60;
  if (mm) min += parseInt(mm[1]);
  if (pm) min = parseInt(pm[1]);
  return min;
}

// ── Main ──────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  // Mode: file input (npx tsx hevy-import.ts file.txt 63)
  if (args[0] && fs.existsSync(args[0])) {
    const raw = fs.readFileSync(args[0], 'utf-8');
    const durMin = parseDuration(args[1] || '0');
    if (durMin <= 0) {
      console.error('❌  Specifica la durata come secondo argomento (es. "63" o "1h 3min")');
      process.exit(1);
    }
    await processWorkout(raw, durMin);
    return;
  }

  // Mode: interactive
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   Hevy → Supabase Importer  v3.0          ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('\n📋  Incolla il testo Hevy, poi scrivi "---" su una riga e premi Invio:\n');

  const pasteLines: string[] = [];
  let collecting = true;

  for await (const line of rl) {
    if (!collecting) break;
    if (line.trim() === '---') {
      collecting = false;
      const raw = pasteLines.join('\n');

      let parsed: ReturnType<typeof parseHevyText>;
      try { parsed = parseHevyText(raw); }
      catch(e:any) { console.error('❌  Errore:', e.message); rl.close(); process.exit(1); }

      console.log(`\n📌  Titolo:   ${parsed.title}`);
      console.log(`🔑  Slug:     ${parsed.slug ?? '(assente)'}`);
      console.log(`💪  Esercizi: ${parsed.exercises.length}`);

      // Ask for duration
      process.stdout.write('\n⏱️  Durata (es. "1h 3min" o "63" minuti): ');

      for await (const durLine of rl) {
        const durMin = parseDuration(durLine);
        if (durMin <= 0) { console.error('❌  Durata non valida.'); rl.close(); process.exit(1); }
        await processWorkout(raw, durMin);
        rl.close();
        return;
      }
    } else {
      pasteLines.push(line);
    }
  }
  rl.close();
}

async function processWorkout(raw: string, durMin: number) {
  const parsed = parseHevyText(raw);
  const { title, startLine, exercises, slug } = parsed;

  let startTime: string;
  try { startTime = parseDateLine(startLine); }
  catch(e:any) { console.error('❌  Errore data:', e.message); process.exit(1); }

  const endTime = DateTime.fromISO(startTime,{zone:'utc'}).plus({minutes:durMin}).toUTC().toISO()!;
  const sessionId = slug ? `hevy_${slug}` : `hevy_${crypto.randomUUID()}`;
  const volumeKg = calcVolume(exercises);

  console.log(`\n📅  Start (UTC): ${startTime}`);
  console.log(`📅  End (UTC):   ${endTime}  (+${durMin} min)`);
  console.log(`🆔  ID:          ${sessionId}`);
  console.log(`📦  Volume:      ${volumeKg} kg`);
  exercises.forEach(e => console.log(`      • ${e.title} — ${e.sets.length} serie`));

  // Dedup check
  const { data: existing } = await supabase.from('hevy_sessions')
    .select('id,title,start_time').eq('id', sessionId).maybeSingle();

  if (existing) {
    console.log(`\n⚠️  ID "${sessionId}" già presente → UPSERT (aggiornamento).`);
  } else {
    const { data: byDate } = await supabase.from('hevy_sessions')
      .select('id').eq('title',title).eq('start_time',startTime).maybeSingle();
    if (byDate) console.log(`\n⚠️  Sessione con stesso titolo+data già presente (ID: ${byDate.id}) — inserisco comunque.`);
  }

  console.log('\n─────────────────────────────────────────────');

  const session = { id:sessionId, title, start_time:startTime, end_time:endTime,
    volume_kg:volumeKg, exercise_count:exercises.length, exercises };

  const op = existing
    ? supabase.from('hevy_sessions').upsert([session], {onConflict:'id'})
    : supabase.from('hevy_sessions').insert([session]);

  const { error } = await op;
  if (error) {
    console.error('\n❌  Errore Supabase:', error.message);
    console.error('   Dettagli:', JSON.stringify(error.details));
    process.exit(1);
  } else {
    console.log(`\n🎉  Salvato! ID: ${sessionId}`);
  }
}

main().catch(e => { console.error('Errore fatale:', e); process.exit(1); });
