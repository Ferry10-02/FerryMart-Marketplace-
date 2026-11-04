-- Make this migration safe to apply even if the initial schema was not run.
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipient_name text not null,
  phone text not null,
  address_line text not null,
  district text not null default '',
  city text not null,
  province text not null,
  postal_code text not null,
  label text not null default 'Rumah',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.addresses
  add column if not exists label text not null default 'Rumah',
  add column if not exists district text not null default '';

create unique index if not exists one_default_address_per_user
  on public.addresses(user_id) where is_default;

alter table public.addresses enable row level security;
do $$ begin
  create policy "own addresses" on public.addresses for all to authenticated
    using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
exception when duplicate_object then null;
end $$;
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.addresses to authenticated;

create or replace function public.set_default_address(p_address_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Login diperlukan'; end if;
  if not exists(select 1 from public.addresses where id=p_address_id and user_id=auth.uid()) then
    raise exception 'Alamat tidak ditemukan';
  end if;
  update public.addresses set is_default=false where user_id=auth.uid() and is_default;
  update public.addresses set is_default=true where id=p_address_id and user_id=auth.uid();
end $$;
revoke all on function public.set_default_address(uuid) from public;
grant execute on function public.set_default_address(uuid) to authenticated;

notify pgrst, 'reload schema';
