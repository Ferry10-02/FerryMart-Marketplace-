import { useEffect } from 'react';
import { supabase } from './lib/supabase';

type DashboardOrder = { id: string; total: number; status: string; created_at: string };
type DashboardProduct = { id: string; name: string; stock: number; price: number; is_active: boolean };
type DashboardItem = { product_name: string; quantity: number; unit_price: number };
const rupiah = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);

export function useAdminDashboard() {
  useEffect(() => {
    if (!supabase) return;
    const style = document.createElement('style');
    style.dataset.fmAdminDashboard = 'true';
    style.textContent = `
      .fm-admin-dashboard{margin-bottom:20px;color:#172033}
      .fm-admin-dashboard *{box-sizing:border-box}
      .fm-admin-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 18px}
      .fm-admin-head h1{font-size:25px;margin:0 0 5px}.fm-admin-head p{margin:0;color:#7b8495;font-size:13px}
      .fm-admin-add{border:0;border-radius:8px;background:#1769e0;color:white;padding:11px 15px;font-weight:700;cursor:pointer}
      .fm-admin-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}
      .fm-admin-metric,.fm-admin-chart,.fm-admin-table{background:#fff;border:1px solid #e6eaf0;border-radius:12px;padding:15px;box-shadow:0 2px 8px #19233a08}
      .fm-admin-metric small{display:block;color:#7b8495;font-size:12px;margin-bottom:12px}.fm-admin-metric strong{font-size:20px}
      .fm-admin-chart{margin-bottom:16px}.fm-admin-chart h2,.fm-admin-table h2{font-size:15px;margin:0 0 14px}
      .fm-admin-bars{height:170px;display:flex;align-items:end;gap:10px;border-bottom:1px solid #e6eaf0;padding:0 4px}
      .fm-admin-bar-col{height:100%;flex:1;display:flex;flex-direction:column;justify-content:end;align-items:center;gap:6px;color:#7b8495;font-size:10px}
      .fm-admin-bar{width:min(24px,75%);min-height:3px;border-radius:4px 4px 0 0;background:linear-gradient(#4ba3ff,#1769e0)}
      .fm-admin-tables{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .fm-admin-table{overflow:auto}.fm-admin-table table{width:100%;border-collapse:collapse;font-size:12px}.fm-admin-table th,.fm-admin-table td{text-align:left;padding:9px 7px;border-bottom:1px solid #edf0f4;white-space:nowrap}.fm-admin-table th{color:#7b8495;font-weight:600}
      .fm-admin-error{font-size:12px;color:#b42318;margin:0 0 12px}
      @media(max-width:900px){.fm-admin-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.fm-admin-tables{grid-template-columns:1fr}}
    `;
    document.head.append(style);

    let active = true;
    const render = async () => {
      const host = [...document.querySelectorAll<HTMLElement>('.address-book')].find((section) => section.querySelector('h2')?.textContent?.trim() === 'Tambah produk');
      if (!host) return;
      let dashboard = host.querySelector<HTMLElement>('.fm-admin-dashboard');
      if (!dashboard) {
        dashboard = document.createElement('section');
        dashboard.className = 'fm-admin-dashboard';
        dashboard.innerHTML = '<div class="fm-admin-head"><div><span class="eyebrow">FERRYMART · ADMIN</span><h1>Dashboard</h1><p>Ringkasan aktivitas marketplace</p></div><button class="fm-admin-add" type="button">＋ Tambah Produk</button></div><div class="fm-admin-metrics"><article class="fm-admin-metric"><small>Total Penjualan</small><strong data-stat="sales">Memuat…</strong></article><article class="fm-admin-metric"><small>Total Pesanan</small><strong data-stat="orders">—</strong></article><article class="fm-admin-metric"><small>Produk Aktif</small><strong data-stat="products">—</strong></article><article class="fm-admin-metric"><small>Total Stok</small><strong data-stat="stock">—</strong></article></div><section class="fm-admin-chart"><h2>Penjualan 7 Hari Terakhir</h2><div class="fm-admin-bars"></div></section><div class="fm-admin-tables"><section class="fm-admin-table"><h2>Produk Terlaris</h2><table><thead><tr><th>Produk</th><th>Terjual</th><th>Nilai</th></tr></thead><tbody data-top-products><tr><td colspan="3">Memuat…</td></tr></tbody></table></section><section class="fm-admin-table"><h2>Pesanan Terbaru</h2><table><thead><tr><th>Tanggal</th><th>Status</th><th>Total</th></tr></thead><tbody data-recent-orders><tr><td colspan="3">Memuat…</td></tr></tbody></table></section></div><p class="fm-admin-error" role="status" hidden></p>';
        host.prepend(dashboard);
        dashboard.querySelector('.fm-admin-add')?.addEventListener('click', () => {
          host.querySelector('.address-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
      if (dashboard.dataset.loading === 'true' || dashboard.dataset.loaded === 'true') return;
      dashboard.dataset.loading = 'true';
      const [ordersResult, productsResult, itemsResult] = await Promise.all([
        supabase!.from('orders').select('id,total,status,created_at').order('created_at', { ascending: false }).limit(100),
        supabase!.from('products').select('id,name,stock,price,is_active'),
        supabase!.from('order_items').select('product_name,quantity,unit_price').limit(500),
      ]);
      if (!active || !dashboard?.isConnected) return;
      dashboard.dataset.loading = 'false';
      dashboard.dataset.loaded = 'true';
      const orders = (ordersResult.data || []) as DashboardOrder[];
      const products = (productsResult.data || []) as DashboardProduct[];
      const items = (itemsResult.data || []) as DashboardItem[];
      dashboard.querySelector<HTMLElement>('[data-stat="sales"]')!.textContent = rupiah(orders.reduce((sum, order) => sum + Number(order.total || 0), 0));
      dashboard.querySelector<HTMLElement>('[data-stat="orders"]')!.textContent = String(orders.length);
      dashboard.querySelector<HTMLElement>('[data-stat="products"]')!.textContent = String(products.filter((product) => product.is_active).length);
      dashboard.querySelector<HTMLElement>('[data-stat="stock"]')!.textContent = String(products.reduce((sum, product) => sum + Number(product.stock || 0), 0));

      const bars = dashboard.querySelector<HTMLElement>('.fm-admin-bars')!;
      bars.replaceChildren();
      const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); return date; });
      const values = days.map((date) => orders.filter((order) => new Date(order.created_at).toDateString() === date.toDateString()).reduce((sum, order) => sum + Number(order.total || 0), 0));
      const max = Math.max(...values, 1);
      days.forEach((date, index) => {
        const col = document.createElement('div'); col.className = 'fm-admin-bar-col';
        const bar = document.createElement('div'); bar.className = 'fm-admin-bar'; bar.style.height = `${Math.max(3, values[index] / max * 145)}px`; bar.title = rupiah(values[index]);
        const day = document.createElement('span'); day.textContent = date.toLocaleDateString('id-ID', { weekday: 'short' });
        col.append(bar, day); bars.append(col);
      });

      const top = new Map<string, { quantity: number; value: number }>();
      items.forEach((item) => { const current = top.get(item.product_name) || { quantity: 0, value: 0 }; current.quantity += Number(item.quantity || 0); current.value += Number(item.quantity || 0) * Number(item.unit_price || 0); top.set(item.product_name, current); });
      const topBody = dashboard.querySelector<HTMLElement>('[data-top-products]')!; topBody.replaceChildren();
      [...top.entries()].sort((a, b) => b[1].quantity - a[1].quantity).slice(0, 5).forEach(([name, value]) => { const row = topBody.insertRow(); row.insertCell().textContent = name; row.insertCell().textContent = String(value.quantity); row.insertCell().textContent = rupiah(value.value); });
      if (!topBody.children.length) topBody.innerHTML = '<tr><td colspan="3">Belum ada data penjualan</td></tr>';
      const recentBody = dashboard.querySelector<HTMLElement>('[data-recent-orders]')!; recentBody.replaceChildren();
      orders.slice(0, 5).forEach((order) => { const row = recentBody.insertRow(); row.insertCell().textContent = new Date(order.created_at).toLocaleDateString('id-ID'); row.insertCell().textContent = order.status; row.insertCell().textContent = rupiah(Number(order.total)); });
      if (!recentBody.children.length) recentBody.innerHTML = '<tr><td colspan="3">Belum ada pesanan</td></tr>';
      const errors = [ordersResult.error, productsResult.error, itemsResult.error].filter(Boolean);
      const errorNote = dashboard.querySelector<HTMLElement>('.fm-admin-error')!;
      if (errors.length) { errorNote.hidden = false; errorNote.textContent = 'Sebagian ringkasan tidak dapat dimuat. Periksa izin akses tabel admin di Supabase.'; }
    };

    const observer = new MutationObserver(() => { void render(); });
    observer.observe(document.body, { childList: true, subtree: true });
    void render();
    return () => { active = false; observer.disconnect(); style.remove(); document.querySelector('.fm-admin-dashboard')?.remove(); };
  }, []);
}
