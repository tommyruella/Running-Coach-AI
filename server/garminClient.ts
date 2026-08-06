import { createRequire } from 'module';
import { DailyMetrics } from '../src/types.js';
import { getActivities } from './db.js';

const require = createRequire(import.meta.url);
const { GarminConnect } = require('garmin-connect');

let cachedClient: any = null;
let cachedDisplayName: string = '';

export async function syncGarminMetrics(email: string, password: string, dateObj: Date = new Date(), existingClient?: any): Promise<DailyMetrics> {
  let gcClient = existingClient || cachedClient;
  
  if (!gcClient) {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Logging in to Garmin Connect (attempt ${attempt}/${maxRetries})...`);
        gcClient = new GarminConnect({ username: email, password });
        await gcClient.login(email, password);
        cachedClient = gcClient;
        break;
      } catch (loginErr: any) {
        const msg = loginErr?.message || '';
        const isRateLimit = msg.includes('429') || msg.includes('1015') || msg.includes('rate_limit');
        if (isRateLimit && attempt < maxRetries) {
          const waitSec = 30 * Math.pow(2, attempt - 1); // 30s, 60s, 120s
          console.warn(`Rate limited on login, waiting ${waitSec}s before retry...`);
          await new Promise(r => setTimeout(r, waitSec * 1000));
          gcClient = null;
        } else {
          cachedClient = null;
          throw loginErr;
        }
      }
    }
  }

  // Use today's date or yesterday depending on what's available
  const dateStr = dateObj.toLocaleDateString('en-CA'); // format YYYY-MM-DD

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  if (!cachedDisplayName && gcClient) {
    try {
      const profile = await gcClient.getUserProfile();
      cachedDisplayName = profile?.displayName || '';
    } catch (e) {
      console.error("Failed to get displayName", e);
    }
    await delay(800);
  }
  const displayName = cachedDisplayName;

  // Sequential fetching with delays to avoid Cloudflare rate-limiting (429/1015)
  console.log(`Fetching Garmin metrics for ${dateStr} (sequential, anti-rate-limit)...`);

  let sleepData: any = null;
  try { sleepData = await gcClient.getSleepData(dateObj); } catch (e) { console.error('Error fetching sleep data:', e); }
  await delay(800);

  let hrData: any = null;
  try { hrData = await gcClient.getHeartRate(dateObj); } catch (e) { console.error('Error fetching HR data:', e); }
  await delay(800);

  let stepsData: any = null;
  try { stepsData = await gcClient.getSteps(dateObj); } catch (e) { console.error('Error fetching steps data:', e); }
  await delay(800);

  let weightData: any = null;
  try { weightData = await gcClient.getDailyWeightData(dateObj); } catch (e) { console.error('Error fetching weight data:', e); }
  await delay(800);

  let summaryData: any = null;
  if (displayName) {
    try { summaryData = await gcClient.get(`https://connect.garmin.com/usersummary-service/usersummary/daily/${displayName}?calendarDate=${dateStr}`); } catch (e) { console.error('Error fetching summary data:', e); }
  }

  // Parse data
  const metrics: DailyMetrics = {
    date: dateStr,
  };

  if (sleepData && (sleepData as any).dailySleepDTO) {
    const sleepDTO = (sleepData as any).dailySleepDTO;
    metrics.sleep_duration = Math.round((sleepDTO.sleepTimeSeconds || 0) / 60);
    metrics.sleep_score = sleepDTO.sleepScores?.overall?.value || null;
    
    // Parse phases
    metrics.sleep_deep = Math.round((sleepDTO.deepSleepSeconds || 0) / 60);
    metrics.sleep_light = Math.round((sleepDTO.lightSleepSeconds || 0) / 60);
    metrics.sleep_rem = Math.round((sleepDTO.remSleepSeconds || 0) / 60);
    metrics.sleep_awake = Math.round((sleepDTO.awakeSleepSeconds || 0) / 60);
    
    // Extract other metrics natively provided by getSleepData
    metrics.resting_hr = (sleepData as any).restingHeartRate || null;
    metrics.hrv_avg = (sleepData as any).avgOvernightHrv || null;
    metrics.body_battery_change = (sleepData as any).bodyBatteryChange || null;
    
    // New metrics
    metrics.respiration_avg = sleepDTO.averageRespirationValue || null;
  }
  
  // Extract generic daily stress from summary (most reliable) with sleep & stress endpoint fallbacks
  if (summaryData) {
    metrics.stress_level = summaryData.averageStressLevel ?? summaryData.avgStressLevel ?? summaryData.overallStressLevel ?? summaryData.averageStress ?? summaryData.stressScore ?? summaryData.dailyStressScore ?? null;
  }
  if ((metrics.stress_level == null || metrics.stress_level < 0) && sleepData && (sleepData as any).dailySleepDTO) {
    const sleepDTO = (sleepData as any).dailySleepDTO;
    metrics.stress_level = sleepDTO.avgSleepStress ?? sleepDTO.averageStressScore ?? sleepDTO.sleepStress ?? null;
  }
  if (metrics.stress_level != null && metrics.stress_level < 0) metrics.stress_level = null;

  // Fallback: If Garmin provides no stress data for this date, calculate an estimated daily stress level based on resting HR and sleep quality
  if (metrics.stress_level == null) {
    if (metrics.resting_hr && metrics.resting_hr > 0) {
      // Base stress estimated from Resting HR (resting HR 50 = ~18 stress, resting HR 70 = ~35 stress)
      const hrEst = Math.round(Math.max(12, Math.min(85, (metrics.resting_hr - 40) * 0.95 + 10)));
      metrics.stress_level = hrEst;
    } else {
      metrics.stress_level = 22; // Default healthy baseline
    }
  }

  // Calculate Custom Sleep Score if missing
    if (metrics.sleep_score == null && metrics.sleep_duration) {
      const durationMin = metrics.sleep_duration;
      const deepMin = metrics.sleep_deep || 0;
      const remMin = metrics.sleep_rem || 0;
      const awakeMin = metrics.sleep_awake || 0;
      const stress = metrics.stress_level || 15;
    
      let durationScore = 0;
      if (durationMin >= 450 && durationMin <= 540) durationScore = 100;
      else if (durationMin > 540) durationScore = Math.max(0, 100 - (durationMin - 540) * 0.4);
      else durationScore = Math.max(0, Math.pow(durationMin / 450, 1.8) * 100);
    
      const deepPct = deepMin / durationMin;
      let deepScore = 0;
      if (deepPct >= 0.15) deepScore = 100;
      else deepScore = Math.max(0, Math.pow(deepPct / 0.15, 1.5) * 100);
    
      const remPct = remMin / durationMin;
      let remScore = 0;
      if (remPct >= 0.20) remScore = 100;
      else remScore = Math.max(0, Math.pow(remPct / 0.20, 1.5) * 100);
    
      let stressScore = 100;
      if (stress <= 15) stressScore = 100;
      else stressScore = Math.max(0, 100 - (stress - 15) * 2.2); 
    
      let awakeScore = Math.max(0, 100 - (awakeMin / 10) * 15);
    
      let calcScore = (
        (durationScore * 0.40) +
        (deepScore * 0.20) +
        (remScore * 0.20) +
        (stressScore * 0.10) +
        (awakeScore * 0.10)
      );

      if (durationMin < 360) calcScore *= 0.85;
      if (remPct < 0.05) calcScore *= 0.85;
      if (deepPct < 0.05) calcScore *= 0.85;

      metrics.sleep_score = Math.min(100, Math.max(0, Math.round(calcScore)));
    }

    // Timeline array (Hypnogram)
    if (sleepData && (sleepData as any).sleepLevels) {
      metrics.sleep_timeline = (sleepData as any).sleepLevels;
    }

  if (stepsData != null) {
    if (typeof stepsData === 'number') {
      metrics.steps = stepsData;
    } else if ((stepsData as any).totalSteps != null) {
      metrics.steps = (stepsData as any).totalSteps;
    } else if (Array.isArray(stepsData)) {
      metrics.steps = stepsData.reduce((s: number, i: any) => s + (i.steps || i[1] || 0), 0);
    }
  }

  if (hrData && hrData.heartRateValues) {
    metrics.hr_timeline = hrData.heartRateValues
      .map((entry: any) => {
        let ts = entry[0] || entry.timestamp;
        let hr = entry[1] || entry.heartrate;
        if (Array.isArray(entry)) {
          ts = entry[0];
          hr = entry[1];
        }
        return {
          time: new Date(ts).toISOString(),
          hr: hr
        };
      })
      .filter((m: any) => m.hr != null);
  }

  metrics.calories_total = 0; 
  metrics.calories_active = 0;
  metrics.distance_m = 0;
  metrics.ran_today = false;

  if (summaryData) {
    metrics.calories_total = summaryData.totalKilocalories || summaryData.totalCalories || 0;
    metrics.calories_active = summaryData.activeKilocalories || summaryData.netCalorieGoal || 0;
    metrics.distance_m = summaryData.totalDistanceMeters || summaryData.totalDistance || 0;
  }

  // Check ran_today using our local Supabase activities DB (uploaded TCX / saved runs)
  try {
    const localActivities = await getActivities();
    if (localActivities && localActivities.length > 0) {
      const hasRun = localActivities.some((a) => {
        const isRun = (a.sport || 'running').toLowerCase().includes('run');
        const activityDateStr = new Date(a.date).toLocaleDateString('en-CA');
        return isRun && activityDateStr === dateStr;
      });
      metrics.ran_today = hasRun;
    }
  } catch (err) {
    console.error('Error checking local activities for ran_today:', err);
  }

  if (weightData && (weightData as any).totalAverage && (weightData as any).totalAverage.weight > 0) {
    metrics.weight_kg = (weightData as any).totalAverage.weight / 1000;
  }

  return metrics;
}
