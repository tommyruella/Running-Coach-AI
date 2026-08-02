import dotenv from 'dotenv';
dotenv.config();
import { supabaseAdmin } from './server/supabaseClient.js';
async function run() {
  const { data, error } = await supabaseAdmin.from('daily_metrics').select('date, sleep_duration').order('date', {ascending: false}).limit(5);
  console.log(data);
}
run();
