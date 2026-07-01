const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://hdzrwlejqhygqyatiqgn.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkenJ3bGVqcWh5Z3F5YXRpcWduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MzU2MjAsImV4cCI6MjA5ODMxMTYyMH0.gHGptYkGtr_qVeNhQTLDG36KrmT05OibWbeJQ0LYKmw');

const sql = `
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible." ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Anyone can upload an avatar." ON storage.objects;
CREATE POLICY "Anyone can upload an avatar." ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Anyone can update an avatar." ON storage.objects;
CREATE POLICY "Anyone can update an avatar." ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'avatars');
`;

sb.rpc('execute_ddl', { query_text: sql }).then(console.log).catch(console.error);
