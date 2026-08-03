import dotenv from 'dotenv';
dotenv.config();
import { supabaseAdmin } from './server/supabaseClient.js';
import { getDailyMetrics } from './server/db.js';

async function test() {
  console.log("Fetching daily metrics...");
  const metrics = await getDailyMetrics();
  
  if (metrics.length === 0) {
    console.log("No metrics found.");
    return;
  }
  
  const m = metrics[0];
  console.log("Most recent metric date:", m.date);
  console.log("Has hr_timeline?", !!m.hr_timeline);
  if (m.hr_timeline) {
    console.log("hr_timeline length:", m.hr_timeline.length);
  }

  console.log("\nAttempting a dummy update to see if hr_timeline is the issue...");
  
  const dummyMetrics = {
    date: '2000-01-01',
    hr_timeline: [{ time: '2000-01-01T12:00:00Z', hr: 60 }]
  };

  const { error } = await supabaseAdmin
    .from('daily_metrics')
    .upsert([dummyMetrics], { onConflict: 'date' });
    
  if (error) {
    console.error("Upsert failed with error:", error);
  } else {
    console.log("Upsert succeeded! hr_timeline column exists and accepts data.");
    
    // Clean up
    await supabaseAdmin.from('daily_metrics').delete().eq('date', '2000-01-01');
  }
}

test().catch(console.error);
