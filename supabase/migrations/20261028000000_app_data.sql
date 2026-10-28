-- One row per user holding the app's full data object and provider profile.
-- The app reads and writes only this table; the views below are for the
-- dashboard's table view and CSV download.

create table public.app_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,                       -- {version, patients, sessions, schools}
  profile    jsonb not null default '{}'::jsonb,   -- {firstName, lastName, credentials, license}
  updated_at timestamptz not null default now()
);

alter table public.app_data enable row level security;

-- Only signed-in users reach the table; RLS limits them to their own row.
revoke all on public.app_data from anon;

create policy "owner reads own row" on public.app_data
  for select to authenticated using (auth.uid() = user_id);
create policy "owner writes own row" on public.app_data
  for insert to authenticated with check (auth.uid() = user_id);
create policy "owner updates own row" on public.app_data
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The server stamps every update, so devices never compare their own clocks.
create function public.set_updated_at() returns trigger
  language plpgsql
  security invoker
  set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger app_data_set_updated_at
  before update on public.app_data
  for each row execute function public.set_updated_at();

-- Read-only views so the dashboard shows rows, not one JSON blob.
-- `security_invoker` makes the views run as the caller so the table's
-- row-level security applies. The app never reads the views, so the API
-- roles lose access and only the dashboard reads them.
create view public.patients_view with (security_invoker = true) as
  select user_id,
         p->>'id'           as id,
         p->>'firstName'    as first_name,
         p->>'lastName'     as last_name,
         p->>'dob'          as dob,
         p->>'diagnosis'    as diagnosis,
         p->>'schoolId'     as school_id,
         p->>'deleted_at'   as deleted_at
  from public.app_data, jsonb_array_elements(data->'patients') p;

create view public.notes_view with (security_invoker = true) as
  select user_id,
         s->>'id'             as id,
         s->>'patientId'      as patient_id,
         s->>'sessionDate'    as session_date,
         s->>'startTime'      as start_time,
         s->>'endTime'        as end_time,
         s->>'subjective'     as subjective,
         s->>'objectiveNotes' as objective_notes,
         s->>'assessment'     as assessment,
         s->>'plan'           as plan,
         s->>'therExMinutes'  as ther_ex_minutes,
         s->>'therActMinutes' as ther_act_minutes,
         s->>'deleted_at'     as deleted_at
  from public.app_data, jsonb_array_elements(data->'sessions') s;

create view public.schools_view with (security_invoker = true) as
  select user_id,
         sc->>'id'           as id,
         sc->>'name'         as name,
         sc->>'street_address' as street_address,
         sc->>'city'         as city,
         sc->>'state'        as state,
         sc->>'zip_code'     as zip_code,
         sc->>'phone'        as phone,
         sc->>'deleted_at'   as deleted_at
  from public.app_data, jsonb_array_elements(data->'schools') sc;

revoke all on public.patients_view, public.notes_view, public.schools_view from anon, authenticated;

-- Realtime tells the other device when the row changes.
alter publication supabase_realtime add table public.app_data;
