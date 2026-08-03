import dotenv from 'dotenv';
dotenv.config();
import garminConnectPkg from 'garmin-connect';
const { GarminConnect } = garminConnectPkg;

async function testStressAPI() {
  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;
  
  if (!email || !password) return;

  const gcClient = new GarminConnect({ username: email, password });
  await gcClient.login(email, password);
  
  const dateStr = new Date().toLocaleDateString('en-CA');
  console.log("Fetching for date:", dateStr);

  try {
    const stressUrl = `https://connect.garmin.com/wellness-service/wellness/dailyStress/${dateStr}`;
    console.log("Hitting URL:", stressUrl);
    const stressData = await gcClient.get(stressUrl);
    console.log("Response:", JSON.stringify(stressData).substring(0, 500));
  } catch (err: any) {
    console.error("Error fetching stress:", err.message);
  }
}

testStressAPI().catch(console.error);
