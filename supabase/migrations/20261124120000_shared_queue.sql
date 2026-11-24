-- Shared salon queue. All application writes go through transactional RPCs;
-- browser clients have no direct table write or read access to customer records.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.salon_settings (
  id smallint primary key default 1 check (id = 1),
  online_open boolean not null default true,
  closing_time time not null default time '21:00',
  time_zone text not null default 'Asia/Kolkata',
  next_token_number bigint not null default 1 check (next_token_number > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.barbers (
  id text primary key,
  name text not null check (length(trim(name)) > 0),
  on_duty boolean not null default true,
  availability text not null default 'available' check (availability in ('available', 'break')),
  sort_order smallint not null default 0
);

create table if not exists public.services (
  id text primary key,
  name jsonb not null check (jsonb_typeof(name) = 'object'),
  duration_minutes integer not null check (duration_minutes > 0),
  price_inr numeric(10, 2) not null check (price_inr >= 0),
  active boolean not null default true,
  sort_order smallint not null default 0,
  constraint services_names_required check (
    length(trim(coalesce(name ->> 'en', ''))) > 0 and
    length(trim(coalesce(name ->> 'gu', ''))) > 0
  )
);

create table if not exists public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  token_number bigint not null unique check (token_number > 0),
  token text not null unique,
  customer_name text not null check (length(trim(customer_name)) > 0),
  customer_phone text not null check (customer_phone ~ '^[0-9]{10}$'),
  service_ids text[] not null check (cardinality(service_ids) between 1 and 3),
  service_snapshot jsonb not null check (jsonb_typeof(service_snapshot) = 'array'),
  duration_minutes integer not null check (duration_minutes > 0),
  price_inr numeric(10, 2) not null check (price_inr >= 0),
  preferred_barber_id text not null,
  assigned_barber_id text references public.barbers(id),
  joined_at timestamptz not null default now(),
  status text not null default 'Waiting' check (status in ('Waiting', 'Called', 'In chair', 'Done', 'Cancelled', 'No-show')),
  sequence_number bigint not null unique,
  called_at timestamptz,
  started_at timestamptz,
  done_at timestamptz,
  cancelled_at timestamptz,
  no_show_at timestamptz,
  constraint assigned_barber_required check (status not in ('Called', 'In chair') or assigned_barber_id is not null),
  constraint waiting_not_assigned check (status <> 'Waiting' or assigned_barber_id is null)
);

create unique index if not exists queue_entries_one_active_phone
  on public.queue_entries(customer_phone)
  where status in ('Waiting', 'Called', 'In chair');
create unique index if not exists queue_entries_one_active_customer_per_barber
  on public.queue_entries(assigned_barber_id)
  where assigned_barber_id is not null and status in ('Called', 'In chair');
create index if not exists queue_entries_waiting_order
  on public.queue_entries(sequence_number, joined_at)
  where status = 'Waiting';

create table if not exists public.queue_updates (
  id smallint primary key default 1 check (id = 1),
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.salon_settings (id) values (1) on conflict (id) do nothing;
insert into public.queue_updates (id) values (1) on conflict (id) do nothing;

insert into public.barbers (id, name, on_duty, availability, sort_order) values
  ('ravi', 'Ravi', true, 'available', 1),
  ('amit', 'Amit', true, 'available', 2),
  ('imran', 'Imran', true, 'available', 3)
on conflict (id) do nothing;

insert into public.services (id, name, duration_minutes, price_inr, active, sort_order) values
  ('haircut', '{"en":"Haircut","gu":"વાળ કાપવા"}'::jsonb, 30, 150, true, 1),
  ('beard-trim', '{"en":"Beard trim","gu":"દાઢી ટ્રિમ"}'::jsonb, 15, 80, true, 2),
  ('hair-spa', '{"en":"Hair spa","gu":"હેર સ્પા"}'::jsonb, 45, 400, true, 3)
on conflict (id) do nothing;

alter table public.salon_settings enable row level security;
alter table public.barbers enable row level security;
alter table public.services enable row level security;
alter table public.queue_entries enable row level security;
alter table public.queue_updates enable row level security;

revoke all on table public.salon_settings, public.barbers, public.services, public.queue_entries, public.queue_updates from anon, authenticated;
grant select on table public.queue_updates to anon, authenticated;
drop policy if exists queue_updates_public_read on public.queue_updates;
create policy queue_updates_public_read on public.queue_updates
  for select to anon, authenticated using (id = 1);

create or replace function private.entry_json(p_entry_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', e.id,
    'token', e.token,
    'tokenNumber', e.token_number,
    'name', e.customer_name,
    'serviceIds', to_jsonb(e.service_ids),
    'services', e.service_snapshot,
    'durationMinutes', e.duration_minutes,
    'priceInr', e.price_inr,
    'barberId', coalesce(e.assigned_barber_id, e.preferred_barber_id),
    'joinedAt', e.joined_at,
    'status', e.status,
    'sequence', e.sequence_number,
    'calledAt', e.called_at,
    'startedAt', e.started_at,
    'doneAt', e.done_at,
    'cancelledAt', e.cancelled_at,
    'noShowAt', e.no_show_at
  )
  from public.queue_entries e
  where e.id = p_entry_id;
$$;

create or replace function private.snapshot_json()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'settings', (
      select jsonb_build_object(
        'onlineOpen', s.online_open,
        'closingTime', to_char(s.closing_time, 'HH24:MI'),
        'timeZone', s.time_zone
      ) from public.salon_settings s where s.id = 1
    ),
    'barbers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', b.name, 'onDuty', b.on_duty, 'availability', b.availability
      ) order by b.sort_order, b.id) from public.barbers b
    ), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'durationMinutes', s.duration_minutes,
        'priceInr', s.price_inr, 'active', s.active
      ) order by s.sort_order, s.id) from public.services s
    ), '[]'::jsonb),
    'queue', coalesce((
      select jsonb_agg(private.entry_json(e.id) order by e.sequence_number, e.joined_at)
      from public.queue_entries e
    ), '[]'::jsonb),
    'nextTokenNumber', (select s.next_token_number from public.salon_settings s where s.id = 1),
    'revision', (select u.revision from public.queue_updates u where u.id = 1)
  );
