-- LZWay 3.5 — migration 0001
-- Audit finding SEC-01: stop anonymous enumeration of public_tracking_v35.
--
-- Today `anon` can SELECT the whole table with the publishable key, which turns
-- the capability-URL design ("whoever holds the token sees one shipment") into
-- "whoever holds the key sees every shipment". This migration revokes the table
-- grant and exposes a single-row lookup function instead.
--
-- Apply in the Supabase SQL editor, or:  supabase db push
-- Safe to run before or after the app update: tracking.js tries the RPC first
-- and falls back to the table query while the function is missing.

revoke select on public.public_tracking_v35 from anon;

create or replace function public.tracking_lookup(p_token text)
returns table (pick_id text, status text, archived boolean, updated_at timestamptz)
language sql stable security definer
set search_path = public
as $$
  select pick_id, status, archived, updated_at
    from public.public_tracking_v35
   where tracking_token = p_token;
$$;

grant execute on function public.tracking_lookup(text) to anon;

-- Recommended follow-ups (Supabase dashboard, not SQL):
--   1. Authentication > Providers > Email > disable "Allow new users to sign up"  (SEC-04)
--   2. Rotate the publishable key and update public/sync-config.json + the worker config
--   3. If column types differ on your project, adjust the RETURNS clause to match
