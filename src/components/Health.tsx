import { generateHealthSectionAnalysis } from '../utils/healthAiEngine';
import React, { useMemo, useState, useEffect, useTransition, useDeferredValue, useCallback } from 'react';
import { Heart, Zap, TrendingDown, TrendingUp, Moon, Activity, Flame, ChevronLeft, ChevronRight, ExternalLink, Sun, MapPin, Settings, X, Loader2 } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis,
  Tooltip,
  CartesianGrid,
  LineChart, Line, AreaChart, Area,
  ComposedChart, Scatter, Legend
} from 'recharts';
import { MinimalTooltip, MiniChartCard } from './Dashboard';

interface HealthProps {
  dailyMetrics: any[];
  activities?: any[];
  onSelectActivity?: (activityId: string) => void;
  onSyncGarmin?: (dateStr?: string) => void | Promise<void>;
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
  const [activeChartTab, setActiveChartTab] = useState<'correlation' | 'intraday' | 'sleep' | 'steps'>('correlation');
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
  const [visibleDaysCount, setVisibleDaysCount] = useState(14);
  const stripContainerRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!stripContainerRef.current) return;
    const container = stripContainerRef.current;
    const selectedEl = container.querySelector('[data-selected="true"]') as HTMLElement;
    if (selectedEl) {
      const containerWidth = container.clientWidth;
      const elOffsetLeft = selectedEl.offsetLeft;
      const elWidth = selectedEl.clientWidth;
      const targetScrollLeft = elOffsetLeft - (containerWidth / 2) + (elWidth / 2);
      container.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth'
      });
    }
  }, [selectedIndex]);

  const handleStripScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollLeft < 150 && !isLoadingOlderDays && visibleDaysCount < dailyMetrics.length) {
      setVisibleDaysCount(prev => Math.min(dailyMetrics.length, prev + 7));
    }
  };
  const [isLoadingOlderDays, setIsLoadingOlderDays] = useState(false);

  const handleLoadOlderDays = async (direction: 'older' | 'newer') => {
    if (direction === 'newer') {
      if (selectedIndex > 0) {
        setSelectedIndex(prev => prev - 1);
      }
      return;
    }

    // direction == 'older'
    if (selectedIndex < visibleDaysCount - 1 && selectedIndex < dailyMetrics.length - 1) {
      setSelectedIndex(prev => prev + 1);
    } else {
      setIsLoadingOlderDays(true);
      try {
        await new Promise(res => setTimeout(res, 400));
        const nextCount = Math.min(dailyMetrics.length, visibleDaysCount + 7);
        if (nextCount > visibleDaysCount) {
          setVisibleDaysCount(nextCount);
          setSelectedIndex(prev => prev + 1);
        } else if (onSyncGarmin && dailyMetrics.length > 0) {
          const oldestDate = new Date(dailyMetrics[dailyMetrics.length - 1].date);
          oldestDate.setDate(oldestDate.getDate() - 1);
          const targetStr = oldestDate.toISOString().split('T')[0];
          await onSyncGarmin(targetStr);
          setVisibleDaysCount(prev => prev + 1);
          setSelectedIndex(prev => prev + 1);
        }
      } finally {
        setIsLoadingOlderDays(false);
      }
    }
  };
  const [isSyncing, setIsSyncing] = useState(false);

  const navigateDay = useCallback((direction: 'prev' | 'next') => {
    setSelectedIndex(i => direction === 'prev' 
      ? Math.min(dailyMetrics.length - 1, i + 1) 
      : Math.max(0, i - 1)
    );
  }, [dailyMetrics.length]);

  useEffect(() => {
    if (currentMetrics?.date) {
      setSyncTargetDate(currentMetrics.date.split('T')[0]);
    }
  }, [currentMetrics?.date]);

  const weatherCacheRef = React.useRef<Record<string, DetailedWeatherData>>({});

  useEffect(() => {
    if (!currentMetrics?.date) return;
    const datePart = currentMetrics.date.split('T')[0];

    // Check cache first
    if (weatherCacheRef.current[datePart]) {
      setWeatherData(weatherCacheRef.current[datePart]);
      return;
    }

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
          
          const result: DetailedWeatherData = {
            tempMin: Math.round(tempMin * 10) / 10,
            tempMax: Math.round(tempMax * 10) / 10,
            humNight,
            humDay,
            desc,
            cityName
          };
          weatherCacheRef.current[datePart] = result;
          setWeatherData(result);
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


  // Supabase cached analysis state (avoids re-calculating or spending AI credits)
  const [dbCachedAnalyses, setDbCachedAnalyses] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!currentMetrics?.date) return;
    const targetDate = currentMetrics.date;

    // Check if already fetched in local state memory
    if (dbCachedAnalyses[targetDate]) return;

    let isMounted = true;
    fetch(`/api/health-analysis?date=${targetDate}`)
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data && data.analysis) {
          // Found in Supabase! Hydrate state (0 AI credits spent)
          const record = data.analysis;
          const hydrated = {
            date: targetDate,
            overall: { trendStatus: record.overall_trend, insightText: record.overall_insight, marginOfImprovement: record.overall_insight },
            sleep: { trendStatus: record.sleep_trend, insightText: record.sleep_insight, marginOfImprovement: record.sleep_insight },
            cardio: { trendStatus: record.cardio_trend, insightText: record.cardio_insight, marginOfImprovement: record.cardio_insight },
            activity: { trendStatus: record.activity_trend, insightText: record.activity_insight, marginOfImprovement: record.activity_insight },
            body: { trendStatus: record.body_trend, insightText: record.body_insight, marginOfImprovement: record.body_insight }
          };
          setDbCachedAnalyses(prev => ({ ...prev, [targetDate]: hydrated }));
        } else {
          // Not found in Supabase: generate and persist to Supabase
          const generated = generateHealthSectionAnalysis(currentMetrics, dailyMetrics);
          setDbCachedAnalyses(prev => ({ ...prev, [targetDate]: generated }));

          // Save to Supabase
          const dbRecord = {
            date: targetDate,
            overall_trend: generated.overall.trendStatus,
            overall_insight: generated.overall.insightText,
            sleep_trend: generated.sleep.trendStatus,
            sleep_insight: generated.sleep.insightText,
            cardio_trend: generated.cardio.trendStatus,
            cardio_insight: generated.cardio.insightText,
            activity_trend: generated.activity.trendStatus,
            activity_insight: generated.activity.insightText,
            body_trend: generated.body.trendStatus,
            body_insight: generated.body.insightText
          };

          fetch('/api/health-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ analysis: dbRecord })
          }).catch(err => console.error('Failed to cache analysis in Supabase:', err));
        }
      })
      .catch(err => console.error('Error querying Supabase health analysis:', err));

    return () => { isMounted = false; };
  }, [currentMetrics?.date, dailyMetrics]);

  // Compute section-by-section sports-medical analysis (prefer Supabase cached result)
  const sectionAnalyses = useMemo(() => {
    if (!currentMetrics) return null;
    if (dbCachedAnalyses[currentMetrics.date]) {
      return dbCachedAnalyses[currentMetrics.date];
    }
    return generateHealthSectionAnalysis(currentMetrics, dailyMetrics);
  }, [currentMetrics, dailyMetrics, dbCachedAnalyses]);

  const RenderAiSectionCapsule = ({ analysis }: any) => {
    if (!analysis) return null;
    return (
      <div className="mt-3 bg-[var(--surface-card)] border border-subtle/50 rounded-2xl p-4 sm:p-5 space-y-2 shadow-sm transition-all hover:border-subtle duration-200">
        <div className="flex items-center justify-between gap-2 border-b border-subtle/40 pb-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-secondary font-mono">
            Analisi &amp; Trend
          </span>
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--surface-inset)] text-[#CCFF00] font-mono border border-subtle/40">
            {analysis.trendStatus}
          </span>
        </div>
        <p className="text-sm text-primary font-normal leading-relaxed pt-0.5">
          {analysis.insightText}
        </p>
        <div className="text-xs text-[#CCFF00] font-semibold pt-1 font-mono">
          <span>{analysis.marginOfImprovement}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto" id="health-tab">
      
      {/* 1. HEADER & SINGLE DAY NAVIGATOR (Solid Neon Green 100%, Black Text, Pure White Arrows) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-primary select-none font-sans">
              Salute &amp; Biometria 360°
            </h1>
            <p className="text-xs text-muted font-mono mt-0.5">Panoramica completa in alto, sezioni di dettaglio verticale in basso</p>
          </div>
        </div>

        {/* Single Day Navigator Bar (Apple Modern Clean White Capsule) */}
        {dailyMetrics.length > 0 && currentMetrics && (
          <div className="w-full flex items-center justify-between bg-white dark:bg-[var(--surface-card)] border border-subtle rounded-2xl py-3 px-5 shadow-md backdrop-blur-2xl transition-all duration-200">
            {/* Prev Day (Older -> Left) */}
            <button 
              onClick={() => handleLoadOlderDays('older')}
              disabled={isLoadingOlderDays}
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--surface-popover)] hover:bg-[#CCFF00] hover:text-black active:scale-[0.94] text-primary transition-all duration-150 ease-out cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed border border-subtle shadow-sm focus:outline-none"
              title="Giorno precedente"
            >
              {isLoadingOlderDays ? (
                <Loader2 className="w-5 h-5 text-[#CCFF00] animate-spin" />
              ) : (
                <ChevronLeft className="w-5 h-5 shrink-0" />
              )}
            </button>
            
            {/* Minimal Day Display: MAR 4 AGO + Workout Dot */}
            <div className="flex items-center gap-3 select-none">
              <span className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-[#CCFF00] font-sans">
                {new Date(currentMetrics.date).toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '')}
              </span>
              <span className="text-2xl sm:text-3xl font-black font-mono leading-none tracking-tight text-primary">
                {new Date(currentMetrics.date).getDate()}
              </span>
              <span className="text-xs sm:text-sm font-bold uppercase text-secondary font-sans">
                {new Date(currentMetrics.date).toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')}
              </span>
              {checkIfRanOnDate(currentMetrics.date, currentMetrics) && (
                <span className="w-2.5 h-2.5 rounded-full bg-[#CCFF00] shadow-[0_0_10px_#CCFF00] ml-0.5" title="Allenamento registrato" />
              )}
            </div>

            {/* Next Day (Newer -> Right) */}
            <button 
              onClick={() => handleLoadOlderDays('newer')}
              disabled={selectedIndex === 0}
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--surface-popover)] hover:bg-[#CCFF00] hover:text-black active:scale-[0.94] text-primary transition-all duration-150 ease-out cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed border border-subtle shadow-sm focus:outline-none"
              title="Giorno successivo"
            >
              <ChevronRight className="w-5 h-5 shrink-0" />
            </button>
          </div>
        )}
      </div>

      {currentMetrics ? (
        <div className="space-y-10 transition-all duration-300 ease-out">
          
          {/* ========================================================================= */}
          {/* PARTE ALTA: PANORAMICA COMPLETA A 360° (EXECUTIVE HEALTH HERO) */}
          {/* ========================================================================= */}
          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-widest text-[#CCFF00] flex items-center gap-2 font-mono">
                
                PARTE ALTA: PANORAMICA GENERALE A 360°
              </h2>
            </div>

            {/* HERO CARD - Daily Readiness & Executive Summary */}
            <div className="relative overflow-hidden rounded-3xl border border-subtle/50 bg-[var(--surface-card)] p-6 sm:p-8 shadow-sm backdrop-blur-xl">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                {/* Score & Main Metric */}
                <div className="flex items-center gap-6 w-full lg:w-auto">
                  {sleepScoreData ? (
                    <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" stroke="var(--border-subtle)" strokeWidth="6" fill="none" />
                        <circle 
                          cx="50" cy="50" r="42" 
                          stroke={sleepScoreData.hexColor} 
                          strokeWidth="6.5" 
                          fill="none" 
                          strokeLinecap="round" 
                          strokeDasharray={`${2 * 3.14159 * 42}`} 
                          strokeDashoffset={`${2 * 3.14159 * 42 * (1 - Math.min(sleepScoreData.finalScore / 100, 1))}`} 
                          className="transition-all duration-700 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-5xl font-black text-primary leading-none tracking-tighter font-mono">{sleepScoreData.finalScore}</span>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted mt-1">Score</span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-32 h-32 shrink-0 rounded-full border-2 border-subtle flex items-center justify-center text-muted font-mono text-xs">--</div>
                  )}
                  
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-widest text-[#CCFF00]">
                      Recupero Giornaliero
                    </span>
                    <h3 className="text-3xl sm:text-4xl font-extrabold text-primary leading-none tracking-tight">
                      {recoveryInsight ? recoveryInsight.status : sleepScoreData?.label || 'Dati Incompleti'}
                    </h3>
                    <p className="text-xs sm:text-sm text-secondary font-medium leading-relaxed max-w-md mt-0.5">
                      {recoveryInsight?.prescription || sleepScoreData?.breakdownText || 'Sincronizza per ottenere il punteggio.'}
                    </p>
                  </div>
                </div>

                {/* 4 Apple Vitals Pill Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-subtle/50 lg:pl-8 shrink-0">
                  <div className="bg-[var(--surface-popover)] p-3.5 rounded-2xl border border-subtle/40 shadow-sm active:scale-[0.96] transition-transform duration-150 ease-out">
                    <span className="text-[10px] text-muted font-bold uppercase block">RHR</span>
                    <span className="text-lg font-black font-mono text-primary mt-0.5 block">{currentMetrics.resting_hr || '--'} <span className="text-[10px] font-normal text-muted">bpm</span></span>
                  </div>

                  <div className="bg-[var(--surface-popover)] p-3.5 rounded-2xl border border-subtle/40 shadow-sm active:scale-[0.96] transition-transform duration-150 ease-out">
                    <span className="text-[10px] text-muted font-bold uppercase block">Sonno</span>
                    <span className="text-lg font-black font-mono text-primary mt-0.5 block">{formatSleepDuration(currentMetrics.sleep_duration)}</span>
                  </div>

                  <div className="bg-[var(--surface-popover)] p-3.5 rounded-2xl border border-subtle/40 shadow-sm active:scale-[0.96] transition-transform duration-150 ease-out">
                    <span className="text-[10px] text-muted font-bold uppercase block">Stress</span>
                    <span className="text-lg font-black font-mono text-primary mt-0.5 block">{currentMetrics.stress_level ?? 22} <span className="text-[10px] font-normal text-muted">/100</span></span>
                  </div>

                  <div className="bg-[var(--surface-popover)] p-3.5 rounded-2xl border border-subtle/40 shadow-sm active:scale-[0.96] transition-transform duration-150 ease-out">
                    <span className="text-[10px] text-muted font-bold uppercase block">Body Batt</span>
                    <span className="text-lg font-black font-mono text-primary mt-0.5 block">{currentMetrics.body_battery_change ? (currentMetrics.body_battery_change > 0 ? `+${currentMetrics.body_battery_change}` : currentMetrics.body_battery_change) : '--'} <span className="text-[10px] font-normal text-muted">pt</span></span>
                  </div>
                </div>
              </div>

              <RenderAiSectionCapsule analysis={sectionAnalyses?.overall} />
            </div>
          </section>

          {/* ========================================================================= */}
          {/* PARTE INFERIORE: SEZIONI SPECIFICHE DEDICATE AI SINGOLI DOMINI DEGLI INDICI */}
          {/* ========================================================================= */}
          
          {/* 1. SEZIONE SONNO & ARCHITETTURA NOTTURNA */}
          <section className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-subtle pb-3">
              <h3 className="text-xl font-black tracking-tight text-primary flex items-center gap-2 font-sans">
                
                1. Sonno &amp; Architettura Notturna
              </h3>
              <span className="text-xs font-mono text-muted">Analisi dettagliata sonno</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Stat Card 1: Durata & Score */}
              <div className="bg-[var(--surface-card)] border border-subtle p-6 rounded-3xl flex flex-col justify-between shadow-sm hover:border-default transition-all">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-wider text-muted font-sans">Punteggio &amp; Durata</span>
                  <span className="text-xs font-bold text-indigo-400 font-mono">{sleepScoreData?.label || '--'}</span>
                </div>
                <div className="mt-6">
                  <div className="text-4xl font-black font-mono text-primary">{formatSleepDuration(currentMetrics.sleep_duration)}</div>
                  <div className="text-xs text-secondary font-medium mt-1">Score: <span className="font-bold text-primary font-mono">{sleepScoreData?.finalScore || '--'}/100</span></div>
                </div>
              </div>

              {/* Stat Card 2: Fasi (Profondo, REM, Leggero) */}
              <div className="col-span-2 bg-[var(--surface-card)] border border-subtle p-6 rounded-3xl flex flex-col justify-between shadow-sm hover:border-default transition-all">
                <span className="text-xs font-black uppercase tracking-wider text-muted font-sans mb-4">Ripartizione Fasi del Sonno</span>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-[var(--surface-inset)] p-3 rounded-2xl border border-subtle">
                    <span className="text-[10px] font-bold uppercase text-blue-400 block">Profondo</span>
                    <span className="text-lg font-black font-mono text-primary">{currentMetrics.sleep_deep ? `${Math.round(currentMetrics.sleep_deep / 60)}h ${currentMetrics.sleep_deep % 60}m` : '--'}</span>
                  </div>
                  <div className="bg-[var(--surface-inset)] p-3 rounded-2xl border border-subtle">
                    <span className="text-[10px] font-bold uppercase text-indigo-400 block">Leggero</span>
                    <span className="text-lg font-black font-mono text-primary">{currentMetrics.sleep_light ? `${Math.round(currentMetrics.sleep_light / 60)}h ${currentMetrics.sleep_light % 60}m` : '--'}</span>
                  </div>
                  <div className="bg-[var(--surface-inset)] p-3 rounded-2xl border border-subtle">
                    <span className="text-[10px] font-bold uppercase text-fuchsia-400 block">REM</span>
                    <span className="text-lg font-black font-mono text-primary">{currentMetrics.sleep_rem ? `${Math.round(currentMetrics.sleep_rem / 60)}h ${currentMetrics.sleep_rem % 60}m` : '--'}</span>
                  </div>
                  <div className="bg-[var(--surface-inset)] p-3 rounded-2xl border border-subtle">
                    <span className="text-[10px] font-bold uppercase text-pink-400 block">Risvegli</span>
                    <span className="text-lg font-black font-mono text-primary">{currentMetrics.sleep_awake ? `${currentMetrics.sleep_awake}m` : '0m'}</span>
                  </div>
                </div>
              </div>
            </div>

            <RenderAiSectionCapsule analysis={sectionAnalyses?.sleep} />
            {/* Timeline Grafica del Sonno */}
            <div className="bg-[var(--surface-card)] border border-subtle p-6 rounded-3xl shadow-sm">
              <h4 className="text-xs font-black uppercase tracking-wider text-muted font-sans mb-4">Grafico Architettura Temporale Notturna</h4>
              <div className="h-[180px]">
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
                          if (level === 0) { bg = '#2563eb'; h = '40%'; }
                          else if (level === 1) { bg = '#60a5fa'; h = '60%'; }
                          else if (level === 2) { bg = '#d946ef'; h = '80%'; }
                          else if (level === 3) { bg = '#ec4899'; h = '100%'; }
                          
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
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted font-mono uppercase">Timeline del Sonno non disponibile</div>
                )}
              </div>
            </div>
          </section>

          {/* 2. SEZIONE CARDIOVASCOLARE & FREQUENZA CARDIACA */}
          <section className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-subtle pb-3">
              <h3 className="text-xl font-black tracking-tight text-primary flex items-center gap-2 font-sans">
                
                2. Sistema Cardiovascolare &amp; Riposo
              </h3>
              <span className="text-xs font-mono text-muted">Dati cardiaci &amp; RHR</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* RHR Card & Sparkline */}
              <div className="bg-[var(--surface-card)] border border-subtle p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between shadow-sm hover:border-default transition-all min-h-[180px]">
                <div className="flex justify-between items-center z-10">
                  <span className="text-xs font-black uppercase tracking-wider text-muted font-sans">Battito a Riposo (RHR)</span>
                  {(() => {
                    const trend = getTrend('resting_hr', currentMetrics.resting_hr, dailyMetrics, selectedIndex, true, 7);
                    if (!trend) return null;
                    return (
                      <div className={`flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-full bg-[var(--surface-inset)] border border-subtle ${trend.isGood ? 'text-accent-lime' : 'text-accent-rose'}`}>
                        {trend.isGood ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                        {Math.abs(trend.percent).toFixed(1)}% vs media 7gg
                      </div>
                    );
                  })()}
                </div>
                
                <div className="z-10 mt-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black font-mono tracking-tight text-primary leading-none">{currentMetrics.resting_hr || '--'}</span>
                    <span className="text-sm font-bold text-muted font-mono">bpm</span>
                  </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 h-[50%] opacity-60 pointer-events-none">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={[...dailyMetrics].slice(selectedIndex, selectedIndex + 7).reverse().map(m => ({ val: m.resting_hr || null }))} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRHR_sec2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.25}/>
                          <stop offset="100%" stopColor="#f43f5e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="val" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorRHR_sec2)" isAnimationActive={false} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Stress Giornaliero */}
              <div className="bg-[var(--surface-card)] border border-subtle p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between shadow-sm hover:border-default transition-all min-h-[180px]">
                <div className="flex justify-between items-center z-10">
                  <span className="text-xs font-black uppercase tracking-wider text-muted font-sans">Livello di Stress Giornaliero</span>
                  {(() => {
                    const activeStress = currentMetrics.stress_level ?? (currentMetrics.resting_hr ? Math.round(Math.max(12, Math.min(85, (currentMetrics.resting_hr - 40) * 0.95 + 10))) : 22);
                    const trend = getTrend('stress_level', activeStress, dailyMetrics, selectedIndex, true, 7);
                    if (!trend) return null;
                    return (
                      <div className={`flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-full bg-[var(--surface-inset)] border border-subtle ${trend.isGood ? 'text-accent-lime' : 'text-accent-rose'}`}>
                        {trend.isGood ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                        {Math.abs(trend.percent).toFixed(1)}%
                      </div>
                    );
                  })()}
                </div>
                
                <div className="z-10 mt-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black font-mono tracking-tight text-primary leading-none">
                      {currentMetrics.stress_level ?? (currentMetrics.resting_hr ? Math.round(Math.max(12, Math.min(85, (currentMetrics.resting_hr - 40) * 0.95 + 10))) : 22)}
                    </span>
                    <span className="text-sm font-bold text-muted font-mono">/100</span>
                  </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 h-[50%] opacity-60 pointer-events-none">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={[...dailyMetrics].slice(selectedIndex, selectedIndex + 7).reverse().map(m => ({ val: m.stress_level ?? (m.resting_hr ? Math.round(Math.max(12, Math.min(85, (m.resting_hr - 40) * 0.95 + 10))) : 22) }))} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorStress_sec2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fb923c" stopOpacity={0.25}/>
                          <stop offset="100%" stopColor="#fb923c" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="val" stroke="#fb923c" strokeWidth={3} fillOpacity={1} fill="url(#colorStress_sec2)" isAnimationActive={false} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <RenderAiSectionCapsule analysis={sectionAnalyses?.cardio} />
            {/* Grafico Intraday HR & Matrice Correlazione */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-[var(--surface-card)] border border-subtle p-6 rounded-3xl shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-wider text-muted font-sans mb-4">Frequenza Cardiaca Intraday (24h)</h4>
                <div className="h-[220px]">
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
                        <Line type="monotone" dataKey="hr" stroke="#f43f5e" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#f43f5e' }} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted font-mono uppercase">Dati HR Intraday non disponibili per questa data</div>
                  )}
                </div>
              </div>

              {/* Matrice Correlazione Sonno vs RHR / Stress */}
              <div className="bg-[var(--surface-card)] border border-subtle p-6 rounded-3xl shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-muted font-sans">
                    Correlazione Sonno vs {correlationType === 'rhr' ? 'RHR' : 'Stress'}
                  </h4>
                  <div className="flex bg-[var(--surface-inset)] rounded-lg p-0.5 text-[10px] font-bold border border-subtle">
                    <button 
                      onClick={() => setCorrelationType('rhr')}
                      className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${correlationType === 'rhr' ? 'bg-[var(--surface-popover)] text-primary shadow-sm' : 'text-muted'}`}
                    >
                      RHR
                    </button>
                    <button 
                      onClick={() => setCorrelationType('stress')}
                      className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${correlationType === 'stress' ? 'bg-[var(--surface-popover)] text-primary shadow-sm' : 'text-muted'}`}
                    >
                      Stress
                    </button>
                  </div>
                </div>

                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={[...dailyMetrics].reverse().map(m => ({
                      date: new Date(m.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }),
                      sleep: m.sleep_score || 70,
                      rhr: m.resting_hr || null,
                      stress: m.stress_level ?? (m.resting_hr ? Math.round(Math.max(12, Math.min(85, (m.resting_hr - 40) * 0.95 + 10))) : 22),
                    }))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={tickStyle} tickLine={false} axisLine={false} minTickGap={30} />
                      <YAxis yAxisId="left" tick={tickStyle} tickLine={false} axisLine={false} width={40} domain={[0, 100]} />
                      <YAxis yAxisId="right" orientation="right" tick={tickStyle} tickLine={false} axisLine={false} width={40} domain={correlationType === 'stress' ? [0, 100] : ['auto', 'auto']} />
                      <Tooltip content={(props: any) => <MinimalTooltip {...props} />} />
                      <Bar yAxisId="left" dataKey="sleep" name="Score Sonno" fill="#818cf8" radius={[3, 3, 0, 0]} maxBarSize={28} />
                      {correlationType === 'rhr' ? (
                        <Line yAxisId="right" type="monotone" dataKey="rhr" name="RHR (bpm)" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3, fill: '#f43f5e' }} connectNulls />
                      ) : (
                        <Line yAxisId="right" type="monotone" dataKey="stress" name="Stress (/100)" stroke="#fb923c" strokeWidth={2.5} dot={{ r: 3, fill: '#fb923c' }} connectNulls />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </section>

          {/* 3. SEZIONE MOVIMENTO, PASSI & CALORIE */}
          <section className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-subtle pb-3">
              <h3 className="text-xl font-black tracking-tight text-primary flex items-center gap-2 font-sans">
                
                3. Attività, Movimento &amp; Calorie
              </h3>
              <span className="text-xs font-mono text-muted">Passi, km &amp; energia</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {(() => {
                const distanceMeters = currentMetrics.distance_m || (currentWorkout?.distanceKm ? Math.round(currentWorkout.distanceKm * 1000) : (currentMetrics.steps ? Math.round(currentMetrics.steps * 0.75) : 0));
                const activeCalories = currentMetrics.calories_active || currentWorkout?.calories || (currentMetrics.steps ? Math.round(currentMetrics.steps * 0.04) : 0);

                return [
                  { label: 'Passi Giornalieri', value: currentMetrics.steps ? currentMetrics.steps.toLocaleString() : '--', unit: 'passi', icon: Activity, iconBg: 'bg-blue-500/15 text-blue-400' },
                  { label: 'Distanza Percorsa', value: distanceMeters > 0 ? (distanceMeters / 1000).toFixed(1) : '--', unit: 'km', icon: Flame, iconBg: 'bg-emerald-500/15 dark:bg-[#CCFF00]/15 text-[#CCFF00]' },
                  { label: 'Calorie Attive', value: activeCalories > 0 ? activeCalories : '--', unit: 'kcal', icon: Zap, iconBg: 'bg-orange-500/15 text-orange-500' },
                ].map((item, i) => (
                  <div key={i} className="bg-[var(--surface-card)] border border-subtle p-6 rounded-3xl flex flex-col justify-between shadow-sm hover:border-[#CCFF00]/40 transition-all">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-xl ${item.iconBg}`}>
                        <item.icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-black uppercase tracking-wider text-muted font-sans">{item.label}</span>
                    </div>
                    <div className="mt-6">
                      <span className="text-4xl font-black font-mono text-primary leading-none">{item.value}</span>
                      <span className="text-xs text-muted font-mono ml-1">{item.unit}</span>
                    </div>
                  </div>
                ));
              })()}
            </div>

            <RenderAiSectionCapsule analysis={sectionAnalyses?.activity} />
            {/* Grafico Passi */}
            <div className="bg-[var(--surface-card)] border border-subtle p-6 rounded-3xl shadow-sm">
              <h4 className="text-xs font-black uppercase tracking-wider text-muted font-sans mb-4">Trend Passi Giornalieri</h4>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...dailyMetrics].reverse().map(m => ({ date: new Date(m.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }), steps: m.steps || 0 }))} margin={{ top: 12, right: 12, left: 12, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={tickStyle} tickLine={false} axisLine={false} minTickGap={30} />
                    <YAxis hide />
                    <Tooltip content={(props: any) => <MinimalTooltip {...props} unit="passi" />} />
                    <Bar dataKey="steps" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* 4. SEZIONE COMPOSIZIONE CORPOREA & PESO */}
          <section className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-subtle pb-3">
              <h3 className="text-xl font-black tracking-tight text-primary flex items-center gap-2 font-sans">
                
                4. Composizione Corporea &amp; Peso
              </h3>
              <span className="text-xs font-mono text-muted">Andamento ponderale</span>
            </div>

            <div className="bg-[var(--surface-card)] border border-subtle p-6 rounded-3xl shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-muted font-sans">Peso Corporeo Registrato</span>
                  <div className="text-3xl font-black font-mono text-primary mt-1">
                    {(lastWeight && lastWeight > 0) ? lastWeight.toFixed(1) : '--'} <span className="text-sm font-normal text-muted font-sans">kg</span>
                  </div>
                </div>
              </div>

              <RenderAiSectionCapsule analysis={sectionAnalyses?.body} />
              <div className="h-[210px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...dailyMetrics].reverse().map(m => ({ date: new Date(m.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }), weight: m.weight_kg || null }))} margin={{ top: 12, right: 12, left: 12, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={gridColor} />
                    <XAxis dataKey="date" tick={tickStyle} tickLine={false} axisLine={false} minTickGap={30} />
                    <YAxis hide domain={[(dataMin: number) => dataMin - 0.2, (dataMax: number) => dataMax + 0.2]} />
                    <Tooltip content={(props: any) => <MinimalTooltip {...props} unit="kg" />} />
                    <Line type="monotone" dataKey="weight" stroke="#22d3ee" strokeWidth={2.8} dot={{ r: 3.5, fill: '#22d3ee' }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

        </div>
      ) : (
        <div className="clean-panel p-10 text-center text-muted text-xs font-mono uppercase">
          Nessuna metrica giornaliera trovata. Effettua la sincronizzazione.
        </div>
      )}

      {/* FOOTER GARMIN SYNC BUTTON & LOCATION WITH DATE SELECTOR */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-6 pb-2">
        <button
          onClick={() => setIsLocationModalOpen(true)}
          className="px-4 py-2.5 bg-[var(--surface-popover)] border border-subtle hover:bg-[var(--surface-inset)] text-secondary hover:text-primary rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer"
          title="Gestisci Posizione / Meteo"
        >
          <MapPin className="w-4 h-4 text-amber-400" />
          <span>Posizione Meteo</span>
        </button>
        {onSyncGarmin && (
          <>
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
              onClick={async () => {
                if (isSyncing) return;
                setIsSyncing(true);
                try {
                  await onSyncGarmin(syncTargetDate || currentMetrics?.date);
                } finally {
                  setIsSyncing(false);
                }
              }}
              disabled={isSyncing}
              className={`px-6 py-3 bg-[var(--surface-popover)] border border-subtle hover:bg-[var(--surface-inset)] text-primary rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 shadow-md ${isSyncing ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 text-[#CCFF00] animate-spin" />
              ) : (
                <Activity className="w-4 h-4 text-[#CCFF00]" />
              )}
              <span>{isSyncing ? 'Sincronizzazione in corso...' : 'Sincronizza Garmin'}</span>
            </button>
          </>
        )}
      </div>

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
