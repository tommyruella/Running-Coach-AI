const { GarminConnect } = require('garmin-connect');
require('dotenv').config();
(async () => {
  const gcClient = new GarminConnect({ username: process.env.GARMIN_EMAIL, password: process.env.GARMIN_PASSWORD });
  await gcClient.login(process.env.GARMIN_EMAIL, process.env.GARMIN_PASSWORD);
  const dateObj = new Date('2026-08-01T12:00:00Z');
  
  const hrData = await gcClient.getHeartRate(dateObj);
  console.log('HR Keys:', Object.keys(hrData));
  if (hrData.heartRateValues) {
    console.log('HR sample:', hrData.heartRateValues[0]);
  }
  
  const sleepData = await gcClient.getSleepData(dateObj);
  console.log('Sleep Keys:', Object.keys(sleepData));
  if (sleepData.sleepLevels) {
    console.log('SleepLevels:', sleepData.sleepLevels.slice(0, 2));
  } else if (sleepData.sleepMovement) {
     console.log('SleepMovement:', sleepData.sleepMovement.slice(0, 2));
  }
})();
