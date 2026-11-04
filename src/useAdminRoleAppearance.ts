import { useEffect } from 'react';
import { supabase } from './lib/supabase';

export function useAdminRoleAppearance() {
  useEffect(() => {
    if (!supabase) return;

    const style = document.createElement('style');
    style.dataset.fmAdminAppearance = 'true';
    style.textContent = `
      html[data-fm-role="admin"] .topbar { border-bottom: 2px solid #7c3aed; }
      html[data-fm-role="admin"] .sidebar { border-right-color: #ddd6fe; }
      .fm-admin-label { margin: 12px 10px 6px; padding: 8px 10px; border-radius: 9px; background: #f3e8ff; color: #6b21a8; font-size: 11px; font-weight: 800; letter-spacing: .09em; }
      .fm-admin-nav { margin-top: 8px; background: #f5f3ff; color: #6d28d9 !important; font-weight: 700; }
      .fm-admin-nav:hover { background: #ede9fe !important; }
    `;
    document.head.append(style);

    let currentIsAdmin = false;
    const renderAdminView = () => {
      const isAdmin = currentIsAdmin;
      if (isAdmin) document.documentElement.dataset.fmRole = 'admin';
      else delete document.documentElement.dataset.fmRole;

      const sidebar = document.querySelector<HTMLElement>('.sidebar');
      const nav = sidebar?.querySelector('nav');
      let label = sidebar?.querySelector<HTMLElement>('.fm-admin-label');
      let shortcut = nav?.querySelector<HTMLAnchorElement>('.fm-admin-nav');
      if (isAdmin && sidebar && nav) {
        if (!label) {
          label = document.createElement('div');
          label.className = 'fm-admin-label';
          label.textContent = 'ADMINISTRATOR';
          sidebar.insertBefore(label, nav);
        }
        if (!shortcut) {
          shortcut = document.createElement('a');
          shortcut.href = '/admin/products';
          shortcut.className = 'nav-link fm-admin-nav';
          shortcut.innerHTML = '<span aria-hidden="true">🛠️</span><span>Panel Admin</span>';
          nav.append(shortcut);
        }
      } else {
        label?.remove();
        shortcut?.remove();
      }
    };
    const syncAdminView = async (userId?: string) => {
      currentIsAdmin = false;
      renderAdminView();
      if (!userId) return;
      const { data, error } = await supabase!.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
      currentIsAdmin = Boolean(data && !error);
      renderAdminView();
    };

    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) void syncAdminView(data.user?.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      window.setTimeout(async () => {
        await syncAdminView(session?.user.id);
        if (event === 'SIGNED_IN' && currentIsAdmin) window.location.assign('/admin/products');
      }, 0);
    });
    const observer = new MutationObserver(() => {
      renderAdminView();
    });
    observer.observe(document.querySelector('.app-shell') || document.body, { childList: true, subtree: true });

    return () => {
      active = false;
      subscription.unsubscribe();
      observer.disconnect();
      style.remove();
      delete document.documentElement.dataset.fmRole;
      document.querySelector('.fm-admin-label')?.remove();
      document.querySelector('.fm-admin-nav')?.remove();
    };
  }, []);
}
