import { DailyMetrics } from '../types';

export interface SectionAnalysis {
  trendStatus: string;
  insightText: string;
  marginOfImprovement: string;
}

export interface Health360Analysis {
  date: string;
  overall: SectionAnalysis;
  sleep: SectionAnalysis;
  cardio: SectionAnalysis;
  activity: SectionAnalysis;
  body: SectionAnalysis;
}

export function generateHealthSectionAnalysis(
  current: DailyMetrics,
  history: DailyMetrics[] = []
): Health360Analysis {
  const dateStr = current.date;
  
  // 1. Calculate 7-day and 30-day historical baselines strictly from data
  const recent7 = history.slice(0, 7);
  const recent30 = history.slice(0, 30);

  const getAvg = (list: DailyMetrics[], key: keyof DailyMetrics, defaultVal: number) => {
    const valid = list.filter(m => m[key] != null && typeof m[key] === 'number');
    if (valid.length === 0) return defaultVal;
    return Math.round(valid.reduce((acc, m) => acc + (m[key] as number), 0) / valid.length);
  };

  const avgRhr7 = getAvg(recent7, 'resting_hr', current.resting_hr || 52);
  const avgRhr30 = getAvg(recent30, 'resting_hr', avgRhr7);

  const avgSleep7 = getAvg(recent7, 'sleep_duration', current.sleep_duration || 450);
  const avgSleep30 = getAvg(recent30, 'sleep_duration', avgSleep7);

  const avgSteps7 = getAvg(recent7, 'steps', current.steps || 8000);
  const avgSteps30 = getAvg(recent30, 'steps', avgSteps7);

  const avgStress7 = getAvg(recent7, 'stress_level', current.stress_level || 22);

  const currentRhr = current.resting_hr || avgRhr7;
  const currentSleep = current.sleep_duration || avgSleep7;
  const currentSteps = current.steps || avgSteps7;
  const currentStress = current.stress_level ?? avgStress7;
  const currentWeight = current.weight_kg || 70;

  // ---------------------------------------------------------------------------
  // 1. PANORAMICA GENERALE A 360°
  // ---------------------------------------------------------------------------
  const rhr7Diff = currentRhr - avgRhr7;
  const sleepHrs7 = (avgSleep7 / 60).toFixed(1);
  let overallStatus = "Trend 7gg: Stabile • Buon Recupero Generale";
  let overallInsight = `Le metriche mostrano un quadro di recupero bilanciato: battito a riposo a ${currentRhr} bpm e media sonno di ${sleepHrs7} ore negli ultimi 7 giorni.`;
  let overallMargin = "Margine di miglioramento: Mantenere l'orario di riposo serale costante nei giorni di allenamento intenso per prevenire l'accumulo di stanchezza.";

  if (rhr7Diff > 3 || currentStress > 35) {
    overallStatus = "Trend 7gg: Lieve Affaticamento Rilevato";
    overallInsight = `La frequenza cardiaca a riposo è salita di +${rhr7Diff} bpm rispetto alla media settimanale (${avgRhr7} bpm), associata ad un livello di stress giornaliero di ${currentStress}/100.`;
    overallMargin = "Margine di miglioramento: Pianificare una giornata di corsa leggera (Zona 2) o riposo attivo ed idratarsi abbondantemente prima di dormire.";
  } else if (rhr7Diff < -2) {
    overallStatus = "Trend 7gg: In Miglioramento • Forma Eccellente";
    overallInsight = `Il battito a riposo è sceso a ${currentRhr} bpm (${Math.abs(rhr7Diff)} bpm sotto la media settimanale di ${avgRhr7} bpm), segno di un'ottima risposta agli allenamenti recenti.`;
    overallMargin = "Margine di miglioramento: Approfittare di questa finestra di forma ottimale per inserire una sessione di qualità o un lavoro di ritmo.";
  }

  // ---------------------------------------------------------------------------
  // 2. SONNO & ARCHITETTURA NOTTURNA
  // ---------------------------------------------------------------------------
  const sleepHrsCurrent = (currentSleep / 60).toFixed(1);
  const sleepDiffMin = currentSleep - avgSleep7;
  const deepMin = current.sleep_deep || Math.round(currentSleep * 0.18);
  const remMin = current.sleep_rem || Math.round(currentSleep * 0.22);
  const deepPct = Math.round((deepMin / (currentSleep || 1)) * 100);

  let sleepStatus = `Trend 7gg: ${sleepHrsCurrent}h riposate (Media 7gg: ${sleepHrs7}h)`;
  let sleepInsight = `In questa giornata hai dormito ${sleepHrsCurrent} ore (${sleepDiffMin >= 0 ? '+' : ''}${sleepDiffMin} min rispetto alla media settimanale). Fasi registrate: ${deepMin} min di sonno profondo (${deepPct}%) e ${remMin} min di fase REM.`;
  let sleepMargin = "Margine di miglioramento: Per aumentare la percentuale di sonno profondo, evita schermi luminosi e pasti abbondanti nei 90 minuti prima di coricarti.";

  if (currentSleep < 390) {
    sleepStatus = `Trend 7gg: Riposo Ridotto (${sleepHrsCurrent}h registrate)`;
    sleepInsight = `La durata del sonno (${sleepHrsCurrent}h) è inferiore rispetto alla media abituale di ${sleepHrs7}h. Il ricarico energetico muscolare è parziale.`;
    sleepMargin = "Margine di miglioramento: Recuperare almeno 45 minuti di sonno la notte successiva per ristabilire la piena efficienza muscolare.";
  }

  // ---------------------------------------------------------------------------
  // 3. SISTEMA CARDIOVASCOLARE & RIPOSO
  // ---------------------------------------------------------------------------
  const rhr30Diff = currentRhr - avgRhr30;
  let cardioStatus = `RHR Attuale: ${currentRhr} bpm (Media 7gg: ${avgRhr7} bpm • 30gg: ${avgRhr30} bpm)`;
  let cardioInsight = `Il battito a riposo (${currentRhr} bpm) si mantiene perfettamente allineato con la baseline mensile (${avgRhr30} bpm). Lo stress giornaliero si attesta su un valore di ${currentStress}/100.`;
  let cardioMargin = "Margine di miglioramento: Mantenere sessioni regolari di respirazione diaframmatica di 5 minuti dopo l'allenamento per abbassare rapidamente i battiti.";

  if (rhr30Diff > 4) {
    cardioStatus = `Innalzamento RHR (+${rhr30Diff} bpm su media 30gg)`;
    cardioInsight = `Il battito a riposo odierno (${currentRhr} bpm) è superiore di ${rhr30Diff} bpm rispetto alla media dei 30 giorni (${avgRhr30} bpm), indicando che il corpo sta gestendo un carico di lavoro o di stress elevato.`;
    cardioMargin = "Margine di miglioramento: Ridurre l'intensità della corsa odierna mantenendo la frequenza cardiaca al di sotto della Zona 3.";
  }

  // ---------------------------------------------------------------------------
  // 4. ATTIVITÀ, MOVIMENTO & CALORIE
  // ---------------------------------------------------------------------------
  const stepsDiff = currentSteps - avgSteps7;
  const kmEst = (current.distance_m ? current.distance_m / 1000 : currentSteps * 0.00075).toFixed(1);
  const steps30k = (avgSteps30 / 1000).toFixed(1);

  let actStatus = `Trend Volumi: ${currentSteps.toLocaleString()} passi (${kmEst} km)`;
  let actInsight = `Hai registrato ${currentSteps.toLocaleString()} passi (${stepsDiff >= 0 ? '+' : ''}${stepsDiff.toLocaleString()} rispetto alla media 7gg di ${avgSteps7.toLocaleString()} passi). Media a 30 giorni: ${steps30k}k passi/giorno.`;
  let actMargin = "Margine di miglioramento: Distribuire i passi durante tutta la giornata ed effettuare 5 minuti di mobilità articolare dopo le sessioni lunghe.";

  if (currentSteps < 4000) {
    actStatus = `Giorno di Riposo / Basso Movimento (${currentSteps.toLocaleString()} passi)`;
    actInsight = `Volume di movimento contenuto (${currentSteps.toLocaleString()} passi vs media di ${avgSteps7.toLocaleString()}). Ideale come giornata di recupero strutturato.`;
    actMargin = "Margine di miglioramento: Eseguire una camminata rigenerante di 15 minuti in serata per favorire la circolazione muscolare.";
  }

  // ---------------------------------------------------------------------------
  // 5. COMPOSIZIONE CORPOREA & PESO
  // ---------------------------------------------------------------------------
  const recent90 = history.slice(0, 90);
  
  const getLatestWeight = (list: DailyMetrics[]) => {
    const valid = list.filter(m => m.weight_kg != null && typeof m.weight_kg === 'number' && m.weight_kg > 0);
    return valid.length > 0 ? valid[0].weight_kg : null;
  };

  const currentWeightFixed = current.weight_kg || getLatestWeight(recent7) || getLatestWeight(recent30);
  
  let bodyStatus = "Dati Peso Non Disponibili";
  let bodyInsight = "Nessuna misurazione del peso registrata di recente.";
  let bodyMargin = "Margine di miglioramento: Registra il tuo peso regolarmente (idealmente al mattino a digiuno) per sbloccare l'analisi del trend.";

  if (currentWeightFixed != null) {
    const weight7 = getAvg(recent7, 'weight_kg', currentWeightFixed);
    const weight30 = getAvg(recent30, 'weight_kg', weight7);
    const weight90 = getAvg(recent90, 'weight_kg', weight30);
    
    const diff30 = (weight7 - weight30).toFixed(1);
    const diff90 = (weight30 - weight90).toFixed(1);
    
    const numDiff30 = Number(diff30);
    const numDiff90 = Number(diff90);
    
    bodyStatus = `Peso Recente: ${currentWeightFixed.toFixed(1)} kg (Trend a 30gg: ${numDiff30 > 0 ? '+' : ''}${numDiff30} kg)`;
    
    let trendDesc = "Stabile";
    if (numDiff30 > 0.8) trendDesc = "In Aumento";
    else if (numDiff30 < -0.8) trendDesc = "In Diminuzione";
    
    let longTrendDesc = "Costante";
    if (numDiff90 > 1.5) longTrendDesc = "Aumento sul Lungo Periodo";
    else if (numDiff90 < -1.5) longTrendDesc = "Diminuzione sul Lungo Periodo";
    
    bodyInsight = `Analisi Globale: Il peso medio settimanale è ${weight7.toFixed(1)} kg (${trendDesc} vs media mensile di ${weight30.toFixed(1)} kg). Sul trimestre il trend risulta ${longTrendDesc} (media 90gg: ${weight90.toFixed(1)} kg).`;
    
    bodyMargin = "Margine di miglioramento: Per ottimizzare la composizione corporea, abbina allenamenti di forza alla corsa per preservare la massa magra durante le fasi di calo ponderale.";
    
    if (numDiff30 > 1.2) {
      bodyMargin = "Margine di miglioramento: Un rapido aumento di peso a breve termine è spesso ritenzione idrica. Assicurati di bere a sufficienza e limitare l'eccesso di sodio post-corsa.";
    } else if (numDiff30 < -1.2) {
      bodyMargin = "Margine di miglioramento: Il peso sta calando velocemente. Monitora l'apporto energetico per evitare di perdere forza e intaccare il recupero muscolare (mangia abbastanza carboidrati!).";
    }
  }

  return {
    date: dateStr,
    overall: { trendStatus: overallStatus, insightText: overallInsight, marginOfImprovement: overallMargin },
    sleep: { trendStatus: sleepStatus, insightText: sleepInsight, marginOfImprovement: sleepMargin },
    cardio: { trendStatus: cardioStatus, insightText: cardioInsight, marginOfImprovement: cardioMargin },
    activity: { trendStatus: actStatus, insightText: actInsight, marginOfImprovement: actMargin },
    body: { trendStatus: bodyStatus, insightText: bodyInsight, marginOfImprovement: bodyMargin }
  };
}
