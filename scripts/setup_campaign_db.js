import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://odgtubiqvxcszsfifjfd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZ3R1Ymlxdnhjc3pzZmlmamZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjA5NDksImV4cCI6MjA5NzUzNjk0OX0.qKXx5hsrG5nJu2bfeu6RZeBWKhcpRfY077eygekXy50';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
    -- Add steps to campaigns if it doesn't exist
    ALTER TABLE public.crm_campaigns ADD COLUMN IF NOT EXISTS steps jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE public.crm_campaigns ADD COLUMN IF NOT EXISTS target_role text;
    ALTER TABLE public.crm_campaigns ADD COLUMN IF NOT EXISTS trigger_type text;

    -- Create crm_tasks table
    CREATE TABLE IF NOT EXISTS public.crm_tasks (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      campaign_id uuid REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
      row_data jsonb NOT NULL,
      assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      active_step_idx integer DEFAULT 0,
      completed boolean DEFAULT false,
      category text,
      created_at timestamp with time zone DEFAULT now()
    );
    ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public.crm_tasks;
    CREATE POLICY "Allow all access to authenticated users" ON public.crm_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
    NOTIFY pgrst, 'reload schema';
  `;
  const { data, error } = await supabase.rpc('execute_ddl', { query_text: sql });
  if (error) {
    console.error('Error executing DDL:', error);
  } else {
    console.log('Successfully created crm_tasks and updated crm_campaigns.');
  }
}
run();
