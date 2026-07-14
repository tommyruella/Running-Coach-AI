/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { Activity, ChatMessage } from '../src/types.js';
import { parseTcx } from './tcxParser.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const ACTIVITIES_FILE = path.join(DATA_DIR, 'activities.json');
const CHAT_HISTORY_FILE = path.join(DATA_DIR, 'chat_history.json');
const TRAINING_PLANS_FILE = path.join(DATA_DIR, 'training_plans.json');
export const TCX_DIR = path.join(process.cwd(), 'tcx');

const SAMPLE_TCX_1 = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Running">
      <Id>2026-07-12T08:30:00Z</Id>
      <Lap StartTime="2026-07-12T08:30:00Z">
        <TotalTimeSeconds>1500</TotalTimeSeconds>
        <DistanceMeters>5000</DistanceMeters>
        <MaximumSpeed>3.8</MaximumSpeed>
        <Calories>340</Calories>
        <AverageHeartRateBpm><Value>138</Value></AverageHeartRateBpm>
        <MaximumHeartRateBpm><Value>144</Value></MaximumHeartRateBpm>
        <Cadence>88</Cadence>
      </Lap>
      <Lap StartTime="2026-07-12T08:55:00Z">
        <TotalTimeSeconds>1560</TotalTimeSeconds>
        <DistanceMeters>5000</DistanceMeters>
        <MaximumSpeed>3.9</MaximumSpeed>
        <Calories>350</Calories>
        <AverageHeartRateBpm><Value>142</Value></AverageHeartRateBpm>
        <MaximumHeartRateBpm><Value>148</Value></MaximumHeartRateBpm>
        <Cadence>89</Cadence>
      </Lap>
      <Creator>
        <Name>Garmin Forerunner 955</Name>
      </Creator>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

const SAMPLE_TCX_2 = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Running">
      <Id>2026-07-10T18:15:00Z</Id>
      <Lap StartTime="2026-07-10T18:15:00Z">
        <TotalTimeSeconds>1380</TotalTimeSeconds>
        <DistanceMeters>4500</DistanceMeters>
        <MaximumSpeed>4.5</MaximumSpeed>
        <Calories>310</Calories>
        <AverageHeartRateBpm><Value>145</Value></AverageHeartRateBpm>
        <MaximumHeartRateBpm><Value>158</Value></MaximumHeartRateBpm>
        <Cadence>90</Cadence>
      </Lap>
      <Lap StartTime="2026-07-10T18:38:00Z">
        <TotalTimeSeconds>1260</TotalTimeSeconds>
        <DistanceMeters>4500</DistanceMeters>
        <MaximumSpeed>5.1</MaximumSpeed>
        <Calories>300</Calories>
        <AverageHeartRateBpm><Value>152</Value></AverageHeartRateBpm>
        <MaximumHeartRateBpm><Value>166</Value></MaximumHeartRateBpm>
        <Cadence>91</Cadence>
      </Lap>
      <Creator>
        <Name>Garmin Forerunner 955</Name>
      </Creator>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

const SAMPLE_TCX_3 = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Running">
      <Id>2026-07-07T07:00:00Z</Id>
      <Lap StartTime="2026-07-07T07:00:00Z">
        <TotalTimeSeconds>4860</TotalTimeSeconds>
        <DistanceMeters>15000</DistanceMeters>
        <MaximumSpeed>3.7</MaximumSpeed>
        <Calories>1020</Calories>
        <AverageHeartRateBpm><Value>135</Value></AverageHeartRateBpm>
        <MaximumHeartRateBpm><Value>142</Value></MaximumHeartRateBpm>
        <Cadence>87</Cadence>
      </Lap>
      <Creator>
        <Name>Strava App</Name>
      </Creator>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

function getWeatherDescription(code: number): string {
  switch (code) {
    case 0: return 'Clear';
    case 1:
    case 2:
    case 3: return 'Partly Cloudy';
    case 45:
    case 48: return 'Fog';
    case 51:
    case 53:
    case 55: return 'Drizzle';
    case 61:
    case 63:
    case 65: return 'Rain';
    case 71:
    case 73:
    case 75: return 'Snow';
    case 80:
    case 81:
    case 82: return 'Rain Showers';
    case 95:
    case 96:
    case 99: return 'Thunderstorm';
    default: return 'Overcast';
  }
}

