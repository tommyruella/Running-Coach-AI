import { supabaseAdmin } from './server/supabaseClient.js';

async function check() {
  const { data, error } = await supabaseAdmin.from('daily_metrics').select('*').order('date', { ascending: false }).limit(5);
  console.log(data);
}
check();
