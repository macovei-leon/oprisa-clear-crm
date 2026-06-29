CREATE TABLE IF NOT EXISTS public.angajati (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nou text,
  nume text,
  uuid text,
  pn text,
  inactiv text,
  tip_contract text,
  data_valabilitate_contract text,
  valabilitate_contract text,
  tip_vehicul text,
  email text,
  telefon text,
  last_status text,
  data_nasterii text,
  adresa text,
  nume_cont_bancar text,
  iban text,
  bic text,
  companie text,
  orase text,
  crm_processed boolean  DEFAULT false,
  new text,
  name text,
  inactive text,
  contract_type text,
  contract_validity_date text,
  contract_validity text,
  vehicle_type text,
  phone text,
  date_of_birth text,
  address text,
  company text,
  cities text
);

CREATE TABLE IF NOT EXISTS public.app_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  is_read boolean  DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.app_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  message text NOT NULL,
  is_read boolean  DEFAULT false,
  created_at timestamp with time zone  DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean  DEFAULT true,
  created_at timestamp with time zone  DEFAULT now(),
  steps jsonb  DEFAULT '[]'::jsonb,
  target_role text,
  trigger_type text,
  visible_columns jsonb  DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.crm_repetitive_flows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean  DEFAULT true,
  created_at timestamp with time zone  DEFAULT now(),
  steps jsonb  DEFAULT '[]'::jsonb,
  target_role text  DEFAULT 'support'::text,
  trigger_type text  DEFAULT 'Manual'::text,
  visible_columns jsonb  DEFAULT '[]'::jsonb,
  reset_interval_hours integer  DEFAULT 24,
  reset_interval_minutes integer  DEFAULT 0,
  is_stopped boolean  DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.crm_repetitive_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  repetitive_flow_id uuid,
  task_id uuid,
  worker_id uuid,
  category text,
  completed_date date  DEFAULT CURRENT_DATE,
  created_at timestamp with time zone  DEFAULT now(),
  notes text,
  step_name text,
  action_type text,
  card_snapshot jsonb
);

CREATE TABLE IF NOT EXISTS public.crm_repetitive_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  repetitive_flow_id uuid NOT NULL,
  stamp_time timestamp with time zone NOT NULL,
  steps_structure jsonb,
  tasks_map jsonb  DEFAULT '{}'::jsonb,
  created_at timestamp with time zone  DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_repetitive_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  repetitive_flow_id uuid,
  row_data jsonb  DEFAULT '{}'::jsonb,
  assigned_to uuid,
  active_step_idx integer  DEFAULT 0,
  completed boolean  DEFAULT false,
  category text,
  created_at timestamp with time zone  DEFAULT now(),
  completed_at timestamp with time zone,
  updated_at timestamp with time zone  DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid,
  row_data jsonb NOT NULL,
  assigned_to uuid,
  active_step_idx integer  DEFAULT 0,
  completed boolean  DEFAULT false,
  category text,
  created_at timestamp with time zone  DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.custom_tables (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  title_ro text NOT NULL,
  title_en text NOT NULL,
  description_ro text,
  description_en text,
  icon text  DEFAULT 'fa-table'::text,
  color text  DEFAULT '#64748b'::text,
  created_at timestamp with time zone  DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dashboard_settings (
  id integer NOT NULL DEFAULT 1,
  active_table text  DEFAULT 'angajati'::text,
  timeline_data jsonb,
  raw_timeline_data jsonb,
  updated_at timestamp with time zone  DEFAULT now(),
  raw_file_path text  DEFAULT 'raw_timeline.json'::text,
  timeline_file_path text  DEFAULT '../public/driver-dashboard/timeline_data.json'::text
);

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  instructions text  DEFAULT ''::text
);

CREATE TABLE IF NOT EXISTS public.driver_activity (
  id serial,
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
  id serial,
  driver_pn text NOT NULL,
  status text NOT NULL,
  user_id uuid,
  created_at timestamp with time zone  DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.driver_dashboard_data (
  id text NOT NULL,
  data jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public.driver_email_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'Running'::text,
  total_emails integer  DEFAULT 0,
  sent_count integer  DEFAULT 0,
  failed_count integer  DEFAULT 0,
  created_at timestamp with time zone  DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.driver_email_logs (
  id serial,
  driver_pn text,
  email text,
  category text,
  status text,
  details text,
  sent_at timestamp with time zone  DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.driver_email_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  driver_pn text,
  email text,
  status text  DEFAULT 'Pending'::text,
  scheduled_for timestamp with time zone,
  created_at timestamp with time zone  DEFAULT timezone('utc'::text, now()),
  batch_id uuid,
  category text
);

CREATE TABLE IF NOT EXISTS public.driver_email_settings (
  id integer NOT NULL,
  is_enabled boolean  DEFAULT false,
  cron_schedule text  DEFAULT '0 9 * * *'::text,
  send_missing boolean  DEFAULT false,
  send_fireable boolean  DEFAULT false,
  send_unjustified boolean  DEFAULT false,
  send_time text  DEFAULT '09:00'::text,
  pn_range_start integer,
  pn_range_end integer,
  allowed_categories jsonb  DEFAULT '["Started Late", "Left Early / Big Gaps", "No Shifts", "Absent"]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.driver_email_templates (
  category text NOT NULL,
  subject text,
  body text
);

CREATE TABLE IF NOT EXISTS public.driver_timeline_data (
  id text NOT NULL,
  data jsonb
);

CREATE TABLE IF NOT EXISTS public.fleetcap_app_data (
  id text NOT NULL,
  data jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  status text  DEFAULT 'pending'::text,
  role text  DEFAULT 'user'::text,
  name text,
  department_id uuid,
  email text
);

CREATE TABLE IF NOT EXISTS public.test_ang (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  crm_processed boolean  DEFAULT false,
  nou text,
  nume text,
  uuid text,
  pn text,
  inactiv text,
  tip_contract text,
  data_valabilitate_contract text,
  valabilitate_contract text,
  tip_vehicul text,
  email text,
  telefon text,
  last_status text,
  data_nasterii text,
  adresa text,
  iban text,
  bic text,
  companie text,
  orase text
);

CREATE TABLE IF NOT EXISTS public.to_fire (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  driver_name text,
  phone text,
  email text,
  driver_id__pn text,
  contract_type text,
  companies text,
  cities text,
  status text,
  source_projects text,
  missed_shifts_count text,
  missed_3_days_in_a_row text,
  scheduled_shifts text,
  worked_activity___leaves text,
  missed_shifts_details text,
  crm_processed boolean  DEFAULT false
);

