import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({ productApi: { getById: vi.fn() } }));

import { REPORT_PRODUCT } from './catalog';
import { applyReportDisplay, REPORT_DISPLAY_KEY } from './display';

const base = REPORT_PRODUCT;

describe('applyReportDisplay', () => {
  it('後台沒有商品時整份用預設值', () => {
    expect(applyReportDisplay(base, null)).toBe(base);
  });

  it('名稱、簡短描述與 report_display 蓋過預設值', () => {
    const p = applyReportDisplay(base, {
      name: '後台名稱',
      short_description: '後台描述',
      attributes: {
        [REPORT_DISPLAY_KEY]: { tagline: '標語', badge: '限時', audience_label: '適合親子', cover_title: '封面', cover_palette: 'rose' },
      },
    });
    expect(p).toMatchObject({
      name: '後台名稱',
      cardDescription: '後台描述',
      tagline: '標語',
      badge: '限時',
      audienceLabel: '適合親子',
      cover: { eyebrow: base.cover.eyebrow, title: '封面', subtitle: base.cover.subtitle, palette: 'rose' },
    });
  });

  it('留空或只有空白的欄位沿用預設值', () => {
    const p = applyReportDisplay(base, { name: '  ', short_description: '', attributes: { [REPORT_DISPLAY_KEY]: { tagline: ' ' } } });
    expect(p.name).toBe(base.name);
    expect(p.cardDescription).toBe(base.cardDescription);
    expect(p.tagline).toBe(base.tagline);
    expect(p.badge).toBe(base.badge);
  });

  it('badge_hidden 隱藏角標', () => {
    const p = applyReportDisplay(base, { attributes: { [REPORT_DISPLAY_KEY]: { badge: '限時', badge_hidden: true } } });
    expect(p.badge).toBeUndefined();
  });

  it('不認得的配色回到預設', () => {
    const p = applyReportDisplay(base, { attributes: { [REPORT_DISPLAY_KEY]: { cover_palette: 'neon' } } });
    expect(p.cover.palette).toBe(base.cover.palette);
  });
});
