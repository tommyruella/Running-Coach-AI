import fs from 'fs';
import path from 'path';

const inputPath = path.join(process.cwd(), 'data', 'workout_data.csv');
const outputPath = path.join(process.cwd(), 'data', 'hevy_sessions.json');

const content = fs.readFileSync(inputPath, 'utf8');

function parseCSV(str: string) {
  const lines = str.split('\n').filter(l => l.trim() !== '');
  const headers = lines[0].split(',').map(h => h.replace(/(^"|"$)/g, ''));
  const rows = [];
  
  for(let i = 1; i < lines.length; i++) {
    const row = lines[i];
    let inQuotes = false;
    let currentVal = '';
    const values = [];
    
    for(let j = 0; j < row.length; j++) {
      const char = row[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentVal.replace(/(^"|"$)/g, ''));
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    values.push(currentVal.replace(/(^"|"$)/g, ''));
    
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx];
    });
    rows.push(obj);
  }
  return rows;
}

const records = parseCSV(content);

const itMonths: Record<string, string> = {
  'gen': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'mag': '05', 'giu': '06',
  'lug': '07', 'ago': '08', 'set': '09', 'ott': '10', 'nov': '11', 'dic': '12'
};

function parseItDate(dateStr: string) {
  // Format: "14 lug 2026, 18:37"
  const match = dateStr.match(/(\d+)\s+([a-z]{3})\s+(\d+),\s+(\d+:\d+)/i);
  if (!match) return new Date().toISOString();
  
  const day = match[1].padStart(2, '0');
  const month = itMonths[match[2].toLowerCase()] || '01';
  const year = match[3];
  const time = match[4];
  
  const d = new Date(`${year}-${month}-${day}T${time}:00`);
  return d.toISOString();
}

const workouts: Record<string, any> = {};

records.forEach((row: any) => {
  const workoutId = row.start_time; 
  
  if (!workouts[workoutId]) {
    workouts[workoutId] = {
      id: "hevy_" + Buffer.from(workoutId).toString('base64').substring(0, 8),
      title: row.title,
      start_time: parseItDate(row.start_time),
      end_time: parseItDate(row.end_time),
      volume_kg: 0,
      exercise_count: 0,
      exercises: []
    };
  }
  
  const workout = workouts[workoutId];
  
  let ex = workout.exercises.find((e: any) => e.title === row.exercise_title);
  if (!ex) {
    ex = {
      title: row.exercise_title,
      sets: []
    };
    workout.exercises.push(ex);
  }
  
  const weight = parseFloat(row.weight_kg) || 0;
  const reps = parseInt(row.reps, 10) || 0;
  
  ex.sets.push({
    index: parseInt(row.set_index, 10) || 0,
    type: row.set_type,
    weight_kg: weight,
    reps: reps
  });
  
  workout.volume_kg += (weight * reps);
});

const sessions = Object.values(workouts).map(w => {
  w.exercise_count = w.exercises.length;
  return w;
});

// Sort by start_time descending
sessions.sort((a: any, b: any) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

fs.writeFileSync(outputPath, JSON.stringify(sessions, null, 2));
console.log(`Parsed ${sessions.length} workouts! Saved to ${outputPath}`);
