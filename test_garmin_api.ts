import dotenv from 'dotenv';
dotenv.config();
import garminConnectPkg from 'garmin-connect';
const { GarminConnect } = garminConnectPkg;

async function testGarminAPI() {
  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;
  
  if (!email || !password) return;

  const gcClient = new GarminConnect({ username: email, password });
  
  try {
    console.log("Logging in...");
    await gcClient.login(email, password);
    console.log("Logged in!");
    
    // Fetch user profile to get displayName
    const profile = await gcClient.getUserProfile();
    const displayName = profile.displayName;
    
    const dateStr = new Date(Date.now() - 86400000 * 2).toLocaleDateString('en-CA'); // 2 days ago
    console.log("Fetching for date:", dateStr);

    // 1. Daily Summary (Distance, Calories)
    const summaryUrl = `https://connect.garmin.com/usersummary-service/usersummary/daily/${displayName}?calendarDate=${dateStr}`;
    const summary = await gcClient.get(summaryUrl);
    console.log("Summary Keys:", Object.keys(summary));
    console.log("Total Distance:", (summary as any).totalDistanceMeters);
    console.log("Total Calories:", (summary as any).totalKilocalories);
    console.log("Active Calories:", (summary as any).activeKilocalories);
    console.log("BMR Calories:", (summary as any).bmrKilocalories);

    // 2. Activities (Check for running)
    const activities = await gcClient.getActivities(0, 10);
    const runActivities = activities.filter(a => a.activityType.typeKey === 'running');
    console.log("Recent Runs:", runActivities.map(a => ({ name: a.activityName, distance: a.distance, date: a.startTimeLocal })));

  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

testGarminAPI().catch(console.error);
