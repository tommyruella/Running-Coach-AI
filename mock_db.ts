import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function injectMock() {
  const mockTimeline = [
    { startGMT: "2026-07-23T22:00:00.000Z", endGMT: "2026-07-23T22:30:00.000Z", activityLevel: 1 },
    { startGMT: "2026-07-23T22:30:00.000Z", endGMT: "2026-07-23T23:30:00.000Z", activityLevel: 0 },
    { startGMT: "2026-07-23T23:30:00.000Z", endGMT: "2026-07-24T00:30:00.000Z", activityLevel: 1 },
    { startGMT: "2026-07-24T00:30:00.000Z", endGMT: "2026-07-24T01:00:00.000Z", activityLevel: 2 },
    { startGMT: "2026-07-24T01:00:00.000Z", endGMT: "2026-07-24T01:10:00.000Z", activityLevel: 3 },
    { startGMT: "2026-07-24T01:10:00.000Z", endGMT: "2026-07-24T02:00:00.000Z", activityLevel: 0 },
    { startGMT: "2026-07-24T02:00:00.000Z", endGMT: "2026-07-24T04:00:00.000Z", activityLevel: 1 },
    { startGMT: "2026-07-24T04:00:00.000Z", endGMT: "2026-07-24T05:00:00.000Z", activityLevel: 2 },
    { startGMT: "2026-07-24T05:00:00.000Z", endGMT: "2026-07-24T06:00:00.000Z", activityLevel: 1 },
    { startGMT: "2026-07-24T06:00:00.000Z", endGMT: "2026-07-24T06:30:00.000Z", activityLevel: 3 }
  ];

  const dateStr = "2026-07-24";
  
  const { error } = await supabase.from('daily_metrics').update({
    sleep_timeline: mockTimeline,
    sleep_deep: 110,
    sleep_light: 270,
    sleep_rem: 90,
    sleep_awake: 40,
    weight_kg: 72.5,
    hrv_avg: 54,
    body_battery_change: 45
  }).eq('date', dateStr);

  if (error) {
    console.error('Error injecting mock:', error);
  } else {
    console.log('Mock data injected successfully for ' + dateStr);
  }
}

injectMock();
