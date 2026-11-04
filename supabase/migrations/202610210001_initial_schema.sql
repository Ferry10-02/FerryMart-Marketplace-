create extension if not exists pgcrypto;

create type public.app_role as enum ('customer','seller','admin');
create type public.order_status as enum ('awaiting_confirmation','processing','shipped','completed','cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '', phone text, avatar_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'customer', created_at timestamptz not null default now(),
  primary key(user_id,role)
);
create table public.categories (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  image_path text, is_active boolean not null default true, sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create table public.stores (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
  name text not null, slug text not null unique, description text not null default '', logo_path text,
  is_active boolean not null default false, created_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id),
  category_id uuid references public.categories(id) on delete set null,
  name text not null, slug text not null unique, description text not null default '', sku text not null,
  price bigint not null check(price >= 0), compare_at_price bigint check(compare_at_price is null or compare_at_price >= price),
  stock integer not null default 0 check(stock >= 0), image_paths text[] not null default '{}',
  is_active boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(store_id,sku)
);
create index products_category_active_idx on public.products(category_id,is_active,created_at desc);
create index products_store_idx on public.products(store_id,is_active);
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  recipient_name text not null, phone text not null, address_line text not null, city text not null,
  province text not null, postal_code text not null, is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists one_default_address_per_user on public.addresses(user_id) where is_default;
create table public.carts (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check(quantity between 1 and 100), variant jsonb not null default '{}',
  created_at timestamptz not null default now(), primary key(user_id,product_id)
);
create table public.wishlists (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(user_id,product_id)
);
create table public.vouchers (
  id uuid primary key default gen_random_uuid(), code text not null unique,
  discount_type text not null check(discount_type in ('fixed','percent')),
  discount_value bigint not null check(discount_value > 0 and (discount_type <> 'percent' or discount_value <= 100)), minimum_subtotal bigint not null default 0,
  max_discount bigint, usage_limit integer, usage_count integer not null default 0,
  starts_at timestamptz not null, ends_at timestamptz not null, is_active boolean not null default false,
  check(ends_at > starts_at)
);
create table public.orders (
  id uuid primary key default gen_random_uuid(), order_number text not null unique,
  idempotency_key uuid not null unique, user_id uuid not null references auth.users(id),
  address_snapshot jsonb not null, status public.order_status not null default 'awaiting_confirmation',
  subtotal bigint not null check(subtotal >= 0), discount bigint not null default 0 check(discount >= 0),
  shipping_fee bigint not null default 0 check(shipping_fee >= 0), total bigint not null check(total >= 0),
  payment_method text not null check(payment_method in ('cod','demo')), voucher_code text,
  created_at timestamptz not null default now()
);
create index orders_user_date_idx on public.orders(user_id,created_at desc);
create table public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
  product_id uuid references public.products(id) on delete set null, store_id uuid references public.stores(id) on delete set null,
  product_name text not null, unit_price bigint not null check(unit_price >= 0), quantity integer not null check(quantity > 0),
  variant jsonb not null default '{}'
);
create index order_items_store_idx on public.order_items(store_id,order_id);
create table public.voucher_redemptions (
  voucher_id uuid not null references public.vouchers(id), user_id uuid not null references auth.users(id),
  order_id uuid not null unique references public.orders(id), created_at timestamptz not null default now(),
  primary key(voucher_id,user_id)
);
create table public.reviews (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  product_id uuid not null references public.products(id), order_item_id uuid not null unique references public.order_items(id),
  rating int not null check(rating between 1 and 5), comment text not null default '', created_at timestamptz not null default now()
);
create table public.banners (
  id uuid primary key default gen_random_uuid(), title text not null, subtitle text not null default '',
  image_path text, target_url text not null default '/products', start_at timestamptz, end_at timestamptz,
  is_active boolean not null default false, sort_order int not null default 0
);
create table public.flash_sales (
  id uuid primary key default gen_random_uuid(), name text not null, start_at timestamptz not null,
  end_at timestamptz not null, is_active boolean not null default false, check(end_at > start_at)
);
create table public.flash_sale_items (
  id uuid primary key default gen_random_uuid(), flash_sale_id uuid not null references public.flash_sales(id) on delete cascade,
  product_id uuid not null references public.products(id), sale_price bigint not null check(sale_price >= 0),
  stock_limit integer check(stock_limit is null or stock_limit >= 0), unique(flash_sale_id,product_id)
);

