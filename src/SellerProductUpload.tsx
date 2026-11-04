import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from './lib/supabase';

export default function SellerProductUpload() {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function check() {
      if (!supabase) { setChecking(false); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const [{ data: role }, { data: store }] = await Promise.all([
          supabase.from('user_roles').select('role').eq('user_id', user.id).in('role', ['seller', 'admin']).limit(1).maybeSingle(),
          supabase.from('stores').select('id').eq('owner_id', user.id).limit(1).maybeSingle(),
        ]);
        if (active) setAllowed(Boolean(role || store));
      }
      if (active) setChecking(false);
    }
    void check();
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) { setError('Supabase belum dikonfigurasi.'); return; }
    setBusy(true); setError(''); setMessage('');
    const form = event.currentTarget;
    const values = new FormData(form);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Silakan masuk kembali.'); setBusy(false); return; }

    const storeName = String(values.get('store') || '').trim();
    const slug = storeName.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let { data: store, error: storeError } = await supabase.from('stores').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
    if (!store && !storeError) {
      const result = await supabase.from('stores').insert({ owner_id: user.id, name: storeName, slug: `${slug}-${crypto.randomUUID().slice(0, 8)}`, is_active: true }).select('id').single();
      store = result.data;
      storeError = result.error;
    }
    if (storeError || !store) { setError(storeError?.message || 'Toko tidak dapat dibuat.'); setBusy(false); return; }

    const name = String(values.get('name') || '').trim();
    const sku = String(values.get('sku') || '').trim();
    const categoryName = String(values.get('category') || '').trim();
    let categoryId: string | null = null;
    if (categoryName) {
      const { data: category } = await supabase.from('categories').select('id').ilike('name', categoryName).maybeSingle();
      categoryId = category?.id ?? null;
    }
    const file = values.get('image');
    let imagePath: string | null = null;
    if (file instanceof File && file.size > 0) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
        setError('Gambar harus JPG, PNG, atau WebP dan maksimal 5 MB.'); setBusy(false); return;
      }
      const path = `${store.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) { setError(uploadError.message); setBusy(false); return; }
      imagePath = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
    }

    const base = name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { error: insertError } = await supabase.from('products').insert({
      store_id: store.id, category_id: categoryId, name, slug: `${base}-${crypto.randomUUID().slice(0, 8)}`,
      description: String(values.get('description') || '').trim(), sku, price: Number(values.get('price')),
      compare_at_price: values.get('compare_at_price') ? Number(values.get('compare_at_price')) : null,
      stock: Number(values.get('stock')), image_paths: imagePath ? [imagePath] : [], is_active: true,
    });
    setBusy(false);
    if (insertError) setError(insertError.message);
    else { setMessage('Produk berhasil ditambahkan.'); form.reset(); }
  }

  if (checking) return <section className="address-book"><p>Memeriksa akses toko…</p></section>;
  if (!allowed) return <section className="address-book"><h2>Akses seller diperlukan</h2><p>Masuk dengan akun seller atau pemilik toko untuk menambahkan produk.</p></section>;
  return <section className="address-book">
    <div className="address-heading"><div><span className="eyebrow">TOKO SAYA</span><h2>Tambah produk</h2><p>Lengkapi detail produk dan unggah foto JPG, PNG, atau WebP (maksimal 5 MB).</p></div></div>
    <form className="address-form" onSubmit={event => void submit(event)}>
      <div className="address-form-grid">
        <label>Nama toko<input name="store" required maxLength={80} placeholder="Nama toko"/></label>
        <label>Nama produk<input name="name" required maxLength={120}/></label>
        <label>SKU<input name="sku" required maxLength={64}/></label>
        <label>Kategori<input name="category" placeholder="Contoh: Elektronik"/></label>
        <label>Harga (Rp)<input name="price" required type="number" min="0" step="1"/></label>
        <label>Harga sebelum diskon<input name="compare_at_price" type="number" min="0" step="1"/></label>
        <label>Stok<input name="stock" required type="number" min="0" step="1" defaultValue="0"/></label>
        <label>Foto produk<input name="image" type="file" accept="image/jpeg,image/png,image/webp"/></label>
        <label className="address-wide">Deskripsi<textarea name="description" rows={4}/></label>
      </div>
      <div className="address-form-actions"><button className="checkout-button" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan produk'}</button></div>
    </form>
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
  </section>;
}
