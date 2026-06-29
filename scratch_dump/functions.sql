CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.profiles (id, name, department_id, email, role, status)
  values (
    new.id,
    new.raw_user_meta_data->>'name',
    nullif(new.raw_user_meta_data->>'department_id', '')::uuid,
    new.email,
    'user',
    'pending'
  );
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_tasks_missing(p_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
              BEGIN
                UPDATE public.crm_tasks
                SET row_data = jsonb_set(row_data, '{is_missing}', 'true'::jsonb)
                WHERE row_data->>'id' = ANY(p_ids::text[]);

                UPDATE public.crm_repetitive_tasks
                SET row_data = jsonb_set(row_data, '{is_missing}', 'true'::jsonb)
                WHERE row_data->>'id' = ANY(p_ids::text[]);
              END;
              $function$
;

CREATE OR REPLACE FUNCTION public.execute_ddl(query_text text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  EXECUTE query_text;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_table_columns(p_table_name text)
 RETURNS TABLE(column_name text, data_type text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT c.column_name::text, c.data_type::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = p_table_name;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_all_angajati()
 RETURNS SETOF angajati
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT * FROM angajati;
$function$
;

CREATE OR REPLACE FUNCTION public.get_table_data(p_table_name text)
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_sql text;
BEGIN
  v_sql := 'SELECT row_to_json(t)::jsonb FROM ' || quote_ident(p_table_name) || ' AS t';
  RETURN QUERY EXECUTE v_sql;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reset_repetitive_tasks(p_flow_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.crm_repetitive_tasks t
  SET completed = false,
      category = null,
      active_step_idx = 0,
      completed_at = null,
      updated_at = CURRENT_TIMESTAMP
  FROM public.crm_repetitive_flows f
  WHERE t.repetitive_flow_id = f.id
    AND f.id = p_flow_id
    AND f.is_stopped = false
    AND (t.completed = true OR t.active_step_idx > 0)
    AND t.updated_at IS NOT NULL
    AND CURRENT_TIMESTAMP >= (t.updated_at + (COALESCE(f.reset_interval_hours, 0) || ' hours')::interval + (COALESCE(f.reset_interval_minutes, 0) || ' minutes')::interval);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_kanban_snapshot(p_flow_id uuid, p_stamp_time timestamp with time zone, p_task_id uuid, p_task_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_snapshot_id uuid;
  v_tasks_map jsonb;
  v_steps_structure jsonb;
BEGIN
  -- Try to find existing snapshot for this interval
  SELECT id INTO v_snapshot_id
  FROM public.crm_repetitive_snapshots
  WHERE repetitive_flow_id = p_flow_id AND stamp_time = p_stamp_time;

  IF v_snapshot_id IS NOT NULL THEN
    -- Update existing snapshot (atomic)
    UPDATE public.crm_repetitive_snapshots
    SET tasks_map = jsonb_set(COALESCE(tasks_map, '{}'::jsonb), array[p_task_id::text], p_task_payload)
    WHERE id = v_snapshot_id;
  ELSE
    -- Snapshot doesn't exist. Find the most recent previous snapshot.
    SELECT tasks_map, steps_structure INTO v_tasks_map, v_steps_structure
    FROM public.crm_repetitive_snapshots
    WHERE repetitive_flow_id = p_flow_id AND stamp_time < p_stamp_time
    ORDER BY stamp_time DESC
    LIMIT 1;

    IF v_tasks_map IS NULL THEN
      -- No previous snapshot. Fetch live tasks to initialize the map.
      SELECT jsonb_object_agg(id, jsonb_build_object(
        'id', id,
        'row_data', row_data,
        'assigned_to', assigned_to,
        'active_step_idx', active_step_idx,
        'completed', completed,
        'category', category
      )) INTO v_tasks_map
      FROM public.crm_repetitive_tasks
      WHERE repetitive_flow_id = p_flow_id;
      
      -- Fetch steps structure from the live flow
      SELECT steps INTO v_steps_structure
      FROM public.crm_repetitive_flows
      WHERE id = p_flow_id;
    END IF;

    IF v_tasks_map IS NULL THEN
      v_tasks_map := '{}'::jsonb;
    END IF;
    
    -- Apply the current move to the map
    v_tasks_map := jsonb_set(v_tasks_map, array[p_task_id::text], p_task_payload);

    -- Insert the new snapshot
    INSERT INTO public.crm_repetitive_snapshots (repetitive_flow_id, stamp_time, steps_structure, tasks_map)
    VALUES (p_flow_id, p_stamp_time, v_steps_structure, v_tasks_map);
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_kanban_snapshot_map(p_flow_id uuid, p_stamp_time timestamp with time zone, p_tasks_map jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
  BEGIN
    UPDATE public.crm_repetitive_snapshots 
    SET tasks_map = p_tasks_map
    WHERE repetitive_flow_id = p_flow_id AND stamp_time = p_stamp_time;
    
    IF NOT FOUND THEN
      INSERT INTO public.crm_repetitive_snapshots (repetitive_flow_id, stamp_time, tasks_map)
      VALUES (p_flow_id, p_stamp_time, p_tasks_map);
    END IF;
  END;
  $function$
;

