/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import multer from 'multer';
import dotenv from 'dotenv';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { parseTcx } from './server/tcxParser.js';
import {
  getActivities,
  saveActivities,
  deleteActivity,
  renameActivity,
  getChatHistory,
  saveChatHistory,
  clearChatHistory,
  getTrainingPlans,
  saveTrainingPlan,
  initializeDb,
  TCX_DIR,
  fetchWeather,
  getCoachSettings,
  saveCoachSettings,
  getWeeklyPlans,
  saveWeeklyPlans
} from './server/db.js';
import { supabaseAdmin } from './server/supabaseClient.js';
import { ChatMessage, Activity } from './src/types.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Setup JSON parsing
app.use(express.json());
app.use('/images', express.static(path.join(process.cwd(), 'images')));

// Setup Multer memory storage for uploads
const storage = multer.memoryStorage();
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // Max 10MB
});

// Initialize Gemini SDK with telemetry headers
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'dummy-key',
  httpOptions: {
    baseUrl: 'https://generativelanguage.googleapis.com',
    headers: {
      'User-Agent': 'aistudio-build'
    }
  }
});

// Italian Running Coach System Instruction
const COACH_SYSTEM_PROMPT = `Sei un allenatore di corsa professionista italiano ed esperto di fisiologia dell'atleta.
Comunichi in modo molto motivante, amichevole ma tecnico e preciso.
Conosci a fondo concetti come Soglia Anaerobica (Lactate Threshold), VO2Max, battiti cardiaci (Zone di frequenza cardiaca Z1-Z5), cadenza ottimale (target ~180 passi al minuto), andatura (ritmo al km) e l'importanza del recupero attivo.

Rispondi sempre in italiano usando un tono incoraggiante e professionale.
Quando l'utente ti chiede un piano settimanale (scrivendo parole chiave come "piano", "settimana", "programma", "allenamento"), rispondi SEMPRE strutturando un piano chiaro di 7 giorni inserito all'interno di una tabella markdown. Includi distanze indicative, zone cardio consigliate e lo scopo di ogni allenamento (es. Fondo Lento, Ripetute, Progressivo, Recupero).`;

/**
 * 1. API: Get Stats
 */
