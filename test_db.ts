import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('daily_metrics').select('*').order('date', { ascending: false });
  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
}
test();
