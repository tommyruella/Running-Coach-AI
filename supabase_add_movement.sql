-- Questo script aggiorna la tabella "daily_metrics" aggiungendo le nuove colonne per il movimento.

ALTER TABLE daily_metrics
ADD COLUMN IF NOT EXISTS distance_m INT,
ADD COLUMN IF NOT EXISTS calories_active INT,
ADD COLUMN IF NOT EXISTS ran_today BOOLEAN DEFAULT false;

-- Eliminiamo la vista precedente per evitare l'errore di Postgres 
-- sul riordino o sull'aggiunta di nuove colonne.
DROP VIEW IF EXISTS daily_trends_view;

-- Creiamo la nuova vista aggiornata
CREATE VIEW daily_trends_view AS
SELECT 
    date,
    sleep_score,
    resting_hr,
    stress_level,
    distance_m,
    calories_active,
    ran_today,
    
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
