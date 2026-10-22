-- TyömaaTunnit v0.2A — yhden yrityksen pilottiskeema.
-- Aja VAIN uuteen, tyhjään Supabase-projektiin. Ei tuotantovarmennettu.
-- Supabase Auth hallitsee käyttäjät; yhteiset käyttäjätunnukset on kielletty.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  created_at timestamptz not null default now()
);

create table public.memberships (
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 100),
  role text not null check (role in ('employee', 'supervisor', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id),
  unique (user_id) -- Yksi yritys / käyttäjä pilotissa. Laajennus myöhemmin.
);
create index memberships_org_idx on public.memberships(organization_id);

create table public.worksites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  code text not null default '' check (char_length(code) <= 32),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);
create index worksites_org_idx on public.worksites(organization_id);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  employee_id uuid not null references auth.users(id),
  worksite_id uuid not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  break_minutes integer not null default 0 check (break_minutes between 0 and 1439),
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'submitted' check (status in ('submitted', 'needs_changes', 'approved')),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_time_interval check (
    end_at > start_at and end_at <= start_at + interval '24 hours'
    and (extract(epoch from (end_at - start_at)) / 60) > break_minutes
  ),
  foreign key (organization_id, worksite_id)
    references public.worksites(organization_id, id)
);
create index time_entries_employee_time_idx on public.time_entries(employee_id,start_at desc);
create index time_entries_org_status_idx on public.time_entries(organization_id,status);
create index time_entries_worksite_time_idx on public.time_entries(worksite_id,start_at desc);

create table public.entry_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id),
  entry_id uuid not null references public.time_entries(id),
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('created', 'changed', 'approved', 'returned')),
  before_value jsonb,
  after_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index entry_events_entry_idx on public.entry_events(entry_id,created_at);

-- Definer-apurit vain private-skeemassa. Ne eivät ole PostgRESTin julkisessa RPC-rajapinnassa.
create function private.my_organization()
returns uuid language sql stable security definer set search_path = '' as $$
  select m.organization_id from public.memberships m
  where m.user_id = (select auth.uid()) and m.active = true limit 1
$$;

create function private.my_role()
returns text language sql stable security definer set search_path = '' as $$
  select m.role from public.memberships m
  where m.user_id = (select auth.uid()) and m.active = true limit 1
$$;

revoke execute on function private.my_organization() from public, anon;
revoke execute on function private.my_role() from public, anon;
grant execute on function private.my_organization(), private.my_role() to authenticated;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.worksites enable row level security;
alter table public.time_entries enable row level security;
alter table public.entry_events enable row level security;

revoke all on table public.organizations, public.memberships,
  public.worksites, public.time_entries, public.entry_events from public, anon, authenticated;
grant select on public.organizations, public.memberships,
  public.worksites, public.time_entries, public.entry_events to authenticated;

create policy org_read on public.organizations for select to authenticated
  using (id = (select private.my_organization()));
create policy membership_read on public.memberships for select to authenticated
  using (organization_id = (select private.my_organization())
    and (user_id = (select auth.uid()) or (select private.my_role()) in ('supervisor','admin')));
create policy worksite_read on public.worksites for select to authenticated
  using (organization_id = (select private.my_organization()));
create policy entry_read on public.time_entries for select to authenticated
  using (organization_id = (select private.my_organization())
    and (employee_id = (select auth.uid()) or (select private.my_role()) in ('supervisor','admin')));
create policy event_read on public.entry_events for select to authenticated
  using (organization_id = (select private.my_organization())
    and exists (select 1 from public.time_entries e where e.id = entry_id));

-- Apuri varmistaa saman työntekijän aikavälien päällekkäisyyden. Serialisointi
-- tehdään työntekijäkohtaisella transaction advisory lockilla jokaisessa kirjoitusfunktiossa.
create function private.ensure_no_overlap(
  p_employee_id uuid, p_start timestamptz, p_end timestamptz, p_exclude uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_employee_id::text, 0));
  if exists (
    select 1 from public.time_entries e where e.employee_id = p_employee_id
      and e.id is distinct from p_exclude
      and e.start_at < p_end and e.end_at > p_start
  ) then
    raise exception 'Työntekijällä on jo kirjaus samalla ajanjaksolla';
  end if;
end $$;

