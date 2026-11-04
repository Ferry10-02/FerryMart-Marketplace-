import { useEffect } from 'react';
import { supabase } from './lib/supabase';

type Passkey = { id: string; friendly_name?: string; created_at?: string };
type PasskeyAuth = {
  registerPasskey: () => Promise<{ data: Passkey | null; error: Error | null }>;
  signInWithPasskey: () => Promise<{ error: Error | null }>;
  passkey: {
    list: () => Promise<{ data: Passkey[] | null; error: Error | null }>;
    delete: (input: { passkeyId: string }) => Promise<{ error: Error | null }>;
  };
};

export function usePasskeyEnhancement() {
  useEffect(() => {
    const auth = supabase?.auth as unknown as PasskeyAuth | undefined;
    if (!auth) return;

    let busy = false;
    const renderSecurity = () => {
      const cards = [...document.querySelectorAll<HTMLElement>('.settings-card')];
      const card = cards.find((item) => item.querySelector('h2')?.textContent?.trim() === 'Keamanan Akun'
        && item.textContent?.includes('Lindungi akun dan sesi masuk Anda.'));
      if (card && !card.querySelector('[data-fm-passkeys]')) {
        const panel = document.createElement('div');
        panel.dataset.fmPasskeys = 'true';
        panel.style.cssText = 'border-top:1px solid #e5e7eb;margin-top:12px;padding-top:14px';
        panel.innerHTML = '<b style="display:block;margin-bottom:5px">Passkey · Sidik jari atau wajah</b><small style="display:block;color:#64748b;margin-bottom:10px">Gunakan Face ID, sidik jari, Windows Hello, PIN perangkat, atau kunci keamanan. Data biometrik tetap tersimpan di perangkat.</small><button type="button" data-fm-add-passkey class="checkout-button">＋ Tambahkan Passkey</button><div data-fm-passkey-list style="margin-top:10px"></div><p data-fm-passkey-message role="status" style="margin:8px 0 0"></p>';
        card.append(panel);
        void refreshList(panel);
      }

      const loginCard = [...document.querySelectorAll<HTMLElement>('.auth-card')]
        .find((item) => item.querySelector('h1')?.textContent?.includes('Selamat datang kembali'));
      if (loginCard && !loginCard.querySelector('[data-fm-passkey-login]')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.fmPasskeyLogin = 'true';
        button.className = 'outline-button';
        button.style.cssText = 'width:100%;margin-top:12px;justify-content:center';
        button.textContent = 'Masuk dengan Passkey';
        loginCard.querySelector('form')?.after(button);
      }
    };

    async function refreshList(panel: HTMLElement) {
      const list = panel.querySelector<HTMLElement>('[data-fm-passkey-list]');
      if (!list) return;
      const { data, error } = await auth.passkey.list();
      if (error) { list.textContent = error.message; return; }
      list.replaceChildren();
      if (!data?.length) { list.innerHTML = '<small>Belum ada Passkey terdaftar di akun ini.</small>'; return; }
      for (const key of data) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid #e5e7eb';
        const label = document.createElement('span');
        label.textContent = key.friendly_name || 'Passkey perangkat';
        const remove = document.createElement('button');
        remove.type = 'button'; remove.className = 'outline-button'; remove.textContent = 'Hapus';
        remove.dataset.fmDeletePasskey = key.id;
        row.append(label, remove); list.append(row);
      }
    }

    const onClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLButtonElement>('button');
      if (!button || busy) return;
      const panel = button.closest<HTMLElement>('[data-fm-passkeys]');
      const message = panel?.querySelector<HTMLElement>('[data-fm-passkey-message]');
      if (button.matches('[data-fm-add-passkey]') && panel && message) {
        busy = true; button.disabled = true; message.textContent = 'Ikuti petunjuk keamanan dari perangkat…';
        void auth.registerPasskey().then(async ({ error }) => {
          if (error) throw error;
          message.textContent = 'Passkey berhasil ditambahkan.';
          await refreshList(panel);
        }).catch((error: unknown) => { message.textContent = error instanceof Error ? error.message : 'Passkey gagal ditambahkan.'; })
          .finally(() => { busy = false; button.disabled = false; });
      } else if (button.dataset.fmDeletePasskey && panel && message) {
        busy = true; button.disabled = true; message.textContent = 'Menghapus Passkey…';
        void auth.passkey.delete({ passkeyId: button.dataset.fmDeletePasskey }).then(async ({ error }) => {
          if (error) throw error;
          message.textContent = 'Passkey dihapus.';
          await refreshList(panel);
        }).catch((error: unknown) => { message.textContent = error instanceof Error ? error.message : 'Passkey gagal dihapus.'; })
          .finally(() => { busy = false; });
      } else if (button.matches('[data-fm-passkey-login]')) {
        busy = true; button.disabled = true; button.textContent = 'Menunggu verifikasi perangkat…';
        void auth.signInWithPasskey().then(({ error }) => {
          if (error) throw error;
          window.location.assign('/');
        }).catch((error: unknown) => {
          button.textContent = error instanceof Error ? error.message : 'Masuk dengan Passkey gagal.';
        }).finally(() => { busy = false; button.disabled = false; });
      }
    };

    const observer = new MutationObserver(renderSecurity);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', onClick);
    renderSecurity();
    return () => { observer.disconnect(); document.removeEventListener('click', onClick); };
  }, []);
}
