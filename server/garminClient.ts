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

  console.log(`Fetching Garmin metrics for ${dateStr} in parallel...`);

  const [sleepRes, hrRes, stepsRes, weightRes] = await Promise.allSettled([
    gcClient.getSleepData(dateObj),
    gcClient.getHeartRate(dateObj),
    gcClient.getSteps(dateObj),
    gcClient.getDailyWeightData(dateObj)
  ]);

  const sleepData = sleepRes.status === 'fulfilled' ? sleepRes.value : null;
  if (sleepRes.status === 'rejected') console.error('Error fetching sleep data:', sleepRes.reason);

  const hrData = hrRes.status === 'fulfilled' ? hrRes.value : null;
  if (hrRes.status === 'rejected') console.error('Error fetching HR data:', hrRes.reason);

  const stepsData = stepsRes.status === 'fulfilled' ? stepsRes.value : null;
  if (stepsRes.status === 'rejected') console.error('Error fetching steps data:', stepsRes.reason);

  const weightData = weightRes.status === 'fulfilled' ? weightRes.value : null;
  if (weightRes.status === 'rejected') console.error('Error fetching weight data:', weightRes.reason);

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

  if (hrData && hrData.heartRateValues) {
    metrics.hr_timeline = hrData.heartRateValues
      .map((entry: any) => {
        // Handle Garmin array format [timestamp, hr] or object {timestamp, heartrate}
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

  if (weightData && (weightData as any).totalAverage && (weightData as any).totalAverage.weight > 0) {
    metrics.weight_kg = (weightData as any).totalAverage.weight / 1000;
  }

  return metrics;
}
