import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  });
  if (request.method !== 'POST') return respond({ error: 'Method tidak didukung.' }, 405);

  const authorization = request.headers.get('Authorization');
  const apiKey = Deno.env.get('RAJAONGKIR_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!authorization || !supabaseUrl || !anonKey) return respond({ error: 'Login diperlukan.' }, 401);
  if (!apiKey) return respond({ error: 'Secret RAJAONGKIR_API_KEY belum dikonfigurasi di Supabase.' }, 503);

  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return respond({ error: 'Sesi login tidak valid.' }, 401);

  let input: { origin?: number; destination?: number; weight_grams?: number; couriers?: string[] };
  try { input = await request.json(); } catch { return respond({ error: 'Body JSON tidak valid.' }, 400); }
  const { origin, destination, weight_grams } = input;
  if (!Number.isInteger(origin) || !Number.isInteger(destination) || !Number.isInteger(weight_grams)
    || Number(weight_grams) < 1 || Number(weight_grams) > 300_000) {
    return respond({ error: 'Asal, tujuan, dan berat (gram) wajib diisi dengan nilai valid.' }, 400);
  }
  const allowedCouriers = new Set(['jne', 'sicepat', 'ide', 'sap', 'jnt', 'ninja', 'tiki', 'lion', 'anteraja', 'pos', 'ncs', 'rex', 'rpx', 'sentral', 'star', 'wahana', 'dse']);
  const couriers = Array.isArray(input.couriers) ? input.couriers.filter(code => allowedCouriers.has(code)) : ['jne', 'jnt', 'sicepat'];
  if (!couriers.length) return respond({ error: 'Pilih minimal satu kurir yang didukung.' }, 400);

  const body = new URLSearchParams({
    origin: String(origin), destination: String(destination), weight: String(weight_grams),
    courier: [...new Set(couriers)].join(':'), price: 'lowest',
  });
  try {
    const upstream = await fetch('https://rajaongkir.komerce.id/api/v1/calculate/district/domestic-cost', {
      method: 'POST', headers: { key: apiKey, 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    });
    const result = await upstream.json();
    if (!upstream.ok) return respond({ error: result?.meta?.message || 'Layanan cek ongkir gagal.', details: result }, upstream.status);
    return respond(result);
  } catch {
    return respond({ error: 'Tidak dapat menghubungi layanan cek ongkir. Coba lagi.' }, 502);
  }
});