export async function fetchWeather(lat: number, lon: number, dateStr: string): Promise<string | null> {
  try {
    const activityDate = new Date(dateStr);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - activityDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const datePart = dateStr.split('T')[0]; // YYYY-MM-DD
    let url = '';
    if (diffDays <= 3) {
      url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${datePart}&end_date=${datePart}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code`;
    } else {
      url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${datePart}&end_date=${datePart}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code`;
    }

    const res = await fetch(url);
    if (!res.ok) return null;
    const data: any = await res.json();
    if (!data.hourly || !data.hourly.time) return null;

    // Find closest hour matching the activity start time (UTC)
    const startHour = activityDate.getUTCHours();
    let index = startHour;
    if (data.hourly.time.length > startHour) {
      const targetHourStr = `${datePart}T${startHour.toString().padStart(2, '0')}:00`;
      const foundIdx = data.hourly.time.findIndex((t: string) => t.startsWith(targetHourStr));
      if (foundIdx !== -1) {
        index = foundIdx;
      }
    }

    if (index >= data.hourly.time.length) {
      index = 0;
    }

    const temp = data.hourly.temperature_2m[index];
    const humidity = data.hourly.relative_humidity_2m[index];
    const wind = data.hourly.wind_speed_10m[index];
    const windDir = data.hourly.wind_direction_10m?.[index];
    const code = data.hourly.weather_code[index];

    // Convert degrees to 16-point compass direction
    const compassDir = (deg: number): string => {
      const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
      return dirs[Math.round(deg / 22.5) % 16];
    };
    const windDirStr = windDir !== undefined ? ` ${compassDir(windDir)}` : '';

    const desc = getWeatherDescription(code);
    return `Condizioni: ${desc}, Temp: ${temp}°C, Umidità: ${humidity}%, Vento: ${wind} km/h${windDirStr}`;
  } catch (err) {
    console.error('Error fetching weather:', err);
    return null;
  }
}

// Helper to ensure directory and files exist
export async function initializeDb() {
  // DB is now handled via Supabase, no local file initialization needed.
  console.log("Supabase DB active. Skipping local filesystem initialization.");
}

// Data read/write utilities using Supabase
import { supabaseAdmin } from './supabaseClient.js';

export async function getActivities(): Promise<Activity[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('activities')
      .select('*')
      .order('date', { ascending: false });
      
    if (error) throw error;
    
    // Ensure laps and trackpoints are properly formatted if they come back as JSON
    return (data || []) as Activity[];
  } catch (error) {
    console.error('Error fetching activities from Supabase:', error);
    return [];
  }
}

export async function saveActivities(activities: Activity[]): Promise<void> {
  try {
    // Upsert all activities
    const { error } = await supabaseAdmin
      .from('activities')
      .upsert(activities);
      
    if (error) throw error;
  } catch (error) {
    console.error('Error saving activities to Supabase:', error);
  }
}

export async function deleteActivity(id: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('activities')
      .delete()
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error('Error deleting activity from Supabase:', error);
  }
}

export async function renameActivity(id: string, newName: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('activities')
      .update({ name: newName })
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error('Error renaming activity in Supabase:', error);
  }
}

export async function getChatHistory(): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('chat_history')
      .select('*')
      .order('timestamp', { ascending: true });
      
    if (error) throw error;
    return (data || []) as ChatMessage[];
  } catch (error) {
    console.error('Error fetching chat history from Supabase:', error);
    return [];
  }
}

export async function saveChatHistory(history: ChatMessage[]): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('chat_history')
      .upsert(history);
      
    if (error) throw error;
  } catch (error) {
    console.error('Error saving chat history to Supabase:', error);
  }
}

export async function clearChatHistory(): Promise<void> {
  try {
    // Delete all records
    await supabaseAdmin.from('chat_history').delete().neq('id', 'never'); // dirty trick to delete all rows
    
    // Insert initial message
    const initMessage: ChatMessage = {
      id: 'chat_init',
      sender: 'assistant',
      text: `Ciao, Runner! 🏃\n\nBenvenuto sul tuo **Running Coach AI**. Sono qui per aiutarti a migliorare la tua forma fisica, strutturare le tue sessioni di allenamento ed analizzare le tue statistiche di corsa.\n\nEcco cosa posso fare per te:\n1. **Analisi veloce (Groq)**: Chiedimi pareri sulle tue metriche di corsa, consigli di postura, scarpe o nutrizione.\n2. **Programma Settimanale (Premium)**: Chiedimi di creare un piano di allenamento personalizzato scrivendo formule tipo "*crea un piano per una maratona*" o "*preparami una settimana ad alta intensità*". L'AI Premium elaborerà per te un piano strutturato dettagliato.\n3. **Analisi TCX**: Carica i file delle tue sessioni Garmin o Strava (.tcx) nella sezione **History** per popolare automaticamente il tuo grafico e le tue statistiche personali!\n\nCome posso aiutarti oggi?`,
      timestamp: new Date().toISOString(),
      isPlan: false
    };
    await saveChatHistory([initMessage]);
  } catch (error) {
    console.error('Error clearing chat history:', error);
  }
}

// Keep local training plans for now, or just migrate them too? 
// The app never actually used training_plans.json beyond saving to it. We can just disable it or put it in chat_history.
export async function getTrainingPlans(): Promise<any[]> {
  return [];
}

export async function saveTrainingPlan(plan: any): Promise<void> {
  // Not implemented in DB yet, plans are saved as chat history
}