create or replace function public.has_role(wanted public.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_roles where user_id = (select auth.uid()) and role = wanted)
$$;
revoke all on function public.has_role(public.app_role) from public;
grant execute on function public.has_role(public.app_role) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''));
  insert into public.user_roles(user_id,role) values(new.id,'customer');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.addresses enable row level security;
alter table public.carts enable row level security;
alter table public.wishlists enable row level security;
alter table public.vouchers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.voucher_redemptions enable row level security;
alter table public.reviews enable row level security;
alter table public.banners enable row level security;
alter table public.flash_sales enable row level security;
alter table public.flash_sale_items enable row level security;

create policy "public read active categories" on public.categories for select using(is_active or public.has_role('admin'));
create policy "admin manage categories" on public.categories for all to authenticated using(public.has_role('admin')) with check(public.has_role('admin'));
create policy "public read active stores" on public.stores for select using(is_active or owner_id=(select auth.uid()) or public.has_role('admin'));
create policy "owner manage store" on public.stores for all to authenticated using(owner_id=(select auth.uid()) or public.has_role('admin')) with check(owner_id=(select auth.uid()) or public.has_role('admin'));
create policy "public read active products" on public.products for select using(is_active or exists(select 1 from public.stores s where s.id=store_id and s.owner_id=(select auth.uid())) or public.has_role('admin'));
create policy "owner manage products" on public.products for all to authenticated using(exists(select 1 from public.stores s where s.id=store_id and s.owner_id=(select auth.uid())) or public.has_role('admin')) with check(exists(select 1 from public.stores s where s.id=store_id and s.owner_id=(select auth.uid())) or public.has_role('admin'));
create policy "own profile read" on public.profiles for select to authenticated using(id=(select auth.uid()) or public.has_role('admin'));
create policy "own profile update" on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy "role read self" on public.user_roles for select to authenticated using(user_id=(select auth.uid()) or public.has_role('admin'));
create policy "admin manage roles" on public.user_roles for all to authenticated using(public.has_role('admin')) with check(public.has_role('admin'));
do $$ begin
  create policy "own addresses" on public.addresses for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
exception when duplicate_object then null;
end $$;
create policy "own cart" on public.carts for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "own wishlist" on public.wishlists for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "public read active banners" on public.banners for select using(is_active or public.has_role('admin'));
create policy "admin manage banners" on public.banners for all to authenticated using(public.has_role('admin')) with check(public.has_role('admin'));
create policy "public read active flash sales" on public.flash_sales for select using(is_active or public.has_role('admin'));
create policy "admin manage flash sales" on public.flash_sales for all to authenticated using(public.has_role('admin')) with check(public.has_role('admin'));
create policy "public read flash items" on public.flash_sale_items for select using(exists(select 1 from public.flash_sales f where f.id=flash_sale_id and f.is_active and now() between f.start_at and f.end_at) or public.has_role('admin'));
create policy "admin manage flash items" on public.flash_sale_items for all to authenticated using(public.has_role('admin')) with check(public.has_role('admin'));
create policy "read applicable voucher codes" on public.vouchers for select using(is_active and now() between starts_at and ends_at or public.has_role('admin'));
create policy "admin manage vouchers" on public.vouchers for all to authenticated using(public.has_role('admin')) with check(public.has_role('admin'));
create policy "buyer read own orders" on public.orders for select to authenticated using(user_id=(select auth.uid()) or public.has_role('admin'));
create policy "buyer read own order items" on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.user_id=(select auth.uid())) or exists(select 1 from public.stores s where s.id=store_id and s.owner_id=(select auth.uid())) or public.has_role('admin'));
create policy "buyer create eligible reviews" on public.reviews for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.order_items i join public.orders o on o.id=i.order_id where i.id=order_item_id and i.product_id=reviews.product_id and o.user_id=(select auth.uid()) and o.status='completed'));
create policy "read reviews" on public.reviews for select using(true);
create policy "owner delete own review" on public.reviews for delete to authenticated using(user_id=(select auth.uid()));
create policy "admin read redemptions" on public.voucher_redemptions for select to authenticated using(public.has_role('admin'));