app.get('/api/stats', async (req, res) => {
  try {
    const activities = await getActivities();
    const totalActivities = activities.length;

    let totalKm = 0;
    let totalDurationMin = 0;
    let hrSum = 0;
    let hrCount = 0;
    let paceSecondsSum = 0;
    let paceCount = 0;

    activities.forEach((act) => {
      totalKm += act.distanceKm;
      totalDurationMin += act.durationMin;

      if (act.avgHeartRate) {
        hrSum += act.avgHeartRate;
        hrCount++;
      }

      // Parse pace MM:SS
      if (act.avgPace && act.avgPace.includes(':')) {
        const [min, sec] = act.avgPace.split(':').map(Number);
        if (!isNaN(min) && !isNaN(sec)) {
          const totalSec = min * 60 + sec;
          // Weighted by distance for accuracy
          paceSecondsSum += totalSec * act.distanceKm;
          paceCount += act.distanceKm;
        }
      }
    });

    // Calculate average pace
    let avgPaceStr = '--:--';
    if (paceCount > 0) {
      const avgPaceSec = paceSecondsSum / paceCount;
      const min = Math.floor(avgPaceSec / 60);
      const sec = Math.round(avgPaceSec % 60);
      avgPaceStr = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }

    res.json({
      totalActivities,
      totalKm: parseFloat(totalKm.toFixed(1)),
      totalDurationHours: parseFloat((totalDurationMin / 60).toFixed(1)),
      avgPace: avgPaceStr,
      avgHr: hrCount > 0 ? Math.round(hrSum / hrCount) : 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 2. API: Get Activities
 */
app.get('/api/activities', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string || '50', 10);
    const activities = await getActivities();
    // Sort activities by date descending
    const sorted = [...activities].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json({ activities: sorted.slice(0, limit) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Delete Activity
app.delete('/api/activities/:id', async (req, res) => {
  try {
    await deleteActivity(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Rename Activity
app.put('/api/activities/:id', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    await renameActivity(req.params.id, name);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload-tcx', upload.any(), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const newActivities: Activity[] = [];

    for (const file of files) {
      try {
        const fileContent = file.buffer.toString('utf8');
        if (!fileContent.includes('<TrainingCenterDatabase')) {
          failedCount++;
          errors.push(`${file.originalname}: Il file caricato non sembra un file TCX valido.`);
          continue;
        }

        // Upload physical TCX file to Supabase Storage
        const randStr = Math.random().toString(36).substring(2, 8);
        const filename = `uploaded_${Date.now()}_${randStr}.tcx`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from('tcx_files')
          .upload(filename, file.buffer, { contentType: 'application/xml', upsert: true });

        if (uploadError) {
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        // Parse TCX in memory
        const act = parseTcx(fileContent);
        
        // Fetch weather
        const firstTp = act.trackpoints?.find(tp => tp.latitude !== undefined && tp.longitude !== undefined);
        const formattedTime = new Date(act.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        
        let weatherSummary = '';
        if (firstTp && firstTp.latitude !== undefined && firstTp.longitude !== undefined) {
          const weatherInfo = await fetchWeather(firstTp.latitude, firstTp.longitude, act.date);
          if (weatherInfo) {
            weatherSummary = ` | ${weatherInfo}`;
          }
        }
        
        const originalNotes = act.notes || `File TCX caricato correttamente. Rilevati ${act.laps?.length || 0} giri.`;
        act.notes = `[Partenza ore ${formattedTime}${weatherSummary}]\n\n${originalNotes}`;

        newActivities.push(act);
        successCount++;
      } catch (err: any) {
        failedCount++;
        errors.push(`${file.originalname}: ${err.message}`);
      }
    }

    if (successCount === 0) {
      return res.status(400).json({ 
        error: 'Nessun file TCX valido è stato caricato.', 
        errors 
      });
    }

    // Save parsed activities to Supabase DB
    await saveActivities(newActivities);

    // Find the newly added activity
    const sorted = [...newActivities].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const newActivity = sorted[0];

    res.json({
      success: true,
      successCount,
      failedCount,
      errors,
      activity: newActivity,
    });
  } catch (error: any) {
    console.error('Error parsing TCX batch:', error);
    res.status(500).json({ error: `Impossibile analizzare il file TCX: ${error.message}` });
  }
});

/**
 * 4. API: Get Chat History
 */
app.get('/api/chat-history', async (req, res) => {
  try {
    const history = await getChatHistory();
    res.json({ history });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 5. API: Clear Chat History
 */
app.post('/api/chat-clear', async (req, res) => {
  try {
    await clearChatHistory();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 6. API: AI Chat Handler (Groq / Premium / Gemini fallback)
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { message, forcePremium } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Messaggio vuoto' });
    }

    // Load full history for context
    const chatHistory = await getChatHistory();

    // Check if the message requests a training plan
    const planKeywords = ['piano', 'settimana', 'programma', 'allenamento settimanale', 'tabella', 'maratona', 'mezza maratona', 'programmazione'];
    const lowerMessage = message.toLowerCase();
    const isPlanRequested = forcePremium || planKeywords.some(keyword => lowerMessage.includes(keyword));

    let assistantResponse = '';
    let modelUsed = '';

    // Choose LLM endpoint based on keys available or user request
    if (isPlanRequested) {
      // PREMIUM MODEL (User requests Premium or keyword triggers it)
      if (process.env.PREMIUM_API_KEY) {
        modelUsed = process.env.PREMIUM_MODEL || 'gpt-4-turbo';
        const apiBase = process.env.PREMIUM_API_BASE || 'https://api.openai.com/v1';
        
        try {
          const response = await fetch(`${apiBase}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.PREMIUM_API_KEY}`
            },
            body: JSON.stringify({
              model: modelUsed,
              messages: [
                { role: 'system', content: COACH_SYSTEM_PROMPT },
                ...chatHistory.map(m => ({
                  role: m.sender === 'user' ? 'user' : 'assistant',
                  content: m.text
                })),
                { role: 'user', content: message }
              ],
              temperature: 0.7
            })
          });
          const data: any = await response.json();
          assistantResponse = data.choices?.[0]?.message?.content || 'Errore nella risposta del modello premium.';
        } catch (apiErr: any) {
          console.error('Premium API Error, falling back to Gemini:', apiErr);
          assistantResponse = ''; // trigger fallback below
        }
      }

      // If no PREMIUM_API_KEY or call failed, fall back to Gemini
      if (!assistantResponse) {
        modelUsed = 'Gemini (Premium Fallback)';
        try {
          const contents = [
            ...chatHistory.map(m => ({
              role: m.sender === 'user' ? 'user' : 'model',
              parts: [{ text: m.text }]
            })),
            { role: 'user', parts: [{ text: message }] }
          ];

          const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: contents as any,
            config: {
              systemInstruction: COACH_SYSTEM_PROMPT,
              temperature: 0.7
            }
          });
          assistantResponse = response.text || 'Nessuna risposta generata.';
        } catch (geminiErr: any) {
          console.error('Gemini API Error:', geminiErr);
          assistantResponse = `Errore di connessione con l'AI: ${geminiErr.message}`;
        }
      }

    } else {
      // FAST MODEL (Groq requested)
      if (process.env.GROQ_API_KEY) {
        modelUsed = 'Groq (Llama 3)';
        try {
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: [
                { role: 'system', content: COACH_SYSTEM_PROMPT },
                ...chatHistory.map(m => ({
                  role: m.sender === 'user' ? 'user' : 'assistant',
                  content: m.text
                })),
                { role: 'user', content: message }
              ],
              temperature: 0.6
            })
          });
          const data: any = await response.json();
          assistantResponse = data.choices?.[0]?.message?.content || '';
        } catch (apiErr: any) {
          console.error('Groq API Error, falling back to Gemini:', apiErr);
          assistantResponse = ''; // trigger fallback below
        }
      }

      // Fall back to high-speed Gemini
      if (!assistantResponse) {
        modelUsed = 'Gemini (Fast Fallback)';
        try {
          const contents = [
            ...chatHistory.map(m => ({
              role: m.sender === 'user' ? 'user' : 'model',
              parts: [{ text: m.text }]
            })),
            { role: 'user', parts: [{ text: message }] }
          ];

          const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: contents as any,
            config: {
              systemInstruction: COACH_SYSTEM_PROMPT + '\nSii estremamente conciso e diretto, rispondi rapidamente.',
              temperature: 0.4
            }
          });
          assistantResponse = response.text || 'Nessuna risposta generata.';
        } catch (geminiErr: any) {
          console.error('Gemini API Error:', geminiErr);
          assistantResponse = `Errore di connessione con l'AI: ${geminiErr.message}`;
        }
      }
    }

    // Save conversation history
    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: message,
      timestamp: new Date().toISOString()
    };

    const assistantMsg: ChatMessage = {
      id: `ast_${Date.now()}`,
      sender: 'assistant',
      text: assistantResponse,
      timestamp: new Date().toISOString(),
      modelUsed,
      isPlan: isPlanRequested
    };

    chatHistory.push(userMsg, assistantMsg);
    await saveChatHistory(chatHistory);

    // If a plan was generated, save it in the training plans too
    if (isPlanRequested) {
      await saveTrainingPlan({
        timestamp: new Date().toISOString(),
        request: message,
        planMarkdown: assistantResponse
      });
    }

    res.json({
      user_message: userMsg,
      assistant_response: assistantMsg,
      is_plan: isPlanRequested
    });

  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});
/**
 * 7. API: AI Coach Routes
 */
app.get('/api/coach/settings', async (req, res) => {
  try {
    const settings = await getCoachSettings();
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/coach/settings', async (req, res) => {
  try {
    const { availableDays } = req.body;
    await saveCoachSettings({ availableDays });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/coach/plan', async (req, res) => {
  try {
    const plans = await getWeeklyPlans();
    // Return the latest plan if any exists
    if (plans.length > 0) {
      const sortedPlans = [...plans].sort((a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime());
      res.json(sortedPlans[0]);
    } else {
      res.json(null);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/coach/link-activity', async (req, res) => {
  try {
    const { plannedWorkoutId, activityId, completedManually } = req.body;
    
    const plans = await getWeeklyPlans();
    let updated = false;
    for (const plan of plans) {
      const workout = plan.workouts.find(w => w.id === plannedWorkoutId);
      if (workout) {
        if (completedManually) {
          workout.completedManually = true;
        }
        if (activityId) {
          workout.linkedActivityId = activityId;
        }
        updated = true;
        break;
      }
    }
    
    if (updated) {
      await saveWeeklyPlans(plans);
    }
    
    if (activityId && !completedManually) {
      const activities = await getActivities();
      const activity = activities.find(a => a.id === activityId);
      if (activity) {
        activity.plannedWorkoutId = plannedWorkoutId;
        // Upserting via Supabase helper since we imported saveActivities
        const { saveActivities } = await import('./server/db.js');
        await saveActivities([activity]); 
      }
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/coach/generate-plan', async (req, res) => {
  try {
    const { notes } = req.body;
    
    const settings = await getCoachSettings();
    const activities = await getActivities();
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentActivities = activities.filter(a => new Date(a.date) >= thirtyDaysAgo);
    
    let totalKm = 0;
    let paceSecondsSum = 0;
    let paceCount = 0;
    
    recentActivities.forEach(act => {
      totalKm += act.distanceKm;
      if (act.avgPace && act.avgPace.includes(':')) {
        const [min, sec] = act.avgPace.split(':').map(Number);
        if (!isNaN(min) && !isNaN(sec)) {
          paceSecondsSum += (min * 60 + sec) * act.distanceKm;
          paceCount += act.distanceKm;
        }
      }
    });
    
    let avgPaceStr = 'N/A';
    if (paceCount > 0) {
      const avgPaceSec = paceSecondsSum / paceCount;
      const min = Math.floor(avgPaceSec / 60);
      const sec = Math.round(avgPaceSec % 60);
      avgPaceStr = `${min}:${sec.toString().padStart(2, '0')}`;
    }
    
    const weeklyAvgKm = (totalKm / 4).toFixed(1);
    
    const plans = await getWeeklyPlans();
    const sortedPlans = [...plans].sort((a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime());
    const lastPlan = sortedPlans.length > 0 ? sortedPlans[0] : null;
    
    let lastWeekContext = "Questo è il primo piano generato dall'IA.";
    if (lastPlan) {
      lastWeekContext = "Il piano della settimana precedente era:\\n" + JSON.stringify(lastPlan.workouts.map(w => ({
        day: w.dayOfWeek,
        type: w.type,
        distance: w.targetDistanceKm,
        completed: w.completedManually || !!w.linkedActivityId
      })), null, 2);
    }

    const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const availableDaysInfo = settings.availableDays.map(d => `${dayNames[d]} (dayOfWeek: ${d})`).join(', ');

    const prompt = `
Sei un allenatore professionista di corsa. Devi generare il piano di allenamento per la prossima settimana.
Obiettivo dell'atleta: Mezza Maratona a Ottobre.
Passo gara target: 4:50 - 5:10 min/km (4 alto, 5 basso).

STATO ATTUALE DELL'ATLETA:
Negli ultimi 30 giorni ha corso in media ${weeklyAvgKm} km a settimana, con un passo medio di ${avgPaceStr} min/km.

GIORNI DISPONIBILI PER ALLENARSI QUESTA SETTIMANA:
L'utente può correre SOLO nei seguenti giorni: ${availableDaysInfo}.
IMPORTANTE: Per tutti gli altri giorni (i cui numeri dayOfWeek non sono in questo elenco), il "type" DEVE ESSERE RIGOROSAMENTE "Riposo" e "targetDistanceKm" deve essere null. Non proporre mai corsa in un giorno di Riposo.

CONTESTO SETTIMANA PRECEDENTE:
${lastWeekContext}

NOTE DELL'UTENTE PER QUESTA SETTIMANA:
${notes ? notes : 'Nessuna nota particolare.'}

DEVI RISPONDERE ESCLUSIVAMENTE CON UN OGGETTO JSON VALIDO. NESSUN TESTO EXTRA O BLOCCHI MARKDOWN.
La struttura JSON deve essere questa:
{
  "theme": "string, es. 'Costruzione Aerobica' o 'Settimana di Scarico'",
  "analysisFeedback": "string, massimo 3 frasi di feedback/analisi motivazionale",
  "workouts": [
    {
      "dayOfWeek": number, /* 0 per Dom, 1 per Lun... da 0 a 6 per tutti e 7 i giorni */
      "type": "string, es. 'Fondo Lento', 'Fartlek', 'Riposo'",
      "targetDistanceKm": "string, es. '8-10' o null",
      "targetHrZone": "string, es. 'Z2' o null",
      "description": "string, struttura schematica dei blocchi. Usa il carattere '|' per separare le fasi (es. 'Riscaldamento 2km | 5x1000m @ 4:30 | Defaticamento 1km'). Sii specifico su ritmi (min/km) e range BPM."
    }
  ]
}`;

    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    const weekStartDate = monday.toISOString().split('T')[0];

    const result = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    });

    const responseText = result.text || '{}';
    const generatedPlan = JSON.parse(responseText);

    const newPlan = {
      id: `plan_${Date.now()}`,
      weekStartDate,
      theme: generatedPlan.theme || 'Piano Settimanale',
      analysisFeedback: generatedPlan.analysisFeedback || '',
      workouts: (generatedPlan.workouts || []).map((w: any) => ({
        ...w,
        id: `w_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        completedManually: false
      }))
    };

    plans.push(newPlan);
    await saveWeeklyPlans(plans);

    res.json(newPlan);
  } catch (error: any) {
    console.error('Generation Error:', error);
    res.status(500).json({ error: error.message });
  }
});


// Express server & Vite Setup
async function startServer() {
  await initializeDb(); // Now safe, does nothing locally or on Vercel
  if (process.env.NODE_ENV !== 'production') {
    const viteModule = 'vite';
    const { createServer: createViteServer } = await import(/* @vite-ignore */ viteModule);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server Running Coach AI running on http://localhost:${PORT}`);
    });
  } else {
    // In production, Vercel handles static files.
    // If running as a standalone node app (not Vercel), uncomment below:
    // const distPath = path.join(process.cwd(), 'dist');
    // app.use(express.static(distPath));
    // app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
    // app.listen(PORT, '0.0.0.0', () => console.log('Server running on port ' + PORT));
  }
}

// Call startServer to initialize things if needed, but don't bind port in production on Vercel
startServer();

// EXPORT app for Vercel Serverless Functions!
export default app;
