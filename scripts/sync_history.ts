async function run() {
  const startDate = new Date('2026-01-01T12:00:00Z');
  const endDate = new Date();
  
  let currentDate = new Date(startDate);
  
  console.log("Starting historical sync from 01/01 to today via Local API (127.0.0.1)...");
  
  while (currentDate <= endDate) {
    const dateString = currentDate.toISOString().split('T')[0];
    console.log(`\n[${new Date().toISOString()}] Sending sync request for ${dateString}...`);
    
    try {
      // Use 127.0.0.1 instead of localhost to avoid Node 18 IPv6 resolution issues
      const response = await fetch('http://127.0.0.1:3000/api/garmin/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ date: dateString })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error(`[${new Date().toISOString()}] API Error for ${dateString}:`, data.error || data);
      } else {
        console.log(`[${new Date().toISOString()}] Successfully synced and saved ${dateString}.`);
      }
    } catch (e: any) {
      console.error(`[${new Date().toISOString()}] Network Error syncing ${dateString}:`, e.message);
    }
    
    // Increment day
    currentDate.setDate(currentDate.getDate() + 1);
    
    if (currentDate <= endDate) {
      console.log(`Waiting 5 minutes before next sync...`);
      await new Promise(r => setTimeout(r, 5 * 60 * 1000));
    }
  }
  
  console.log("Historical sync completed.");
}

run();
