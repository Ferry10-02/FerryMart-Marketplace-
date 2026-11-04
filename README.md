# FerryMart Marketplace

FerryMart adalah fondasi marketplace berbasis React, TypeScript, Vite, React Router, dan Supabase. Antarmuka beranda mengikuti komposisi referensi: navigasi samping, banner, kategori, produk, panel keranjang, voucher, rekomendasi, dan toko.

## Status implementasi

Antarmuka beranda, katalog, detail produk, buku alamat, chat pembeli-penjual, ulasan terverifikasi, keranjang, checkout COD, dan riwayat pesanan tersedia. Produk yang dibuat lewat admin di Supabase tampil di katalog. Data katalog demo tetap ditampilkan sebagai pratinjau dan tidak dapat dibeli. Gateway pembayaran eksternal belum terhubung.

Migrasi Supabase menyiapkan profil, peran, toko, produk, kategori, alamat, cart, wishlist, voucher, pesanan, item pesanan, ulasan, banner, flash sale, RLS, Storage, RPC atomik `create_order`, dan tabel percakapan/pesan. Seller yang memiliki toko dapat menambahkan produk beserta foto lewat `/seller/products`; gambar JPG/PNG/WebP maksimal 5 MB disimpan di bucket `product-images`. Migrasi Storage harus diterapkan untuk mengaktifkan upload.

## Menjalankan lokal

1. Pasang Node.js 20.19+ atau 22.12+.
2. Jalankan `npm install`.
3. Salin `.env.example` menjadi `.env`.
4. Buat proyek Supabase dan isi URL serta publishable key di `.env`.
5. Jalankan migrasi `supabase/migrations/202610210001_initial_schema.sql` melalui Supabase CLI atau SQL Editor.
6. Jalankan `supabase/migrations/202610210002_storage.sql` untuk bucket dan policies Storage.
7. Jalankan `supabase/migrations/202610210003_address_book.sql` untuk label/kecamatan alamat dan RPC alamat utama.
8. Jalankan `supabase/seed.sql` untuk kategori dan banner contoh.
9. Jalankan `supabase/migrations/202610210004_messaging.sql` untuk chat penjual.
10. Jalankan `supabase/migrations/202610240001_profile_details.sql` untuk kolom tanggal lahir dan jenis kelamin.
11. Jalankan `npm run dev`.

Environment yang dipakai frontend hanya `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY`. Jangan pernah menaruh service role key di frontend. Migrasi kedua membuat bucket Storage dengan batas ukuran dan MIME type serta policies berbasis pemilik.

Pengaturan akun memungkinkan pengubahan nama lengkap, nomor telepon, tanggal lahir, dan jenis kelamin. Email akun tetap dikelola melalui autentikasi Supabase.

## Pemeriksaan

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

## Peran dan admin pertama

Registrasi database otomatis memberi role `customer`. Role tidak tersedia lewat metadata registrasi. Operator proyek dapat menetapkan role admin pertama secara manual melalui dashboard SQL Supabase setelah memverifikasi identitas akun: `insert into public.user_roles(user_id,role) select id,'admin' from auth.users where email = '<email-terverifikasi>';`. Jangan menyimpan password akun di source code.

## Vercel

Impor repository ke Vercel, gunakan preset Vite, tambahkan dua variabel environment Supabase yang sama untuk environment deployment, lalu deploy. Terapkan migrasi lebih dulu di Supabase. Pastikan redirect URL Supabase Auth mencakup domain Vercel. Payment gateway, ongkir real-time, dan dashboard seller lanjutan masih memerlukan implementasi tambahan.

Profil akun mendukung nama lengkap, nomor telepon, tanggal lahir, dan jenis kelamin. Untuk database yang sudah berjalan, jalankan migrasi supabase/migrations/202610240001_profile_details.sql sebelum menyimpan detail profil.
