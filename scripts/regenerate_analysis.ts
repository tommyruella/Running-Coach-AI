import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { generateHealthSectionAnalysis } from '/Users/tommy/antigravity/Running-Coach-AI/src/utils/healthAiEngine.ts';

dotenv.config({ path: '/Users/tommy/antigravity/Running-Coach-AI/.env' });

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

async function run() {
  console.log("Fetching all daily metrics...");
  const { data: metrics, error } = await supabaseAdmin.from('daily_metrics').select('*').order('date', { ascending: true });
  
  if (error || !metrics) {
    console.error("Failed to fetch metrics", error);
    return;
  }
  
  console.log(`Found ${metrics.length} metrics. Regenerating analysis...`);
  
  for (let i = 0; i < metrics.length; i++) {
    const current = metrics[i];
    // History is the metrics before current, ordered from most recent to oldest (so we reverse the slice)
    const history = metrics.slice(0, i).reverse();
    
    const generated = generateHealthSectionAnalysis(current, history);
    
    const dbRecord = {
      date: current.date,
      overall_trend: generated.overall.trendStatus,
      overall_insight: generated.overall.insightText,
      sleep_trend: generated.sleep.trendStatus,
      sleep_insight: generated.sleep.insightText,
      cardio_trend: generated.cardio.trendStatus,
      cardio_insight: generated.cardio.insightText,
      activity_trend: generated.activity.trendStatus,
      activity_insight: generated.activity.insightText,
      body_trend: generated.body.trendStatus,
      body_insight: generated.body.insightText
    };
    
    const { error: saveErr } = await supabaseAdmin.from('daily_health_analysis').upsert(dbRecord, { onConflict: 'date' });
    
    if (saveErr) {
      console.error(`Error saving ${current.date}:`, saveErr.message);
    } else {
      console.log(`Successfully updated ${current.date}`);
    }
  }
  
  console.log("Done updating all analysis rows!");
}

run();
