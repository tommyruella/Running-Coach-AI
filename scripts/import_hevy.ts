import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import { saveHevySessions } from '../server/db.js';

async function importHevy() {
  const jsonPath = path.join(process.cwd(), 'data', 'hevy_sessions.json');
  if (!fs.existsSync(jsonPath)) {
    console.log("No hevy_sessions.json found.");
    return;
  }

  const content = fs.readFileSync(jsonPath, 'utf8');
  const sessions = JSON.parse(content);
  
  if (sessions.length > 0) {
    console.log(`Uploading ${sessions.length} Hevy sessions to Supabase...`);
    try {
      await saveHevySessions(sessions);
      console.log("Successfully uploaded!");
    } catch (err) {
      console.error("Error uploading to Supabase. Make sure the table 'hevy_sessions' exists.", err);
    }
  }
}

importHevy().catch(console.error);
