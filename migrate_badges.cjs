const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://odgtubiqvxcszsfifjfd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZ3R1Ymlxdnhjc3pzZmlmamZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjA5NDksImV4cCI6MjA5NzUzNjk0OX0.qKXx5hsrG5nJu2bfeu6RZeBWKhcpRfY077eygekXy50';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  let sql = `
    ALTER TABLE public.crm_tasks ADD COLUMN IF NOT EXISTS badges jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE public.crm_repetitive_tasks ADD COLUMN IF NOT EXISTS badges jsonb DEFAULT '[]'::jsonb;

    CREATE OR REPLACE FUNCTION filter_persisted_badges(badges jsonb) RETURNS jsonb AS $$
    SELECT COALESCE(
      (SELECT jsonb_agg(elem)
       FROM jsonb_array_elements(badges) AS elem
       WHERE (elem->>'persist_on_reset')::boolean = true), 
      '[]'::jsonb
    );
    $$ LANGUAGE SQL IMMUTABLE;
  `;
  let res = await supabase.rpc('execute_ddl', { query_text: sql });
  if (res.error) console.error('Error 1:', res.error);
  else console.log('Added badges columns and helper function');

  let resetFnSql = `
CREATE OR REPLACE FUNCTION public.reset_repetitive_tasks(p_flow_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.crm_repetitive_tasks t
  SET completed = false,
      category = null,
      active_step_idx = 0,
      completed_at = null,
      updated_at = CURRENT_TIMESTAMP,
      badges = filter_persisted_badges(COALESCE(t.badges, '[]'::jsonb))
  FROM public.crm_repetitive_flows f
  WHERE t.repetitive_flow_id = f.id
    AND f.id = p_flow_id
    AND f.is_stopped = false
    AND (t.completed = true OR t.active_step_idx > 0)
    AND t.updated_at IS NOT NULL
    AND CURRENT_TIMESTAMP >= (t.updated_at + (COALESCE(f.reset_interval_hours, 0) || ' hours')::interval + (COALESCE(f.reset_interval_minutes, 0) || ' minutes')::interval);
END;
$$;
  `;
  res = await supabase.rpc('execute_ddl', { query_text: resetFnSql });
  if (res.error) console.error('Error 2:', res.error);
  else console.log('Updated reset_repetitive_tasks');
}
run();
