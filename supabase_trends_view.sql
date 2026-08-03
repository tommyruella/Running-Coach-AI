-- Questo script crea una Vista (View) nel tuo database Supabase.
-- Una Vista si comporta esattamente come una tabella normale, 
-- ma calcola i trend in tempo reale leggendo da "daily_metrics".
-- Puoi interrogare "daily_trends_view" come se fosse una tabella per 
-- fare tutte le indagini che vuoi (es. esportare i dati in Excel o per AI).

CREATE OR REPLACE VIEW daily_trends_view AS
SELECT 
    date,
    -- Valori del giorno
    sleep_score,
    resting_hr,
    stress_level,
    
    -- Medie Mobili (Moving Averages) a 7 giorni
    AVG(sleep_score) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS sleep_7d_avg,
    AVG(resting_hr) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS rhr_7d_avg,
    AVG(stress_level) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS stress_7d_avg,
    
    -- Baseline (Medie Mobili a 28 giorni)
    AVG(sleep_score) OVER (ORDER BY date ROWS BETWEEN 27 PRECEDING AND CURRENT ROW) AS sleep_28d_avg,
    AVG(resting_hr) OVER (ORDER BY date ROWS BETWEEN 27 PRECEDING AND CURRENT ROW) AS rhr_28d_avg,
    
    -- Calcolo del Delta di recupero (differenza tra 7g e 28g per il RHR)
    (AVG(resting_hr) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)) - 
    (AVG(resting_hr) OVER (ORDER BY date ROWS BETWEEN 27 PRECEDING AND CURRENT ROW)) AS rhr_recovery_delta

FROM daily_metrics
ORDER BY date DESC;

-- Esempio di utilizzo futuro:
-- SELECT * FROM daily_trends_view WHERE date > '2026-07-01';
-- Se rhr_recovery_delta > 3, significa forte affaticamento accumulato in quella data.
