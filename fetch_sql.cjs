const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', {
    query: "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'update_kanban_snapshot'"
  });
  if (error) console.error(error);
  else console.log(data);
}

run();
