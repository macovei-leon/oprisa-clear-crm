import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://odgtubiqvxcszsfifjfd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZ3R1Ymlxdnhjc3pzZmlmamZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjA5NDksImV4cCI6MjA5NzUzNjk0OX0.qKXx5hsrG5nJu2bfeu6RZeBWKhcpRfY077eygekXy50';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const sql = `
  CREATE OR REPLACE FUNCTION public.upsert_kanban_snapshot_map(p_flow_id uuid, p_stamp_time timestamptz, p_tasks_map jsonb)
  RETURNS void AS $$
  BEGIN
    UPDATE public.crm_repetitive_snapshots 
    SET tasks_map = p_tasks_map
    WHERE repetitive_flow_id = p_flow_id AND stamp_time = p_stamp_time;
    
    IF NOT FOUND THEN
      INSERT INTO public.crm_repetitive_snapshots (repetitive_flow_id, stamp_time, tasks_map)
      VALUES (p_flow_id, p_stamp_time, p_tasks_map);
    END IF;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;
  
  const { error } = await supabase.rpc('execute_ddl', { query_text: sql });
  console.log(error ? error : 'Updated upsert_kanban_snapshot_map to not use ON CONFLICT successfully');
}

run();
