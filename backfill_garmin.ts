import dotenv from 'dotenv';
dotenv.config();
import { syncGarminMetrics } from './server/garminClient.js';
import { saveDailyMetrics } from './server/db.js';

async function backfillGarmin() {
  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;
  
  if (!email || !password) {
    console.error("Missing GARMIN_EMAIL or GARMIN_PASSWORD");
    return;
  }

  // Backfill just today and yesterday to fix the missing data
  const daysToBackfill = 1;
  const metricsToSave = [];

  for (let i = 0; i <= daysToBackfill; i++) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - i);
    const dateStr = targetDate.toLocaleDateString('en-CA');
    
    console.log(`\nFetching Garmin metrics for ${dateStr} ...`);
    try {
      const metrics = await syncGarminMetrics(email, password, targetDate);
      console.log(`- Success! (HR entries: ${metrics.hr_timeline?.length || 0})`);
      metricsToSave.push(metrics);
    } catch (err) {
      console.error(`- Error for ${dateStr}:`, err);
    }
  }

  if (metricsToSave.length > 0) {
    console.log(`\nSaving ${metricsToSave.length} days of metrics to Supabase...`);
    await saveDailyMetrics(metricsToSave);
    console.log("Backfill complete!");
  }
}

backfillGarmin().catch(console.error);
