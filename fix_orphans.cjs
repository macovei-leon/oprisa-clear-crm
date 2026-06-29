const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://odgtubiqvxcszsfifjfd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZ3R1Ymlxdnhjc3pzZmlmamZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjA5NDksImV4cCI6MjA5NzUzNjk0OX0.qKXx5hsrG5nJu2bfeu6RZeBWKhcpRfY077eygekXy50');

const query = `
  insert into public.profiles (id, name, department_id, email, role, status)
  select 
    id,
    raw_user_meta_data->>'name',
    nullif(raw_user_meta_data->>'department_id', '')::uuid,
    email,
    'user',
    'pending'
  from auth.users
  where id not in (select id from public.profiles);
`;

async function run() {
  const res = await sb.rpc('execute_ddl', { query_text: query });
  console.log('Result:', res);
}

run();
