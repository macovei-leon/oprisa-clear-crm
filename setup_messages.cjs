const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://odgtubiqvxcszsfifjfd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZ3R1Ymlxdnhjc3pzZmlmamZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjA5NDksImV4cCI6MjA5NzUzNjk0OX0.qKXx5hsrG5nJu2bfeu6RZeBWKhcpRfY077eygekXy50');

const query = `
CREATE TABLE IF NOT EXISTS public.app_messages (
  id uuid default gen_random_uuid() primary key,
  thread_id uuid not null,
  sender_id uuid references public.profiles(id) not null,
  receiver_id uuid references public.profiles(id) not null,
  subject text not null,
  message text not null,
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.app_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see their own messages" ON public.app_messages;
CREATE POLICY "Users can see their own messages" 
ON public.app_messages FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can insert messages" ON public.app_messages;
CREATE POLICY "Users can insert messages" 
ON public.app_messages FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update their received messages" ON public.app_messages;
CREATE POLICY "Users can update their received messages"
ON public.app_messages FOR UPDATE
USING (auth.uid() = receiver_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_messages;
`;

async function run() {
  const res = await sb.rpc('execute_ddl', { query_text: query });
  console.log('Setup messages result:', res);
}

run();
