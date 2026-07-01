const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://odgtubiqvxcszsfifjfd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZ3R1Ymlxdnhjc3pzZmlmamZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjA5NDksImV4cCI6MjA5NzUzNjk0OX0.qKXx5hsrG5nJu2bfeu6RZeBWKhcpRfY077eygekXy50';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  let sql = `
    ALTER TABLE public.crm_repetitive_flows ADD COLUMN IF NOT EXISTS permanent_categories jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE public.crm_campaigns ADD COLUMN IF NOT EXISTS permanent_categories jsonb DEFAULT '[]'::jsonb;
  `;
  let res = await supabase.rpc('execute_ddl', { query_text: sql });
  if (res.error) console.error('Error adding columns:', res.error);
  else console.log('Added permanent_categories columns to crm_repetitive_flows and crm_campaigns');

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
    AND CURRENT_TIMESTAMP >= (t.updated_at + (COALESCE(f.reset_interval_hours, 0) || ' hours')::interval + (COALESCE(f.reset_interval_minutes, 0) || ' minutes')::interval)
    AND (t.category IS NULL OR NOT (COALESCE(f.permanent_categories, '[]'::jsonb) @> to_jsonb(t.category)));
END;
$$;
  `;
  res = await supabase.rpc('execute_ddl', { query_text: resetFnSql });
  if (res.error) console.error('Error updating function:', res.error);
  else console.log('Updated reset_repetitive_tasks function');
}
run();
