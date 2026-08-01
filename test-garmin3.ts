import 'dotenv/config';
import garminConnectPkg from 'garmin-connect';
const { GarminConnect } = garminConnectPkg;

async function test() {
  const email = process.env.GARMIN_EMAIL!;
  const password = process.env.GARMIN_PASSWORD!;
  const gc = new GarminConnect({ username: email, password });
  await gc.login(email, password);

  const profile = await gc.getUserProfile();
  console.log('Profile:', profile);

  try {
    const summary = await gc.get(`https://connect.garmin.com/usersummary-service/usersummary/daily/${profile.displayName}?calendarDate=2026-07-24`);
    console.log('Summary keys:', Object.keys(summary));
    console.log('Summary:', summary);
  } catch (e: any) {
    console.error('Summary error:', e.message);
  }
}
test();
