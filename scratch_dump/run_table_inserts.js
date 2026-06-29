const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient('https://hdzrwlejqhygqyatiqgn.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkenJ3bGVqcWh5Z3F5YXRpcWduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MzU2MjAsImV4cCI6MjA5ODMxMTYyMH0.gHGptYkGtr_qVeNhQTLDG36KrmT05OibWbeJQ0LYKmw');

async function run() {
  const sql = fs.readFileSync('C:/Users/user/Desktop/oprisa-clear-crm/scratch_dump/insert_tables2.sql', 'utf8');
  console.log('Sending SQL of length: ', sql.length);
  
  const { data, error } = await supabase.rpc('execute_ddl', { query_text: sql });
  if (error) {
    console.error('Error inserting tables:', error);
  } else {
    console.log('Successfully inserted all table data!');
  }
}

run();
