insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp']),
  ('store-assets','store-assets',true,3145728,array['image/jpeg','image/png','image/webp']),
  ('user-avatars','user-avatars',true,2097152,array['image/jpeg','image/png','image/webp']),
  ('promo-banners','promo-banners',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "public read marketplace assets" on storage.objects for select to anon,authenticated
using(bucket_id in ('product-images','store-assets','user-avatars','promo-banners'));

create policy "store owners upload product photos" on storage.objects for insert to authenticated
with check(bucket_id='product-images' and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' and exists(
  select 1 from public.stores s where s.id::text=(storage.foldername(name))[1] and s.owner_id=(select auth.uid())
));
create policy "store owners update product photos" on storage.objects for update to authenticated
using(bucket_id='product-images' and exists(select 1 from public.stores s where s.id::text=(storage.foldername(name))[1] and s.owner_id=(select auth.uid())))
with check(bucket_id='product-images' and exists(select 1 from public.stores s where s.id::text=(storage.foldername(name))[1] and s.owner_id=(select auth.uid())));
create policy "store owners delete product photos" on storage.objects for delete to authenticated
using(bucket_id='product-images' and exists(select 1 from public.stores s where s.id::text=(storage.foldername(name))[1] and s.owner_id=(select auth.uid())));

create policy "store owners manage store assets" on storage.objects for all to authenticated
using(bucket_id='store-assets' and exists(select 1 from public.stores s where s.id::text=(storage.foldername(name))[1] and s.owner_id=(select auth.uid())))
with check(bucket_id='store-assets' and exists(select 1 from public.stores s where s.id::text=(storage.foldername(name))[1] and s.owner_id=(select auth.uid())));

create policy "users manage own avatar" on storage.objects for all to authenticated
using(bucket_id='user-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check(bucket_id='user-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);

create policy "admins manage promo banners" on storage.objects for all to authenticated
using(bucket_id='promo-banners' and public.has_role('admin'))
with check(bucket_id='promo-banners' and public.has_role('admin'));
