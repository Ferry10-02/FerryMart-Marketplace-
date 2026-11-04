import { useEffect, useState, type FormEvent } from 'react';
import { ChevronRight } from 'lucide-react';
import { supabase } from './lib/supabase';

type Profile = { full_name: string; phone: string; date_of_birth: string | null; gender: string | null };
const blank: Profile = { full_name: '', phone: '', date_of_birth: null, gender: null };

export default function ProfileSettings({ email }: { email: string }) {
  const [profile, setProfile] = useState<Profile>(blank);
  const [form, setForm] = useState<Profile>(blank);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) { setLoading(false); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data, error: loadError } = await supabase.from('profiles').select('full_name,phone,date_of_birth,gender').eq('id', user.id).maybeSingle();
      if (!active) return;
      if (loadError) setError(loadError.message);
      if (data) setProfile({ full_name: data.full_name || '', phone: data.phone || '', date_of_birth: data.date_of_birth || null, gender: data.gender || null });
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, []);

  function edit(field?: keyof Profile) {
    setForm({ ...profile }); setError(''); setMessage(''); setOpen(true);
    if (field === 'full_name' || field === 'phone' || field === 'date_of_birth' || field === 'gender') {
      window.setTimeout(() => document.getElementById(`profile-${field}`)?.focus(), 0);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) { setError('Supabase belum dikonfigurasi.'); return; }
    setBusy(true); setError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Silakan masuk kembali.'); setBusy(false); return; }
    const values = { full_name: form.full_name.trim(), phone: form.phone.trim() || null, date_of_birth: form.date_of_birth || null, gender: form.gender || null };
    const { error: saveError } = await supabase.from('profiles').update(values).eq('id', user.id);
    setBusy(false);
    if (saveError) { setError(saveError.message); return; }
    setProfile({ ...values, phone: values.phone || '' }); setOpen(false); setMessage('Informasi akun berhasil disimpan.');
  }

  const items: { key: keyof Profile | 'email'; label: string; icon: string; value: string }[] = [
    { key: 'full_name', label: 'Nama Lengkap', icon: '♙', value: profile.full_name || 'Tambahkan informasi' },
    { key: 'email', label: 'Email', icon: '✉', value: email },
    { key: 'phone', label: 'Nomor Telepon', icon: '☎', value: profile.phone || 'Tambahkan informasi' },
    { key: 'date_of_birth', label: 'Tanggal Lahir', icon: '▣', value: profile.date_of_birth ? new Date(`${profile.date_of_birth}T00:00:00`).toLocaleDateString('id-ID') : 'Tambahkan informasi' },
    { key: 'gender', label: 'Jenis Kelamin', icon: '◉', value: profile.gender === 'male' ? 'Laki-laki' : profile.gender === 'female' ? 'Perempuan' : 'Tambahkan informasi' },
  ];

  return <>
    <section className="settings-card"><h2>Informasi Akun</h2>
      {items.map(item => <button type="button" className="settings-row settings-row-button" key={item.key} onClick={() => item.key === 'email' ? (setError('Email akun dikelola oleh proses autentikasi dan belum bisa diubah di sini.'), setMessage('')) : edit(item.key)}>
        <span>{item.icon}</span><div><b>{item.label}</b><small>{loading ? 'Memuat…' : item.value}</small></div><ChevronRight size={15}/>
      </button>)}
      {error && !open && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
      <button type="button" className="settings-action" onClick={() => edit()}>✎　Ubah Informasi　›</button>
    </section>
    {open && <div className="profile-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
      <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
        <div className="address-form-head"><h2 id="profile-modal-title">Ubah Informasi Akun</h2><button type="button" onClick={() => setOpen(false)} aria-label="Tutup">×</button></div>
        <form onSubmit={event => void save(event)}><label>Nama lengkap<input id="profile-full_name" required maxLength={120} value={form.full_name} onChange={event => setForm({ ...form, full_name: event.target.value })}/></label>
          <label>Email akun<input type="email" value={email} readOnly/><small>Email tidak dapat diubah di halaman ini.</small></label>
          <label>Nomor telepon<input id="profile-phone" type="tel" maxLength={32} value={form.phone || ''} onChange={event => setForm({ ...form, phone: event.target.value })}/></label>
          <label>Tanggal lahir<input id="profile-date_of_birth" type="date" value={form.date_of_birth || ''} onChange={event => setForm({ ...form, date_of_birth: event.target.value || null })}/></label>
          <label>Jenis kelamin<select id="profile-gender" value={form.gender || ''} onChange={event => setForm({ ...form, gender: event.target.value || null })}><option value="">Pilih (opsional)</option><option value="female">Perempuan</option><option value="male">Laki-laki</option><option value="other">Lainnya</option></select></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="address-form-actions"><button type="button" className="outline-button" disabled={busy} onClick={() => setOpen(false)}>Batal</button><button className="checkout-button" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan perubahan'}</button></div>
        </form>
      </section>
    </div>}
  </>;
}
