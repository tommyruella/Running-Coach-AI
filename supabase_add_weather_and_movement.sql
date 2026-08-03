-- Script completo per aggiungere colonne di Movimento e Meteo a "daily_metrics" su Supabase

ALTER TABLE daily_metrics
ADD COLUMN IF NOT EXISTS distance_m INT,
ADD COLUMN IF NOT EXISTS calories_active INT,
ADD COLUMN IF NOT EXISTS ran_today BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS weather_temp NUMERIC(4,1),
ADD COLUMN IF NOT EXISTS weather_humidity INT,
ADD COLUMN IF NOT EXISTS weather_desc TEXT;

-- Eliminiamo la vista precedente per evitare errori di Postgres (42P16)
DROP VIEW IF EXISTS daily_trends_view;

-- Ricreiamo la vista aggiornata con le nuove colonne
CREATE VIEW daily_trends_view AS
SELECT 
    date,
    sleep_score,
    resting_hr,
    stress_level,
    distance_m,
    calories_active,
    ran_today,
    weather_temp,
    weather_humidity,
    weather_desc,
    
    AVG(sleep_score) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS sleep_7d_avg,
    AVG(resting_hr) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS rhr_7d_avg,
    AVG(stress_level) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS stress_7d_avg,
    AVG(distance_m) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS distance_7d_avg,
    
    AVG(sleep_score) OVER (ORDER BY date ROWS BETWEEN 27 PRECEDING AND CURRENT ROW) AS sleep_28d_avg,
    AVG(resting_hr) OVER (ORDER BY date ROWS BETWEEN 27 PRECEDING AND CURRENT ROW) AS rhr_28d_avg,
    
    (AVG(resting_hr) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)) - 
    (AVG(resting_hr) OVER (ORDER BY date ROWS BETWEEN 27 PRECEDING AND CURRENT ROW)) AS rhr_recovery_delta

FROM daily_metrics
ORDER BY date DESC;
