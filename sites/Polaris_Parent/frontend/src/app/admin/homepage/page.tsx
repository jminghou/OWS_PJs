'use client';

/**
 * Polaris 獨立的首頁設定。
 *
 * 本站首頁是文字型 landing（首屏介紹 → 線上排盤 → 使用者回饋 → 電子報），沒有幻燈片、輪播、按鈕文字、
 * 關於我們區塊，所以不用共用的 HomepageSettingsPage，改成只列本站首頁真的有的四個區塊。
 * 資料仍存在後端的 hero_intro（PUT 只送 hero_intro，其他站台的首頁設定不受影響）。
 * 欄位留空時前台退回 src/i18n/homeLandingContent.ts 的預設（這裡顯示成灰色提示字）。
 */
import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Save } from 'lucide-react';
import { AdminLayout } from '@ows/admin-app';
import MediaBrowser from '@ows/admin-app/components/MediaBrowser';
import { homepageApi, i18nApi } from '@ows/platform-api';
import type { HeroIntro, HeroIntroFields } from '@ows/platform-api/types';
import { AdminImagePicker, AdminListLayout } from '@ows/ui/admin';
import { homepageDefaults } from '@/i18n/homeLandingContent';
import { getImageUrl } from '@/lib/utils';

type SectionKey = 'hero' | 'ziwei' | 'testimonials' | 'subscribe';

interface FieldDef {
  key: keyof HeroIntroFields;
  label: string;
  hint: string;
  max: number;
  rows?: number;
}

const SECTIONS: { key: SectionKey; label: string; description: string; fields: FieldDef[] }[] = [
  {
    key: 'hero',
    label: '首屏介紹',
    description: '首頁第一屏：左邊是小標、大標與內文，右邊是圖片（沒放圖時顯示佔位面板）。',
    fields: [
      { key: 'eyebrow', label: '小標（選填）', hint: '大標上方的粉色小標籤，例如品牌名或定位', max: 200 },
      { key: 'headline', label: '大標', hint: '一句話說清楚：你們是誰、幫誰、解決什麼', max: 200 },
      { key: 'body', label: '內文', hint: '兩三句即可。空一行會分段', max: 2000, rows: 6 },
      { key: 'proof_line', label: '信任佐證（選填）', hint: '一行真實數字或事實；留空就不顯示', max: 300 },
    ],
  },
  {
    key: 'ziwei',
    label: '線上排盤區',
    description: '首屏下方的滾輪排盤。排盤元件本身不在這裡設定。',
    fields: [
      { key: 'ziwei_heading', label: '區塊標題', hint: '排盤區的大標', max: 100 },
      { key: 'ziwei_body', label: '區塊說明', hint: '告訴訪客怎麼操作', max: 500, rows: 3 },
    ],
  },
  {
    key: 'testimonials',
    label: '使用者回饋區',
    description: '回饋牆的內容來自 Senja；正式站要設定 NEXT_PUBLIC_SENJA_WIDGET_ID 才會顯示這個區塊。',
    fields: [{ key: 'testimonials_heading', label: '區塊標題', hint: '回饋牆上方的標題', max: 100 }],
  },
  {
    key: 'subscribe',
    label: '電子報區',
    description: '頁面最下方的粉色電子報卡。',
    fields: [
      { key: 'subscribe_heading', label: '卡片標題', hint: '電子報卡的標題', max: 100 },
      { key: 'newsletter_note', label: '訂閱表單上方說明（選填）', hint: '訂閱後會收到什麼、多久一封', max: 300, rows: 2 },
    ],
  },
];

const inputCls =
  'w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 ' +
  'focus:outline-none focus:ring-1 focus:ring-admin-accent-500';

