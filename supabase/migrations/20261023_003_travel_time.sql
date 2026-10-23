-- TyömaaTunnit v0.2A.4, käytössä oleva migraatio: travel_time_intervals.
-- Uusiin tietokantoihin ajettavaksi 001_pilot.sql ja 002_worksite_archiving.sql jälkeen.
-- Matka-ajat eivät lisää palkallista työaikaa; vanhoille riveille oletuksena NULL.
alter table public.time_entries
 add column travel_out_start timestamptz,
 add column travel_out_end timestamptz,
 add column travel_back_start timestamptz,
 add column travel_back_end timestamptz;

alter table public.time_entries add constraint travel_out_pair_check
 check ((travel_out_start is null and travel_out_end is null) or
 (travel_out_start is not null and travel_out_end is not null and
 travel_out_end>travel_out_start and travel_out_end<=travel_out_start+interval '24 hours'));
alter table public.time_entries add constraint travel_back_pair_check
 check ((travel_back_start is null and travel_back_end is null) or
 (travel_back_start is not null and travel_back_end is not null and
 travel_back_end>travel_back_start and travel_back_end<=travel_back_start+interval '24 hours'));
alter table public.time_entries add constraint travel_distinct_work_check check (
 (travel_out_start is null or travel_out_end<=start_at or travel_out_start>=end_at)
 and (travel_back_start is null or travel_back_end<=start_at or travel_back_start>=end_at)
 and (travel_out_start is null or travel_back_start is null or
 travel_out_end<=travel_back_start or travel_back_end<=travel_out_start));