$$;

create or replace function private.bump_queue_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.queue_updates
  set revision = revision + 1, updated_at = now()
  where id = 1;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists salon_settings_realtime_revision on public.salon_settings;
create trigger salon_settings_realtime_revision after insert or update or delete on public.salon_settings
  for each row execute function private.bump_queue_revision();
drop trigger if exists barbers_realtime_revision on public.barbers;
create trigger barbers_realtime_revision after insert or update or delete on public.barbers
  for each row execute function private.bump_queue_revision();
drop trigger if exists services_realtime_revision on public.services;
create trigger services_realtime_revision after insert or update or delete on public.services
  for each row execute function private.bump_queue_revision();
drop trigger if exists queue_entries_realtime_revision on public.queue_entries;
create trigger queue_entries_realtime_revision after insert or update or delete on public.queue_entries
  for each row execute function private.bump_queue_revision();

create or replace function public.get_salon_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$ select private.snapshot_json(); $$;

create or replace function public.join_customer(
  p_name text,
  p_phone text,
  p_service_ids text[],
  p_barber_id text,
  p_walk_in boolean default false,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.salon_settings%rowtype;
  v_entry public.queue_entries%rowtype;
  v_duplicate_id uuid;
  v_request_id uuid := coalesce(p_request_id, gen_random_uuid());
  v_service_count integer;
  v_service_snapshot jsonb;
  v_duration integer;
  v_price numeric(10, 2);
  v_local_now timestamp;
  v_closing timestamp;
  v_number bigint;
begin
  select * into v_settings from public.salon_settings where id = 1 for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'cloudUnavailable'); end if;

  select id into v_duplicate_id from public.queue_entries where request_id = v_request_id;
  if v_duplicate_id is not null then
    return jsonb_build_object('ok', true, 'entry', private.entry_json(v_duplicate_id), 'idempotentReplay', true);
  end if;

  if p_name is null or length(trim(p_name)) = 0 then return jsonb_build_object('ok', false, 'error', 'nameRequired'); end if;
  if p_phone is null or p_phone !~ '^[0-9]{10}$' then return jsonb_build_object('ok', false, 'error', 'phoneInvalid'); end if;
  if p_barber_id is null then return jsonb_build_object('ok', false, 'error', 'barberUnavailable'); end if;
  if p_service_ids is null or cardinality(p_service_ids) = 0 then return jsonb_build_object('ok', false, 'error', 'serviceRequired'); end if;
  if cardinality(p_service_ids) > 3 or cardinality(p_service_ids) <> (select count(distinct x) from unnest(p_service_ids) as ids(x)) then
    return jsonb_build_object('ok', false, 'error', 'serviceLimit');
  end if;

  select count(*), coalesce(sum(s.duration_minutes), 0), coalesce(sum(s.price_inr), 0),
         coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'name', s.name, 'durationMinutes', s.duration_minutes, 'priceInr', s.price_inr
         ) order by selected.ordinality), '[]'::jsonb)
  into v_service_count, v_duration, v_price, v_service_snapshot
  from unnest(p_service_ids) with ordinality as selected(service_id, ordinality)
  join public.services s on s.id = selected.service_id and s.active;
  if v_service_count <> cardinality(p_service_ids) then return jsonb_build_object('ok', false, 'error', 'serviceUnavailable'); end if;

  if p_barber_id <> 'any' and not exists (
    select 1 from public.barbers b where b.id = p_barber_id and b.on_duty and b.availability = 'available'
  ) then return jsonb_build_object('ok', false, 'error', 'barberUnavailable'); end if;
  if p_walk_in is null then return jsonb_build_object('ok', false, 'error', 'invalidJoin'); end if;

  select id into v_duplicate_id from public.queue_entries
  where customer_phone = p_phone and status in ('Waiting', 'Called', 'In chair')
  order by sequence_number limit 1;
  if v_duplicate_id is not null then
    return jsonb_build_object('ok', false, 'duplicate', private.entry_json(v_duplicate_id));
  end if;

  if not p_walk_in then
    v_local_now := now() at time zone v_settings.time_zone;
    v_closing := v_local_now::date + v_settings.closing_time;
    if not v_settings.online_open or v_closing - v_local_now <= interval '30 minutes' then
      return jsonb_build_object('ok', false, 'error', 'queueClosed');
    end if;
  end if;

  v_number := v_settings.next_token_number;
  update public.salon_settings set next_token_number = v_number + 1, updated_at = now() where id = 1;
  insert into public.queue_entries (
    request_id, token_number, token, customer_name, customer_phone, service_ids, service_snapshot,
    duration_minutes, price_inr, preferred_barber_id, joined_at, sequence_number, status
  ) values (
    v_request_id, v_number, 'S-' || v_number::text, trim(p_name), p_phone, p_service_ids, v_service_snapshot,
    v_duration, v_price, p_barber_id, now(), v_number, 'Waiting'
  ) returning * into v_entry;

  return jsonb_build_object('ok', true, 'entry', private.entry_json(v_entry.id));
