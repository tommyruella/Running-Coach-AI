import garminConnectPkg from 'garmin-connect';
const { GarminConnect } = garminConnectPkg;
import { DailyMetrics } from '../src/types.js';

export async function syncGarminMetrics(email: string, password: string): Promise<DailyMetrics> {
  const gcClient = new GarminConnect({ username: email, password });
  await gcClient.login(email, password);

  // Use today's date or yesterday depending on what's available
  // Let's fetch for the current date in YYYY-MM-DD
  const dateObj = new Date();
  const dateStr = dateObj.toISOString().split('T')[0];

  console.log(`Fetching Garmin metrics for ${dateStr}...`);

  let sleepData, hrData, weightData, stepsData;

  try {
    sleepData = await gcClient.getSleepData(dateObj);
  } catch (err) {
    console.error('Error fetching sleep data:', err);
  }

  try {
    hrData = await gcClient.getHeartRate(dateObj);
  } catch (err) {
    console.error('Error fetching HR data:', err);
  }

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
    metrics.sleep_duration = Math.round(((sleepData as any).dailySleepDTO.sleepTimeSeconds || 0) / 60);
    metrics.sleep_score = (sleepData as any).dailySleepDTO.sleepScores?.overall?.value || null;
  }

  if (hrData) {
    metrics.resting_hr = (hrData as any).restingHeartRate;
  }

  if (stepsData) {
    metrics.steps = stepsData;
  }

  // we can mock calories if it's missing, or just leave it null
  metrics.calories_total = 0; 

  if (weightData && (weightData as any).totalAverage) {
    metrics.weight_kg = (weightData as any).totalAverage.weight / 1000;
  }

  return metrics;
}
