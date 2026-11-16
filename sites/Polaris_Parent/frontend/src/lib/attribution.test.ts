import { describe, expect, it } from 'vitest';
import {
  ATTRIBUTION_KEY, readAttribution, recordVisit, touchFromVisit, type Visit,
} from './attribution';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
}

class BrokenStorage {
  getItem(): string | null { throw new Error('SecurityError'); }
  setItem(): void { throw new Error('QuotaExceededError'); }
}

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date('2026-11-16T00:00:00.000Z');
const at = (days: number) => new Date(T0.getTime() + days * DAY);

function visit(over: Partial<Visit> = {}): Visit {
  return { search: '', referrer: '', pathname: '/', hostname: 'localhost', ...over };
}

const IG = visit({ search: '?utm_source=ig&utm_medium=social&utm_campaign=20261116_test' });
const FB = visit({ search: '?utm_source=fb&utm_medium=paid', pathname: '/zh-TW/report' });

describe('touchFromVisit', () => {
  it('UTM 優先，landing_path 只存 pathname 不存 query', () => {
    const t = touchFromVisit(visit({ search: '?utm_source=ig&email=a@b.c&token=x', pathname: '/report',
      referrer: 'https://www.google.com/search?q=secret' }), T0)!;
    expect(t).toEqual({ source: 'ig', medium: null, campaign: null, content: null, term: null,
      referrer_host: 'www.google.com', landing_path: '/report', at: T0.toISOString() });
    expect(JSON.stringify(t)).not.toContain('a@b.c');
    expect(JSON.stringify(t)).not.toContain('secret');
  });

  it('沒有 UTM 時看站外 referrer 的 host', () => {
    const t = touchFromVisit(visit({ referrer: 'https://l.instagram.com/?u=https%3A%2F%2Fx' }), T0)!;
    expect(t.source).toBeNull();
    expect(t.referrer_host).toBe('l.instagram.com');
  });

  it('直接進站、站內跳轉不算新來源', () => {
    expect(touchFromVisit(visit(), T0)).toBeNull();
    expect(touchFromVisit(visit({ referrer: 'http://localhost:3000/about' }), T0)).toBeNull();
  });

  it('UTM 截到 100 字、空白值當沒有', () => {
    const t = touchFromVisit(visit({ search: `?utm_source=${'x'.repeat(300)}&utm_medium=%20` }), T0)!;
    expect(t.source).toHaveLength(100);
    expect(t.medium).toBeNull();
  });
});

describe('recordVisit', () => {
  it('first 不被覆寫，last 每次新來源覆寫，30 天到期', () => {
    const s = new MemoryStorage();
    recordVisit(s, IG, T0);
    const after = recordVisit(s, FB, at(2));
    expect(after.first?.source).toBe('ig');
    expect(after.first_expires_at).toBe(at(30).toISOString());
    expect(after.last?.source).toBe('fb');
    expect(after.last?.landing_path).toBe('/zh-TW/report');
    expect(after.last_expires_at).toBe(at(32).toISOString());
  });

  it('直接進站不動既有紀錄', () => {
    const s = new MemoryStorage();
    recordVisit(s, IG, T0);
    const before = s.getItem(ATTRIBUTION_KEY);
    recordVisit(s, visit({ pathname: '/about' }), at(1));
    expect(s.getItem(ATTRIBUTION_KEY)).toBe(before);
  });

  it('first 過期後由下一個來源重寫；讀取時過期的一側是 null', () => {
    const s = new MemoryStorage();
    recordVisit(s, IG, T0);
    recordVisit(s, FB, at(20));
    const mid = readAttribution(s, at(31));
    expect(mid.first).toBeNull();
    expect(mid.last?.source).toBe('fb');
    const again = recordVisit(s, visit({ search: '?utm_source=yt' }), at(31));
    expect(again.first?.source).toBe('yt');
    expect(readAttribution(s, at(80))).toEqual({ first: null, first_expires_at: null, last: null, last_expires_at: null });
  });

  it('storage 壞掉或內容損毀時靜默', () => {
    expect(() => recordVisit(new BrokenStorage(), IG, T0)).not.toThrow();
    expect(readAttribution(new BrokenStorage(), T0).first).toBeNull();
    const s = new MemoryStorage();
    s.setItem(ATTRIBUTION_KEY, '{not json');
    expect(readAttribution(s, T0).first).toBeNull();
    expect(recordVisit(s, IG, T0).first?.source).toBe('ig');
  });
});