CREATE OR REPLACE FUNCTION private.validate_travel_intervals(p_start timestamp with time zone, p_end timestamp with time zone, p_out_start timestamp with time zone, p_out_end timestamp with time zone, p_back_start timestamp with time zone, p_back_end timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if (p_out_start is null) <> (p_out_end is null)
 or (p_back_start is null) <> (p_back_end is null) then
 raise exception 'Täytä molemmat matkan kellonajat tai jätä jakso tyhjäksi'; end if;
 if p_out_start is not null then
  if p_out_end <= p_out_start or p_out_end > p_out_start + interval '24 hours'
  then raise exception 'Menomatkan kellonajat ovat virheelliset'; end if;
  if p_out_start < p_end and p_out_end > p_start
  then raise exception 'Menomatka ja työaika ovat päällekkäin'; end if;
 end if;
 if p_back_start is not null then
  if p_back_end <= p_back_start or p_back_end > p_back_start + interval '24 hours'
  then raise exception 'Paluumatkan kellonajat ovat virheelliset'; end if;
  if p_back_start < p_end and p_back_end > p_start
  then raise exception 'Paluumatka ja työaika ovat päällekkäin'; end if;
 end if;
 if p_out_start is not null and p_back_start is not null
 and p_out_start < p_back_end and p_out_end > p_back_start then
 raise exception 'Meno- ja paluumatka ovat päällekkäin'; end if;
end $function$

CREATE OR REPLACE FUNCTION private.create_entry_with_travel_secure(p_employee_id uuid, p_worksite_id uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_break integer, p_note text, p_out_start timestamp with time zone, p_out_end timestamp with time zone, p_back_start timestamp with time zone, p_back_end timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  perform private.validate_travel_intervals(p_start,p_end,p_out_start,p_out_end,p_back_start,p_back_end);
  perform private.ensure_no_overlap(p_employee_id,p_start,p_end,null);
  insert into public.time_entries(organization_id,employee_id,worksite_id,start_at,end_at,break_minutes,note,created_by,updated_by,travel_out_start,travel_out_end,travel_back_start,travel_back_end)
  values(v_org,p_employee_id,p_worksite_id,p_start,p_end,p_break,coalesce(p_note,''),v_user,v_user,p_out_start,p_out_end,p_back_start,p_back_end)
  returning * into v_new;
  insert into public.entry_events(organization_id,entry_id,actor_id,action,after_value)
    values(v_org,v_new.id,v_user,'created',to_jsonb(v_new));
  return v_new.id;
end $function$

CREATE OR REPLACE FUNCTION private.update_entry_with_travel_secure(p_entry_id uuid, p_worksite_id uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_break integer, p_note text, p_reason text, p_out_start timestamp with time zone, p_out_end timestamp with time zone, p_back_start timestamp with time zone, p_back_end timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_org uuid := private.my_organization();
  v_role text := private.my_role();
  v_old public.time_entries%rowtype;
  v_new public.time_entries%rowtype;
begin
  if v_user is null or v_org is null then raise exception 'Ei aktiivista yritysjäsenyyttä'; end if;
  select * into v_old from public.time_entries e
  where e.id=p_entry_id and e.organization_id=v_org for update;
  if not found then raise exception 'Kirjausta ei löydy'; end if;
  if v_old.status = 'approved' then raise exception 'Hyväksyttyä kirjausta ei voi muokata'; end if;
  if v_old.employee_id <> v_user and v_role not in ('supervisor','admin')
  then raise exception 'Ei muokkausoikeutta'; end if;
  if v_old.employee_id = v_user and v_role = 'employee' and v_old.status <> 'needs_changes'
  then raise exception 'Lähetetty kirjaus täytyy palauttaa korjattavaksi ensin'; end if;
  if not exists (
    select 1 from public.worksites s
    where s.id=p_worksite_id and s.organization_id=v_org
      and (s.active or s.id=v_old.worksite_id)
  ) then raise exception 'Työmaa ei ole käytössä'; end if;
  if p_start is null or p_end is null or p_end <= p_start or p_end > p_start + interval '24 hours'
     or p_break is null or p_break < 0 or p_break >= (extract(epoch from (p_end-p_start))/60)
     or char_length(coalesce(p_note,'')) > 500
     or char_length(coalesce(p_reason,'')) < 3
  then raise exception 'Virheellinen muutos tai perustelu'; end if;
  perform private.validate_travel_intervals(p_start,p_end,p_out_start,p_out_end,p_back_start,p_back_end);
  perform private.ensure_no_overlap(v_old.employee_id,p_start,p_end,v_old.id);
  update public.time_entries set worksite_id=p_worksite_id,start_at=p_start,end_at=p_end,
    break_minutes=p_break,note=coalesce(p_note,''),
    travel_out_start=p_out_start,travel_out_end=p_out_end,
    travel_back_start=p_back_start,travel_back_end=p_back_end,status='submitted',
    updated_by=v_user,updated_at=now(),reviewed_by=null,reviewed_at=null,review_reason=null
  where id=v_old.id returning * into v_new;
  insert into public.entry_events(organization_id,entry_id,actor_id,action,before_value,after_value,reason)
    values(v_org,v_old.id,v_user,'changed',to_jsonb(v_old),to_jsonb(v_new),p_reason);
  return v_new.id;
end $function$

CREATE OR REPLACE FUNCTION public.create_entry_with_travel(p_employee_id uuid, p_worksite_id uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_break integer, p_note text, p_out_start timestamp with time zone, p_out_end timestamp with time zone, p_back_start timestamp with time zone, p_back_end timestamp with time zone)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.create_entry_with_travel_secure(p_employee_id,p_worksite_id,p_start,p_end,p_break,p_note,p_out_start,p_out_end,p_back_start,p_back_end)
$function$

CREATE OR REPLACE FUNCTION public.update_entry_with_travel(p_entry_id uuid, p_worksite_id uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_break integer, p_note text, p_reason text, p_out_start timestamp with time zone, p_out_end timestamp with time zone, p_back_start timestamp with time zone, p_back_end timestamp with time zone)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.update_entry_with_travel_secure(p_entry_id,p_worksite_id,p_start,p_end,p_break,p_note,p_reason,p_out_start,p_out_end,p_back_start,p_back_end)
$function$
-- Uudet RPC:t eivät saa yleistä PUBLIC/anon-suoritusoikeutta.
revoke execute on function private.validate_travel_intervals(timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz),
 private.create_entry_with_travel_secure(uuid,uuid,timestamptz,timestamptz,integer,text,timestamptz,timestamptz,timestamptz,timestamptz),
 private.update_entry_with_travel_secure(uuid,uuid,timestamptz,timestamptz,integer,text,text,timestamptz,timestamptz,timestamptz,timestamptz)
 from public,anon,authenticated;
grant execute on function private.validate_travel_intervals(timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz),
 private.create_entry_with_travel_secure(uuid,uuid,timestamptz,timestamptz,integer,text,timestamptz,timestamptz,timestamptz,timestamptz),
 private.update_entry_with_travel_secure(uuid,uuid,timestamptz,timestamptz,integer,text,text,timestamptz,timestamptz,timestamptz,timestamptz)
 to authenticated;
revoke execute on function public.create_entry_with_travel(uuid,uuid,timestamptz,timestamptz,integer,text,timestamptz,timestamptz,timestamptz,timestamptz),
 public.update_entry_with_travel(uuid,uuid,timestamptz,timestamptz,integer,text,text,timestamptz,timestamptz,timestamptz,timestamptz)
 from public,anon,authenticated;
grant execute on function public.create_entry_with_travel(uuid,uuid,timestamptz,timestamptz,integer,text,timestamptz,timestamptz,timestamptz,timestamptz),
 public.update_entry_with_travel(uuid,uuid,timestamptz,timestamptz,integer,text,text,timestamptz,timestamptz,timestamptz,timestamptz)
 to authenticated;