create or replace function public.create_order(p_address_id uuid,p_payment_method text,p_idempotency_key uuid,p_voucher_code text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); addr jsonb; subtotal_value bigint; discount_value bigint := 0; total_value bigint; order_id uuid; voucher_row public.vouchers%rowtype;
begin
  if uid is null then raise exception 'Login diperlukan'; end if;
  if p_payment_method not in ('cod','demo') then raise exception 'Metode pembayaran tidak didukung'; end if;
  select id into order_id from public.orders where idempotency_key=p_idempotency_key and user_id=uid;
  if order_id is not null then return order_id; end if;
  select to_jsonb(a)-'user_id' into addr from public.addresses a where a.id=p_address_id and a.user_id=uid;
  if addr is null then raise exception 'Alamat pengiriman tidak valid'; end if;
  perform 1 from public.carts c where c.user_id=uid order by c.product_id for update;
  perform p.id from public.products p join public.carts c on c.product_id=p.id where c.user_id=uid order by p.id for update of p;
  if not exists(select 1 from public.carts where user_id=uid) then raise exception 'Keranjang kosong'; end if;
  if exists(select 1 from public.carts c join public.products p on p.id=c.product_id join public.stores s on s.id=p.store_id where c.user_id=uid and (p.stock<c.quantity or not p.is_active or not s.is_active)) then raise exception 'Stok atau ketersediaan produk berubah'; end if;
  select sum(p.price*c.quantity) into subtotal_value from public.carts c join public.products p on p.id=c.product_id where c.user_id=uid;
  if p_voucher_code is not null then
    select * into voucher_row from public.vouchers where code=upper(p_voucher_code) and is_active and now() between starts_at and ends_at for update;
    if not found or subtotal_value<voucher_row.minimum_subtotal or (voucher_row.usage_limit is not null and voucher_row.usage_count>=voucher_row.usage_limit) then raise exception 'Voucher tidak berlaku'; end if;
    if exists(select 1 from public.voucher_redemptions where voucher_id=voucher_row.id and user_id=uid) then raise exception 'Voucher sudah digunakan'; end if;
    discount_value:=case when voucher_row.discount_type='fixed' then voucher_row.discount_value else floor(subtotal_value*voucher_row.discount_value/100.0)::bigint end;
    if voucher_row.max_discount is not null then discount_value:=least(discount_value,voucher_row.max_discount); end if;
    discount_value:=least(discount_value,subtotal_value);
  end if;
  total_value:=subtotal_value-discount_value;
  insert into public.orders(order_number,idempotency_key,user_id,address_snapshot,status,subtotal,discount,total, payment_method,voucher_code)
    values('FM-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),p_idempotency_key,uid,addr,'awaiting_confirmation',subtotal_value,discount_value,total_value,p_payment_method,upper(p_voucher_code)) returning id into order_id;
  insert into public.order_items(order_id,product_id,store_id,product_name,unit_price,quantity,variant)
    select order_id,p.id,p.store_id,p.name,p.price,c.quantity,c.variant from public.carts c join public.products p on p.id=c.product_id where c.user_id=uid;
  update public.products p set stock=p.stock-c.quantity,updated_at=now() from public.carts c where c.user_id=uid and p.id=c.product_id;
  delete from public.carts where user_id=uid;
  if p_voucher_code is not null then insert into public.voucher_redemptions(voucher_id,user_id,order_id) values(voucher_row.id,uid,order_id); update public.vouchers set usage_count=usage_count+1 where id=voucher_row.id; end if;
  return order_id;
end $$;
revoke all on function public.create_order(uuid,text,uuid,text) from public;
grant execute on function public.create_order(uuid,text,uuid,text) to authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.categories,public.stores,public.products,public.banners,public.flash_sales,public.flash_sale_items,public.vouchers,public.reviews to anon,authenticated;
grant select,insert,update,delete on public.profiles,public.addresses,public.carts,public.wishlists,public.reviews to authenticated;
grant select on public.user_roles,public.orders,public.order_items,public.voucher_redemptions to authenticated;
  grant insert,update,delete on public.stores,public.products,public.categories,public.vouchers,public.banners,public.flash_sales,public.flash_sale_items,public.user_roles to authenticated;
