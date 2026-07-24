-- Script per creare la tabella daily_metrics
-- Da eseguire nel SQL Editor di Supabase

CREATE TABLE IF NOT EXISTS daily_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    sleep_duration INTEGER, -- in minutes
    sleep_score INTEGER,
    resting_hr INTEGER,
    weight_kg NUMERIC,
    calories_total INTEGER,
    calories_active INTEGER,
    steps INTEGER,
    stress_level INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Abilita RLS (Row Level Security) se necessario, oppure lascia pubblica per il backend
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;

-- Crea policy per permettere l'accesso pubblico (visto che stiamo bypassando l'auth frontend)
CREATE POLICY "Enable read access for all users" ON daily_metrics FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON daily_metrics FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON daily_metrics FOR UPDATE USING (true) WITH CHECK (true);
