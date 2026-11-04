-- Input data required to request courier quotes from RajaOngkir.
alter table public.stores
  add column if not exists origin_district_id integer;

alter table public.products
  add column if not exists weight_grams integer not null default 1000;

alter table public.products
  drop constraint if exists products_weight_grams_check;

alter table public.products
  add constraint products_weight_grams_check check (weight_grams between 1 and 300000);

alter table public.addresses
  add column if not exists district_id integer;

notify pgrst, 'reload schema';
