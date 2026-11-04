create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(buyer_id,product_id)
);
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check(char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists conversations_store_date_idx on public.conversations(store_id,created_at desc);
create index if not exists chat_messages_conversation_date_idx on public.chat_messages(conversation_id,created_at);
alter table public.conversations enable row level security;
alter table public.chat_messages enable row level security;
drop policy if exists "chat participants read conversations" on public.conversations;
create policy "chat participants read conversations" on public.conversations for select to authenticated using(
  buyer_id=(select auth.uid()) or exists(select 1 from public.stores s where s.id=store_id and s.owner_id=(select auth.uid())) or public.has_role('admin')
);
drop policy if exists "buyers start product chats" on public.conversations;
create policy "buyers start product chats" on public.conversations for insert to authenticated with check(
  buyer_id=(select auth.uid()) and exists(select 1 from public.products p join public.stores s on s.id=p.store_id where p.id=product_id and s.id=store_id and p.is_active and s.is_active)
);
drop policy if exists "participants read chat messages" on public.chat_messages;
create policy "participants read chat messages" on public.chat_messages for select to authenticated using(
  exists(select 1 from public.conversations c join public.stores s on s.id=c.store_id where c.id=conversation_id and (c.buyer_id=(select auth.uid()) or s.owner_id=(select auth.uid()) or public.has_role('admin')))
);
drop policy if exists "participants send chat messages" on public.chat_messages;
create policy "participants send chat messages" on public.chat_messages for insert to authenticated with check(
  sender_id=(select auth.uid()) and exists(select 1 from public.conversations c join public.stores s on s.id=c.store_id where c.id=conversation_id and (c.buyer_id=(select auth.uid()) or s.owner_id=(select auth.uid()) or public.has_role('admin')))
);
grant select,insert on public.conversations,public.chat_messages to authenticated;
notify pgrst, 'reload schema';
