import 'dotenv/config';
import { syncGarminMetrics } from './server/garminClient.js';
import { saveDailyMetrics } from './server/db.js';

async function test() {
  const email = process.env.GARMIN_EMAIL!;
  const password = process.env.GARMIN_PASSWORD!;
  const d = new Date();
  console.log(`Syncing for ${d.toLocaleDateString('en-CA')}...`);
  try {
    const metrics = await syncGarminMetrics(email, password, d);
    await saveDailyMetrics([metrics]);
    console.log('Sync complete!');
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}
test();
