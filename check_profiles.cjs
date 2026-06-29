const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://odgtubiqvxcszsfifjfd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZ3R1Ymlxdnhjc3pzZmlmamZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjA5NDksImV4cCI6MjA5NzUzNjk0OX0.qKXx5hsrG5nJu2bfeu6RZeBWKhcpRfY077eygekXy50');

async function run() {
  const { data, error } = await sb.from('profiles').select('*');
  console.log('Profiles error:', error);
  console.log('Profiles data:', data);
}

run();
