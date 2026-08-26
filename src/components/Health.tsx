import { generateHealthSectionAnalysis } from '../utils/healthAiEngine';
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, MapPin, X, Loader2, ChevronDown, ChevronUp, Sparkles, Cloud, Sun, CloudRain } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart, Bar, Cell, LabelList,
  XAxis, YAxis,
  Tooltip,
  CartesianGrid,
  LineChart, Line, AreaChart, Area,
  ComposedChart, Legend
} from 'recharts';
import { MinimalTooltip } from './Dashboard';

interface HealthProps {
  dailyMetrics: any[];
  activities?: any[];
  hevySessions?: any[];
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

const HrTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const timeStr = new Date(data.time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    return (
      <div className="mac-popover px-2.5 py-1.5 text-xs font-mono z-[5000]">
        <span className="text-secondary block text-[10px] mb-0.5">{timeStr}</span>
        <span className="text-primary font-bold">{data.hr}</span>
      </div>
    );
  }
  return null;
};

const CorrelationTooltip = ({ active, payload, correlationType }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[var(--bg-primary)] text-primary p-2 border border-[var(--border-subtle)] rounded shadow-sm text-[11px] font-mono leading-relaxed">
        <div className="text-secondary mb-2 uppercase font-bold tracking-widest">{data.date}</div>
        <div className="font-bold text-[#3b82f6]">Sonno: {data.sleep}</div>
        {correlationType === 'rhr' ? (
          <div className="font-bold text-[#ec4899]">RHR: {data.rhr || 'N/D'}</div>
        ) : (
          <div className="font-bold text-[var(--accent-amber)]">Stress: {data.stress || 'N/D'}</div>
        )}
      </div>
    );
  }
  return null;
};

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

const calculateSleepScore = (metrics: any, hevySessions?: any[]) => {
  if (!metrics || !metrics.sleep_duration) return null;

  const durationMin = metrics.sleep_duration;
  const deepMin = metrics.sleep_deep || 0;
  const remMin = metrics.sleep_rem || 0;
  const awakeMin = metrics.sleep_awake || 0;
  const stress = metrics.stress_level || 15;

  let durationScore = 0;
  if (durationMin >= 450 && durationMin <= 540) durationScore = 100;
  else if (durationMin > 540) durationScore = Math.max(0, 100 - (durationMin - 540) * 0.4);
  else durationScore = Math.max(0, Math.pow(durationMin / 450, 1.8) * 100);

  const deepPct = deepMin / durationMin;
  let deepScore = 0;
  if (deepPct >= 0.15) deepScore = 100;
  else deepScore = Math.max(0, Math.pow(deepPct / 0.15, 1.5) * 100);

  const remPct = remMin / durationMin;
  let remScore = 0;
  if (remPct >= 0.20) remScore = 100;
  else remScore = Math.max(0, Math.pow(remPct / 0.20, 1.5) * 100);

  let stressScore = 100;
  if (stress <= 15) stressScore = 100;
  else stressScore = Math.max(0, 100 - (stress - 15) * 2.2); 

  let awakeScore = Math.max(0, 100 - (awakeMin / 10) * 15);

  let finalScore = (
    (durationScore * 0.40) +
    (deepScore * 0.20) +
    (remScore * 0.20) +
    (stressScore * 0.10) +
    (awakeScore * 0.10)
  );

  if (durationMin < 360) finalScore *= 0.85; 
  if (remPct < 0.05) finalScore *= 0.85;       
  if (deepPct < 0.05) finalScore *= 0.85;      

  // ----- Hevy Readiness Impact -----
  // If user lifted heavy weights yesterday, readiness drops to account for muscular fatigue
  if (hevySessions && metrics.date) {
    const today = new Date(metrics.date);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    
    const yesterdaysHevy = hevySessions.filter(h => h.start_time.startsWith(yStr));
    let totalVolume = 0;
    yesterdaysHevy.forEach(h => totalVolume += h.volume_kg);
    
    // Penalize score by up to 15 points based on volume (e.g. 10,000kg = -15 points)
    if (totalVolume > 0) {
      const penalty = Math.min(15, (totalVolume / 10000) * 15);
      finalScore -= penalty;
    }
  }

  finalScore = Math.min(100, Math.max(0, Math.round(finalScore)));

  let label = "Scarso";
  if (finalScore >= 88) { label = "Eccellente"; }
  else if (finalScore >= 75) { label = "Buono"; }
  else if (finalScore >= 60) { label = "Discreto"; }

  return { finalScore, label };
};

// NEW ULTRA MINIMAL CAPSULE (No borders, pure typography)
const getReadinessColor = (val?: number) => {
  if (!val) return 'var(--color-primary)';
  if (val >= 85) return '#10b981'; // Premium Emerald Green
  if (val >= 70) return '#84cc16'; // Premium Lime Green
  if (val >= 50) return '#f59e0b'; // Premium Amber Gold
  if (val >= 30) return '#f97316'; // Premium Warm Orange
  return '#ef4444'; // Premium Coral Red
};

const getReadinessComment = (val?: number) => {
  if (!val) return "Dati insufficienti per valutare la readiness odierna.";
  if (val >= 90) return "La tua readiness è ai massimi livelli. Sei perfettamente recuperato e pronto per affrontare sforzi intensi o superare i tuoi record.";
  if (val >= 75) return "Ottima readiness. Il corpo ha recuperato bene ed è preparato per un allenamento produttivo e di qualità.";
  if (val >= 50) return "Readiness moderata. Puoi allenarti, ma ascolta il tuo corpo e considera di ridurre l'intensità se avverti affaticamento.";
  if (val >= 25) return "La tua readiness è bassa. Il recupero non è ottimale; valuta un allenamento leggero o una giornata di riposo attivo.";
  return "Readiness molto bassa. Il tuo corpo ha un forte bisogno di recupero. È fortemente consigliato riposo o attività di scarico.";
};

const ReadinessRing = ({ score }: { score: number }) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  
  useEffect(() => {
    const t = setTimeout(() => setAnimatedScore(score), 100);
    return () => clearTimeout(t);
  }, [score]);

  const radius = 80;
  const stroke = 12;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - ((animatedScore || 0) / 100) * circumference;
  const color = getReadinessColor(score);

  const getLabel = (val?: number) => {
    if (!val) return "";
    if (val >= 90) return "Eccellente";
    if (val >= 75) return "Ottimale";
    if (val >= 50) return "Moderata";
    if (val >= 25) return "Bassa";
    return "Critica";
  };

  return (
    <div className="relative flex items-center justify-center py-6">
      <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
        <circle
          stroke="var(--border-subtle)"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke={color}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset, filter: `drop-shadow(0 0 12px ${color}50)` }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          className="transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-1">Readiness</span>
        <span className="text-5xl font-black font-mono leading-none" style={{ color }}>{score || '--'}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color }}>{getLabel(score)}</span>
      </div>
    </div>
  );
};

