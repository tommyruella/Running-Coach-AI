/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Lap {
  lapIndex: number;
  distanceKm: number;
  durationSec: number;
  calories: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  maxSpeedKmh?: number;
  avgSpeedKmh?: number;
  avgCadence?: number;
}

export interface Trackpoint {
  time: string;
  latitude?: number;
  longitude?: number;
  altitudeMeters?: number;
  distanceMeters?: number;
  heartRate?: number;
  cadence?: number;
  speedKmh?: number;
  pace?: string;
}

export interface Activity {
  id: string; // ISO String or custom ID
  sport: string; // e.g. "Running", "Biking"
  name: string; // Custom name given by user or default
  date: string; // ISO Timestamp
  distanceKm: number;
  durationMin: number;
  calories: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgCadence?: number;
  maxCadence?: number;
  avgSpeedKmh?: number;
  maxSpeedKmh?: number;
  avgPace: string; // Format "MM:SS" (min/km)
  deviceBrand?: string; // Garmin, Apple, Polaris, etc.
  deviceModel?: string; // e.g. Forerunner 945
  laps?: Lap[];
  notes?: string;
  trackpoints?: Trackpoint[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  modelUsed?: string; // "Groq" or "Premium"
  isPlan?: boolean; // If it's a generated weekly training plan
}

export interface RunningStats {
  totalActivities: number;
  totalKm: number;
  totalDurationHours: number;
  avgPace: string; // Format "MM:SS"
  avgHr: number;
}
