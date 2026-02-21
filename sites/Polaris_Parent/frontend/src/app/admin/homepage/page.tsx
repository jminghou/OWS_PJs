'use client';

import { useState, useEffect } from 'react';
import { homepageApi, i18nApi } from '@/lib/api';
import { HomepageSlide } from '@/types';
import { I18nSettings } from '@/lib/api';
import AdminLayout from '@/components/admin/AdminLayout';
import Button from '@/components/ui/Button';
import { AdminListLayout, AdminImagePicker } from '@/components/admin/shared';
import TiptapEditor from '@/components/admin/TiptapEditor';
import { Image, Trash2, GripVertical, Save, AlertCircle, Video, Link } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import MediaBrowser from '@/components/admin/MediaBrowser';
import { type MediaItem } from '@/lib/api/strapi';
import { getImageUrl } from '@/lib/utils';

// ─── 圖片焦點選擇器 ────────────────────────────────────────────────────────────
const FOCAL_POINTS = [
  'top left',    'top center',    'top right',
  'center left', 'center center', 'center right',
  'bottom left', 'bottom center', 'bottom right',
];

const FOCAL_LABELS: Record<string, string> = {
  'top left': '左上', 'top center': '上', 'top right': '右上',
  'center left': '左', 'center center': '中', 'center right': '右',
  'bottom left': '左下', 'bottom center': '下', 'bottom right': '右下',
};

function FocalPointPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const current = value || 'center center';
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">圖片焦點</label>
      <div className="grid grid-cols-3 gap-1 w-24">
        {FOCAL_POINTS.map((fp) => (
          <button
            key={fp}
            type="button"
            title={FOCAL_LABELS[fp]}
            onClick={() => onChange(fp)}
            className={`h-6 w-full rounded-sm border text-xs transition-colors ${
              current === fp
                ? 'bg-blue-500 border-blue-600 text-white'
                : 'bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-500'
            }`}
          >
            {FOCAL_LABELS[fp]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── datetime-local 格式轉換工具 ───────────────────────────────────────────────
function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

function fromDatetimeLocal(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}

// ─── 可排序的幻燈片項目組件 ────────────────────────────────────────────────────
function SortableSlideItem({
  slide,
  enabledLanguages,
  languageNames,
  onDelete,
  onUpdate,
  onOpenMediaBrowser,
}: {
  slide: HomepageSlide;
  enabledLanguages: string[];
  languageNames: Record<string, string>;
  onDelete: (id: string) => void;
  onUpdate: (id: string, field: string, value: any) => void;
  onOpenMediaBrowser: (slideId: string, field: 'image_url' | 'video_url') => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [activeSubtitleLang, setActiveSubtitleLang] = useState(enabledLanguages[0] || '');
  const [activeTitleLang, setActiveTitleLang] = useState(enabledLanguages[0] || '');
  const [activeCtaLang, setActiveCtaLang] = useState(enabledLanguages[0] || '');

  const mediaType = slide.media_type || 'image';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-gray-200 rounded-lg p-6 mb-4"
    >
      <div className="flex gap-4">
        {/* 拖拉手柄 */}
        <div
          {...attributes}
          {...listeners}
          className="flex items-start pt-2 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-6 w-6 text-gray-400" />
        </div>

        {/* 主體內容 */}
        <div className="flex-1 space-y-5">

          {/* ── A. 媒體設定 ─────────────────────────────────────────── */}
          <div className="border border-gray-100 rounded-lg p-4 bg-gray-50 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Video className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">媒體設定</span>
            </div>

            {/* 媒體類型選擇 */}
            <div className="flex gap-2">
              {(['image', 'youtube', 'video'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => onUpdate(slide.id, 'media_type', type)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                    mediaType === type
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {type === 'image' ? '圖片' : type === 'youtube' ? 'YouTube' : 'MP4 直連'}
                </button>
              ))}
            </div>

            {/* 圖片模式 */}
            {mediaType === 'image' && (
              <div className="flex gap-4 items-start">
                <div className="space-y-2">
                  {slide.image_url ? (
                    <img
                      src={getImageUrl(slide.image_url, 'medium')}
                      alt={slide.alt_text}
                      className="w-48 h-auto max-h-36 object-contain rounded-lg border border-gray-200"
                      onError={(e) => {
                        const t = e.target as HTMLImageElement;
                        if (t.src.includes('_medium')) {
                          t.src = getImageUrl(slide.image_url);
                        } else {
                          t.style.display = 'none';
                        }
                      }}
                    />
                  ) : (
                    <div className="w-48 h-28 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white">
                      <Image className="h-8 w-8 text-gray-300" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenMediaBrowser(slide.id, 'image_url')}
                    className="text-xs text-blue-600 hover:text-blue-700 underline"
                  >
                    {slide.image_url ? '更換圖片' : '選擇圖片'}
                  </button>
                  <div className="text-xs text-gray-400 break-all max-w-[192px]">{slide.image_url}</div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Alt Text（無障礙描述）</label>
                    <input
                      type="text"
                      value={slide.alt_text}
                      onChange={(e) => onUpdate(slide.id, 'alt_text', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="圖片的無障礙描述"
                    />
                  </div>
                  <FocalPointPicker
                    value={slide.focal_point || 'center center'}
                    onChange={(v) => onUpdate(slide.id, 'focal_point', v)}
                  />
                </div>
              </div>
            )}

            {/* YouTube 模式 */}
            {mediaType === 'youtube' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">YouTube 影片 URL</label>
                <input
                  type="url"
                  value={slide.video_url || ''}
                  onChange={(e) => onUpdate(slide.id, 'video_url', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                <p className="text-xs text-gray-400 mt-1">影片將以靜音背景播放。支援 youtube.com 或 youtu.be 格式。</p>
              </div>
            )}

            {/* MP4 直連模式 */}
            {mediaType === 'video' && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-600">MP4 影片</label>
                <button
                  type="button"
                  onClick={() => onOpenMediaBrowser(slide.id, 'video_url')}
                  className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  <Video className="h-4 w-4 text-gray-500" />
                  {slide.video_url ? '更換影片' : '從媒體庫選取影片'}
                </button>
                {slide.video_url && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 break-all flex-1">{slide.video_url}</span>
                    <button
                      type="button"
                      onClick={() => onUpdate(slide.id, 'video_url', '')}
                      className="text-xs text-red-500 hover:text-red-700 shrink-0"
                    >
                      清除
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── B. 顯示設定 ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                覆蓋層透明度：{slide.overlay_opacity ?? 40}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={slide.overlay_opacity ?? 40}
                onChange={(e) => onUpdate(slide.id, 'overlay_opacity', Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>透明</span><span>不透明</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                個別播放秒數（毫秒）
              </label>
              <input
                type="number"
                min="1000"
                step="500"
                value={slide.autoplay_delay ?? ''}
                onChange={(e) => onUpdate(
                  slide.id,
                  'autoplay_delay',
                  e.target.value === '' ? null : Number(e.target.value)
                )}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="留空使用全域設定（6000ms）"
              />
            </div>
          </div>

          {/* ── C. 文字內容（主標題 + 副標題）───────────────────────── */}
          <div className="space-y-4">
            {/* 主標題覆蓋 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                主標題覆蓋（多語言，留空沿用全域主標題）
              </label>
              <div className="flex gap-2 mb-2 border-b border-gray-200">
                {enabledLanguages.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setActiveTitleLang(lang)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeTitleLang === lang
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {languageNames[lang] || lang}
                  </button>
                ))}
              </div>
              {enabledLanguages.map((lang) => (
                <div key={lang} className={activeTitleLang === lang ? 'block' : 'hidden'}>
                  <input
                    type="text"
                    value={slide.titles?.[lang] || ''}
                    onChange={(e) => onUpdate(slide.id, 'titles', { ...slide.titles, [lang]: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`主標題（${languageNames[lang] || lang}）留空 = 沿用全域設定`}
                  />
                </div>
              ))}
            </div>

            {/* 副標題 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                副標題（多語言富文本）
              </label>
              <div className="flex gap-2 mb-3 border-b border-gray-200">
                {enabledLanguages.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setActiveSubtitleLang(lang)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeSubtitleLang === lang
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {languageNames[lang] || lang}
                  </button>
                ))}
              </div>
              <div className="border border-gray-300 rounded-md overflow-hidden">
                <TiptapEditor
                  content={slide.subtitles[activeSubtitleLang] || ''}
                  onChange={(value) => {
                    onUpdate(slide.id, 'subtitles', { ...slide.subtitles, [activeSubtitleLang]: value });
                  }}
                  placeholder={`輸入${languageNames[activeSubtitleLang] || activeSubtitleLang}的副標題...`}
                  minHeight="100px"
                  className="bg-white"
                  showBlockHandle={false}
                />
              </div>
            </div>
          </div>

          {/* ── D. 個別 CTA 連結 ─────────────────────────────────────── */}
          <div className="border border-gray-100 rounded-lg p-4 bg-gray-50 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Link className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">個別 CTA 連結</span>
              <span className="text-xs text-gray-400">（留空則使用全域按鈕行為）</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">連結 URL</label>
              <input
                type="url"
                value={slide.cta_url || ''}
                onChange={(e) => onUpdate(slide.id, 'cta_url', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://... 或 /about"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">按鈕文字（多語言）</label>
              <div className="flex gap-2 mb-2 border-b border-gray-200">
                {enabledLanguages.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setActiveCtaLang(lang)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeCtaLang === lang
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {languageNames[lang] || lang}
                  </button>
                ))}
              </div>
              {enabledLanguages.map((lang) => (
                <div key={lang} className={activeCtaLang === lang ? 'block' : 'hidden'}>
                  <input
                    type="text"
                    value={slide.cta_text?.[lang] || ''}
                    onChange={(e) => onUpdate(slide.id, 'cta_text', { ...slide.cta_text, [lang]: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`按鈕文字（${languageNames[lang] || lang}）留空 = 沿用全域按鈕文字`}
                  />
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={slide.cta_new_tab || false}
                onChange={(e) => onUpdate(slide.id, 'cta_new_tab', e.target.checked)}
                className="w-4 h-4 rounded accent-blue-600"
              />
              <span className="text-sm text-gray-700">在新分頁開啟連結</span>
            </label>
          </div>

          {/* ── E. 排程 ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">排程啟用時間</label>
              <input
                type="datetime-local"
                value={toDatetimeLocal(slide.start_date)}
                onChange={(e) => onUpdate(slide.id, 'start_date', fromDatetimeLocal(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <p className="text-xs text-gray-400 mt-0.5">留空 = 立即顯示</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">排程結束時間</label>
              <input
                type="datetime-local"
                value={toDatetimeLocal(slide.end_date)}
                onChange={(e) => onUpdate(slide.id, 'end_date', fromDatetimeLocal(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <p className="text-xs text-gray-400 mt-0.5">留空 = 永不下架</p>
            </div>
          </div>
        </div>

        {/* 刪除按鈕 */}
        <div className="flex items-start pt-2">
          <button
            onClick={() => onDelete(slide.id)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="刪除此幻燈片"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 主頁面 ────────────────────────────────────────────────────────────────────
export default function HomepagePage() {
  const [slides, setSlides] = useState<HomepageSlide[]>([]);
  const [buttonText, setButtonText] = useState<Record<string, string>>({});
  const [aboutSection, setAboutSection] = useState<Record<string, any>>({});
  const [pauseOnHover, setPauseOnHover] = useState(true);
  const [lazyLoading, setLazyLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [i18nSettings, setI18nSettings] = useState<I18nSettings | null>(null);
  const [isMediaBrowserOpen, setIsMediaBrowserOpen] = useState(false);
  const [pendingSlideId, setPendingSlideId] = useState<string | null>(null);
  const [pendingField, setPendingField] = useState<'image_url' | 'video_url'>('image_url');
  const [isAboutImageBrowserOpen, setIsAboutImageBrowserOpen] = useState(false);

  type SectionKey = 'slides' | 'button_text' | 'about_section' | 'carousel_settings';
  const [activeSection, setActiveSection] = useState<SectionKey>('slides');

  const enabledLanguages = i18nSettings?.languages || [];
  const languageNames = i18nSettings?.language_names || {};

  const [activeLanguage, setActiveLanguage] = useState('');

  useEffect(() => {
    if (enabledLanguages.length > 0 && !activeLanguage) {
      setActiveLanguage(enabledLanguages[0]);
    }
  }, [enabledLanguages, activeLanguage]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [homepageData, i18nData] = await Promise.all([
        homepageApi.getSettings(),
        i18nApi.getSettings(),
      ]);
      setSlides(homepageData.slides || []);
      setButtonText(homepageData.button_text || {});
      setAboutSection(homepageData.about_section || {});
      setPauseOnHover(homepageData.pause_on_hover ?? true);
      setLazyLoading(homepageData.lazy_loading ?? true);
      setI18nSettings(i18nData);
    } catch (error: any) {
      console.error('獲取設定失敗:', error);
      setMessage({ type: 'error', text: error.message || '載入設定失敗' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMediaBrowser = (slideId: string, field: 'image_url' | 'video_url' = 'image_url') => {
    setPendingSlideId(slideId);
    setPendingField(field);
    setIsMediaBrowserOpen(true);
  };

  const handleMediaSelect = (media: MediaItem) => {
    if (pendingSlideId) {
      if (pendingField === 'video_url') {
        // 為現有 slide 設定影片
        setSlides(slides.map((s) =>
          s.id === pendingSlideId
            ? { ...s, video_url: media.file_path }
            : s
        ));
      } else {
        // 為現有 slide 更換圖片
        setSlides(slides.map((s) =>
          s.id === pendingSlideId
            ? { ...s, image_url: getImageUrl(media.file_path), alt_text: s.alt_text || media.alt_text || '', media_type: 'image' as const }
            : s
        ));
      }
      setPendingSlideId(null);
    } else {
      // 新增 slide
      if (slides.length >= 5) {
        setMessage({ type: 'error', text: '最多只能添加 5 張圖片' });
        return;
      }
      const newSlide: HomepageSlide = {
        id: `slide-${Date.now()}`,
        image_url: getImageUrl(media.file_path),
        alt_text: media.alt_text || '',
        sort_order: slides.length,
        subtitles: {},
        cta_url: '',
        cta_text: {},
        cta_new_tab: false,
        autoplay_delay: null,
        video_url: '',
        media_type: 'image',
        focal_point: 'center center',
        overlay_opacity: 40,
        titles: {},
        start_date: null,
        end_date: null,
      };
      setSlides([...slides, newSlide]);
      setMessage({ type: 'success', text: '圖片已添加' });
    }
    setIsMediaBrowserOpen(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSlides((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex).map((item, index) => ({ ...item, sort_order: index }));
      });
    }
  };

  const handleDeleteSlide = (id: string) => {
    if (confirm('確定要刪除此幻燈片嗎？')) {
      setSlides(slides.filter((s) => s.id !== id));
      setMessage({ type: 'success', text: '幻燈片已刪除' });
    }
  };

  const handleUpdateSlide = (id: string, field: string, value: any) => {
    setSlides(slides.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      await homepageApi.updateSettings({
        slides,
        button_text: buttonText,
        about_section: aboutSection,
        pause_on_hover: pauseOnHover,
        lazy_loading: lazyLoading,
      });
      setMessage({ type: 'success', text: '設定儲存成功' });
    } catch (error: any) {
      console.error('儲存失敗:', error);
      if (error.status === 401) {
        setMessage({ type: 'error', text: '您的登入已過期，請重新登入後再試' });
        setTimeout(() => { window.location.href = '/admin/login'; }, 3000);
      } else if (error.status === 403) {
        setMessage({ type: 'error', text: '您沒有權限執行此操作，需要編輯或管理員權限' });
      } else {
        setMessage({ type: 'error', text: error.message || '儲存設定失敗，請稍後再試' });
      }
    } finally {
      setSaving(false);
    }
  };

  const sectionItems: { key: SectionKey; label: string }[] = [
    { key: 'slides', label: '幻燈片管理' },
    { key: 'carousel_settings', label: '輪播全域設定' },
    { key: 'button_text', label: '按鈕文字設定' },
    { key: 'about_section', label: '關於我們區塊設定' },
  ];

  const sidebar = (
    <div className="w-full h-full border-r bg-white flex flex-col">
      <div className="p-6 pb-2">
        <h1 className="text-xl font-bold text-gray-900 mb-6">首頁設定</h1>
      </div>
      <nav className="flex-1 overflow-y-auto">
        {sectionItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setActiveSection(item.key)}
            className={`w-full flex items-center gap-3 px-6 py-2.5 text-left transition-colors ${
              activeSection === item.key
                ? 'border-l-2 border-blue-500 bg-blue-50 text-blue-700'
                : 'border-l-2 border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <span className="text-sm">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );

  return (
    <AdminLayout>
      <AdminListLayout sidebar={sidebar} sidebarWidth={224}>
        <div className="p-6 space-y-6">
          {/* 頂部標題 + 儲存 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {sectionItems.find((s) => s.key === activeSection)?.label}
              </h1>
              <p className="text-gray-600 mt-2">
                {activeSection === 'slides' && '最多上傳 5 張圖片，拖拉調整順序，每張可設定媒體、文字、CTA、排程'}
                {activeSection === 'carousel_settings' && '設定輪播的全域行為（hover 暫停、延遲載入）'}
                {activeSection === 'button_text' && '設定首頁 Hero Section 進入「關於我們」按鈕的多語言文字'}
                {activeSection === 'about_section' && '管理首頁「關於我們」區塊的多語言內容'}
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? '儲存中...' : '儲存設定'}
            </Button>
          </div>

          {/* 訊息提示 */}
          {message && (
            <div
              className={`flex items-center gap-2 p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              <AlertCircle className="h-5 w-5" />
              <span>{message.text}</span>
            </div>
          )}

          {/* ── 幻燈片管理 ─────────────────────────────────────────── */}
          {activeSection === 'slides' && (
            <>
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  {slides.length < 5 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPendingSlideId(null);
                        setIsMediaBrowserOpen(true);
                      }}
                      className="flex items-center justify-center gap-2 w-full px-6 py-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                    >
                      <Image className="h-5 w-5 text-gray-600" />
                      <span className="text-gray-700">從媒體庫選擇圖片新增幻燈片 ({slides.length}/5)</span>
                    </button>
                  )}

                  {slides.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Image className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p>尚未添加任何幻燈片</p>
                      <p className="text-sm mt-1">點擊上方按鈕從媒體庫選擇圖片</p>
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                        {slides.map((slide) => (
                          <SortableSlideItem
                            key={slide.id}
                            slide={slide}
                            enabledLanguages={enabledLanguages}
                            languageNames={languageNames}
                            onDelete={handleDeleteSlide}
                            onUpdate={handleUpdateSlide}
                            onOpenMediaBrowser={handleOpenMediaBrowser}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  )}
                </>
              )}
            </>
          )}

          {/* ── 輪播全域設定 ─────────────────────────────────────────── */}
          {activeSection === 'carousel_settings' && (
            <div className="space-y-4 max-w-lg">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-gray-800">滑鼠懸停暫停</div>
                  <div className="text-xs text-gray-500 mt-0.5">滑鼠移入輪播區塊時自動暫停自動播放</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pauseOnHover}
                    onChange={(e) => setPauseOnHover(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-gray-800">延遲載入圖片（Lazy Loading）</div>
                  <div className="text-xs text-gray-500 mt-0.5">非第一張幻燈片圖片延遲載入，提升首頁效能</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lazyLoading}
                    onChange={(e) => setLazyLoading(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          )}

          {/* ── 按鈕文字設定 ─────────────────────────────────────────── */}
          {activeSection === 'button_text' && (
            <>
              {loading ? (
                <div className="flex justify-center items-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {enabledLanguages.map((lang) => (
                    <div key={lang}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {languageNames[lang] || lang}
                      </label>
                      <input
                        type="text"
                        value={buttonText[lang] || ''}
                        onChange={(e) => setButtonText({ ...buttonText, [lang]: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={`按鈕文字 (${languageNames[lang] || lang})`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── 關於我們區塊設定 ─────────────────────────────────────── */}
          {activeSection === 'about_section' && (
            <>
              {loading ? (
                <div className="flex justify-center items-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex gap-2 border-b border-gray-200">
                    {enabledLanguages.map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setActiveLanguage(lang)}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          activeLanguage === lang
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {languageNames[lang] || lang}
                      </button>
                    ))}
                  </div>

                  {enabledLanguages.map((lang) => (
                    <div
                      key={lang}
                      className={`space-y-4 ${activeLanguage === lang ? 'block' : 'hidden'}`}
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">標題</label>
                            <input
                              type="text"
                              value={aboutSection[lang]?.title || ''}
                              onChange={(e) => {
                                const n = { ...aboutSection };
                                n[lang] = { ...n[lang], title: e.target.value };
                                setAboutSection(n);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              placeholder="例如：關於我們"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">金句 (Quote)</label>
                            <input
                              type="text"
                              value={aboutSection[lang]?.quote || ''}
                              onChange={(e) => {
                                const n = { ...aboutSection };
                                n[lang] = { ...n[lang], quote: e.target.value };
                                setAboutSection(n);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              placeholder="例如：我們不是算命，是在跑數據"
                            />
                          </div>
                        </div>
                        <div>
                          <AdminImagePicker
                            label="區塊圖片"
                            value={aboutSection[lang]?.image_url}
                            getImageUrl={getImageUrl}
                            onBrowse={() => setIsAboutImageBrowserOpen(true)}
                            onRemove={() => {
                              const n = { ...aboutSection };
                              n[lang] = { ...n[lang], image_url: '' };
                              setAboutSection(n);
                            }}
                            aspectRatio="1/1"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">品牌理念 (Philosophy)</label>
                        <textarea
                          value={aboutSection[lang]?.philosophy || ''}
                          onChange={(e) => {
                            const n = { ...aboutSection };
                            n[lang] = { ...n[lang], philosophy: e.target.value };
                            setAboutSection(n);
                          }}
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          placeholder="輸入品牌理念描述..."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">使命重點（每行一個）</label>
                        <textarea
                          value={(aboutSection[lang]?.mission_points || []).join('\n')}
                          onChange={(e) => {
                            const n = { ...aboutSection };
                            n[lang] = { ...n[lang], mission_points: e.target.value.split('\n') };
                            setAboutSection(n);
                          }}
                          onBlur={(e) => {
                            const n = { ...aboutSection };
                            n[lang] = {
                              ...n[lang],
                              mission_points: e.target.value.split('\n').filter((p) => p.trim() !== ''),
                            };
                            setAboutSection(n);
                          }}
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          placeholder="看懂天賦&#10;理解差異&#10;精準溝通"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </AdminListLayout>

      {/* 媒體庫瀏覽器 */}
      <MediaBrowser
        isOpen={isMediaBrowserOpen}
        onClose={() => { setIsMediaBrowserOpen(false); setPendingSlideId(null); }}
        onSelect={handleMediaSelect}
      />

      {/* 關於我們圖片瀏覽器 */}
      <MediaBrowser
        isOpen={isAboutImageBrowserOpen}
        onClose={() => setIsAboutImageBrowserOpen(false)}
        onSelect={(media) => {
          const n = { ...aboutSection };
          n[activeLanguage] = { ...n[activeLanguage], image_url: media.file_path };
          setAboutSection(n);
          setIsAboutImageBrowserOpen(false);
        }}
      />
    </AdminLayout>
  );
}
