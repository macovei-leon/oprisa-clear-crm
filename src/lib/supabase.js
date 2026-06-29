import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hdzrwlejqhygqyatiqgn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkenJ3bGVqcWh5Z3F5YXRpcWduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MzU2MjAsImV4cCI6MjA5ODMxMTYyMH0.gHGptYkGtr_qVeNhQTLDG36KrmT05OibWbeJQ0LYKmw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