const AiInsightAccordion = ({ analysis, title = "Analisi AI" }: any) => {
  const [isExpanded, setIsExpanded] = useState(false);
  if (!analysis) return null;
  return (
    <div className="mt-4 -mx-6 sm:-mx-8 -mb-6 sm:-mb-8 bg-[var(--surface-inset)] border-t border-[var(--border-subtle)] overflow-hidden transition-all duration-300 rounded-b-[11px]">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-6 sm:px-8 py-4 cursor-pointer hover:bg-[var(--surface-card-alt)] transition-colors group"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[var(--surface-card)] shadow-sm flex items-center justify-center border border-[var(--border-subtle)]">
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent-lime)]" />
          </div>
          <span className="text-sm font-semibold text-primary tracking-tight">{title}</span>
        </div>
        <div className="w-7 h-7 flex items-center justify-center bg-[var(--surface-card)] rounded-full border border-[var(--border-subtle)] shadow-sm">
          <ChevronDown className={`w-4 h-4 text-secondary transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {isExpanded && (
        <div className="px-6 sm:px-8 pb-6 pt-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-primary uppercase tracking-widest">{analysis.trendStatus}</h4>
            <p className="text-sm text-secondary leading-relaxed font-sans">
              {analysis.insightText}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default function Health({ dailyMetrics = [], activities = [], hevySessions = [], onSelectActivity, onSyncGarmin }: HealthProps) {
  const displayMetrics = useMemo(() => {
    if (!dailyMetrics || dailyMetrics.length === 0) {
      return [{ date: new Date().toISOString().split('T')[0], isGapPlaceholder: true }];
    }
    const sorted = [...dailyMetrics].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const todayStr = new Date().toISOString().split('T')[0];
    const oldestStr = sorted[sorted.length - 1].date.split('T')[0];
    
    const padded = [];
    let current = new Date(todayStr);
    const oldest = new Date(oldestStr);
    
    while (current >= oldest) {
      const dStr = current.toISOString().split('T')[0];
      const existing = sorted.find(m => m.date.startsWith(dStr));
      if (existing) {
        padded.push(existing);
      } else {
        padded.push({ date: dStr, isGapPlaceholder: true });
      }
      current.setDate(current.getDate() - 1);
    }
    return padded;
  }, [dailyMetrics]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [correlationType, setCorrelationType] = useState<'rhr' | 'stress'>('rhr');
  const [weatherData, setWeatherData] = useState<DetailedWeatherData | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [hoveredSleepDay, setHoveredSleepDay] = useState<{date: string, score: number} | null>(null);
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

  const currentMetrics = displayMetrics[selectedIndex] || null;
  const [syncTargetDate, setSyncTargetDate] = useState<string>(() => currentMetrics?.date?.split('T')[0] || new Date().toISOString().split('T')[0]);
  const [visibleDaysCount, setVisibleDaysCount] = useState(14);
  const [isLoadingOlderDays, setIsLoadingOlderDays] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDatePickerModalOpen, setDatePickerModalOpen] = useState(false);
  const [selectedPickerDate, setSelectedPickerDate] = useState<string>(() => new Date().toISOString().split('T')[0]);


  const handleLoadOlderDays = async (direction: 'older' | 'newer') => {
    if (direction === 'newer') {
      if (selectedIndex > 0) {
        setSelectedIndex(prev => prev - 1);
      }
      return;
    }

    if (selectedIndex < visibleDaysCount - 1 && selectedIndex < displayMetrics.length - 1) {
      setSelectedIndex(prev => prev + 1);
    } else {
      setIsLoadingOlderDays(true);
      try {
        await new Promise(res => setTimeout(res, 400));
        const nextCount = Math.min(displayMetrics.length, visibleDaysCount + 7);
        if (nextCount > visibleDaysCount) {
          setVisibleDaysCount(nextCount);
          setSelectedIndex(prev => prev + 1);
        } else if (onSyncGarmin && displayMetrics.length > 0) {
          const oldestDate = new Date(displayMetrics[displayMetrics.length - 1].date);
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

  useEffect(() => {
    if (currentMetrics?.date) {
      setSyncTargetDate(currentMetrics.date.split('T')[0]);
    }
  }, [currentMetrics?.date]);

  const weatherCacheRef = React.useRef<Record<string, DetailedWeatherData>>({});

  useEffect(() => {
    if (!currentMetrics?.date) return;
    const datePart = currentMetrics.date.split('T')[0];

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

          const nightTemps = temps.slice(0, 7);
          const nightHums = humidities.slice(0, 7);
          const tempMin = nightTemps.length > 0 ? Math.min(...nightTemps) : Math.min(...temps);
          const humNight = nightHums.length > 0 ? Math.round(nightHums.reduce((a, b) => a + b, 0) / nightHums.length) : 50;

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
    if (!displayMetrics || displayMetrics.length === 0) return null;
    for (let i = selectedIndex; i < displayMetrics.length; i++) {
      if (displayMetrics[i].weight_kg != null && displayMetrics[i].weight_kg > 0) return displayMetrics[i].weight_kg;
    }
    return null;
  }, [displayMetrics, selectedIndex]);

  const sleepScoreData = useMemo(() => {
    if (currentMetrics) return calculateSleepScore(currentMetrics, hevySessions);
    return null;
  }, [currentMetrics, hevySessions]);

  const weightHistoryData = useMemo(() => {
    if (!displayMetrics || displayMetrics.length === 0) return [];
    return [...displayMetrics]
      .filter(d => d.weight_kg != null && d.weight_kg > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(d => ({
        date: new Date(d.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
        peso: d.weight_kg
      }));
  }, [displayMetrics]);

  const intradayStepsData = useMemo(() => {
    if (!currentMetrics?.steps_timeline || !Array.isArray(currentMetrics.steps_timeline)) return [];
    return currentMetrics.steps_timeline.map((item: any) => {
      const d = new Date(item.time);
      return {
        time: d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        passi: item.steps
      };
    });
  }, [currentMetrics]);

  const fitnessFatigueData = useMemo(() => {
    if (!displayMetrics || displayMetrics.length === 0) return [];
    
    const data = [...displayMetrics].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let ctl = 0;
    let atl = 0;
    const results = [];
    
    const CTL_DECAY = Math.exp(-1/42);
    const ATL_DECAY = Math.exp(-1/7);
    
    for (const day of data) {
      // Proxy Training Load: Active Calories > Distance > Steps
      let load = 0;
      if (day.calories_active && day.calories_active > 0) {
        load = day.calories_active * 0.1;
      } else if (day.distance_m && day.distance_m > 0) {
        load = (day.distance_m / 1000) * 10;
      } else if (day.steps && day.steps > 0) {
        load = (day.steps / 1000) * 4;
      }
      
      ctl = load * (1 - CTL_DECAY) + ctl * CTL_DECAY;
      atl = load * (1 - ATL_DECAY) + atl * ATL_DECAY;
      
      results.push({
        date: new Date(day.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
        rawDate: day.date,
        ctl: Math.round(ctl),
        atl: Math.round(atl),
        tsb: Math.round(ctl - atl)
      });
    }
    
    return results.slice(-90); // Last 90 days
  }, [displayMetrics]);

  const sleepHeatmapData = useMemo(() => {
    if (!displayMetrics || displayMetrics.length === 0) return [];
    
    // The real end date based on latest data
    const realEndDate = new Date(displayMetrics[0].date);
    
    // Add 28 days (4 columns) to the right to visually center the existing data
    const endDate = new Date(realEndDate);
    endDate.setDate(endDate.getDate() + 28);
    
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 363); 
    
    const daysMap = new Map();
    for (const m of displayMetrics) {
      daysMap.set(m.date.split('T')[0], m.sleep_score || 0);
    }
    
    const results = [];
    let curr = new Date(startDate);
    while (curr <= endDate) {
      const d = curr.toISOString().split('T')[0];
      results.push({
        date: d,
        score: daysMap.get(d) || 0
      });
      curr.setDate(curr.getDate() + 1);
    }
    
    return results;
  }, [displayMetrics]);

  const sleepHeatmapStats = useMemo(() => {
    if (!sleepHeatmapData || sleepHeatmapData.length === 0) return null;
    let totalScore = 0;
    let daysWithScore = 0;
    let daysOver90 = 0;
    let daysOver80 = 0;
    let daysOver60 = 0;
    let daysUnder60 = 0;
    
    sleepHeatmapData.forEach(d => {
      if (d.score > 0) {
        totalScore += d.score;
        daysWithScore++;
        if (d.score >= 90) daysOver90++;
        else if (d.score >= 80) daysOver80++;
        else if (d.score >= 60) daysOver60++;
        else daysUnder60++;
      }
    });

    const avgScore = daysWithScore > 0 ? Math.round(totalScore / daysWithScore) : 0;
    
    return { avgScore, daysWithScore, daysOver90, daysOver80, daysOver60, daysUnder60 };
  }, [sleepHeatmapData]);

  const rhrHistoryData = useMemo(() => {
    if (!displayMetrics || displayMetrics.length === 0) return [];
    
    const data = [...displayMetrics].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const validData = data.filter(d => d.resting_hr != null && d.resting_hr > 0);
    
    return validData.map((d, i, arr) => {
      let sum = 0;
      let count = 0;
      for (let j = Math.max(0, i - 29); j <= i; j++) {
        sum += arr[j].resting_hr;
        count++;
      }
      return {
        date: new Date(d.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
        rhr: d.resting_hr,
        trend: Math.round((sum / count) * 10) / 10
      };
    });
  }, [displayMetrics]);

  const stressHistoryData = useMemo(() => {
    if (!displayMetrics || displayMetrics.length === 0) return [];
    
    const data = [...displayMetrics].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const validData = data.filter(d => (d.stress_level != null && d.stress_level > 0) || (d.resting_hr != null && d.resting_hr > 0));
    
    return validData.map((d, i, arr) => {
      const getStress = (day: any) => day.stress_level ?? (day.resting_hr ? Math.round(Math.max(12, Math.min(85, (day.resting_hr - 40) * 0.95 + 10))) : 22);
      
      let sum = 0;
      let count = 0;
      for (let j = Math.max(0, i - 29); j <= i; j++) {
        sum += getStress(arr[j]);
        count++;
      }
      return {
        date: new Date(d.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
        stress: getStress(d),
        trend: Math.round((sum / count) * 10) / 10
      };
    });
  }, [displayMetrics]);

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

  const [dbCachedAnalyses, setDbCachedAnalyses] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!currentMetrics?.date) return;
    const targetDate = currentMetrics.date;

    if (dbCachedAnalyses[targetDate]) return;

    let isMounted = true;
    fetch(`/api/health-analysis?date=${targetDate}`)
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data && data.analysis) {
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
          const generated = generateHealthSectionAnalysis(currentMetrics, displayMetrics);
          setDbCachedAnalyses(prev => ({ ...prev, [targetDate]: generated }));

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
  }, [currentMetrics?.date, displayMetrics]);

  const sectionAnalyses = useMemo(() => {
    if (!currentMetrics) return null;
    if (dbCachedAnalyses[currentMetrics.date]) {
      return dbCachedAnalyses[currentMetrics.date];
    }
    return generateHealthSectionAnalysis(currentMetrics, displayMetrics);
  }, [currentMetrics, displayMetrics, dbCachedAnalyses]);

  const sleepVsTargetData = useMemo(() => {
    if (!displayMetrics || displayMetrics.length === 0 || !currentMetrics?.date) return [];

    const selectedDateStr = currentMetrics.date.split('T')[0];
    const [year, month, day] = selectedDateStr.split('-').map(Number);
    const targetDateObj = new Date(year, month - 1, day);
    
    // Find Monday of the current week (Sunday = 0, Monday = 1)
    const dayOfWeek = targetDateObj.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const mondayObj = new Date(targetDateObj);
    mondayObj.setDate(targetDateObj.getDate() + diffToMonday);

    const result = [];
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(mondayObj);
      currentDay.setDate(mondayObj.getDate() + i);
      
      const y = currentDay.getFullYear();
      const mStr = String(currentDay.getMonth() + 1).padStart(2, '0');
      const dStr = String(currentDay.getDate()).padStart(2, '0');
      const dateStr = `${y}-${mStr}-${dStr}`;

      const dayName = currentDay.toLocaleDateString('en-US', { weekday: 'short' });
      const dateNum = currentDay.getDate();
      
      const m = displayMetrics.find(metric => metric.date === dateStr || metric.date?.startsWith(dateStr));
      
      if (m) {
        const actualHours = m.sleep_duration ? m.sleep_duration / 60 : null;
        
        let targetMins = 450;
        const activeCals = m.calories_active || (m.steps ? m.steps * 0.04 : 0);
        const distance = m.distance_m || (m.steps ? m.steps * 0.75 : 0);
        
        if (activeCals > 0) targetMins += (activeCals / 500) * 30;
        if (distance > 0) targetMins += (distance / 1000) * 5;
        if (m.stress_level && m.stress_level > 25) targetMins += (m.stress_level - 25) * 1;

        const targetHours = targetMins / 60;

        result.push({
          dayName,
          dateNum,
          Ideale: targetHours,
          Reale: actualHours,
          Score: m.sleep_score || null,
          fullDate: dateStr
        });
      } else {
        result.push({
          dayName,
          dateNum,
          Ideale: null,
          Reale: null,
          Score: null,
          fullDate: dateStr
        });
      }
    }

    return result;
  }, [displayMetrics, currentMetrics?.date]);


  const getDayLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate()} ${d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '').toUpperCase()}`;
  };

  // Custom components for Sleep Whoop-style Chart
  const formatHoursToHMM = (val: number) => {
    const h = Math.floor(val);
    const m = Math.round((val - h) * 60);
    return `${h}:${m.toString().padStart(2, '0')}`;
  };

  const CustomSleepDot = (props: any) => {
    const { cx, cy, stroke, value } = props;
    if (value === undefined || value === null) return null;
    return (
      <circle cx={cx} cy={cy} r={4} stroke={stroke} strokeWidth={2} fill="var(--surface-card)" />
    );
  };

  const CustomSleepLabel = (props: any) => {
    const { x, y, value, stroke, dataKey, index } = props;
    if (value === undefined || value === null) return null;
    
    const dataObj = sleepVsTargetData[index];
    const ideale = dataObj?.Ideale ?? 0;
    const reale = dataObj?.Reale ?? 0;
    
    let dy = 0;
    if (dataKey === 'Reale') {
      dy = reale >= ideale ? -12 : 20;
    } else if (dataKey === 'Ideale') {
      dy = ideale > reale ? -12 : 20;
    }

    return (
      <text x={x} y={y} dy={dy} fill={stroke} fontSize={10} fontWeight="bold" textAnchor="middle" style={{ pointerEvents: 'none' }}>
        {formatHoursToHMM(value)}
      </text>
    );
  };

  const CustomXAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const dataObj = sleepVsTargetData[payload.index];
    if (!dataObj) return null;
    const isSelected = dataObj.fullDate === currentMetrics?.date?.split('T')[0];

    return (
      <g transform={`translate(${x},${y})`}>
        {isSelected && (
          <rect x={-20} y={-10} width={40} height={40} fill="var(--surface-inset)" rx={4} />
        )}
        <text x={0} y={4} dy={0} textAnchor="middle" fill="var(--text-muted)" fontSize={10}>
          {dataObj.dayName}
        </text>
        <text x={0} y={18} dy={0} textAnchor="middle" fill={isSelected ? "var(--primary)" : "var(--text-muted)"} fontSize={10} fontWeight={isSelected ? "bold" : "normal"}>
          {dataObj.dateNum}
        </text>
      </g>
    );
  };

  return (
    <div className="space-y-10" id="health-tab">
      
      {/* 1. HEADER (Left aligned) & SINGLE DAY NAVIGATOR (Full Width) */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-primary select-none">
          Salute
        </h1>
        {weatherData && (
          <div 
            className="flex items-center gap-2 cursor-pointer select-none bg-[var(--surface-card)] px-3 py-1.5 rounded-[12px] border border-[var(--border-subtle)] shadow-sm hover:border-[var(--primary)] transition-colors"
            onClick={(e) => {
              if (e.detail === 3) setIsLocationModalOpen(true);
            }}
          >
            {weatherData.desc.toLowerCase().includes('pioggia') || weatherData.desc.toLowerCase().includes('rovesci') ? (
              <CloudRain className="w-3.5 h-3.5 text-secondary" />
            ) : weatherData.desc.toLowerCase().includes('nuvoloso') ? (
              <Cloud className="w-3.5 h-3.5 text-secondary" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-secondary" />
            )}
            <span className="text-xs font-bold text-secondary tracking-tight uppercase">
              {weatherData.cityName} • {Math.round(weatherData.tempMax)}°
            </span>
          </div>
        )}
      </div>

      {displayMetrics.length > 0 && currentMetrics && (
        <div className="flex items-center justify-between w-full clean-panel px-4 py-3 mb-8">
          <button 
            onClick={() => handleLoadOlderDays('older')}
            disabled={isLoadingOlderDays}
            className="text-secondary hover:text-[var(--accent-lime)] transition-colors disabled:opacity-20 cursor-pointer p-1"
          >
            {isLoadingOlderDays ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
          
          <div className="flex items-center gap-2 select-none justify-center flex-1">
            <span 
              className="text-lg font-bold font-mono tracking-tight text-primary cursor-pointer select-none"
              onClick={(e) => {
                if (e.detail === 3) {
                  setSelectedPickerDate(currentMetrics?.date?.split('T')[0] || new Date().toISOString().split('T')[0]);
                  setDatePickerModalOpen(true);
                }
              }}
            >
              {getDayLabel(currentMetrics.date)}
            </span>
            {checkIfRanOnDate(currentMetrics.date, currentMetrics) && (
              <span className="w-2 h-2 rounded-full bg-[var(--accent-lime)]" />
            )}
          </div>

          <button 
            onClick={() => handleLoadOlderDays('newer')}
            disabled={selectedIndex === 0}
            className="text-secondary hover:text-[var(--accent-lime)] transition-colors disabled:opacity-20 cursor-pointer p-1"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {currentMetrics ? (
        <div className="space-y-8">
          
          {/* ========================================================================= */}
          {/* VITALI HERO - Grid of Cards */}
          {/* ========================================================================= */}
          <section className="clean-panel flex flex-col shadow-sm">
            <div className="p-6 sm:p-8 pb-8 flex flex-col items-center">
              
              {/* The Hero Radial Ring */}
              <div className="w-full flex justify-center mb-8">
                <ReadinessRing score={sleepScoreData?.finalScore || 0} />
              </div>

              {/* Supporting Stats */}
              <div className="grid grid-cols-3 gap-2 md:gap-8 max-w-lg mx-auto w-full pt-8 border-t border-[var(--border-subtle)]">
                <div className="flex flex-col items-center text-center space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">RHR</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black font-mono text-[var(--accent-rose)]">{currentMetrics.resting_hr || '--'}</span>
                    <span className="text-[10px] font-mono text-secondary">bpm</span>
                  </div>
                </div>

                <div className="flex flex-col items-center text-center space-y-1 border-l border-r border-[var(--border-subtle)] px-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">Sonno</span>
                  <span className="text-2xl font-black font-mono text-[#3b82f6]">{formatSleepDuration(currentMetrics.sleep_duration).replace(' ', '')}</span>
                </div>

                <div className="flex flex-col items-center text-center space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">Stress</span>
                  <span className="text-2xl font-black font-mono text-[#d97706]">{currentMetrics.stress_level ?? '--'}</span>
                </div>
              </div>
            </div>

            {sectionAnalyses?.overall && (
              <div className="bg-[var(--surface-inset)] p-6 sm:p-8 border-t border-[var(--border-subtle)] rounded-b-[11px]">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-7 h-7 rounded-full bg-[var(--surface-card)] shadow-sm flex items-center justify-center border border-[var(--border-subtle)]">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--accent-lime)]" />
                  </div>
                  <span className="text-sm font-semibold text-primary tracking-tight">Overview AI</span>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold text-primary uppercase tracking-widest">{sectionAnalyses.overall.trendStatus}</h4>
                    <p className="text-sm text-secondary leading-relaxed font-sans">
                      {sectionAnalyses.overall.insightText}
                    </p>
                  </div>
                  <div className="space-y-1.5 pt-4 border-t border-[var(--border-subtle)]">
                    <h4 className="text-xs font-bold text-primary uppercase tracking-widest">Readiness</h4>
                    <p className="text-sm text-secondary leading-relaxed font-sans">
                      {getReadinessComment(sleepScoreData?.finalScore)}
                    </p>
                  </div>
                  {sectionAnalyses.sleep && sectionAnalyses.sleep.insightText && sectionAnalyses.sleep.insightText !== "N/A" && (
                    <div className="space-y-1.5 pt-4 border-t border-[var(--border-subtle)]">
                      <h4 className="text-xs font-bold text-primary uppercase tracking-widest">Sonno: {sectionAnalyses.sleep.trendStatus}</h4>
                      <p className="text-sm text-secondary leading-relaxed font-sans">
                        {sectionAnalyses.sleep.insightText}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ========================================================================= */}
          {/* SEZIONI DI DETTAGLIO - UNIFIED CARDS */}
          {/* ========================================================================= */}
          
          {/* SONNO CARD */}
          <section className="clean-panel p-6 sm:p-8 shadow-sm flex flex-col space-y-6">
            <h3 className="text-xl font-bold tracking-tight text-primary">Dettaglio Sonno</h3>
            
            {/* Data Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 font-mono pb-2">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest block mb-1" style={{ color: '#3b82f6' }}>Profondo</span>
                <span className="text-3xl font-black font-mono" style={{ color: '#3b82f6' }}>{currentMetrics.sleep_deep ? `${Math.round(currentMetrics.sleep_deep / 60)}h ${currentMetrics.sleep_deep % 60}m` : '--'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest block mb-1" style={{ color: '#60a5fa' }}>Leggero</span>
                <span className="text-3xl font-black font-mono" style={{ color: '#60a5fa' }}>{currentMetrics.sleep_light ? `${Math.round(currentMetrics.sleep_light / 60)}h ${currentMetrics.sleep_light % 60}m` : '--'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest block mb-1" style={{ color: '#d946ef' }}>REM</span>
                <span className="text-3xl font-black font-mono" style={{ color: '#d946ef' }}>{currentMetrics.sleep_rem ? `${Math.round(currentMetrics.sleep_rem / 60)}h ${currentMetrics.sleep_rem % 60}m` : '--'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest block mb-1" style={{ color: '#ec4899' }}>Risvegli</span>
                <span className="text-3xl font-black font-mono" style={{ color: '#ec4899' }}>{currentMetrics.sleep_awake ? `${currentMetrics.sleep_awake}m` : '0m'}</span>
              </div>
            </div>

            {/* Minimal Sleep Timeline */}
            <div className="h-[60px] w-full mt-2">
              {currentMetrics?.sleep_timeline && currentMetrics.sleep_timeline.length > 0 ? (() => {
                const timeline = currentMetrics.sleep_timeline;
                const parseDate = (d: string) => new Date(d.endsWith('Z') || d.includes('+') ? d : d + 'Z');
                const firstStart = parseDate(timeline[0].startGMT);
                const lastEnd = parseDate(timeline[timeline.length - 1].endGMT);
                const totalMs = lastEnd.getTime() - firstStart.getTime();

                return (
                  <div className="w-full h-full flex flex-col justify-end border-b border-[var(--border-subtle)]">
                    <div className="w-full h-8 flex items-end">
                      {timeline.map((segment: any, i: number) => {
                        const start = parseDate(segment.startGMT).getTime();
                        const end = parseDate(segment.endGMT).getTime();
                        const duration = end - start;
                        const widthPct = `${(duration / totalMs) * 100}%`;
                        const level = segment.activityLevel;
                        let bg = 'var(--text-muted)';
                        let h = '40%';
                        if (level === 0) { bg = '#3b82f6'; h = '100%'; } // Deep -> blue
                        else if (level === 1) { bg = '#60a5fa'; h = '60%'; } // Light -> light blue
                        else if (level === 2) { bg = '#d946ef'; h = '80%'; } // REM -> magenta/purple
                        else if (level === 3) { bg = '#ec4899'; h = '100%'; } // Awake -> pink
                        
                        return (
                          <div 
                            key={i}
                            style={{ width: widthPct, backgroundColor: bg, height: h }}
                            className="rounded-t-[1px] transition-all hover:opacity-80"
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })() : null}
            </div>

            
            {/* Sleep vs Target Chart */}
            {sleepVsTargetData.length > 0 && (
              <div className="mt-8 border-t border-[var(--border-subtle)] pt-6">
                {/* Weekly Sleep Score Bar Chart */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-primary uppercase tracking-widest">Score Sonno Settimanale</h4>
                    <div className="text-[11px] font-mono text-secondary">
                      Media: <span className="font-bold text-primary">{Math.round(sleepVsTargetData.reduce((acc, curr) => acc + (curr.Score || 0), 0) / (sleepVsTargetData.filter(d => d.Score > 0).length || 1))}</span>/100
                    </div>
                  </div>
                  <div className="h-[140px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sleepVsTargetData} margin={{ top: 22, right: 10, left: 10, bottom: 0 }}>
                        <XAxis dataKey="dayName" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }} />
                        <YAxis hide domain={[0, 100]} />
                        <Bar dataKey="Score" radius={[6, 6, 0, 0]} maxBarSize={38}>
                          {sleepVsTargetData.map((entry, index) => {
                            const isSelected = entry.fullDate === currentMetrics?.date?.split('T')[0];
                            let color = 'var(--border-subtle)';
                            if (entry.Score && entry.Score >= 90) color = '#3b82f6';
                            else if (entry.Score && entry.Score >= 80) color = '#60a5fa';
                            else if (entry.Score && entry.Score >= 60) color = '#d946ef';
                            else if (entry.Score && entry.Score > 0) color = '#ec4899';
                            return <Cell key={`cell-${index}`} fill={color} opacity={isSelected ? 1 : 0.65} />;
                          })}
                          <LabelList dataKey="Score" position="top" formatter={(val: any) => val > 0 ? val : ''} style={{ fill: 'var(--text-primary)', fontSize: 11, fontWeight: 'bold' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-widest">Bilancio Settimanale</h4>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full border-2 border-[#3b82f6] bg-transparent" />
                      <span className="text-[10px] uppercase tracking-widest text-primary font-bold">Ore Dormite</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full border-2 border-[#64748b] bg-transparent" />
                      <span className="text-[10px] uppercase tracking-widest text-primary font-bold">Fabbisogno</span>
                    </div>
                  </div>
                </div>
                <div className="h-[220px] w-full relative">
                  {/* Highlight current day column background */}
                  {(() => {
                     const selectedIdx = sleepVsTargetData.findIndex(d => d.fullDate === currentMetrics?.date?.split('T')[0]);
                     if (selectedIdx !== -1) {
                        const colWidth = 100 / Math.max(sleepVsTargetData.length - 1, 1);
                        const leftPct = (selectedIdx * colWidth);
                        return (
                          <div 
                            className="absolute top-0 bottom-0 bg-[var(--surface-inset)] opacity-50 rounded-t-md pointer-events-none"
                            style={{ 
                              left: `calc(${leftPct}% - 20px)`, 
                              width: '40px' 
                            }}
                          />
                        );
                     }
                     return null;
                  })()}
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={sleepVsTargetData} margin={{ top: 20, right: 20, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" opacity={0.3} />
                      <XAxis axisLine={false} tickLine={false} tick={<CustomXAxisTick />} />
                      <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                      
                      <Line 
                        type="natural" 
                        dataKey="Reale" 
                        stroke="#3b82f6" 
                        strokeWidth={2} 
                        dot={<CustomSleepDot stroke="#3b82f6" />} 
                        activeDot={{ r: 5, fill: "#3b82f6", stroke: "var(--surface-card)", strokeWidth: 2 }} 
                        label={<CustomSleepLabel stroke="#3b82f6" dataKey="Reale" />}
                      />
                      <Line 
                        type="natural" 
                        dataKey="Ideale" 
                        stroke="#64748b" 
                        strokeWidth={2} 
                        strokeDasharray="4 4"
                        dot={<CustomSleepDot stroke="#64748b" />} 
                        activeDot={{ r: 5, fill: "#64748b", stroke: "var(--surface-card)", strokeWidth: 2 }} 
                        label={<CustomSleepLabel stroke="#64748b" dataKey="Ideale" />}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Sleep Heatmap Annuale */}
            {sleepHeatmapData.length > 0 && sleepHeatmapStats && (
              <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 mt-4 pt-6 border-t border-[var(--border-subtle)] overflow-hidden w-full">
                
                {/* Left: Summary Stats */}
                <div className="flex flex-col justify-center min-w-[200px] space-y-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-secondary block mb-1">
                      {hoveredSleepDay ? `Score del ${new Date(hoveredSleepDay.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}` : 'Score Medio (365g)'}
                    </span>
                    <span className="text-4xl font-black text-primary">
                      {hoveredSleepDay ? (hoveredSleepDay.score > 0 ? hoveredSleepDay.score : 'N/D') : sleepHeatmapStats.avgScore}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]"><span className="text-secondary font-mono">Giorni &ge;90</span><span className="font-bold text-[#3b82f6]">{sleepHeatmapStats.daysOver90}</span></div>
                    <div className="flex justify-between items-center text-[11px]"><span className="text-secondary font-mono">Giorni 80-89</span><span className="font-bold text-[#60a5fa]">{sleepHeatmapStats.daysOver80}</span></div>
                    <div className="flex justify-between items-center text-[11px]"><span className="text-secondary font-mono">Giorni 60-79</span><span className="font-bold text-[#d946ef]">{sleepHeatmapStats.daysOver60}</span></div>
                    <div className="flex justify-between items-center text-[11px]"><span className="text-secondary font-mono">Giorni &lt;60</span><span className="font-bold text-[#ec4899]">{sleepHeatmapStats.daysUnder60}</span></div>
                  </div>
                </div>

                {/* Right: Heatmap Grid */}
                <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar flex items-center lg:justify-start" onMouseLeave={() => setHoveredSleepDay(null)}>
                  <div 
                    className="grid grid-rows-7 grid-flow-col gap-1 min-w-max"
                    style={{ gridAutoColumns: 'max-content' }}
                  >
                    {sleepHeatmapData.map((day, i) => (
                      <div
                        key={i}
                        onMouseEnter={() => setHoveredSleepDay(day)}
                        className="w-[12px] h-[12px] rounded-[3px] transition-transform hover:scale-125 cursor-crosshair"
                        style={{ backgroundColor: day.score >= 90 ? '#3b82f6' : day.score >= 80 ? '#60a5fa' : day.score >= 60 ? '#d946ef' : day.score > 0 ? '#ec4899' : 'rgba(150,150,150,0.15)' }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

{/* AI Insight */}
            <div className="w-full">
              <AiInsightAccordion analysis={sectionAnalyses?.sleep} title="Insight Sonno" />
            </div>
          </section>

          {/* CARDIO E STRESS CARD */}
          <section className="clean-panel p-6 sm:p-8 shadow-sm flex flex-col space-y-6">
            <h3 className="text-xl font-bold tracking-tight text-primary">Cardio & Stress</h3>

            {/* Intraday HR */}
            <div className="pt-2">
              <div className="space-y-4">
                <span className="text-[10px] uppercase font-bold tracking-widest text-secondary block">HR Intraday (24h)</span>
                <div className="h-[140px]">
                  {currentMetrics?.hr_timeline && currentMetrics.hr_timeline.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={currentMetrics.hr_timeline.map((h: any) => ({ time: new Date(h.time).getTime(), hr: h.hr }))}>
                        <XAxis hide dataKey="time" type="number" domain={['dataMin', 'dataMax']} />
                        <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                        <Tooltip content={<HrTooltip />} wrapperStyle={{ zIndex: 100 }} cursor={{ stroke: 'var(--border-subtle)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                        <Line 
                          type="monotone" 
                          dataKey="hr" 
                          stroke="var(--accent-rose)" 
                          strokeWidth={1.5} 
                          dot={false}
                          activeDot={{ r: 4, fill: 'var(--bg-primary)', stroke: 'var(--accent-rose)', strokeWidth: 2 }} 
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-xs text-muted font-mono h-full flex items-center justify-center">Dati non disponibili</div>
                  )}
                </div>
              </div>
            </div>

            {/* Annual RHR Trend */}
              <div className="flex flex-col space-y-4 mt-6 pt-4 border-t border-[var(--border-subtle)]">
                <span className="text-[10px] uppercase font-bold tracking-widest text-secondary block">Andamento RHR (365g)</span>
                <div className="h-[150px] w-full">
                  {rhrHistoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={rhrHistoryData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                        <XAxis dataKey="date" hide={true} />
                        <YAxis domain={['dataMin - 2', 'dataMax + 2']} hide={true} />
                        <Tooltip content={<MinimalTooltip />} />
                        <Area 
                          type="monotone" 
                          dataKey="rhr" 
                          name="RHR"
                          stroke="var(--accent-rose)" 
                          fill="var(--accent-rose)" 
                          fillOpacity={0.15} 
                          strokeWidth={0}
                          activeDot={{ r: 4, fill: 'var(--bg-primary)', stroke: 'var(--accent-rose)', strokeWidth: 2 }}
                        />
                        <Line type="basis" dataKey="trend" name="Trend (30g)" stroke="var(--accent-rose)" strokeWidth={2} dot={false} strokeOpacity={0.8} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-tertiary font-mono">
                      Nessuno storico RHR disponibile.
                    </div>
                  )}
                </div>
              </div>
              
              {/* Annual Stress Trend */}
              <div className="flex flex-col space-y-4 mt-6 pt-4 border-t border-[var(--border-subtle)]">
                <span className="text-[10px] uppercase font-bold tracking-widest text-secondary block">Andamento Stress (365g)</span>
                <div className="h-[150px] w-full">
                  {stressHistoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={stressHistoryData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                        <XAxis dataKey="date" hide={true} />
                        <YAxis domain={['auto', 'auto']} hide={true} />
                        <Tooltip content={<MinimalTooltip />} />
                        <Area 
                          type="monotone" 
                          dataKey="stress" 
                          name="Stress"
                          stroke="var(--accent-amber)" 
                          fill="var(--accent-amber)" 
                          fillOpacity={0.15} 
                          strokeWidth={0}
                          activeDot={{ r: 4, fill: 'var(--bg-primary)', stroke: 'var(--accent-amber)', strokeWidth: 2 }}
                        />
                        <Line type="basis" dataKey="trend" name="Trend (30g)" stroke="var(--accent-amber)" strokeWidth={2} dot={false} strokeOpacity={0.8} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-tertiary font-mono">
                      Nessuno storico Stress disponibile.
                    </div>
                  )}
                </div>
              </div>

            {/* AI Insight */}
            <div className="w-full mt-6">
              <AiInsightAccordion analysis={sectionAnalyses?.cardio} title="Insight Cardio" />
            </div>
          </section>

          {/* ATTIVITA E CORPO CARD */}
          <section className="clean-panel p-6 sm:p-8 shadow-sm flex flex-col space-y-6">
            <h3 className="text-xl font-bold tracking-tight text-primary">Attività & Corpo</h3>
            
            {/* Data Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 font-mono pb-2">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest block mb-1" style={{ color: '#10b981' }}>Passi</span>
                <span className="text-3xl font-black font-mono" style={{ color: '#10b981' }}>{currentMetrics.steps ? currentMetrics.steps.toLocaleString() : '--'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest block mb-1">Distanza (km)</span>
                <span className="text-3xl font-black font-mono text-primary">
                  {(() => {
                    const dist = currentMetrics.distance_m || (currentWorkout?.distanceKm ? Math.round(currentWorkout.distanceKm * 1000) : (currentMetrics.steps ? Math.round(currentMetrics.steps * 0.75) : 0));
                    return dist > 0 ? (dist / 1000).toFixed(1) : '--';
                  })()}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest block mb-1" style={{ color: '#f97316' }}>Calorie Attive</span>
                <span className="text-3xl font-black font-mono" style={{ color: '#f97316' }}>
                  {currentMetrics.calories_active || currentWorkout?.calories || (currentMetrics.steps ? Math.round(currentMetrics.steps * 0.04) : '--')}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest block mb-1" style={{ color: '#0ea5e9' }}>Peso (kg)</span>
                <span className="text-3xl font-black font-mono" style={{ color: '#0ea5e9' }}>
                  {(lastWeight && lastWeight > 0) ? lastWeight.toFixed(1) : '--'}
                </span>
              </div>
            </div>

            {/* Charts Section */}
            <div className="pt-4 border-t border-border/50">
              
              {/* Historical Weight Chart */}
              <div className="flex flex-col space-y-4">
                <span className="text-[10px] uppercase font-bold tracking-widest text-secondary">Storico Peso (kg)</span>
                <div className="h-[150px] w-full">
                  {weightHistoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weightHistoryData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <XAxis dataKey="date" hide={true} />
                        <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide={true} />
                        <Tooltip content={<MinimalTooltip />} />
                        <Line 
                          type="natural" 
                          dataKey="peso" 
                          stroke="#0ea5e9" 
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#0ea5e9', strokeWidth: 0 }}
                          activeDot={{ r: 5, fill: 'var(--bg-primary)', stroke: '#0ea5e9', strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-tertiary font-mono">
                      Nessuno storico peso disponibile.
                    </div>
                  )}
                </div>
              </div>

              {/* Fitness vs Fatigue Chart */}
              <div className="flex flex-col space-y-4 mt-6 pt-6 border-t border-[var(--border-subtle)]">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-secondary">Fitness vs Fatigue (90g)</span>
                  <div className="flex gap-4 text-[10px] font-bold font-mono">
                    <div className="flex items-center gap-1"><span className="w-3 h-1 rounded-sm" style={{ backgroundColor: '#0ea5e9' }}></span> CTL</div>
                    <div className="flex items-center gap-1"><span className="w-3 h-1 rounded-sm" style={{ backgroundColor: '#ec4899' }}></span> ATL</div>
                    <div className="flex items-center gap-1"><span className="w-3 h-1 rounded-sm" style={{ backgroundColor: '#eab308' }}></span> TSB</div>
                  </div>
                </div>
                <div className="h-[180px] w-full">
                  {fitnessFatigueData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={fitnessFatigueData} margin={{ top: 10, right: 0, left: 0, bottom: 5 }}>
                        <XAxis dataKey="date" hide={true} />
                        <YAxis hide={true} domain={['auto', 'auto']} />
                        <Tooltip content={<MinimalTooltip />} />
                        <Area type="monotone" dataKey="ctl" name="Fitness (CTL)" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.4} strokeWidth={0} />
                        <Line type="monotone" dataKey="atl" name="Fatica (ATL)" stroke="#ec4899" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="tsb" name="Forma (TSB)" stroke="#eab308" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-tertiary font-mono">
                      Dati insufficienti per il calcolo CTL/ATL.
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-secondary leading-relaxed border-t border-[var(--border-subtle)] pt-3">
                  <strong className="text-primary">CTL (Fitness)</strong> indica la preparazione aerobica a lungo termine (Area Azzurra). <strong className="text-primary">ATL (Fatica)</strong> indica lo stress cumulato nell'ultima settimana (Linea Rosa). <strong className="text-primary">TSB (Forma)</strong> è il bilancio: positivo = riposato, negativo = affaticato (Linea Gialla).
                </div>
              </div>

            </div>

            {/* AI Insights (Attivita) */}
            <div className="w-full space-y-2 pt-2">
              <AiInsightAccordion analysis={sectionAnalyses?.activity} title="Insight Attività" />
            </div>
          </section>

        </div>
      ) : (
        <div className="pt-20 text-center text-secondary font-mono uppercase text-sm">
          Nessun dato. Sincronizza Garmin.
        </div>
      )}

      {/* FOOTER ACTIONS */}
      <div className="flex justify-center pt-4 mt-4 pb-0">
        <div className="flex items-center gap-2">
          
          <button
            onClick={() => setIsLocationModalOpen(true)}
            className="text-primary hover:opacity-70 transition-opacity cursor-pointer flex items-center justify-center p-2"
            title="Gestisci Posizione / Meteo"
          >
            <MapPin className="w-4 h-4" />
          </button>

          {onSyncGarmin && (
            <>
              <div className="flex items-center gap-2">
                <input 
                  type="date"
                  value={syncTargetDate}
                  onChange={(e) => setSyncTargetDate(e.target.value)}
                  className="bg-transparent text-primary border-none p-2 font-mono text-[10px] uppercase tracking-widest focus:outline-none cursor-pointer"
                />
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
                  className={`text-primary hover:opacity-70 font-bold tracking-widest uppercase text-[10px] transition-opacity cursor-pointer p-2 ${isSyncing ? 'opacity-50' : ''}`}
                >
                  {isSyncing ? 'SYNC...' : 'SYNC GARMIN'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      
      {/* DATE PICKER MODAL (TRIPLE CLICK) */}
      {isDatePickerModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-3xl p-8 max-w-sm w-full space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-4">
              <h3 className="text-lg font-bold text-primary">Vai a Data</h3>
              <button onClick={() => setDatePickerModalOpen(false)} className="text-secondary hover:text-primary transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 font-mono text-sm">
              <input
                type="date"
                value={selectedPickerDate}
                onChange={(e) => setSelectedPickerDate(e.target.value)}
                className="w-full bg-transparent border-b border-[var(--border-subtle)] py-2 text-primary focus:outline-none focus:border-[var(--accent-lime)] transition-colors cursor-pointer"
              />
              <button
                className="w-full bg-primary text-[var(--surface-base)] font-bold rounded-full py-3 hover:opacity-90 transition-opacity cursor-pointer flex justify-center items-center"
                disabled={isSyncing}
                onClick={async () => {
                  const idx = displayMetrics.findIndex(m => m.date.startsWith(selectedPickerDate));
                  if (idx !== -1) {
                    if (idx >= visibleDaysCount) {
                       setVisibleDaysCount(idx + 1);
                    }
                    setSelectedIndex(idx);
                    setDatePickerModalOpen(false);
                  } else {
                    if (onSyncGarmin) {
                       setIsSyncing(true);
                       try {
                         await onSyncGarmin(selectedPickerDate);
                         setDatePickerModalOpen(false);
                       } finally {
                         setIsSyncing(false);
                       }
                    } else {
                       alert("Data non trovata in locale.");
                    }
                  }
                }}
              >
                {isSyncing ? 'Sincronizzazione...' : 'Vai / Sincronizza'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOCATION OVERRIDES ADMIN MODAL */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-3xl p-8 max-w-sm w-full space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-4">
              <h3 className="text-lg font-bold text-primary">Posizione</h3>
              <button onClick={() => setIsLocationModalOpen(false)} className="text-secondary hover:text-primary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 font-mono text-sm">
              <input
                type="text"
                placeholder="Città"
                value={inputCity}
                onChange={(e) => setInputCity(e.target.value)}
                className="w-full bg-transparent border-b border-[var(--border-subtle)] py-2 text-primary focus:outline-none focus:border-[var(--accent-lime)] transition-colors"
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  placeholder="Lat"
                  value={inputLat}
                  onChange={(e) => setInputLat(e.target.value)}
                  className="w-full bg-transparent border-b border-[var(--border-subtle)] py-2 text-primary focus:outline-none focus:border-[var(--accent-lime)] transition-colors"
                />
                <input
                  type="number"
                  placeholder="Lon"
                  value={inputLon}
                  onChange={(e) => setInputLon(e.target.value)}
                  className="w-full bg-transparent border-b border-[var(--border-subtle)] py-2 text-primary focus:outline-none focus:border-[var(--accent-lime)] transition-colors"
                />
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <button onClick={handleSaveCustomLocation} className="text-[var(--accent-lime)] font-bold uppercase tracking-widest text-xs px-4 py-2 hover:bg-[var(--surface-inset)] rounded-full transition-colors">
                Salva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
