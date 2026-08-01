import garminConnectPkg from 'garmin-connect';
const { GarminConnect } = garminConnectPkg;
import { DailyMetrics } from '../src/types.js';

export async function syncGarminMetrics(email: string, password: string, dateObj: Date = new Date(), existingClient?: any): Promise<DailyMetrics> {
  let gcClient = existingClient;
  
  if (!gcClient) {
    gcClient = new GarminConnect({ username: email, password });
    await gcClient.login(email, password);
  }

  // Use today's date or yesterday depending on what's available
  // Let's fetch for the current date in YYYY-MM-DD
  const dateStr = dateObj.toLocaleDateString('en-CA'); // format YYYY-MM-DD

  console.log(`Fetching Garmin metrics for ${dateStr}...`);

  let sleepData, weightData, stepsData;

  try {
    sleepData = await gcClient.getSleepData(dateObj);
  } catch (err) {
    console.error('Error fetching sleep data:', err);
  }

  // HeartRate is skipped because restingHeartRate is extracted from getSleepData

  try {
    stepsData = await gcClient.getSteps(dateObj);
  } catch (err) {
    console.error('Error fetching steps:', err);
  }

  try {
    weightData = await gcClient.getDailyWeightData(dateObj);
  } catch (err) {
    console.error('Error fetching body composition:', err);
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
    metrics.stress_level = sleepDTO.avgSleepStress || null;

    // Timeline array (Hypnogram)
    if ((sleepData as any).sleepLevels) {
      metrics.sleep_timeline = (sleepData as any).sleepLevels;
    }
  }

  if (stepsData) {
    metrics.steps = stepsData;
  }

  metrics.calories_total = 0; 

  if (weightData && (weightData as any).totalAverage && (weightData as any).totalAverage.weight > 0) {
    metrics.weight_kg = (weightData as any).totalAverage.weight / 1000;
  }

  return metrics;
}