create function private.create_entry_secure(
  p_employee_id uuid, p_worksite_id uuid, p_start timestamptz,
  p_end timestamptz, p_break integer, p_note text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_org uuid := private.my_organization();
  v_role text := private.my_role();
  v_new public.time_entries%rowtype;
begin
  if v_user is null or v_org is null then raise exception 'Ei aktiivista yritysjäsenyyttä'; end if;
  if p_employee_id is null or (p_employee_id <> v_user and v_role not in ('supervisor','admin'))
  then raise exception 'Ei oikeutta kirjata tämän työntekijän tunteja'; end if;
  if not exists (select 1 from public.memberships m where m.user_id=p_employee_id and m.organization_id=v_org and m.active)
  then raise exception 'Työntekijä ei kuulu yritykseen'; end if;
  if not exists (select 1 from public.worksites s where s.id=p_worksite_id and s.organization_id=v_org and s.active)
  then raise exception 'Työmaa ei ole käytössä'; end if;
  if p_start is null or p_end is null or p_end <= p_start or p_end > p_start + interval '24 hours'
     or p_break is null or p_break < 0 or p_break >= (extract(epoch from (p_end-p_start))/60)
     or char_length(coalesce(p_note,'')) > 500
  then raise exception 'Virheellinen aika, tauko tai huomautus'; end if;
  perform private.ensure_no_overlap(p_employee_id,p_start,p_end,null);
  insert into public.time_entries(organization_id,employee_id,worksite_id,start_at,end_at,break_minutes,note,created_by,updated_by)
  values(v_org,p_employee_id,p_worksite_id,p_start,p_end,p_break,coalesce(p_note,''),v_user,v_user)
  returning * into v_new;
  insert into public.entry_events(organization_id,entry_id,actor_id,action,after_value)
    values(v_org,v_new.id,v_user,'created',to_jsonb(v_new));
  return v_new.id;
end $$;

create function private.update_entry_secure(
  p_entry_id uuid, p_worksite_id uuid, p_start timestamptz,
  p_end timestamptz, p_break integer, p_note text, p_reason text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_org uuid := private.my_organization();
  v_role text := private.my_role();
  v_old public.time_entries%rowtype;
  v_new public.time_entries%rowtype;
begin
  if v_user is null or v_org is null then raise exception 'Ei aktiivista yritysjäsenyyttä'; end if;
  select * into v_old from public.time_entries e where e.id=p_entry_id and e.organization_id=v_org for update;
  if not found then raise exception 'Kirjausta ei löydy'; end if;
  if v_old.status = 'approved' then raise exception 'Hyväksyttyä kirjausta ei voi muokata'; end if;
  if v_old.employee_id <> v_user and v_role not in ('supervisor','admin')
  then raise exception 'Ei muokkausoikeutta'; end if;
  if v_old.employee_id = v_user and v_role = 'employee' and v_old.status <> 'needs_changes'
  then raise exception 'Lähetetty kirjaus täytyy palauttaa korjattavaksi ensin'; end if;
  if not exists (select 1 from public.worksites s where s.id=p_worksite_id and s.organization_id=v_org and s.active)
  then raise exception 'Työmaa ei ole käytössä'; end if;
  if p_start is null or p_end is null or p_end <= p_start or p_end > p_start + interval '24 hours'
     or p_break is null or p_break < 0 or p_break >= (extract(epoch from (p_end-p_start))/60)
     or char_length(coalesce(p_note,'')) > 500
     or char_length(coalesce(p_reason,'')) < 3
  then raise exception 'Virheellinen muutos tai perustelu'; end if;
  perform private.ensure_no_overlap(v_old.employee_id,p_start,p_end,v_old.id);
  update public.time_entries set worksite_id=p_worksite_id,start_at=p_start,end_at=p_end,
    break_minutes=p_break,note=coalesce(p_note,''),status='submitted',
    updated_by=v_user,updated_at=now(),reviewed_by=null,reviewed_at=null,review_reason=null
  where id=v_old.id returning * into v_new;
  insert into public.entry_events(organization_id,entry_id,actor_id,action,before_value,after_value,reason)
    values(v_org,v_old.id,v_user,'changed',to_jsonb(v_old),to_jsonb(v_new),p_reason);
  return v_new.id;
end $$;

create function private.review_entry_secure(
  p_entry_id uuid, p_decision text, p_reason text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_org uuid := private.my_organization();
  v_role text := private.my_role();
  v_old public.time_entries%rowtype;
  v_new public.time_entries%rowtype;
begin
  if v_org is null or v_role not in ('supervisor','admin') then raise exception 'Ei hyväksyntäoikeutta'; end if;
  if p_decision not in ('approved','needs_changes') then raise exception 'Tuntematon päätös'; end if;
  if p_decision = 'needs_changes' and char_length(btrim(coalesce(p_reason,''))) < 3
  then raise exception 'Palautus vaatii perustelun'; end if;
  select * into v_old from public.time_entries e where e.id=p_entry_id and e.organization_id=v_org for update;
  if not found or v_old.status <> 'submitted' then raise exception 'Kirjaus ei odota käsittelyä'; end if;
  if p_decision = 'approved' and (v_old.created_by = v_user or v_old.updated_by = v_user)
  then raise exception 'Itse luotua tai muokattua kirjausta ei voi hyväksyä. Käytä toista hyväksyjää.'; end if;
  update public.time_entries set status=p_decision,reviewed_by=v_user,reviewed_at=now(),
    review_reason=nullif(btrim(coalesce(p_reason,'')),''),updated_by=v_user,updated_at=now()
  where id=p_entry_id returning * into v_new;
  insert into public.entry_events(organization_id,entry_id,actor_id,action,before_value,after_value,reason)
    values(v_org,p_entry_id,v_user,case when p_decision='approved' then 'approved' else 'returned' end,
      to_jsonb(v_old),to_jsonb(v_new),nullif(btrim(coalesce(p_reason,'')),''));
  return v_new.id;
end $$;

create function private.create_worksite_secure(p_name text,p_code text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_org uuid := private.my_organization(); v_new uuid;
begin
  if v_org is null or private.my_role() <> 'admin' then raise exception 'Vain pääkäyttäjä voi lisätä työmaan'; end if;
  if char_length(btrim(coalesce(p_name,''))) not between 2 and 120 or char_length(coalesce(p_code,'')) > 32
  then raise exception 'Virheellinen työmaan nimi tai koodi'; end if;
  insert into public.worksites(organization_id,name,code)
    values(v_org,btrim(p_name),btrim(coalesce(p_code,''))) returning id into v_new;
  return v_new;
end $$;

-- Julkisissa RPC-kuorissa ei ole definer-oikeuksia.
create function public.create_entry(p_employee_id uuid,p_worksite_id uuid,p_start timestamptz,
  p_end timestamptz,p_break integer,p_note text default '')
returns uuid language sql security invoker set search_path = '' as $$
  select private.create_entry_secure(p_employee_id,p_worksite_id,p_start,p_end,p_break,p_note)
$$;
create function public.update_entry(p_entry_id uuid,p_worksite_id uuid,p_start timestamptz,
  p_end timestamptz,p_break integer,p_note text,p_reason text)
returns uuid language sql security invoker set search_path = '' as $$
  select private.update_entry_secure(p_entry_id,p_worksite_id,p_start,p_end,p_break,p_note,p_reason)
$$;
create function public.review_entry(p_entry_id uuid,p_decision text,p_reason text default '')
returns uuid language sql security invoker set search_path = '' as $$
  select private.review_entry_secure(p_entry_id,p_decision,p_reason)
$$;
create function public.create_worksite(p_name text,p_code text default '')
returns uuid language sql security invoker set search_path = '' as $$
  select private.create_worksite_secure(p_name,p_code)
$$;

revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function public.create_entry(uuid,uuid,timestamptz,timestamptz,integer,text),
  public.update_entry(uuid,uuid,timestamptz,timestamptz,integer,text,text),
  public.review_entry(uuid,text,text), public.create_worksite(text,text)
  from public, anon, authenticated;
grant execute on function private.my_organization(),private.my_role(),
  private.ensure_no_overlap(uuid,timestamptz,timestamptz,uuid),
  private.create_entry_secure(uuid,uuid,timestamptz,timestamptz,integer,text),
  private.update_entry_secure(uuid,uuid,timestamptz,timestamptz,integer,text,text),
  private.review_entry_secure(uuid,text,text),
  private.create_worksite_secure(text,text) to authenticated;
grant execute on function public.create_entry(uuid,uuid,timestamptz,timestamptz,integer,text),
  public.update_entry(uuid,uuid,timestamptz,timestamptz,integer,text,text),
  public.review_entry(uuid,text,text), public.create_worksite(text,text) to authenticated;
-- Private-skeemaa ei saa lisätä Dashboardin API Exposed schemas -asetukseen.