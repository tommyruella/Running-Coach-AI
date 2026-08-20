import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { parseTcx } from '../server/tcxParser.js';
import { saveActivities } from '../server/db.js';

async function importTcxFiles() {
  const tcxDir = path.join(process.cwd(), 'tcx');
  if (!fs.existsSync(tcxDir)) {
    console.log("No tcx directory found.");
    return;
  }

  const files = fs.readdirSync(tcxDir).filter(f => f.endsWith('.tcx'));
  if (files.length === 0) {
    console.log("No .tcx files found.");
    return;
  }

  console.log(`Found ${files.length} .tcx files. Parsing...`);
  const activities = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(tcxDir, file), 'utf-8');
      const activity = parseTcx(content);
      activities.push(activity);
    } catch (err) {
      console.error(`Error parsing ${file}:`, err);
    }
  }

  console.log(`Successfully parsed ${activities.length} activities.`);
  
  if (activities.length > 0) {
    console.log("Saving to Supabase in batches of 5...");
    const batchSize = 5;
    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = activities.slice(i, i + batchSize);
      console.log(`Saving batch ${i / batchSize + 1}/${Math.ceil(activities.length / batchSize)}...`);
      await saveActivities(batch);
    }
    console.log("Done!");
  }
}

importTcxFiles().catch(console.error);
