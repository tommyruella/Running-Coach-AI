import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'dummy-key',
  httpOptions: {
    baseUrl: 'https://generativelanguage.googleapis.com',
    headers: {
      'User-Agent': 'aistudio-build'
    }
  }
});

async function test() {
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
    });
    console.log('Success:', result.text);
  } catch (e: any) {
    console.error('Error:', e.message || e);
  }
}
test();
