CREATE TABLE IF NOT EXISTS public.app_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_repetitive_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  repetitive_flow_id uuid NOT NULL,
  stamp_time timestamp with time zone NOT NULL,
  steps_structure jsonb,
  tasks_map jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dashboard_settings (
  id integer DEFAULT 1 PRIMARY KEY,
  active_table text DEFAULT 'angajati'::text,
  timeline_data jsonb,
  raw_timeline_data jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  raw_file_path text DEFAULT 'raw_timeline.json'::text,
  timeline_file_path text DEFAULT '../public/driver-dashboard/timeline_data.json'::text
);

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  instructions text DEFAULT ''::text
);

CREATE TABLE IF NOT EXISTS public.driver_activity (
  id serial PRIMARY KEY,
  pn text,
  nume text,
  data text,
  nr_curse integer,
  timp_online text,
  timp_muncit text,
  val_diurna double precision,
  val_ore_lucrate double precision
);

CREATE TABLE IF NOT EXISTS public.driver_daily_actions (
  id serial PRIMARY KEY,
  driver_pn text NOT NULL,
  status text NOT NULL,
  user_id uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.driver_dashboard_data (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public.driver_email_batches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  status text DEFAULT 'Running'::text NOT NULL,
  total_emails integer DEFAULT 0,
  sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fleetcap_app_data (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  status text DEFAULT 'pending'::text,
  role text DEFAULT 'user'::text,
  name text,
  department_id uuid,
  email text
);
