import React, { useMemo, useState, useEffect } from 'react';
import { Heart, Zap, TrendingDown, TrendingUp, Moon, Activity, Flame, ChevronLeft, ChevronRight, ExternalLink, Sun, MapPin, Settings, X } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis,
  Tooltip,
  CartesianGrid,
  LineChart, Line,
  ComposedChart, Scatter, Legend
} from 'recharts';
import { MinimalTooltip, MiniChartCard } from './Dashboard';

interface HealthProps {
  dailyMetrics: any[];
  activities?: any[];
  onSelectActivity?: (activityId: string) => void;
  onSyncGarmin?: (dateStr?: string) => void;
}

interface DetailedWeatherData {
  tempMin: number;
  tempMax: number;
  humNight: number;
  humDay: number;
  desc: string;
  cityName: string;
}

const VACATION_MAPPING: Record<string, { lat: number; lon: number; name: string }> = {
  '2026-07-26': { lat: 40.8518, lon: 14.2681, name: 'Napoli' },
  '2026-07-27': { lat: 40.5507, lon: 14.2426, name: 'Capri' },
  '2026-07-28': { lat: 40.0747, lon: 15.6308, name: 'Sapri' },
  '2026-07-29': { lat: 40.0051, lon: 15.6811, name: 'Acquafredda' },
  '2026-07-30': { lat: 40.6340, lon: 14.6027, name: 'Amalfi-Sorrento' },
  '2026-07-31': { lat: 40.8518, lon: 14.2681, name: 'Napoli' },
};
const DEFAULT_LOCATION = { lat: 45.0069, lon: 7.8687, name: 'Riva presso Chieri' };

const tickStyle = { fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'monospace' };
const gridColor = 'var(--border-subtle)';

