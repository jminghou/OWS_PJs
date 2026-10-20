import { describe, expect, it } from 'vitest';
import { formatMoney } from './money';

// 與後端 tests/test_money.py 的 test_fmt_and_major 對照：兩邊格式要一致
describe('formatMoney', () => {
  it('formats minor units by currency', () => {
    expect(formatMoney(1980, 'TWD')).toBe('NT$1,980');
    expect(formatMoney(4999, 'USD')).toBe('US$49.99');
    expect(formatMoney(123450, 'EUR')).toBe('€1,234.50');
    expect(formatMoney(49900, 'NOK')).toBe('NOK 499.00');
    expect(formatMoney(5000, 'JPY')).toBe('¥5,000');
  });
  it('defaults to TWD and handles empty / unknown values', () => {
    expect(formatMoney(1980)).toBe('NT$1,980');
    expect(formatMoney(null, 'USD')).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
    expect(formatMoney(100, 'XYZ')).toBe('XYZ 100');
    expect(formatMoney(-500, 'TWD')).toBe('−NT$500');
  });
});
