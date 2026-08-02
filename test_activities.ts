import dotenv from 'dotenv';
dotenv.config();
import { getActivities } from './server/db.js';

async function run() {
  try {
    const activities = await getActivities();
    console.log('Activities count:', activities.length);
    if (activities.length > 0) {
      console.log('First activity:', JSON.stringify(activities[0], null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  }
}
run();
