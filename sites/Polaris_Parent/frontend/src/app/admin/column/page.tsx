'use client';

/**
 * 親紫專欄頁（/articles）的 IG 式頁頭設定。
 *
 * 三個區塊：關於我（頭像＋各語系名稱／副標／簡介）、連結與按鈕、精選主題（標籤圓圈）。
 * 分頁列直接用文章「分類」，不在這裡設定；圓圈指向既有「標籤」，可各配一張圖。
 * 資料存在後端 Setting 表的 column_profile（/settings/column-profile），欄位留空時前台用內建預設。
 */
import { useEffect, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle2, Plus, Save, Trash2 } from 'lucide-react';
import { AdminLayout } from '@ows/admin-app';
import MediaBrowser from '@ows/admin-app/components/MediaBrowser';
import { columnProfileApi, i18nApi, tagApi, type ColumnProfile, type ColumnProfileFields, type ColumnProfileLink } from '@/lib/api';
import type { Tag } from '@/types';
import { AdminImagePicker, AdminListLayout } from '@ows/ui/admin';
import { EMPTY_COLUMN_PROFILE } from '@/lib/columnProfile';
import { getColumnCopy } from '@/app/(public)/articles/column/columnCopy';
import { getImageUrl } from '@/lib/utils';

type SectionKey = 'about' | 'links' | 'highlights';

const SECTIONS: { key: SectionKey; label: string; description: string }[] = [
  { key: 'about', label: '關於我', description: '專欄頁最上方的頭像、名稱、副標與簡介（IG 個人檔案的位置）。' },
  { key: 'links', label: '連結與按鈕', description: '簡介下方的外部連結（最多 3 個），以及名稱旁的行動按鈕（最多 2 個，第一個是深色主按鈕）。' },
  { key: 'highlights', label: '精選主題', description: '頁頭下方那排圓圈。每個圓圈對應一個文章標籤，訪客點了就只看該標籤的文章。可用箭頭調整順序、各配一張圖。' },
];

const TEXT_FIELDS: { key: keyof ColumnProfileFields; label: string; hint: string; max: number; rows?: number }[] = [
  { key: 'name', label: '名稱', hint: '頭像旁的大字', max: 60 },
  { key: 'subtitle', label: '副標', hint: '名稱下方的灰色小字，例如定位或身分', max: 120 },
  { key: 'bio', label: '簡介', hint: '兩三行即可；換行會保留', max: 600, rows: 5 },
];

const inputCls =
  'w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 ' +
  'focus:outline-none focus:ring-1 focus:ring-admin-accent-500';
const iconBtn =
  'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent';

type BrowseTarget = { kind: 'avatar' } | { kind: 'highlight'; index: number } | null;

function LinkListEditor({
  items,
  max,
  onChange,
  labelPlaceholder,
  urlPlaceholder,
}: {
  items: ColumnProfileLink[];
  max: number;
  onChange: (items: ColumnProfileLink[]) => void;
  labelPlaceholder: string;
  urlPlaceholder: string;
}) {
  const update = (i: number, patch: Partial<ColumnProfileLink>) =>
    onChange(items.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            className={`${inputCls} w-40 shrink-0`}
            value={item.label}
            maxLength={40}
            placeholder={labelPlaceholder}
            aria-label="顯示文字"
            onChange={(e) => update(i, { label: e.target.value })}
          />
          <input
            className={inputCls}
            value={item.url}
            maxLength={500}
            placeholder={urlPlaceholder}
            aria-label="網址"
            onChange={(e) => update(i, { url: e.target.value })}
          />
          <button type="button" className={iconBtn} aria-label="移除" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      {items.length < max && (
        <button
          type="button"
          onClick={() => onChange([...items, { label: '', url: '' }])}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-admin-accent-500 hover:text-foreground"
        >
          <Plus className="h-4 w-4" /> 新增
        </button>
      )}
    </div>
  );
}

