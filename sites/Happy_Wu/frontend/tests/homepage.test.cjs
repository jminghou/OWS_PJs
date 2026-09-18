const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '../src');
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => id in mocks ? mocks[id] : require(id), module, module.exports);
  return module.exports;
}
const link = ({ children, ...props }) => React.createElement('a', props, children);
const utils = { getImageUrl: x => x, getGcsImageUrl: x => x };
const Tile = load('components/platform/public/HomepageArticleTile.tsx', { 'next/link': link, '@/lib/utils': utils }).default;
const Hero = load('components/platform/public/HeroSection.tsx', { '@ows/site-kit': { HeroCarousel: () => null } }).default;
const about = load('i18n/aboutDefaults.ts', { '@/i18n/homePageData': load('i18n/homePageData.ts') });
const Home = load('components/platform/public/HomePageContent.tsx', {
  '@/i18n/aboutDefaults': about, 'next/link': link, '@/lib/utils': utils, './HeroSection': Hero, './HomepageArticleTile': Tile,
  '@ows/site-kit': { JsonLd: () => null, buildItemListJsonLd: () => null },
}).default;
const content = load('i18n/homePageData.ts').localeContent['zh-TW'];

test('saved slide text, CTA and About fields render in the new template', () => {
  const html = renderToStaticMarkup(React.createElement(Home, { locale: 'zh-TW', content, latestPosts: [], homepageSettings: {
    slides: [{ id: 'a', sort_order: 0, image_url: '/slide.jpg', titles: { 'zh-TW': 'Saved hero' }, subtitles: { 'zh-TW': 'Saved subtitle' }, cta_text: { 'zh-TW': 'Slide CTA' }, cta_url: '/contact', cta_new_tab: true }],
    button_text: { 'zh-TW': 'Global CTA' }, about_section: { 'zh-TW': { title: 'Saved about', philosophy: 'Saved story', quote: 'Saved quote', mission_points: ['Saved mission'], image_url: '/about.jpg' } },
  } }));
  for (const text of ['Saved hero', 'Saved subtitle', 'Slide CTA', 'Saved about', 'Saved story', 'Saved quote', 'Saved mission', '/about.jpg', 'href="/contact"', 'target="_blank"']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('Global CTA'));
});
test('global button is used when a slide has no override', () => {
  const html = renderToStaticMarkup(React.createElement(Hero, { title: 'Hero', subtitle: 'Subtitle', buttonText: 'Global CTA', buttonLink: '/articles', backgroundSlides: [], locale: 'zh-TW' }));
  assert.ok(html.includes('Global CTA'));
});
test('article wall keeps more than six selected posts and their order', () => {
  const posts = Array.from({ length: 8 }, (_, i) => ({ id: i, title: `Title ${i}`, slug: `post-${i}`, cover_image: `/cover-${i}.jpg` }));
  const html = renderToStaticMarkup(React.createElement(Home, { locale: 'en', content, latestPosts: posts, homepageSettings: { slides: [], button_text: {} } }));
  assert.equal((html.match(/class="hw-wall-tile"/g) || []).length, 8);
  assert.ok(html.indexOf('/en/posts/post-0') < html.indexOf('/en/posts/post-7'));
  assert.ok(html.includes('/cover-0.jpg'));
});
test('manual wall keeps explicit order and excludes drafts, future posts and missing IDs', async () => {
  const article = id => ({ id, status: 'published', language: 'zh-TW', content_type: 'article' });
  const posts = { 9: article(9), 2: article(2), 3: { ...article(3), status: 'draft' }, 4: { ...article(4), published_at: '2999-01-01T00:00:00Z' }, 5: { ...article(5), language: 'en' } };
  const api = { homepageApi: { getSettings: async () => ({ article_wall: { mode: 'manual', article_ids: [9, 2, 3, 4, 5, 99] } }) }, contentApi: { getList: async params => { assert.equal(params.ids, '9,2,3,4,5,99'); return { contents: Object.values(posts).reverse() }; } } };
  const { getHomePageData } = load('lib/homepage.ts', { '@/lib/api': api });
  assert.deepEqual((await getHomePageData('zh-TW')).latestPosts.map(p => p.id), [9, 2]);
  api.homepageApi.getSettings = async () => ({ article_wall: { mode: 'manual', article_ids: [] } });
  assert.deepEqual((await getHomePageData('zh-TW')).latestPosts, []);
});

test('About editor defaults and public defaults agree; intentional empty fields stay empty', () => {
  assert.deepEqual(about.resolveAbout({}, 'zh-TW'), about.aboutDefaults['zh-TW']);
  const settings = { about_section: { 'zh-TW': { title: '', philosophy: '', quote: '', description: '', eyebrow: '', button_text: '', image_caption: '', mission_points: [] } } };
  const resolved = about.resolveAbout(settings, 'zh-TW');
  for (const key of ['title', 'philosophy', 'quote', 'description', 'eyebrow', 'button_text', 'image_caption']) assert.equal(resolved[key], '');
  const html = renderToStaticMarkup(React.createElement(Home, { locale: 'zh-TW', content, latestPosts: [], homepageSettings: { slides: [], button_text: {}, ...settings } }));
  assert.ok(!html.includes('嗨，我是 Happy Wu。'));
  assert.ok(!html.includes('THE PERSON BEHIND THE WORDS'));
  assert.ok(!html.includes('多認識我一點'));
});
test('About custom CTA, subtitle and second paragraph use saved values', () => {
  const html = renderToStaticMarkup(React.createElement(Home, { locale: 'zh-TW', content, latestPosts: [], homepageSettings: { slides: [], button_text: {}, about_section: { 'zh-TW': { eyebrow: 'My eyebrow', description: 'My second paragraph', image_caption: 'My image caption', button_text: 'Meet me', button_url: '/contact' } } } }));
  for (const value of ['My eyebrow', 'My second paragraph', 'My image caption', 'Meet me', 'href="/contact"']) assert.ok(html.includes(value));
  assert.equal(about.safeAboutLink('javascript:alert(1)'), '');
  assert.equal(about.safeAboutLink('//external.example'), '');
});