const formatSleepDuration = (mins: number | undefined | null) => {
  if (!mins) return '--';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${m}m`;
};

const getTrend = (key: string, currentVal: number | null | undefined, dailyMetrics: any[], selectedIndex: number, isLowerBetter = false, days = 7) => {
  if (currentVal == null || !dailyMetrics || dailyMetrics.length <= selectedIndex + 1) return null;
  const previousDays = dailyMetrics.slice(selectedIndex + 1, selectedIndex + 1 + days).filter(m => {
    const val = m[key as keyof typeof m];
    return val != null && (typeof val === 'number' ? val > 0 : true);
  });
  if (previousDays.length === 0) return null;
  const avg = previousDays.reduce((sum, m) => sum + (m[key as keyof typeof m] as number), 0) / previousDays.length;
  const diff = currentVal - avg;
  const percent = (diff / avg) * 100;
  const isGood = isLowerBetter ? diff <= 0 : diff >= 0;
  return { percent, isGood };
};

const calculateSleepScore = (metrics: any) => {
  if (!metrics || !metrics.sleep_duration) return null;

  const durationMin = metrics.sleep_duration;
  const deepMin = metrics.sleep_deep || 0;
  const remMin = metrics.sleep_rem || 0;
  const awakeMin = metrics.sleep_awake || 0;
  const stress = metrics.stress_level || 15;

  // 1. Duration Score (target: 450-540 min, exponential penalty for low duration)
  let durationScore = 0;
  if (durationMin >= 450 && durationMin <= 540) durationScore = 100;
  else if (durationMin > 540) durationScore = Math.max(0, 100 - (durationMin - 540) * 0.4);
  else durationScore = Math.max(0, Math.pow(durationMin / 450, 1.8) * 100);

  // 2. Deep Sleep Score (target: >= 15% of total)
  const deepPct = deepMin / durationMin;
  let deepScore = 0;
  if (deepPct >= 0.15) deepScore = 100;
  else deepScore = Math.max(0, Math.pow(deepPct / 0.15, 1.5) * 100);

  // 3. REM Sleep Score (target: >= 20% of total)
  const remPct = remMin / durationMin;
  let remScore = 0;
  if (remPct >= 0.20) remScore = 100;
  else remScore = Math.max(0, Math.pow(remPct / 0.20, 1.5) * 100);

  // 4. Stress Score
  let stressScore = 100;
  if (stress <= 15) stressScore = 100;
  else stressScore = Math.max(0, 100 - (stress - 15) * 2.2); 

  // 5. Awake Score
  let awakeScore = Math.max(0, 100 - (awakeMin / 10) * 15);

  // Base Weighted Score (Duration 40%, Deep 20%, REM 20%, Stress 10%, Awake 10%)
  let finalScore = (
    (durationScore * 0.40) +
    (deepScore * 0.20) +
    (remScore * 0.20) +
    (stressScore * 0.10) +
    (awakeScore * 0.10)
  );

  // Severe Compound Penalties
  if (durationMin < 360) finalScore *= 0.85; // Under 6 hours
  if (remPct < 0.05) finalScore *= 0.85;       // Almost no REM
  if (deepPct < 0.05) finalScore *= 0.85;      // Almost no Deep sleep

  finalScore = Math.min(100, Math.max(0, Math.round(finalScore)));

  let label = "Scarso";
  let color = "text-accent-rose";
  let hexColor = "#f43f5e";
  if (finalScore >= 88) { label = "Eccellente"; color = "text-accent-lime"; hexColor = "#a3e635"; }
  else if (finalScore >= 75) { label = "Buono"; color = "text-[#CCFF00]"; hexColor = "#CCFF00"; }
  else if (finalScore >= 60) { label = "Discreto"; color = "text-accent-amber"; hexColor = "#f59e0b"; }

  const breakdown = [];
  if (durationScore < 75) breakdown.push("Durata insufficiente");
  if (stressScore < 75) breakdown.push("Stress notturno elevato");
  if (deepScore < 75) breakdown.push("Carenza di Sonno Profondo");
  if (remScore < 75) breakdown.push("Carenza di Sonno REM");
  if (awakeScore < 75) breakdown.push("Risvegli frequenti");

  let breakdownText = breakdown.length > 0 ? "Fattori critici: " + breakdown.join(", ") : "Qualità del sonno bilanciata su tutti i fronti. Ottimo lavoro!";

  return { finalScore, label, color, hexColor, breakdownText };
};

export default function Health({ dailyMetrics = [], activities = [], onSelectActivity, onSyncGarmin }: HealthProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [correlationType, setCorrelationType] = useState<'rhr' | 'stress'>('rhr');
  const [weatherData, setWeatherData] = useState<DetailedWeatherData | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [customLocations, setCustomLocations] = useState<Record<string, { lat: number; lon: number; name: string }>>(() => {
    try {
      return JSON.parse(localStorage.getItem('customLocations') || '{}');
    } catch {
      return {};
    }
  });

  const [inputCity, setInputCity] = useState('');
  const [inputLat, setInputLat] = useState('');
  const [inputLon, setInputLon] = useState('');

  const currentMetrics = dailyMetrics[selectedIndex] || null;
  const [syncTargetDate, setSyncTargetDate] = useState<string>(() => currentMetrics?.date?.split('T')[0] || new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (currentMetrics?.date) {
      setSyncTargetDate(currentMetrics.date.split('T')[0]);
    }
  }, [currentMetrics?.date]);

  useEffect(() => {
    if (!currentMetrics?.date) return;
    const datePart = currentMetrics.date.split('T')[0];

    const fetchMeteo = async (lat: number, lon: number, cityName: string) => {
      try {
        let url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${datePart}&end_date=${datePart}&hourly=temperature_2m,relative_humidity_2m,weather_code`;
        let res = await fetch(url);
        if (!res.ok) {
          url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${datePart}&end_date=${datePart}&hourly=temperature_2m,relative_humidity_2m,weather_code`;
          res = await fetch(url);
        }
        if (!res.ok) return;
        const data = await res.json();
        if (data.hourly && data.hourly.temperature_2m && data.hourly.temperature_2m.length > 0) {
          const temps: number[] = data.hourly.temperature_2m;
          const humidities: number[] = data.hourly.relative_humidity_2m;

          // Night Hours (00:00 to 07:00) for sleep analysis
          const nightTemps = temps.slice(0, 7);
          const nightHums = humidities.slice(0, 7);
          const tempMin = nightTemps.length > 0 ? Math.min(...nightTemps) : Math.min(...temps);
          const humNight = nightHums.length > 0 ? Math.round(nightHums.reduce((a, b) => a + b, 0) / nightHums.length) : 50;

          // Day Hours (08:00 to 20:00) for workout analysis
          const dayTemps = temps.slice(8, 21);
          const dayHums = humidities.slice(8, 21);
          const tempMax = dayTemps.length > 0 ? Math.max(...dayTemps) : Math.max(...temps);
          const humDay = dayHums.length > 0 ? Math.round(dayHums.reduce((a, b) => a + b, 0) / dayHums.length) : 50;

          const weatherCode = data.hourly.weather_code[12] || data.hourly.weather_code[0] || 0;
          
          let desc = "Sereno";
          if (weatherCode > 0 && weatherCode <= 3) desc = "Nuvoloso";
          else if (weatherCode >= 51 && weatherCode <= 67) desc = "Pioggia";
          else if (weatherCode >= 80) desc = "Rovesci";
          
          setWeatherData({
            tempMin: Math.round(tempMin * 10) / 10,
            tempMax: Math.round(tempMax * 10) / 10,
            humNight,
            humDay,
            desc,
            cityName
          });
        }
      } catch (e) {
        console.error("Error fetching weather for health tab:", e);
      }
    };

    // Location priority cascade:
    // 1. Activity GPS Trackpoints (if available for this date)
    // 2. Custom User Overrides (saved in localStorage)
    // 3. Vacation Mapping (Napoli, Capri, Sapri, Acquafredda, Amalfi-Sorrento)
    // 4. Default Base Location (Riva presso Chieri)
    const activeWk = currentMetrics ? getWorkoutForDate(currentMetrics.date) : null;
    const gpsTrackpoint = activeWk?.trackpoints?.find(tp => tp.latitude != null && tp.longitude != null);

    if (gpsTrackpoint?.latitude != null && gpsTrackpoint?.longitude != null) {
      fetchMeteo(gpsTrackpoint.latitude, gpsTrackpoint.longitude, activeWk?.name || 'GPS Corsa');
    } else if (customLocations[datePart]) {
      const loc = customLocations[datePart];
      fetchMeteo(loc.lat, loc.lon, loc.name);
    } else if (VACATION_MAPPING[datePart]) {
      const loc = VACATION_MAPPING[datePart];
      fetchMeteo(loc.lat, loc.lon, loc.name);
    } else if (currentMetrics?.lat != null && currentMetrics?.lon != null) {
      fetchMeteo(currentMetrics.lat, currentMetrics.lon, 'Posizione Metrics');
    } else {
      fetchMeteo(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon, DEFAULT_LOCATION.name);
    }
  }, [currentMetrics?.date, activities, customLocations]);

  const getWorkoutForDate = (dateStr: string) => {
    if (!activities || activities.length === 0 || !dateStr) return null;
    const targetDate = new Date(dateStr).toLocaleDateString('en-CA');
    return activities.find(a => {
      const isRun = (a.sport || 'running').toLowerCase().includes('run');
      const actDate = new Date(a.date).toLocaleDateString('en-CA');
      return isRun && actDate === targetDate;
    }) || null;
  };

  const checkIfRanOnDate = (dateStr: string, metricsObj?: any) => {
    if (metricsObj?.ran_today) return true;
    return getWorkoutForDate(dateStr) != null;
  };

  const currentWorkout = currentMetrics ? getWorkoutForDate(currentMetrics.date) : null;

  const lastWeight = useMemo(() => {
    if (!dailyMetrics || dailyMetrics.length === 0) return null;
    for (let i = selectedIndex; i < dailyMetrics.length; i++) {
      if (dailyMetrics[i].weight_kg != null && dailyMetrics[i].weight_kg > 0) return dailyMetrics[i].weight_kg;
    }
    return null;
  }, [dailyMetrics, selectedIndex]);

  const sleepScoreData = useMemo(() => {
    if (currentMetrics) return calculateSleepScore(currentMetrics);
    return null;
  }, [currentMetrics]);

  const recoveryInsight = useMemo(() => {
    if (!dailyMetrics || dailyMetrics.length === 0) return null;
    
    // Calculate 7-day average RHR
    const rhr7 = dailyMetrics.slice(selectedIndex, selectedIndex + 7).filter(m => m.resting_hr).map(m => m.resting_hr as number);
    const avgRhr7 = rhr7.length > 0 ? rhr7.reduce((a, b) => a + b, 0) / rhr7.length : null;
    
    // Calculate 28-day baseline RHR
    const rhr28 = dailyMetrics.slice(selectedIndex, selectedIndex + 28).filter(m => m.resting_hr).map(m => m.resting_hr as number);
    const avgRhr28 = rhr28.length > 0 ? rhr28.reduce((a, b) => a + b, 0) / rhr28.length : null;

    // Calculate 7-day sleep score
    const sleep7 = dailyMetrics.slice(selectedIndex, selectedIndex + 7).filter(m => m.sleep_score).map(m => m.sleep_score as number);
    const avgSleep7 = sleep7.length > 0 ? sleep7.reduce((a, b) => a + b, 0) / sleep7.length : null;

    // Calculate 7-day total distance (km)
    const dist7 = dailyMetrics.slice(selectedIndex, selectedIndex + 7).reduce((acc, m) => acc + ((m.distance_m || 0) / 1000), 0);
    const runs7 = dailyMetrics.slice(selectedIndex, selectedIndex + 7).filter(m => checkIfRanOnDate(m.date, m)).length;

    if (!avgRhr7 || !avgRhr28) return null;

    const rhrDiff = avgRhr7 - avgRhr28;
    
    let status = 'Bilanciato';
    let color = 'text-accent-lime';
    let bg = 'bg-accent-lime/10';
    let border = 'border-accent-lime/20';
    let icon = Activity;
    let prescription = 'Stato di forma ottimale. Il corpo sta assorbendo bene il carico ed è pronto per sessioni ad alta intensità (Ripetute o Tempo Run Z4/Z5).';

    if (rhrDiff >= 3) {
      status = 'Affaticamento';
      color = 'text-accent-rose';
      bg = 'bg-accent-rose/10';
      border = 'border-accent-rose/20';
      icon = Flame;
      prescription = 'Fatica cardiovascolare in aumento (+3+ bpm su baseline). Evita lavori veloci oggi; limita a Corsa Lenta Z2 < 45 min o riposo attivo.';
    } else if (rhrDiff <= -2) {
      status = 'Picco di Forma';
      color = 'text-[#CCFF00]';
      bg = 'bg-[#CCFF00]/10';
      border = 'border-[#CCFF00]/20';
      icon = Zap;
      prescription = 'Eccellente supercompensazione (RHR in calo). Giornata ideale per test di ritmo o workout chiave a ritmo gara.';
    } else if (avgSleep7 && avgSleep7 < 65) {
      status = 'Recupero Carente';
      color = 'text-orange-400';
      bg = 'bg-orange-400/10';
      border = 'border-orange-400/20';
      icon = Moon;
      prescription = 'RHR nella norma ma debito di sonno settimanale. Limita il volume degli allenamenti e privilegia il riposo notturno.';
    }

    // Check workout effort on current date or yesterday
    const currentWk = currentMetrics ? getWorkoutForDate(currentMetrics.date) : null;
    const yesterdayDate = selectedIndex + 1 < dailyMetrics.length ? dailyMetrics[selectedIndex + 1].date : null;
    const yesterdayWk = yesterdayDate ? getWorkoutForDate(yesterdayDate) : null;

    const recentWk = currentWk || yesterdayWk;

    if (recentWk) {
      const isYesterday = !currentWk && yesterdayWk != null;
      const dayLabel = isYesterday ? 'ieri' : 'oggi';
      const km = recentWk.distanceKm || (recentWk.laps?.reduce((s: number, l: any) => s + l.distanceKm, 0)) || 0;
      const hr = recentWk.avgHeartRate || 0;
      const durationMin = recentWk.durationMin || 0;

      const isHighIntensity = hr >= 150 || durationMin >= 60 || km >= 12;

      if (isYesterday && isHighIntensity) {
        status = 'Recupero da Sforzo';
        color = 'text-amber-400';
        bg = 'bg-amber-400/10';
        border = 'border-amber-400/20';
        icon = Flame;
        prescription = `Fisiologico innalzamento dei battiti (+${rhrDiff > 0 ? rhrDiff.toFixed(1) : '0'} bpm) per l'impatto della corsa intensa di ieri (${km.toFixed(1)} km, FC ${hr} bpm, ~36h recupero). Consigliata sessione Z2 leggera o riposo.`;
      } else if (isYesterday) {
        prescription = `Carico allenamento di ieri (${km.toFixed(1)} km) assorbito positivamente. Parametri stabili; pronto per proseguire con il piano.`;
      } else if (!isYesterday && isHighIntensity) {
        prescription = `Workout intenso registrato oggi (${km.toFixed(1)} km, FC ${hr} bpm). Il battito a riposo notturno potrebbe risentirne temporaneamente; cura idratazione e riposo.`;
      }
    }

    // Factor weather into prescription if night heat or day heat is significant
    let finalPrescription = prescription;
    if (weatherData) {
      if (weatherData.tempMin >= 21 || weatherData.humNight >= 70) {
        finalPrescription += ` (Notte afosa a ${weatherData.cityName}: Min ${weatherData.tempMin}°C, ${weatherData.humNight}% umidità).`;
      } else if (weatherData.tempMax >= 26 || weatherData.humDay >= 70) {
        finalPrescription += ` (Caldo diurno a ${weatherData.cityName}: Max ${weatherData.tempMax}°C, ${weatherData.humDay}% umidità).`;
      }
    }

    // Factor steps anomaly into prescription
    const steps30 = dailyMetrics.slice(selectedIndex, selectedIndex + 30).filter(m => m.steps && m.steps > 0).map(m => m.steps as number);
    const avgSteps30 = steps30.length > 0 ? steps30.reduce((a, b) => a + b, 0) / steps30.length : null;
    const todaySteps = currentMetrics?.steps || 0;
    if (avgSteps30 && todaySteps > 0) {
      const stepsDeltaPct = ((todaySteps - avgSteps30) / avgSteps30) * 100;
      if (stepsDeltaPct >= 50) {
        finalPrescription += ` Attenzione: passi giornalieri molto elevati (${todaySteps.toLocaleString()} vs media ${Math.round(avgSteps30).toLocaleString()}, +${Math.round(stepsDeltaPct)}%) — carico extra non contabilizzato negli allenamenti.`;
      } else if (stepsDeltaPct <= -50) {
        finalPrescription += ` Giornata di scarso movimento (${todaySteps.toLocaleString()} passi, ${Math.round(Math.abs(stepsDeltaPct))}% sotto media) — recupero passivo registrato.`;
      }
    }

    // Factor stress level into prescription if high
    if (currentMetrics?.stress_level && currentMetrics.stress_level > 50) {
      finalPrescription += ` Stress giornaliero elevato (${currentMetrics.stress_level}/100) — può alterare RHR e qualità del sonno.`;
    }

    return {
      status,
      color,
      bg,
      border,
      icon,
      prescription: finalPrescription,
      weatherCity: weatherData ? weatherData.cityName : null,
      weatherNight: weatherData ? `${weatherData.tempMin}°C (${weatherData.humNight}%)` : null,
      weatherDay: weatherData ? `${weatherData.tempMax}°C (${weatherData.humDay}%)` : null,
      rhr7: avgRhr7.toFixed(1),
      rhr28: avgRhr28.toFixed(1),
      rhrDiff: (rhrDiff > 0 ? `+${rhrDiff.toFixed(1)}` : rhrDiff.toFixed(1)),
      sleep7: avgSleep7 ? Math.round(avgSleep7) : null,
      dist7: dist7.toFixed(1),
      runs7
    };
  }, [dailyMetrics, selectedIndex, activities, weatherData]);

  const handleSaveCustomLocation = () => {
    if (!currentMetrics?.date || !inputCity.trim()) return;
    const datePart = currentMetrics.date.split('T')[0];
    const lat = parseFloat(inputLat) || DEFAULT_LOCATION.lat;
    const lon = parseFloat(inputLon) || DEFAULT_LOCATION.lon;

    const updated = {
      ...customLocations,
      [datePart]: { lat, lon, name: inputCity.trim() }
    };
    setCustomLocations(updated);
    localStorage.setItem('customLocations', JSON.stringify(updated));
    setIsLocationModalOpen(false);
    setInputCity('');
    setInputLat('');
    setInputLon('');
  };

  return (
    <div className="space-y-6" id="health-tab">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-3xl font-bold text-primary tracking-tight flex items-center gap-3 select-none">
            <Heart className="h-8 w-8 text-accent-rose" />
            Salute
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Location & Weather Settings Button */}
          <button
            onClick={() => setIsLocationModalOpen(true)}
            className="px-3 py-2 bg-[var(--surface-popover)] border border-subtle rounded-md text-xs font-bold text-primary hover:bg-[var(--surface-inset)] transition-colors flex items-center gap-2 cursor-pointer shadow-sm font-mono"
            title="Clicca per modificare la posizione"
          >
            <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{weatherData?.cityName || 'Posizione'}</span>
            {weatherData && (
              <span className="text-[11px] text-secondary border-l border-subtle pl-2 flex items-center gap-1.5 font-normal">
                <span className="flex items-center gap-0.5 text-indigo-300">
                  <Moon className="w-3 h-3" />
                  {weatherData.tempMin}°C
                </span>
                <span className="flex items-center gap-0.5 text-amber-300">
                  <Sun className="w-3 h-3" />
                  {weatherData.tempMax}°C
                </span>
              </span>
            )}
          </button>

          {/* Clickable Allenamento Link to the LEFT of Date Selector */}
          {currentWorkout && (
            <button
              onClick={() => onSelectActivity && onSelectActivity(currentWorkout.id)}
              className="px-4 py-2 bg-[var(--surface-popover)] border border-subtle rounded-md text-xs font-bold text-primary hover:bg-[var(--surface-inset)] transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
              title="Clicca per aprire la scheda dettagliata dell'allenamento"
            >
              <Activity className="w-4 h-4 text-blue-400" />
              <span>Allenamento</span>
            </button>
          )}

          {dailyMetrics.length > 0 && (
            <div className="flex items-center bg-[var(--surface-popover)] border border-subtle rounded-md overflow-hidden">
              <button 
                onClick={() => setSelectedIndex(Math.min(dailyMetrics.length - 1, selectedIndex + 1))}
                disabled={selectedIndex >= dailyMetrics.length - 1}
                className="p-2 hover:bg-[var(--surface-inset)] disabled:opacity-20 text-secondary transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-2 py-1 text-xs font-bold text-primary font-mono min-w-[100px] text-center select-none">
                 {currentMetrics ? new Date(currentMetrics.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
              </div>
              <button 
                onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
                disabled={selectedIndex === 0}
                className="p-2 hover:bg-[var(--surface-inset)] disabled:opacity-20 text-secondary transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {currentMetrics ? (
        <div className="space-y-6">
          
          {/* RECOVERY INSIGHT BANNER */}
          {recoveryInsight && (
            <div className={`p-5 rounded-xl border ${recoveryInsight.bg} ${recoveryInsight.border} flex flex-col gap-3 transition-all duration-300 shadow-sm`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg bg-[var(--surface-base)] ${recoveryInsight.color} shadow-sm shrink-0`}>
                    <recoveryInsight.icon className="w-4 h-4" />
                  </div>
                  <span className={`text-xs font-black uppercase tracking-wider ${recoveryInsight.color}`}>
                    {recoveryInsight.status}
                  </span>
                </div>
                
                {/* Clean Specific Metric Badges */}
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-secondary">
                  <span className="bg-[var(--surface-base)] px-2.5 py-1 rounded-md border border-subtle flex items-center gap-1">
                    <span className="text-muted">RHR 7g:</span>
                    <strong className="text-primary">{recoveryInsight.rhr7} bpm</strong>
                    <span className={`text-[10px] ${parseFloat(recoveryInsight.rhrDiff) > 0 ? 'text-accent-rose' : 'text-accent-lime'}`}>({recoveryInsight.rhrDiff})</span>
                  </span>
                  <span className="bg-[var(--surface-base)] px-2.5 py-1 rounded-md border border-subtle flex items-center gap-1">
                    <span className="text-muted">Baseline 28g:</span>
                    <strong className="text-primary">{recoveryInsight.rhr28} bpm</strong>
                  </span>
                  {recoveryInsight.sleep7 && (
                    <span className="bg-[var(--surface-base)] px-2.5 py-1 rounded-md border border-subtle flex items-center gap-1">
                      <span className="text-muted">Sonno 7g:</span>
                      <strong className="text-primary">{recoveryInsight.sleep7}/100</strong>
                    </span>
                  )}
                  {parseFloat(recoveryInsight.dist7) > 0 && (
                    <span className="bg-[var(--surface-base)] px-2.5 py-1 rounded-md border border-subtle flex items-center gap-1">
                      <span className="text-muted">Vol. 7g:</span>
                      <strong className="text-primary">{recoveryInsight.dist7} km</strong>
                      <span className="text-muted">({recoveryInsight.runs7} run)</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Actionable Training & Effort Synthesis */}
              <div className="text-xs text-primary font-medium leading-relaxed border-t border-subtle pt-2.5 flex items-start gap-2">
                <span className="font-bold text-secondary shrink-0 uppercase tracking-wider text-[10px] mt-0.5">Analisi & Indicazione:</span>
                <span>{recoveryInsight.prescription}</span>
              </div>
            </div>
          )}

          {/* HERO SECTION */}
          <div className="flex flex-col lg:flex-row gap-6 items-stretch">
            {/* Left Hero: Sleep Score */}
            <div className="flex-1 clean-panel p-6 flex flex-col justify-center items-center relative overflow-hidden">
              <h2 className="absolute top-6 left-6 text-secondary font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <Moon className="h-3.5 w-3.5 text-indigo-400" />
                Qualità del Sonno
              </h2>
              
              {sleepScoreData ? (
                <>
                  <div className="relative w-40 h-40 sm:w-48 sm:h-48 flex items-center justify-center mt-6">
                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" stroke="var(--border-subtle)" strokeWidth="7" fill="none" />
                      <circle 
                        cx="50" cy="50" r="42" 
                        stroke={sleepScoreData.hexColor} 
                        strokeWidth="7" 
                        fill="none" 
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 42}`}
                        strokeDashoffset={`${2 * Math.PI * 42 * (1 - Math.min(sleepScoreData.finalScore / 100, 1))}`}
                        className="transition-all duration-1000 ease-out"
                        style={{ filter: `drop-shadow(0px 0px 4px ${sleepScoreData.hexColor}60)` }}
                      />
                    </svg>
                    <div className="flex flex-col items-center justify-center relative z-10 text-center mt-1">
                      <span className="text-4xl sm:text-5xl font-black text-primary leading-none tracking-tighter">{sleepScoreData.finalScore}</span>
                      <span className={`font-bold uppercase text-[9px] tracking-widest mt-1 ${sleepScoreData.color}`}>{sleepScoreData.label}</span>
                    </div>
                  </div>
                  
                  <div className="text-center mt-6">
                    <p className="text-xs text-secondary font-medium max-w-[240px] mx-auto leading-relaxed">
                      {sleepScoreData.breakdownText}
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-muted text-xs font-mono uppercase mt-10">Dati insufficienti</div>
              )}
            </div>

            {/* Right Hero: Sleep Summary */}
            <div className="flex-1 clean-panel p-6 flex flex-col relative overflow-hidden">
              <h2 className="absolute top-6 left-6 text-secondary font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-[#CCFF00]" />
                Ripartizione Fasi
              </h2>
              
              {(() => {
                const deep = currentMetrics.sleep_deep || 0;
                const light = currentMetrics.sleep_light || 0;
                const rem = currentMetrics.sleep_rem || 0;
                const awake = currentMetrics.sleep_awake || 0;
                const total = (deep + light + rem + awake) || 1;

                const formatMins = (mins: number) => {
                  if (!mins) return '0m';
                  const h = Math.floor(mins / 60);
                  const m = Math.round(mins % 60);
                  return h > 0 ? `${h}h ${m}m` : `${m}m`;
                };

                const phases = [
                  { label: 'Profondo', mins: deep, color: '#2563eb' },
                  { label: 'Leggero', mins: light, color: '#60a5fa' },
                  { label: 'REM', mins: rem, color: '#d946ef' },
                  { label: 'Sveglio', mins: awake, color: '#ec4899' },
                ];

                return (
                  <div className="w-full h-full flex flex-col items-center justify-center pt-8">
                    <div className="w-full flex items-center justify-center gap-8">
                      <div className="w-[140px] h-[140px] flex-shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={phases}
                              cx="50%"
                              cy="50%"
                              innerRadius={36}
                              outerRadius={60}
                              paddingAngle={4}
                              dataKey="mins"
                            >
                              {phases.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                              ))}
                            </Pie>
                            <Tooltip content={(props: any) => (
                              <MinimalTooltip 
                                {...props} 
                                label={props.payload?.[0]?.name}
                                formatValue={(v) => formatMins(v)}
                              />
                            )} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="flex flex-col justify-center gap-3 font-mono w-[180px]">
                        {phases.map((p, i) => {
                          const pct = Math.round((p.mins / total) * 100);
                          return (
                            <div key={i} className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                                <span className="text-primary font-bold truncate text-xs font-sans">{p.label}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs flex-shrink-0">
                                <span className="text-muted text-[11px]">{formatMins(p.mins)}</span>
                                <span className="font-black text-primary w-8 text-right">{pct}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* SECONDARY METRICS BENTO GRID */}
          {(() => {
            const distanceMeters = currentMetrics.distance_m || (currentWorkout?.distanceKm ? Math.round(currentWorkout.distanceKm * 1000) : (currentMetrics.steps ? Math.round(currentMetrics.steps * 0.75) : 0));
            const activeCalories = currentMetrics.calories_active || currentWorkout?.calories || (currentMetrics.steps ? Math.round(currentMetrics.steps * 0.04) : 0);

            return (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { key: 'body_battery_change', label: 'Body Battery', icon: Zap, color: 'text-[#CCFF00]', value: currentMetrics.body_battery_change ? (currentMetrics.body_battery_change > 0 ? `+${currentMetrics.body_battery_change}` : currentMetrics.body_battery_change) : '--', unit: 'pt' },
                  { key: 'resting_hr', label: 'Battito a Riposo', icon: Heart, color: 'text-accent-rose', value: currentMetrics.resting_hr || '--', unit: 'bpm', isLowerBetter: true },
                  { key: 'stress_level', label: 'Stress Notturno', icon: Flame, color: 'text-orange-400', value: currentMetrics.stress_level || '--', unit: '/100', isLowerBetter: true },
                  { key: 'distance_m', label: 'Distanza', icon: Activity, color: 'text-blue-400', value: distanceMeters > 0 ? (distanceMeters / 1000).toFixed(1) : '--', unit: 'km', isLowerBetter: false, refValue: distanceMeters },
                  { key: 'calories_active', label: 'Calorie Attive', icon: Flame, color: 'text-orange-500', value: activeCalories > 0 ? activeCalories : '--', unit: 'kcal', isLowerBetter: false, refValue: activeCalories },
                  { key: 'weight_kg', label: 'Peso', icon: TrendingDown, color: 'text-cyan-400', value: (lastWeight && lastWeight > 0) ? lastWeight.toFixed(1) : '--', unit: 'kg', isLowerBetter: true, refValue: lastWeight },
                ].map((metric, i) => {
                  const trend = getTrend(metric.key, metric.refValue !== undefined ? metric.refValue : currentMetrics[metric.key as keyof typeof currentMetrics], dailyMetrics, selectedIndex, metric.isLowerBetter, metric.key === 'weight_kg' ? 30 : 7);

                  return (
                  <div key={i} className="clean-panel p-5 flex flex-col justify-center gap-2 hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-2 text-secondary">
                      <metric.icon className={`w-4 h-4 ${metric.color}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">{metric.label}</span>
                    </div>
                    <div className="flex items-end gap-1 flex-wrap">
                      <span className="text-2xl font-black font-mono text-primary leading-none tracking-tighter whitespace-nowrap">{metric.value}</span>
                      <span className="text-xs font-medium text-muted mb-0.5 whitespace-nowrap">{metric.unit}</span>
                      {trend && (
                        <div className={`flex items-center gap-0.5 text-[10px] font-mono font-bold ${trend.isGood ? 'text-accent-lime' : 'text-accent-rose'} ml-auto mb-0.5`}>
                          {trend.isGood ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {Math.abs(trend.percent).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>
                )})}
              </div>
            );
          })()}

          {/* CHARTS */}
          <div className="grid grid-cols-1 gap-5">
            <div className="h-[180px]">
              <MiniChartCard title="Frequenza Cardiaca" subtitle="intraday" value={currentMetrics.hr_timeline && currentMetrics.hr_timeline.length > 0 ? currentMetrics.hr_timeline[currentMetrics.hr_timeline.length - 1].hr.toString() : '--'} unit="bpm" accentColor="#f43f5e">
                {currentMetrics?.hr_timeline && currentMetrics.hr_timeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={currentMetrics.hr_timeline.map((h: any) => ({ time: new Date(h.time).getTime(), hr: h.hr }))} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                      <XAxis 
                        type="number" 
                        dataKey="time" 
                        domain={['dataMin', 'dataMax']} 
                        tickFormatter={(v) => new Date(v).toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit'})} 
                        tick={tickStyle} tickLine={false} axisLine={false} 
                      />
                      <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                      <Tooltip 
                        content={(props: any) => (
                          <MinimalTooltip 
                            {...props} 
                            label={props.label ? new Date(props.label).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : ''} 
                            unit="bpm" 
                          />
                        )} 
                      />
                      <Line type="monotone" dataKey="hr" stroke="#f43f5e" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#f43f5e' }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-muted font-mono uppercase">
                    Dati HR non disponibili
                  </div>
                )}
              </MiniChartCard>
            </div>

            <div className="h-[180px]">
              <MiniChartCard title="Timeline del Sonno" subtitle="notturna" value={formatSleepDuration(currentMetrics.sleep_duration)} unit="" accentColor="#818cf8">
                {currentMetrics?.sleep_timeline && currentMetrics.sleep_timeline.length > 0 ? (() => {
                  const timeline = currentMetrics.sleep_timeline;
                  const parseDate = (d: string) => new Date(d.endsWith('Z') || d.includes('+') ? d : d + 'Z');
                  const firstStart = parseDate(timeline[0].startGMT);
                  const lastEnd = parseDate(timeline[timeline.length - 1].endGMT);
                  const totalMs = lastEnd.getTime() - firstStart.getTime();

                  const midPoint1 = new Date(firstStart.getTime() + totalMs * 0.33);
                  const midPoint2 = new Date(firstStart.getTime() + totalMs * 0.66);

                  const formatTime = (d: Date) => d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div className="w-full h-full flex flex-col justify-end pt-2 pb-1">
                      <div className="w-full h-full flex items-end">
                        {timeline.map((segment: any, i: number) => {
                          const start = parseDate(segment.startGMT).getTime();
                          const end = parseDate(segment.endGMT).getTime();
                          const duration = end - start;
                          const widthPct = `${(duration / totalMs) * 100}%`;
                          const level = segment.activityLevel;
                          let bg = '#94a3b8';
                          let h = '50%';
                          if (level === 0) { bg = '#2563eb'; h = '40%'; } // Deep
                          else if (level === 1) { bg = '#60a5fa'; h = '60%'; } // Light
                          else if (level === 2) { bg = '#d946ef'; h = '80%'; } // REM
                          else if (level === 3) { bg = '#ec4899'; h = '100%'; } // Awake
                          
                          return (
                            <div 
                              key={i}
                              style={{ width: widthPct, backgroundColor: bg, height: h }}
                              className="rounded-t-sm transition-all hover:opacity-80 cursor-pointer"
                              title={`Fase: ${level === 0 ? 'Profondo' : level === 1 ? 'Leggero' : level === 2 ? 'REM' : 'Sveglio'}`}
                            />
                          );
                        })}
                      </div>
                      <div className="w-full flex justify-between text-[10px] text-muted font-mono mt-2 pt-1 border-t border-subtle">
                        <span>{formatTime(firstStart)}</span>
                        <span>{formatTime(midPoint1)}</span>
                        <span>{formatTime(midPoint2)}</span>
                        <span>{formatTime(lastEnd)}</span>
                      </div>
                    </div>
                  );
                })() : (
                   <div className="w-full h-full flex items-center justify-center text-[10px] text-muted font-mono uppercase">Timeline non disponibile</div>
                )}
              </MiniChartCard>
            </div>
          </div>

          {/* CORRELATION MATRIX */}
          <div className="clean-panel p-5">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-3">
              <div>
                <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                  Matrice di Correlazione
                </h3>
                <p className="text-[11px] text-muted font-mono mt-1">Impatto del sonno sui parametri vitali</p>
              </div>
              <div className="flex bg-[var(--surface-inset)] rounded-lg p-1 text-[11px] font-bold">
                <button 
                  onClick={() => setCorrelationType('rhr')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${correlationType === 'rhr' ? 'bg-[var(--surface-popover)] text-primary shadow-sm' : 'text-muted hover:text-secondary'}`}
                >
                  Sonno vs Battito (RHR)
                </button>
                <button 
                  onClick={() => setCorrelationType('stress')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${correlationType === 'stress' ? 'bg-[var(--surface-popover)] text-primary shadow-sm' : 'text-muted hover:text-secondary'}`}
                >
                  Sonno vs Stress
                </button>
              </div>
            </div>
            
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={[...dailyMetrics].reverse().map(m => ({
                  date: new Date(m.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }),
                  sleep: m.sleep_score || null,
                  rhr: m.resting_hr || null,
                  stress: m.stress_level || null,
                  runMarker: checkIfRanOnDate(m.date, m) ? (correlationType === 'rhr' ? m.resting_hr : m.stress_level) : null
                })).filter(m => m.sleep != null && (correlationType === 'rhr' ? m.rhr != null : m.stress != null))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={tickStyle} tickLine={false} axisLine={false} minTickGap={30} />
                  <YAxis yAxisId="left" tick={tickStyle} tickLine={false} axisLine={false} width={40} domain={[0, 100]} />
                  <YAxis yAxisId="right" orientation="right" tick={tickStyle} tickLine={false} axisLine={false} width={40} domain={['auto', 'auto']} />
                  <Tooltip content={(props: any) => <MinimalTooltip {...props} />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                  <Bar yAxisId="left" dataKey="sleep" name="Score Sonno" fill="#818cf8" radius={[2, 2, 0, 0]} maxBarSize={40} />
                  {correlationType === 'rhr' ? (
                    <Line yAxisId="right" type="monotone" dataKey="rhr" name="Battito a Riposo" stroke="#f43f5e" strokeWidth={2} dot={{ r: 4, fill: '#f43f5e' }} activeDot={{ r: 6 }} />
                  ) : (
                    <Line yAxisId="right" type="monotone" dataKey="stress" name="Stress" stroke="#fb923c" strokeWidth={2} dot={{ r: 4, fill: '#fb923c' }} activeDot={{ r: 6 }} />
                  )}
                  <Scatter yAxisId="right" dataKey="runMarker" name="Corsa (Giorno Precedente)" fill="#3b82f6" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* STEPS TREND */}
          <div className="h-[180px]">
            <MiniChartCard title="Trend dei Passi" subtitle="giornalieri" value={currentMetrics?.steps ? currentMetrics.steps.toLocaleString() : '--'} unit="passi" accentColor="#3b82f6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...dailyMetrics].reverse().map(m => ({ date: new Date(m.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }), steps: m.steps || 0 }))} margin={{ top: 12, right: 12, left: 12, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={tickStyle} tickLine={false} axisLine={false} minTickGap={40} />
                  <YAxis hide />
                  <Tooltip content={(props: any) => <MinimalTooltip {...props} unit="passi" />} />
                  <Bar dataKey="steps" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </MiniChartCard>
          </div>

          {/* WEIGHT TREND */}
          <div className="h-[180px]">
            <MiniChartCard title="Trend del Peso" subtitle="kg" value={(lastWeight && lastWeight > 0) ? lastWeight.toFixed(1) : '--'} unit="kg" accentColor="#22d3ee">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[...dailyMetrics].reverse().map(m => ({ date: new Date(m.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }), weight: m.weight_kg || null }))} margin={{ top: 12, right: 12, left: 12, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={gridColor} />
                  <XAxis dataKey="date" tick={tickStyle} tickLine={false} axisLine={false} minTickGap={40} />
                  <YAxis hide domain={[(dataMin: number) => dataMin - 0.2, (dataMax: number) => dataMax + 0.2]} />
                  <Tooltip content={(props: any) => <MinimalTooltip {...props} unit="kg" />} />
                  <Line type="monotone" dataKey="weight" stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 3, fill: '#22d3ee' }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </MiniChartCard>
          </div>

        </div>
      ) : (
        <div className="clean-panel p-10 text-center text-muted text-xs font-mono uppercase">
          Nessuna metrica giornaliera trovata. Effettua la sincronizzazione.
        </div>
      )}

      {/* FOOTER GARMIN SYNC BUTTON WITH DATE SELECTOR */}
      {onSyncGarmin && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-6 pb-2">
          <div className="flex items-center gap-2 bg-[var(--surface-popover)] border border-subtle px-3.5 py-2.5 rounded-xl text-xs font-mono shadow-sm">
            <span className="text-muted font-bold">Data da sincronizzare:</span>
            <input
              type="date"
              value={syncTargetDate}
              onChange={(e) => setSyncTargetDate(e.target.value)}
              className="bg-transparent text-primary font-mono focus:outline-none cursor-pointer"
            />
          </div>
          <button
            onClick={() => onSyncGarmin(syncTargetDate || currentMetrics?.date)}
            className="px-6 py-3 bg-[var(--surface-popover)] border border-subtle hover:bg-[var(--surface-inset)] text-primary rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer shadow-md"
          >
            <Activity className="w-4 h-4 text-[#CCFF00]" />
            <span>Sincronizza Garmin</span>
          </button>
        </div>
      )}

      {/* LOCATION OVERRIDES ADMIN MODAL */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface-base)] border border-subtle rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-subtle pb-3">
              <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                <MapPin className="w-5 h-5 text-amber-400" />
                Gestione Posizione & Vacanze
              </h3>
              <button onClick={() => setIsLocationModalOpen(false)} className="text-secondary hover:text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-secondary leading-relaxed">
              Imposta la città o le coordinate per il giorno selezionato (<strong className="text-primary">{currentMetrics ? new Date(currentMetrics.date).toLocaleDateString('it-IT') : ''}</strong>).
            </p>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-muted mb-1">Nome Città / Località</label>
                <input
                  type="text"
                  placeholder="Es. Capri, Riva presso Chieri, Napoli"
                  value={inputCity}
                  onChange={(e) => setInputCity(e.target.value)}
                  className="w-full bg-[var(--surface-popover)] border border-subtle rounded-md px-3 py-2 text-primary focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-muted mb-1">Latitudine (opzionale)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Es. 40.5507"
                    value={inputLat}
                    onChange={(e) => setInputLat(e.target.value)}
                    className="w-full bg-[var(--surface-popover)] border border-subtle rounded-md px-3 py-2 text-primary focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-muted mb-1">Longitudine (opzionale)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Es. 14.2426"
                    value={inputLon}
                    onChange={(e) => setInputLon(e.target.value)}
                    className="w-full bg-[var(--surface-popover)] border border-subtle rounded-md px-3 py-2 text-primary focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-subtle pt-3">
              <button
                onClick={() => setIsLocationModalOpen(false)}
                className="px-4 py-2 bg-[var(--surface-popover)] hover:bg-[var(--surface-inset)] text-secondary rounded-md text-xs font-bold transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                onClick={handleSaveCustomLocation}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black rounded-md text-xs font-bold transition-colors cursor-pointer"
              >
                Salva Posizione
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
