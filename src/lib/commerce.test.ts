import { describe, expect, it } from 'vitest';
import { discountAmount, formatRupiah, lineSubtotal } from './commerce';

describe('perhitungan harga', () => {
  it('menghitung subtotal rupiah dengan bilangan bulat', () => {
    expect(lineSubtotal(1399000, 2)).toBe(2798000);
  });
  it('menolak jumlah negatif', () => {
    expect(() => lineSubtotal(12000, -1)).toThrow(RangeError);
  });
  it('membatasi voucher nominal pada subtotal', () => {
    expect(discountAmount(15000, 'fixed', 20000)).toBe(15000);
  });
  it('menerapkan batas potongan persentase', () => {
    expect(discountAmount(200000, 'percent', 20, 25000)).toBe(25000);
  });
  it('memformat rupiah tanpa desimal', () => {
    expect(formatRupiah(100000)).toContain('100.000');
  });
});
