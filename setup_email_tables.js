import { createClient } from '@supabase/supabase-js';

// We get the URL and KEY from the existing app code
import fs from 'fs';
const appCode = fs.readFileSync('src/lib/supabase.js', 'utf8');
const urlMatch = appCode.match(/const supabaseUrl = ['"]([^'"]+)['"]/);
const keyMatch = appCode.match(/const supabaseAnonKey = ['"]([^'"]+)['"]/);

if (!urlMatch || !keyMatch) {
    console.error("Could not find supabase credentials");
    process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function setup() {
    console.log("Setting up email tables...");

    const { error: e1 } = await supabase.rpc('execute_sql', {
        sql_query: `
            CREATE TABLE IF NOT EXISTS driver_email_settings (
                id INT PRIMARY KEY,
                is_enabled BOOLEAN DEFAULT false,
                cron_schedule TEXT DEFAULT '0 9 * * *',
                send_missing BOOLEAN DEFAULT false,
                send_fireable BOOLEAN DEFAULT false,
                send_unjustified BOOLEAN DEFAULT false
            );
            
            INSERT INTO driver_email_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

            CREATE TABLE IF NOT EXISTS driver_email_templates (
                category TEXT PRIMARY KEY,
                subject TEXT,
                body TEXT
            );

            CREATE TABLE IF NOT EXISTS driver_email_logs (
                id SERIAL PRIMARY KEY,
                driver_pn TEXT,
                email TEXT,
                category TEXT,
                status TEXT,
                details TEXT,
                sent_at TIMESTAMPTZ DEFAULT NOW()
            );
        `
    });
    
    if (e1) {
        console.error("RPC fail (maybe no execute_sql func). Will just insert dummy to trigger creation if RLS allows, or please run this in Supabase dashboard");
        console.log(e1);
    } else {
        console.log("Tables created via RPC");
    }
}
setup();
