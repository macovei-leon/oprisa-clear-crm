import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://odgtubiqvxcszsfifjfd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZ3R1Ymlxdnhjc3pzZmlmamZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjA5NDksImV4cCI6MjA5NzUzNjk0OX0.qKXx5hsrG5nJu2bfeu6RZeBWKhcpRfY077eygekXy50';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
    CREATE TABLE IF NOT EXISTS public.crm_campaigns (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      name text NOT NULL,
      description text,
      is_active boolean DEFAULT true,
      created_at timestamp with time zone DEFAULT now()
    );
    ALTER TABLE public.crm_campaigns ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public.crm_campaigns;
    CREATE POLICY "Allow all access to authenticated users" ON public.crm_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);
    NOTIFY pgrst, 'reload schema';
  `;
  const { data, error } = await supabase.rpc('execute_ddl', { query_text: sql });
  if (error) {
    console.error('Error executing DDL:', error);
  } else {
    console.log('Successfully created crm_campaigns table.');
  }
}
run();
