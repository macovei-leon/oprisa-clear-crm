import { supabase } from './src/lib/supabase.js';

const ddlSql = `
CREATE TABLE IF NOT EXISTS public.crm_repetitive_flows (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  steps jsonb DEFAULT '[]'::jsonb,
  target_role text DEFAULT 'support',
  trigger_type text DEFAULT 'Manual',
  visible_columns jsonb DEFAULT '[]'::jsonb,
  reset_interval_hours integer DEFAULT 24
);

CREATE TABLE IF NOT EXISTS public.crm_repetitive_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  repetitive_flow_id uuid REFERENCES public.crm_repetitive_flows(id) ON DELETE CASCADE,
  row_data jsonb DEFAULT '{}'::jsonb,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  active_step_idx integer DEFAULT 0,
  completed boolean DEFAULT false,
  category text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.crm_repetitive_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  repetitive_flow_id uuid REFERENCES public.crm_repetitive_flows(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.crm_repetitive_tasks(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  category text,
  completed_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_repetitive_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_repetitive_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_repetitive_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public.crm_repetitive_flows;
CREATE POLICY "Allow all access to authenticated users" ON public.crm_repetitive_flows FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public.crm_repetitive_tasks;
CREATE POLICY "Allow all access to authenticated users" ON public.crm_repetitive_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public.crm_repetitive_history;
CREATE POLICY "Allow all access to authenticated users" ON public.crm_repetitive_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.reset_repetitive_tasks(p_flow_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.crm_repetitive_tasks t
  SET completed = false,
      category = null,
      active_step_idx = 0,
      completed_at = null
  FROM public.crm_repetitive_flows f
  WHERE t.repetitive_flow_id = f.id
    AND f.id = p_flow_id
    AND t.completed = true
    AND t.completed_at IS NOT NULL
    AND CURRENT_TIMESTAMP >= (t.completed_at + (f.reset_interval_hours || ' hours')::interval);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
`;

async function run() {
  const { error } = await supabase.rpc('execute_ddl', { query_text: ddlSql });
  console.log(error ? error : 'DDL success');
}

run();
