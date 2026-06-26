import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://odgtubiqvxcszsfifjfd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZ3R1Ymlxdnhjc3pzZmlmamZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjA5NDksImV4cCI6MjA5NzUzNjk0OX0.qKXx5hsrG5nJu2bfeu6RZeBWKhcpRfY077eygekXy50';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Reading dashboard_data.json...");
  const raw = fs.readFileSync('C:/Users/user/Desktop/oprisa ultimate crm/frontend/public/dashboard_data.json', 'utf8');
  const appData = JSON.parse(raw);
  
  console.log("Upserting into Supabase fleetcap_app_data...");
  const { data, error } = await supabase
    .from('fleetcap_app_data')
    .upsert([{ id: 'default', data: appData }]);
    
  if (error) {
    console.error("Error upserting:", error);
    // Let's try inserting via REST if the table doesn't exist? No, we have to create the table first.
  } else {
    console.log("Successfully inserted app data!");
  }
}

run();
