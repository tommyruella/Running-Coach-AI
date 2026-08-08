import { generateHealthSectionAnalysis } from '../utils/healthAiEngine';
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, MapPin, X, Loader2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart, Bar,
  XAxis, YAxis,
  Tooltip,
  CartesianGrid,
  LineChart, Line, AreaChart, Area,
  ComposedChart
} from 'recharts';
import { MinimalTooltip } from './Dashboard';

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

  finalScore = Math.min(100, Math.max(0, Math.round(finalScore)));

  let label = "Scarso";
  if (finalScore >= 88) { label = "Eccellente"; }
  else if (finalScore >= 75) { label = "Buono"; }
  else if (finalScore >= 60) { label = "Discreto"; }

  return { finalScore, label };
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

  const weightHistoryData = useMemo(() => {
    if (!dailyMetrics || dailyMetrics.length === 0) return [];
    return [...dailyMetrics]
      .filter(d => d.weight_kg != null && d.weight_kg > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(d => ({
        date: new Date(d.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
        peso: d.weight_kg
      }));
  }, [dailyMetrics]);

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
          const generated = generateHealthSectionAnalysis(currentMetrics, dailyMetrics);
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
  }, [currentMetrics?.date, dailyMetrics]);

  const sectionAnalyses = useMemo(() => {
    if (!currentMetrics) return null;
    if (dbCachedAnalyses[currentMetrics.date]) {
      return dbCachedAnalyses[currentMetrics.date];
    }
    return generateHealthSectionAnalysis(currentMetrics, dailyMetrics);
  }, [currentMetrics, dailyMetrics, dbCachedAnalyses]);

  // NEW ULTRA MINIMAL CAPSULE (No borders, pure typography)
    const getReadinessColor = (val?: number) => {
    if (!val) return 'var(--color-primary)';
    if (val >= 75) return '#32D74B'; // Apple Green
    if (val >= 50) return '#FFD60A'; // Apple Yellow
    if (val >= 25) return '#FF9F0A'; // Apple Orange
    return '#FF3B30'; // Apple Red
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

  const getDayLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate()} ${d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '').toUpperCase()}`;
  };

  return (
    <div className="space-y-10" id="health-tab">
      
      {/* 1. HEADER (Left aligned) & SINGLE DAY NAVIGATOR (Full Width) */}
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-primary select-none">
          Salute
        </h1>
      </div>

      {dailyMetrics.length > 0 && currentMetrics && (
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 p-6 sm:p-8 pb-8">
              <div className="flex flex-col items-start text-left space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">Readiness</span>
                <span className={`text-4xl font-black font-mono ${getReadinessColor(sleepScoreData?.finalScore)}`}>{sleepScoreData?.finalScore || '--'}</span>
              </div>

              <div className="flex flex-col items-start text-left space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">RHR</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black font-mono text-[var(--accent-rose)]">{currentMetrics.resting_hr || '--'}</span>
                  <span className="text-xs font-mono text-secondary">bpm</span>
                </div>
              </div>

              <div className="flex flex-col items-start text-left space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">Sonno</span>
                <span className="text-4xl font-black font-mono text-[#3b82f6]">{formatSleepDuration(currentMetrics.sleep_duration).replace(' ', '')}</span>
              </div>

              <div className="flex flex-col items-start text-left space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">Stress</span>
                <span className="text-4xl font-black font-mono text-[#d97706]">{currentMetrics.stress_level ?? '--'}</span>
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
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-widest">{sectionAnalyses.overall.trendStatus}</h4>
                  <p className="text-sm text-secondary leading-relaxed font-sans">
                    {sectionAnalyses.overall.insightText}
                  </p>
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

            {/* AI Insight */}
            <div className="w-full">
              <AiInsightAccordion analysis={sectionAnalyses?.sleep} title="Insight Sonno" />
            </div>
          </section>

          {/* CARDIO E STRESS CARD */}
          <section className="clean-panel p-6 sm:p-8 shadow-sm flex flex-col space-y-6">
            <h3 className="text-xl font-bold tracking-tight text-primary">Cardio & Stress</h3>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
              <div className="space-y-4">
                <span className="text-[10px] uppercase font-bold tracking-widest text-secondary block">HR Intraday (24h)</span>
                <div className="h-[120px]">
                  {currentMetrics?.hr_timeline && currentMetrics.hr_timeline.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={currentMetrics.hr_timeline.map((h: any) => ({ time: new Date(h.time).getTime(), hr: h.hr }))}>
                        <YAxis hide domain={['dataMin', 'dataMax']} />
                        <Tooltip content={(props: any) => <MinimalTooltip {...props} unit="bpm" />} />
                        <Line type="monotone" dataKey="hr" stroke="var(--accent-rose)" strokeWidth={1.5} dot={false} activeDot={{ r: 4, fill: 'var(--accent-rose)' }} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-xs text-muted font-mono">Dati non disponibili</div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-secondary block">Correlazione</span>
                  <div className="flex gap-4 text-xs font-mono">
                    <button onClick={() => setCorrelationType('rhr')} className={correlationType === 'rhr' ? 'text-primary font-bold' : 'text-muted'}>RHR</button>
                    <button onClick={() => setCorrelationType('stress')} className={correlationType === 'stress' ? 'text-primary font-bold' : 'text-muted'}>STRESS</button>
                  </div>
                </div>
                <div className="h-[120px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={[...dailyMetrics].reverse().map(m => ({
                      date: new Date(m.date).toLocaleDateString('it-IT', { day: '2-digit' }),
                      sleep: m.sleep_score || 70,
                      rhr: m.resting_hr || null,
                      stress: m.stress_level ?? (m.resting_hr ? Math.round(Math.max(12, Math.min(85, (m.resting_hr - 40) * 0.95 + 10))) : 22),
                    }))}>
                      <YAxis yAxisId="left" hide domain={[0, 100]} />
                      <YAxis yAxisId="right" orientation="right" hide domain={correlationType === 'stress' ? [0, 100] : ['auto', 'auto']} />
                      <Tooltip content={(props: any) => <MinimalTooltip {...props} />} />
                      <Bar yAxisId="left" dataKey="sleep" fill="var(--accent-blue)" radius={[2, 2, 0, 0]} maxBarSize={16} />
                      {correlationType === 'rhr' ? (
                        <Line yAxisId="right" type="monotone" dataKey="rhr" stroke="var(--accent-rose)" strokeWidth={2} dot={{ r: 2, fill: 'var(--accent-rose)' }} connectNulls />
                      ) : (
                        <Line yAxisId="right" type="monotone" dataKey="stress" stroke="var(--accent-amber)" strokeWidth={2} dot={{ r: 2, fill: 'var(--accent-amber)' }} connectNulls />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* AI Insight */}
            <div className="w-full">
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
                          type="monotone" 
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

            </div>

            {/* AI Insights (Attivita + Corpo) */}
            <div className="w-full space-y-2 pt-2">
              <AiInsightAccordion analysis={sectionAnalyses?.activity} title="Insight Attività" />
              <AiInsightAccordion analysis={sectionAnalyses?.body} title="Insight Corpo" />
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
                  const idx = dailyMetrics.findIndex(m => m.date.startsWith(selectedPickerDate));
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
