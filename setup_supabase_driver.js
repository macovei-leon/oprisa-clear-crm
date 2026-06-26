import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://odgtubiqvxcszsfifjfd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZ3R1Ymlxdnhjc3pzZmlmamZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjA5NDksImV4cCI6MjA5NzUzNjk0OX0.qKXx5hsrG5nJu2bfeu6RZeBWKhcpRfY077eygekXy50';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    const data = JSON.parse(fs.readFileSync('C:/Users/user/Desktop/temp-driver-dashboard/absent_drivers_last_3_days.json', 'utf8'));
    
    const { error } = await supabase
      .from('driver_dashboard_data')
      .upsert([{ id: 'default', data: data }]);
      
    if (error) {
      console.error("Error uploading data:", error);
    } else {
      console.log("Successfully uploaded driver dashboard data to Supabase!");
    }
  } catch (err) {
    console.error("Failed:", err);
  }
}

run();
