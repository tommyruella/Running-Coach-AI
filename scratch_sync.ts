import dotenv from 'dotenv';
dotenv.config();
import { updateAllData } from './server.ts';

async function main() {
  console.log("Syncing...");
  await updateAllData(process.env.GARMIN_EMAIL!, process.env.GARMIN_PASSWORD!, 1);
  console.log("Done");
}
main().catch(console.error);
