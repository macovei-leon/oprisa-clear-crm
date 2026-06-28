require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local', override: true });

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://odgtubiqvxcszsfifjfd.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function setup() {
    console.log("Setting up driver_timeline_data table...");
    
    // Create the table using execute_sql or via DDL if possible, but let's just try RPC
    const createSql = `
        CREATE TABLE IF NOT EXISTS public.driver_timeline_data (
            id text PRIMARY KEY,
            data jsonb
        );
        -- Insert default row if not exists
        INSERT INTO public.driver_timeline_data (id, data) 
        VALUES ('default', '[]'::jsonb)
        ON CONFLICT (id) DO NOTHING;
    `;
    
    // The execute_ddl rpc we created earlier!
    const { error } = await supabase.rpc('execute_ddl', { query_text: createSql });
    
    if (error) {
        console.error("Failed to execute DDL via RPC. Trying direct table insert to test...", error);
    } else {
        console.log("driver_timeline_data created via execute_ddl successfully!");
    }
    
    // Also test an insert
    const { error: insErr } = await supabase.from('driver_timeline_data').upsert({ id: 'default', data: [] });
    if (insErr) {
        console.error("Insert into driver_timeline_data failed. It might not exist.", insErr);
    } else {
        console.log("Insert into driver_timeline_data succeeded!");
    }
}

setup();
