const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://odgtubiqvxcszsfifjfd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZ3R1Ymlxdnhjc3pzZmlmamZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjA5NDksImV4cCI6MjA5NzUzNjk0OX0.qKXx5hsrG5nJu2bfeu6RZeBWKhcpRfY077eygekXy50');

const query = `
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, department_id, email, role, status)
  values (
    new.id,
    new.raw_user_meta_data->>'name',
    nullif(new.raw_user_meta_data->>'department_id', '')::uuid,
    new.email,
    'user',
    'pending'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
`;

async function run() {
  const res = await sb.rpc('execute_ddl', { query_text: query });
  console.log('Result:', res);
}

run();
