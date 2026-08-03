import dotenv from 'dotenv';
dotenv.config();
import { syncGarminMetrics } from './server/garminClient.js';
import { saveDailyMetrics } from './server/db.js';

async function testSync() {
  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;
  
  if (!email || !password) {
    console.error("Missing GARMIN_EMAIL or GARMIN_PASSWORD");
    return;
  }

  console.log("Starting Garmin extraction for today...");
  const metrics = await syncGarminMetrics(email, password, new Date());
  
  console.log("Extracted Metrics:");
  console.log("- Sleep Duration:", metrics.sleep_duration);
  console.log("- Custom Sleep Score:", metrics.sleep_score);
  console.log("- Stress Level:", metrics.stress_level);
  console.log("- Body Battery Change:", metrics.body_battery_change);
  console.log("- Weight:", metrics.weight_kg);

  console.log("\nSaving to Supabase...");
  await saveDailyMetrics([metrics]);
  console.log("Save complete!");
}

testSync().catch(console.error);
