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
  plannedWorkoutId?: string; // Link to AI Coach weekly plan workout
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

export interface PlannedWorkout {
  id: string;
  dayOfWeek: number; // 0 = Domenica, 1 = Lunedì, ecc.
  type: string; // "Fondo Lento", "Fartlek", ecc.
  targetDistanceKm?: string; // Es. "10 - 12"
  targetHrZone?: string; // Es. "Z2"
  description: string;
  completedManually: boolean;
  linkedActivityId?: string; // ID dell'Activity reale se completata con GPS
}

export interface WeeklyPlan {
  id: string;
  weekStartDate: string; // "YYYY-MM-DD" del lunedì
  theme: string;
  analysisFeedback: string;
  tips?: string[];
  workouts: PlannedWorkout[];
}

export interface CoachSettings {
  availableDays: number[]; // Array of days, es. [1, 3, 5, 0] per Lun, Mer, Ven, Dom
}

export interface DailyMetrics {
  id?: string;
  date: string;
  sleep_duration?: number;
  sleep_score?: number;
  resting_hr?: number;
  weight_kg?: number;
  calories_total?: number;
  calories_active?: number;
  steps?: number;
  stress_level?: number;
}