end;
$$;

create or replace function public.call_next_customer(p_barber_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings_id smallint;
  v_barber public.barbers%rowtype;
  v_entry_id uuid;
begin
  select id into v_settings_id from public.salon_settings where id = 1 for update;
  select * into v_barber from public.barbers where id = p_barber_id for update;
  if not found or not v_barber.on_duty or v_barber.availability <> 'available' then
    return jsonb_build_object('ok', false, 'error', 'barberUnavailable');
  end if;
  if exists (select 1 from public.queue_entries where assigned_barber_id = p_barber_id and status in ('Called', 'In chair')) then
    return jsonb_build_object('ok', false, 'error', 'barberOccupied');
  end if;
  select id into v_entry_id from public.queue_entries
  where status = 'Waiting' and (preferred_barber_id = 'any' or preferred_barber_id = p_barber_id)
  order by sequence_number, joined_at limit 1 for update;
  if v_entry_id is null then return jsonb_build_object('ok', false, 'error', 'noEligibleCustomer'); end if;
  update public.queue_entries set status = 'Called', assigned_barber_id = p_barber_id, called_at = now()
  where id = v_entry_id and status = 'Waiting';
  if not found then return jsonb_build_object('ok', false, 'error', 'noEligibleCustomer'); end if;
  return jsonb_build_object('ok', true, 'entry', private.entry_json(v_entry_id));
end;
$$;

create or replace function public.cancel_waiting_customer(p_entry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_settings_id smallint;
begin
  select id into v_settings_id from public.salon_settings where id = 1 for update;
  update public.queue_entries set status = 'Cancelled', cancelled_at = now()
  where id = p_entry_id and status = 'Waiting';
  if not found then return jsonb_build_object('ok', false, 'error', 'notWaiting'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.mark_customer_no_show(p_entry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_settings_id smallint;
begin
  select id into v_settings_id from public.salon_settings where id = 1 for update;
  update public.queue_entries set status = 'No-show', no_show_at = now()
  where id = p_entry_id and status = 'Called' and called_at <= now() - interval '10 minutes';
  if found then return jsonb_build_object('ok', true); end if;
  if exists (select 1 from public.queue_entries where id = p_entry_id and status = 'Called') then
    return jsonb_build_object('ok', false, 'error', 'gracePeriod');
  end if;
  return jsonb_build_object('ok', false, 'error', 'notCalled');
end;
$$;

create or replace function public.start_barber_service(p_barber_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_settings_id smallint; v_entry_id uuid;
begin
  select id into v_settings_id from public.salon_settings where id = 1 for update;
  select id into v_entry_id from public.queue_entries
  where assigned_barber_id = p_barber_id and status = 'Called' for update;
  if v_entry_id is null then return jsonb_build_object('ok', false, 'error', 'noCalledCustomer'); end if;
  update public.queue_entries set status = 'In chair', started_at = now() where id = v_entry_id;
  return jsonb_build_object('ok', true, 'entry', private.entry_json(v_entry_id));
end;
$$;

create or replace function public.complete_barber_service(p_barber_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_settings_id smallint; v_entry_id uuid;
begin
  select id into v_settings_id from public.salon_settings where id = 1 for update;
  select id into v_entry_id from public.queue_entries
  where assigned_barber_id = p_barber_id and status = 'In chair' for update;
  if v_entry_id is null then return jsonb_build_object('ok', false, 'error', 'noInChairCustomer'); end if;
  update public.queue_entries set status = 'Done', done_at = now() where id = v_entry_id;
  return jsonb_build_object('ok', true, 'entry', private.entry_json(v_entry_id));
end;
$$;

create or replace function public.set_barber_break(p_barber_id text, p_on_break boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_settings_id smallint; v_barber public.barbers%rowtype;
begin
  select id into v_settings_id from public.salon_settings where id = 1 for update;
  select * into v_barber from public.barbers where id = p_barber_id for update;
  if not found or not v_barber.on_duty then return jsonb_build_object('ok', false, 'error', 'barberUnavailable'); end if;
  if exists (select 1 from public.queue_entries where assigned_barber_id = p_barber_id and status in ('Called', 'In chair')) then
    return jsonb_build_object('ok', false, 'error', 'barberOccupied');
  end if;
  update public.barbers set availability = case when p_on_break then 'break' else 'available' end where id = p_barber_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.update_service(p_service_id text, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings_id smallint;
  v_service public.services%rowtype;
  v_name jsonb;
  v_duration integer;
  v_price numeric(10, 2);
  v_active boolean;
begin
  select id into v_settings_id from public.salon_settings where id = 1 for update;
  select * into v_service from public.services where id = p_service_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'serviceMissing'); end if;
  v_name := case when p_patch ? 'name' then v_service.name || (p_patch -> 'name') else v_service.name end;
  begin
    v_duration := case when p_patch ? 'durationMinutes' then (p_patch ->> 'durationMinutes')::integer else v_service.duration_minutes end;
    v_price := case when p_patch ? 'priceInr' then (p_patch ->> 'priceInr')::numeric(10, 2) else v_service.price_inr end;
    v_active := case when p_patch ? 'active' then (p_patch ->> 'active')::boolean else v_service.active end;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'invalidService');
  end;
  if jsonb_typeof(v_name) <> 'object' or length(trim(coalesce(v_name ->> 'en', ''))) = 0
     or length(trim(coalesce(v_name ->> 'gu', ''))) = 0 or v_duration is null
     or v_duration <= 0 or v_price is null or v_price < 0 or v_active is null then
    return jsonb_build_object('ok', false, 'error', 'invalidService');
  end if;
  update public.services set name = v_name, duration_minutes = v_duration, price_inr = v_price, active = v_active
  where id = p_service_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.set_barber_on_duty(p_barber_id text, p_on_duty boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_settings_id smallint;
begin
  select id into v_settings_id from public.salon_settings where id = 1 for update;
  update public.barbers set on_duty = p_on_duty,
    availability = case when p_on_duty then availability else 'available' end
  where id = p_barber_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'barberMissing'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.update_queue_settings(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings_id smallint;
  v_online boolean;
  v_closing time;
begin
  select id into v_settings_id from public.salon_settings where id = 1 for update;
  select online_open, closing_time into v_online, v_closing from public.salon_settings where id = 1;
  begin
    if p_patch ? 'onlineOpen' then v_online := (p_patch ->> 'onlineOpen')::boolean; end if;
    if p_patch ? 'closingTime' then
      if (p_patch ->> 'closingTime') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
        return jsonb_build_object('ok', false, 'error', 'invalidClosingTime');
      end if;
      v_closing := (p_patch ->> 'closingTime')::time;
    end if;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'invalidClosingTime');
  end;
  update public.salon_settings set online_open = v_online, closing_time = v_closing, updated_at = now() where id = 1;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke execute on function public.get_salon_snapshot() from public, anon, authenticated;
revoke execute on function public.join_customer(text, text, text[], text, boolean, uuid) from public, anon, authenticated;
revoke execute on function public.call_next_customer(text) from public, anon, authenticated;
revoke execute on function public.cancel_waiting_customer(uuid) from public, anon, authenticated;
revoke execute on function public.mark_customer_no_show(uuid) from public, anon, authenticated;
revoke execute on function public.start_barber_service(text) from public, anon, authenticated;
revoke execute on function public.complete_barber_service(text) from public, anon, authenticated;
revoke execute on function public.set_barber_break(text, boolean) from public, anon, authenticated;
revoke execute on function public.update_service(text, jsonb) from public, anon, authenticated;
revoke execute on function public.set_barber_on_duty(text, boolean) from public, anon, authenticated;
revoke execute on function public.update_queue_settings(jsonb) from public, anon, authenticated;

grant execute on function public.get_salon_snapshot() to anon, authenticated;
grant execute on function public.join_customer(text, text, text[], text, boolean, uuid) to anon, authenticated;
grant execute on function public.call_next_customer(text) to anon, authenticated;
grant execute on function public.cancel_waiting_customer(uuid) to anon, authenticated;
grant execute on function public.mark_customer_no_show(uuid) to anon, authenticated;
grant execute on function public.start_barber_service(text) to anon, authenticated;
grant execute on function public.complete_barber_service(text) to anon, authenticated;
grant execute on function public.set_barber_break(text, boolean) to anon, authenticated;
grant execute on function public.update_service(text, jsonb) to anon, authenticated;
grant execute on function public.set_barber_on_duty(text, boolean) to anon, authenticated;
grant execute on function public.update_queue_settings(jsonb) to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'queue_updates'
    ) then
      execute 'alter publication supabase_realtime add table public.queue_updates';
    end if;
  else
    execute 'create publication supabase_realtime for table public.queue_updates';
  end if;
end;
$$;
