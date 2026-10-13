begin; alter table public.sync_entities drop constraint sync_entities_entity_type_allowed_check; alter table public.sync_entities add constraint sync_entities_entity_type_allowed_check check(entity_type in ('profile', 'profile_settings', 'customer', 'parcel_active', 'archive_day', 'label_copy', 'counter_state', 'parcel_archive', 'claim', 'profile_settings_v35', 'inventory_v35', 'stock_movement_v35', 'settlement_v35', 'profile_catalog_v35')); CREATE OR REPLACE FUNCTION public.apply_sync_changes(p_workspace_id uuid, p_changes jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  item jsonb;
  applied integer := 0;
  v_profile_id text;
  v_entity_type text;
  v_entity_id text;
  v_device_id text;
  v_modified_at timestamptz;
  v_deleted_at timestamptz;
  v_payload jsonb;
begin
  if auth.uid() is null or coalesce(public.workspace_role(p_workspace_id), '') not in ('admin', 'staff') then
    raise exception 'Not authorized to change this workspace' using errcode = '42501';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 250 then
    raise exception 'Changes must be an array of at most 250 records';
  end if;
  if octet_length(p_changes::text) > 16777216 then
    raise exception 'Synchronized request is larger than the 16 MB server safety limit';
  end if;

  for item in select value from jsonb_array_elements(p_changes)
  loop
    if coalesce((item->>'workspace_id')::uuid, p_workspace_id) <> p_workspace_id then
      raise exception 'A change targets the wrong workspace';
    end if;
    v_profile_id := item->>'profile_id';
    v_entity_type := item->>'entity_type';
    v_entity_id := item->>'entity_id';
    v_device_id := item->>'device_id';
    v_modified_at := (item->>'modified_at')::timestamptz;
    v_deleted_at := nullif(item->>'deleted_at', '')::timestamptz;
    v_payload := coalesce(item->'payload', '{}'::jsonb);

    if char_length(coalesce(v_profile_id, '')) not between 1 and 160 or position('|' in coalesce(v_profile_id, '')) > 0
       or char_length(coalesce(v_entity_id, '')) not between 1 and 220 or position('|' in coalesce(v_entity_id, '')) > 0
       or char_length(coalesce(v_device_id, '')) not between 1 and 160 or position('|' in coalesce(v_device_id, '')) > 0
       or v_entity_type not in ('profile', 'profile_settings', 'customer', 'parcel_active', 'archive_day', 'label_copy', 'counter_state', 'parcel_archive', 'claim', 'profile_settings_v35', 'inventory_v35', 'stock_movement_v35', 'settlement_v35', 'profile_catalog_v35')
       or v_modified_at is null
       or v_modified_at > now() + interval '10 minutes'
       or (v_deleted_at is not null and v_deleted_at <> v_modified_at)
       or jsonb_typeof(v_payload) <> 'object'
       or octet_length(v_payload::text) > 8388608 then
      raise exception 'Invalid synchronized record';
    end if;

    insert into public.sync_entities (
      workspace_id, profile_id, entity_type, entity_id, payload,
      modified_at, deleted_at, device_id, server_received_at
    ) values (
      p_workspace_id, v_profile_id, v_entity_type, v_entity_id, v_payload,
      v_modified_at, v_deleted_at, v_device_id, now()
    )
    on conflict (workspace_id, profile_id, entity_type, entity_id) do update
      set payload = excluded.payload,
          modified_at = excluded.modified_at,
          deleted_at = excluded.deleted_at,
          device_id = excluded.device_id,
          server_received_at = now()
      where excluded.modified_at > public.sync_entities.modified_at
         or (excluded.modified_at = public.sync_entities.modified_at
             and excluded.device_id > public.sync_entities.device_id);
    applied := applied + 1;
  end loop;
  return applied;
end;
$function$
; commit;
