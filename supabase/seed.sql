insert into public.categories(name,slug,sort_order) values
('Elektronik','elektronik',1),('Fashion','fashion',2),('Kecantikan','kecantikan',3),('Rumah & Dapur','rumah-dapur',4),('Olahraga','olahraga',5),('Ibu & Bayi','ibu-bayi',6),('Otomotif','otomotif',7),('Lainnya','lainnya',8)
on conflict(slug) do nothing;
-- Konten contoh hanya memakai placeholder visual UI. Produk nyata perlu dibuat setelah akun toko demo disiapkan.
insert into public.banners(title,subtitle,target_url,is_active,sort_order)
values('Belanja Mudah, Hidup Lebih Baik','Dapatkan produk terbaik dengan harga yang lebih hemat.','/products',true,1);
