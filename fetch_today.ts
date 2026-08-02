import dotenv from 'dotenv';
dotenv.config();
import garminConnectPkg from 'garmin-connect';
const { GarminConnect } = garminConnectPkg;

async function main() {
  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;
  const gcClient = new GarminConnect({ username: email, password });
  await gcClient.login(email, password);
  
  const today = new Date();
  const sleepData = await gcClient.getSleepData(today);
  console.log(JSON.stringify(sleepData, null, 2));
}

main().catch(console.error);
