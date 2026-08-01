import 'dotenv/config';
import { syncGarminMetrics } from './server/garminClient.js';
import { saveDailyMetrics } from './server/db.js';

async function backfill() {
  const email = process.env.GARMIN_EMAIL!;
  const password = process.env.GARMIN_PASSWORD!;
  
  if (!email || !password) {
    console.error('Missing GARMIN_EMAIL or GARMIN_PASSWORD');
    return;
  }

  // Fetch last 7 days
  for (let i = 0; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    console.log(`Backfilling for ${d.toISOString().split('T')[0]}...`);
    try {
      const metrics = await syncGarminMetrics(email, password, d);
      await saveDailyMetrics([metrics]);
      // Small delay to avoid rate limit
      await new Promise(r => setTimeout(r, 2000));
    } catch (err: any) {
      console.error(`Error for ${d.toISOString().split('T')[0]}:`, err.message);
    }
  }
  console.log('Backfill complete!');
}

backfill();