export default function ColumnProfileSettingsPage() {
  const [profile, setProfile] = useState<ColumnProfile>(EMPTY_COLUMN_PROFILE);
  const [tags, setTags] = useState<Tag[]>([]);
  const [languages, setLanguages] = useState<string[]>(['zh-TW']);
  const [languageNames, setLanguageNames] = useState<Record<string, string>>({});
  const [activeLang, setActiveLang] = useState('zh-TW');
  const [activeSection, setActiveSection] = useState<SectionKey>('about');
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [browse, setBrowse] = useState<BrowseTarget>(null);
  const [pendingTag, setPendingTag] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [stored, tagList, i18n] = await Promise.all([
          columnProfileApi.getAdminProfile(),
          tagApi.getList('zh-TW'),
          i18nApi.getSettings().catch(() => null),
        ]);
        setProfile({ ...EMPTY_COLUMN_PROFILE, ...stored });
        setTags(tagList);
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
  const defaults = getColumnCopy(activeLang).defaults;
  const tagName = (id: number) => {
    const tag = tags.find((t) => t.id === id);
    return tag ? tag.name || tag.slugs?.['zh-TW'] || tag.code : `（已刪除的標籤 #${id}）`;
  };
  const availableTags = tags.filter((t) => !profile.highlights.some((h) => h.tag_id === t.id));

  const setText = (key: keyof ColumnProfileFields, text: string) =>
    setProfile((prev) => ({
      ...prev,
      locales: { ...prev.locales, [activeLang]: { ...prev.locales[activeLang], [key]: text } },
    }));

  const moveHighlight = (i: number, delta: number) =>
    setProfile((prev) => {
      const next = [...prev.highlights];
      const [item] = next.splice(i, 1);
      next.splice(i + delta, 0, item);
      return { ...prev, highlights: next };
    });

  const handleSave = async () => {
    if (!loaded) return;
    setSaving(true);
    setMessage(null);
    try {
      // 只送後端認得的欄位（公開端補上的 code/name 不回存）
      const payload: ColumnProfile = {
        ...profile,
        highlights: profile.highlights.map(({ tag_id, image_url }) => ({ tag_id, image_url })),
      };
      const res = await columnProfileApi.updateProfile(payload);
      setProfile({ ...EMPTY_COLUMN_PROFILE, ...res.column_profile });
      setMessage({ type: 'success', text: '設定儲存成功，前台約一分鐘內更新（空白的連結會自動略過）' });
    } catch (error: any) {
      if (error.status === 401) setMessage({ type: 'error', text: '您的登入已過期，請重新登入後再試' });
      else if (error.status === 403) setMessage({ type: 'error', text: '您沒有權限執行此操作，需要編輯或管理員權限' });
      else setMessage({ type: 'error', text: error.message || '儲存設定失敗，請稍後再試' });
    } finally {
      setSaving(false);
    }
  };

  const sidebar = (
    <div className="flex h-full w-full flex-col border-r border-border bg-card">
      <h1 className="px-6 pb-4 pt-6 text-xl font-bold text-foreground">專欄頁設定</h1>
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
      <a
        href="/articles"
        target="_blank"
        rel="noopener noreferrer"
        className="border-t border-border px-6 py-3 text-sm text-admin-accent-600 hover:underline"
      >
        在新分頁預覽專欄頁 ↗
      </a>
    </div>
  );

  return (
    <AdminLayout>
      <AdminListLayout sidebar={sidebar} sidebarWidth={224}>
        <div className="max-w-3xl space-y-6 p-6">
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

          {!loading && activeSection === 'about' && (
            <>
              <AdminImagePicker
                label="頭像（選填，各語系共用；建議 400×400 以上的正方形，前台會裁成圓形）。沒放時顯示品牌 Logo。"
                value={profile.avatar_url}
                onRemove={() => setProfile((prev) => ({ ...prev, avatar_url: '' }))}
                onBrowse={() => setBrowse({ kind: 'avatar' })}
                getImageUrl={getImageUrl}
                aspectRatio="1/1"
              />

              {languages.length > 1 && (
                <div className="flex gap-2 border-b border-border">
                  {languages.map((lang) => (
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

              <p className="text-sm text-muted-foreground">欄位留空時，前台會顯示灰色提示字的預設文案。</p>
              <div className="space-y-4">
                {TEXT_FIELDS.map(({ key, label, hint, max, rows }) => {
                  const text = profile.locales[activeLang]?.[key] || '';
                  const id = `column-${activeLang}-${key}`;
                  const shared = {
                    id,
                    value: text,
                    maxLength: max,
                    placeholder: defaults[key],
                    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setText(key, e.target.value),
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
            </>
          )}

          {!loading && activeSection === 'links' && (
            <>
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground">外部連結（最多 3 個）</h3>
                <p className="text-xs text-muted-foreground">例如 Instagram、Threads、Podcast。網址要以 https:// 或 / 開頭。</p>
                <LinkListEditor
                  items={profile.links}
                  max={3}
                  onChange={(links) => setProfile((prev) => ({ ...prev, links }))}
                  labelPlaceholder="Instagram"
                  urlPlaceholder="https://www.instagram.com/…"
                />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground">行動按鈕（最多 2 個）</h3>
                <p className="text-xs text-muted-foreground">
                  留空時前台顯示預設的「購買報告」「訂閱電子報」。站內頁面用 / 開頭，例如 /report。
                </p>
                <LinkListEditor
                  items={profile.actions}
                  max={2}
                  onChange={(actions) => setProfile((prev) => ({ ...prev, actions }))}
                  labelPlaceholder="購買報告"
                  urlPlaceholder="/report"
                />
              </div>
            </>
          )}

          {!loading && activeSection === 'highlights' && (
            <>
              {profile.highlights.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  還沒有精選主題。從下方選一個標籤加入；沒有設定時前台不顯示這排圓圈。
                </p>
              )}
              <ul className="space-y-3">
                {profile.highlights.map((h, i) => (
                  <li key={h.tag_id} className="flex items-center gap-4 rounded-lg border border-border bg-card p-3">
                    <button
                      type="button"
                      onClick={() => setBrowse({ kind: 'highlight', index: i })}
                      className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-muted text-xs text-muted-foreground hover:border-admin-accent-500"
                      title="選擇圓圈圖片"
                    >
                      {h.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={getImageUrl(h.image_url)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        '選圖'
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">#{tagName(h.tag_id)}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.image_url ? (
                          <button
                            type="button"
                            className="hover:text-foreground hover:underline"
                            onClick={() =>
                              setProfile((prev) => ({
                                ...prev,
                                highlights: prev.highlights.map((x, idx) => (idx === i ? { ...x, image_url: '' } : x)),
                              }))
                            }
                          >
                            移除圖片（改顯示標籤首字）
                          </button>
                        ) : (
                          '沒有圖片時，圓圈顯示標籤的第一個字'
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0">
                      <button type="button" className={iconBtn} aria-label="上移" disabled={i === 0} onClick={() => moveHighlight(i, -1)}>
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className={iconBtn}
                        aria-label="下移"
                        disabled={i === profile.highlights.length - 1}
                        onClick={() => moveHighlight(i, 1)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className={iconBtn}
                        aria-label="移除"
                        onClick={() => setProfile((prev) => ({ ...prev, highlights: prev.highlights.filter((_, idx) => idx !== i) }))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {profile.highlights.length < 20 && (
                <div className="flex gap-2">
                  <select
                    className={inputCls}
                    value={pendingTag}
                    onChange={(e) => setPendingTag(e.target.value)}
                    aria-label="選擇要加入的標籤"
                  >
                    <option value="">{availableTags.length ? '選擇標籤…' : '沒有可加入的標籤（請先到「標籤」建立）'}</option>
                    {availableTags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name || t.slugs?.['zh-TW'] || t.code}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!pendingTag}
                    onClick={() => {
                      setProfile((prev) => ({ ...prev, highlights: [...prev.highlights, { tag_id: Number(pendingTag), image_url: '' }] }));
                      setPendingTag('');
                    }}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" /> 加入
                  </button>
                </div>
              )}
            </>
          )}

          <MediaBrowser
            isOpen={browse !== null}
            onClose={() => setBrowse(null)}
            onSelect={(media) => {
              setProfile((prev) =>
                browse?.kind === 'avatar'
                  ? { ...prev, avatar_url: media.file_path }
                  : browse?.kind === 'highlight'
                    ? {
                        ...prev,
                        highlights: prev.highlights.map((x, idx) => (idx === browse.index ? { ...x, image_url: media.file_path } : x)),
                      }
                    : prev
              );
              setBrowse(null);
            }}
          />
        </div>
      </AdminListLayout>
    </AdminLayout>
  );
}
