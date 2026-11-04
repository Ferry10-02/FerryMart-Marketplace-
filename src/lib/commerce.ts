export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}

export function lineSubtotal(unitPrice: number, quantity: number): number {
  if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) throw new RangeError('Harga harus berupa bilangan rupiah nonnegatif.');
  if (!Number.isSafeInteger(quantity) || quantity < 0) throw new RangeError('Jumlah harus berupa bilangan bulat nonnegatif.');
  const result = unitPrice * quantity;
  if (!Number.isSafeInteger(result)) throw new RangeError('Subtotal melebihi batas aman.');
  return result;
}

export function discountAmount(subtotal: number, kind: 'fixed' | 'percent', value: number, cap?: number): number {
  if (!Number.isSafeInteger(subtotal) || subtotal < 0 || !Number.isSafeInteger(value) || value < 0) throw new RangeError('Nilai voucher tidak valid.');
  const raw = kind === 'fixed' ? value : Math.floor(subtotal * value / 100);
  return Math.min(subtotal, cap === undefined ? raw : Math.max(0, cap), raw);
}
