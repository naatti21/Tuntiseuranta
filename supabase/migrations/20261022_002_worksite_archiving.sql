-- TyömaaTunnit v0.2A.1 – arkistointi ilman historian poistamista.
-- Sovellettu Supabase-projektiin 22.10.2026 (worksite_archiving).
-- Säilytä alkuperäinen migraatio erillisenä. Tätä ei ajeta uudestaan samaan projektiin.

create or replace function private.set_worksite_active_secure(
  p_worksite_id uuid, p_active boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.my_organization();
  v_result uuid;
begin
  if auth.uid() is null or v_org is null or private.my_role() <> 'admin' then
    raise exception 'Vain pääkäyttäjä voi arkistoida tai palauttaa työmaan';
  end if;
  if p_worksite_id is null or p_active is null then
    raise exception 'Työmaan tunniste tai tila puuttuu';
  end if;
  update public.worksites set active=p_active
  where id=p_worksite_id and organization_id=v_org
  returning id into v_result;
  if v_result is null then
    raise exception 'Työmaata ei löydy tästä yrityksestä';
  end if;
  return v_result;
end $$;

create or replace function public.set_worksite_active(
  p_worksite_id uuid, p_active boolean
) returns uuid language sql security invoker set search_path = '' as $$
  select private.set_worksite_active_secure(p_worksite_id,p_active)
$$;

revoke execute on function private.set_worksite_active_secure(uuid,boolean)
  from public, anon, authenticated;
grant execute on function private.set_worksite_active_secure(uuid,boolean)
  to authenticated;
revoke execute on function public.set_worksite_active(uuid,boolean)
  from public, anon, authenticated;
grant execute on function public.set_worksite_active(uuid,boolean)
  to authenticated;

-- Korjaus sallitaan myös arkistoidulle alkuperäiselle työmaalle.
-- Uuden kirjauksen luontifunktio estää edelleen kaikki arkistoidut työmaat.
create or replace function private.update_entry_secure(
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
  perform private.ensure_no_overlap(v_old.employee_id,p_start,p_end,v_old.id);
  update public.time_entries set worksite_id=p_worksite_id,start_at=p_start,end_at=p_end,
    break_minutes=p_break,note=coalesce(p_note,''),status='submitted',
    updated_by=v_user,updated_at=now(),reviewed_by=null,reviewed_at=null,review_reason=null
  where id=v_old.id returning * into v_new;
  insert into public.entry_events(organization_id,entry_id,actor_id,action,before_value,after_value,reason)
    values(v_org,v_old.id,v_user,'changed',to_jsonb(v_old),to_jsonb(v_new),p_reason);
  return v_new.id;
end $$;