export default function PolarisHomepageSettingsPage() {
  const [heroIntro, setHeroIntro] = useState<HeroIntro>({ image_url: '', locales: {} });
  const [languages, setLanguages] = useState<string[]>([]);
  const [languageNames, setLanguageNames] = useState<Record<string, string>>({});
  const [activeLang, setActiveLang] = useState('zh-TW');
  const [activeSection, setActiveSection] = useState<SectionKey>('hero');
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [homepage, i18n] = await Promise.all([homepageApi.getAdminSettings(), i18nApi.getSettings()]);
        setHeroIntro({ image_url: '', locales: {}, ...homepage.hero_intro });
        const langs = i18n?.languages?.length ? i18n.languages : ['zh-TW'];
        setLanguages(langs);
        setLanguageNames(i18n?.language_names || {});
        setActiveLang(langs[0]);
        setLoaded(true);
      } catch (error: any) {
        setMessage({ type: 'error', text: error.message || '載入設定失敗' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const section = SECTIONS.find((s) => s.key === activeSection)!;
  const tabs = languages.length > 0 ? languages : ['zh-TW'];

  const setField = (key: keyof HeroIntroFields, text: string) =>
    setHeroIntro((prev) => ({
      ...prev,
      locales: { ...prev.locales, [activeLang]: { ...prev.locales[activeLang], [key]: text } },
    }));

  const handleSave = async () => {
    if (!loaded) return;
    setSaving(true);
    setMessage(null);
    try {
      // 只送 hero_intro：後端逐 key 更新，幻燈片等其他設定原封不動
      await homepageApi.updateSettings({ hero_intro: heroIntro });
      setMessage({ type: 'success', text: '設定儲存成功，前台約一分鐘內更新' });
    } catch (error: any) {
      if (error.status === 401) {
        setMessage({ type: 'error', text: '您的登入已過期，請重新登入後再試' });
      } else if (error.status === 403) {
        setMessage({ type: 'error', text: '您沒有權限執行此操作，需要編輯或管理員權限' });
      } else {
        setMessage({ type: 'error', text: error.message || '儲存設定失敗，請稍後再試' });
      }
    } finally {
      setSaving(false);
    }
  };

  const sidebar = (
    <div className="flex h-full w-full flex-col border-r border-border bg-card">
      <h1 className="px-6 pb-4 pt-6 text-xl font-bold text-foreground">首頁設定</h1>
      <nav className="flex-1 overflow-y-auto">
        {SECTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActiveSection(item.key)}
            className={`w-full border-l-2 px-6 py-2.5 text-left text-sm transition-colors ${
              activeSection === item.key
                ? 'border-admin-accent-500 bg-admin-accent-50 text-admin-accent-700 dark:bg-admin-accent-500/15 dark:text-admin-accent-200'
                : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );

  return (
    <AdminLayout>
      <AdminListLayout
        sidebar={sidebar}
        sidebarWidth={224}
        mobileListLabel="首頁區塊"
        mobileTitle={section.label}
        closeDrawerOn={activeSection}
      >
        <div className="max-w-3xl space-y-6 p-4 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">{section.label}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{section.description}</p>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading || !loaded}
              className="inline-flex shrink-0 items-center gap-2 rounded-md bg-admin-accent-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-admin-accent-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? '儲存中…' : '儲存設定'}
            </button>
          </div>

          {message && (
            <div
              role={message.type === 'error' ? 'alert' : 'status'}
              className={`flex items-center gap-2 rounded-lg p-4 text-sm ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                  : 'bg-red-50 text-red-800 dark:bg-red-900/40 dark:text-red-200'
              }`}
            >
              {message.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              <span>{message.text}</span>
            </div>
          )}

          {!loading && (
            <>
              <p className="text-sm text-muted-foreground">
                欄位留空時，前台會顯示站台內建的預設文案（灰色提示字）。
              </p>

              {tabs.length > 1 && (
                <div className="flex gap-2 border-b border-border">
                  {tabs.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setActiveLang(lang)}
                      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                        activeLang === lang
                          ? 'border-admin-accent-600 text-admin-accent-600'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {languageNames[lang] || lang}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-4">
                {section.fields.map(({ key, label, hint, max, rows }) => {
                  const text = heroIntro.locales[activeLang]?.[key] || '';
                  const id = `homepage-${activeLang}-${key}`;
                  const shared = {
                    id,
                    value: text,
                    maxLength: max,
                    placeholder: homepageDefaults[activeLang]?.[key] || '',
                    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setField(key, e.target.value),
                    className: inputCls,
                  };
                  return (
                    <div key={key}>
                      <label htmlFor={id} className="mb-1 block text-sm font-medium text-foreground">{label}</label>
                      {rows ? <textarea {...shared} rows={rows} /> : <input type="text" {...shared} />}
                      <p className="mt-1 text-xs text-muted-foreground">{hint}（{text.length}/{max}）</p>
                    </div>
                  );
                })}
              </div>

              {activeSection === 'hero' && (
                <>
                  <AdminImagePicker
                    label="首屏右側圖片（選填，各語系共用；建議 960×800 以上，前台會裁成圓角橫幅）"
                    value={heroIntro.image_url}
                    onRemove={() => setHeroIntro((prev) => ({ ...prev, image_url: '' }))}
                    onBrowse={() => setBrowsing(true)}
                    getImageUrl={getImageUrl}
                    aspectRatio="4/3"
                  />
                  <MediaBrowser
                    isOpen={browsing}
                    onClose={() => setBrowsing(false)}
                    onSelect={(media) => {
                      setHeroIntro((prev) => ({ ...prev, image_url: media.file_path }));
                      setBrowsing(false);
                    }}
                  />
                </>
              )}
            </>
          )}
        </div>
      </AdminListLayout>
    </AdminLayout>
  );
}
