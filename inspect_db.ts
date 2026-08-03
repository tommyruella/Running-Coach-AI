import dotenv from 'dotenv';
dotenv.config();
import { getDailyMetrics } from './server/db.js';

async function test() {
  const metrics = await getDailyMetrics();
  for (const m of metrics) {
    console.log(`${m.date} - HR entries: ${m.hr_timeline ? m.hr_timeline.length : 0}`);
  }
}
test().catch(console.error);
