import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({ productApi: { getById: vi.fn() } }));
vi.mock('@ows/platform-api/client', () => ({ request: vi.fn() }));

import { REPORT_PRODUCT } from './catalog';
import { applyCatalogModules, applyReportDisplay, REPORT_DISPLAY_KEY } from './display';
import { PRODUCT_MODULES_KEY } from './modules';

const base = REPORT_PRODUCT;

describe('改用模組的商品頁', () => {
  const remote = {
    name: '本命報告',
    attributes: {
      [REPORT_DISPLAY_KEY]: { tagline: '標語', intro: ['舊的介紹'], feature_images: ['old.jpg'] },
      [PRODUCT_MODULES_KEY]: { intro: 'intro-a', faq: 'faq-a', features: 'feat-a', reviews: 'rev-wrong-type', process: '' },
    },
  };
  const mods = {
    'intro-a': { type: 'intro' as const, data: { paragraphs: ['模組介紹', ' '] } },
    'faq-a': { type: 'faq' as const, data: { title: '常見問題', items: [{ q: '問', a: '答' }, { q: '沒回答', a: '' }] } },
    'feat-a': { type: 'features' as const, data: { items: [{ title: '精裝', body: '說明', image_url: 'new.jpg' }] } },
    'rev-wrong-type': { type: 'faq' as const, data: { items: [{ q: 'x', a: 'y' }] } },
  };

  it('只顯示選用的模組；沒選、類型不符或沒有該語言版本的位置是空的', () => {
    const p = applyReportDisplay(base, remote, mods);
    expect(p.tagline).toBe('標語');
    expect(p.intro).toEqual(['模組介紹']);
    expect(p.faq).toEqual([{ q: '問', a: '答' }]);
    expect(p.titles?.faq).toBe('常見問題');
    expect(p.reviews).toEqual([]);
    expect(p.process).toEqual([]);
    expect(p.highlights).toEqual([]);
    expect(p.testimonial).toBeUndefined();
    expect(p.audiences).toEqual([]);
  });

  it('特色圖片取模組裡的，不再用 feature_images', () => {
    const p = applyReportDisplay(base, remote, mods);
    expect(p.features).toEqual([{ title: '精裝', body: '說明', image: '［佔位］圖片', imageUrl: 'new.jpg' }]);
  });

  it('還沒改用模組的商品照舊讀 report_display', () => {
    const { [PRODUCT_MODULES_KEY]: _, ...attrs } = remote.attributes;
    const p = applyReportDisplay(base, { ...remote, attributes: attrs }, mods);
    expect(p.intro).toEqual(['舊的介紹']);
    expect(p.faq).toEqual(base.faq);
    expect(p.features[0].imageUrl).toBe('old.jpg');
  });
});

describe('目錄頁模組', () => {
  it('文字取目錄頁設定，送禮對象與常見問題取選用的模組', () => {
    const c = applyCatalogModules(
      { title: 'All reports', promo: '', audiences: 'aud', faq: 'missing' },
      { aud: { type: 'audiences', data: { title: 'Who is it for?', note: 'Ask first.', items: [{ label: 'For you', note: '' }] } } },
    );
    expect(c.title).toBe('All reports');
    expect(c.promo).toBe('');
    expect(c.audienceTitle).toBe('Who is it for?');
    expect(c.audienceConsent).toBe('Ask first.');
    expect(c.audiences).toEqual([{ label: 'For you', note: '' }]);
    expect(c.faq).toEqual([]);
  });
});
