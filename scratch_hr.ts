import garminConnect from 'garmin-connect';
const { GarminConnect } = garminConnect;
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function main() {
  const gcClient = new GarminConnect();
  await gcClient.login(process.env.GARMIN_EMAIL!, process.env.GARMIN_PASSWORD!);
  const hr = await gcClient.getHeartRate(new Date());
  fs.writeFileSync('hr_data.json', JSON.stringify(hr, null, 2));
  console.log('Saved hr_data.json');
}
main().catch(console.error);
