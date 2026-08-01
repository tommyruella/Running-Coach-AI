import dotenv from 'dotenv';
import path from 'path';
import { syncGarminMetrics } from './server/garminClient.js';
import { saveDailyMetrics } from './server/db.js';
import garminConnectPkg from 'garmin-connect';
const { GarminConnect } = garminConnectPkg;

// Carica variabili d'ambiente
dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function runBackfill() {
  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;

  if (!email || !password) {
    console.error('Errore: Credenziali Garmin (GARMIN_EMAIL, GARMIN_PASSWORD) non trovate.');
    process.exit(1);
  }

  // Definiamo il range: dal 1° Gennaio 2026 fino a ieri
  const startDate = new Date('2026-01-01T00:00:00Z');
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1); // Fino a ieri
  
  // Ottieni i giorni già presenti nel database per evitare di scaricarli di nuovo
  const { supabaseAdmin } = await import('./server/supabaseClient.js');
  const { data: existingData } = await supabaseAdmin.from('daily_metrics').select('date');
  const existingDates = new Set((existingData || []).map(d => d.date));
  
  console.log(`Trovati ${existingDates.size} giorni già nel database. Verranno saltati.`);
  console.log(`Inizio estrazione storica Garmin da ${startDate.toISOString().split('T')[0]} a ${endDate.toISOString().split('T')[0]}...`);

  const gcClient = new GarminConnect({ username: email, password });
  await gcClient.login(email, password);
  console.log('Login iniziale a Garmin completato!');

  let currentDate = new Date(startDate);
  let metricsBatch: any[] = [];
  const BATCH_SIZE = 7; 
  
  let successCount = 0;
  let failCount = 0;

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    
    if (existingDates.has(dateStr)) {
      console.log(`[${dateStr}] Già presente, salto...`);
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    console.log(`[${dateStr}] Estrazione in corso...`);
    
    try {
      const metrics = await syncGarminMetrics(email, password, currentDate, gcClient);
      metricsBatch.push(metrics);
      successCount++;
    } catch (err: any) {
      console.error(`[${dateStr}] Errore critico in syncGarminMetrics:`, err.message);
      failCount++;
    }

    // Se nelle metriche o nei log notiamo che i dati sono tutti null, 
    // o se sappiamo che c'è stato un rate limit interno a garminClient, 
    // potremmo fare una pausa più lunga. Per sicurezza, aumentiamo il delay a 7 secondi.
    let delay = 7000; 

    // Verifica se l'ultimo fetch ha causato 429 loggato in console (intercettato da garminClient.ts)
    // Non possiamo leggerlo facilmente se garminClient.ts lo catcha, quindi semplicemente 
    // mettiamo un delay generoso di 7-10 secondi tra i giorni. Se serve, faremo una pausa enorme ogni 20 giorni.
    if (successCount > 0 && successCount % 20 === 0) {
       console.log("Pausa lunga di 30 secondi ogni 20 giorni per evitare ban di Cloudflare...");
       delay = 30000;
    }

    // Salva a blocchi su Supabase
    if (metricsBatch.length >= BATCH_SIZE) {
      console.log(`Salvataggio di ${metricsBatch.length} giorni su Supabase...`);
      await saveDailyMetrics(metricsBatch);
      metricsBatch = [];
    }

    // Avanza di un giorno
    currentDate.setDate(currentDate.getDate() + 1);
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Salva l'eventuale rimanenza
  if (metricsBatch.length > 0) {
    console.log(`Salvataggio degli ultimi ${metricsBatch.length} giorni su Supabase...`);
    await saveDailyMetrics(metricsBatch);
  }

  console.log('🎉 Estrazione Storica Completata!');
  console.log(`Giorni estratti con successo: ${successCount}`);
  console.log(`Giorni falliti: ${failCount}`);
}

runBackfill().catch(console.error);
