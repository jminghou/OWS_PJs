'use client';

import { useState, useEffect, useRef } from 'react';
import { homepageApi, i18nApi } from '@/lib/api';
import { HomepageSettings, HomepageSlide } from '@/types';
import { I18nSettings } from '@/lib/api';
import AdminLayout from '@/components/admin/AdminLayout';
import Button from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import MarkdownToolbar from '@/components/ui/MarkdownToolbar';
import { Upload, Trash2, GripVertical, Save, AlertCircle } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 可排序的幻燈片項目組件
function SortableSlideItem({
  slide,
  enabledLanguages,
  languageNames,
  onDelete,
  onUpdate
}: {
  slide: HomepageSlide;
  enabledLanguages: string[];
  languageNames: Record<string, string>;
  onDelete: (id: string) => void;
  onUpdate: (id: string, field: string, value: any) => void;
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

  // 為每個語言創建獨立的 textarea ref
  const [activeLanguage, setActiveLanguage] = useState(enabledLanguages[0] || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

        {/* 圖片預覽 */}
        <div className="flex-shrink-0">
          <div className="space-y-2">
            <img
              src={slide.image_url.startsWith('http') ? slide.image_url : `http://localhost:5000${slide.image_url}`}
              alt={slide.alt_text}
              className="w-48 h-32 object-cover rounded-lg border border-gray-200"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="192" height="128"%3E%3Crect fill="%23f3f4f6" width="192" height="128"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af"%3E圖片載入失敗%3C/text%3E%3C/svg%3E';
              }}
            />
            <div className="text-xs text-gray-500 break-all">
              {slide.image_url}
            </div>
          </div>
        </div>

        {/* 表單欄位 */}
        <div className="flex-1 space-y-4">
          {/* Alt Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Alt Text (無障礙描述)
            </label>
            <input
              type="text"
              value={slide.alt_text}
              onChange={(e) => onUpdate(slide.id, 'alt_text', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="圖片的無障礙描述"
            />
          </div>

          {/* 多語言副標題 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              副標題（多語言 Markdown 編輯器）
            </label>

            {/* 語言標籤切換 */}
            <div className="flex gap-2 mb-3 border-b border-gray-200">
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

            {/* Markdown 工具列 */}
            <MarkdownToolbar
              textareaRef={textareaRef}
              content={slide.subtitles[activeLanguage] || ''}
              onContentChange={(value) => {
                const newSubtitles = { ...slide.subtitles, [activeLanguage]: value };
                onUpdate(slide.id, 'subtitles', newSubtitles);
              }}
            />

            {/* Markdown 編輯區 */}
            <textarea
              ref={textareaRef}
              value={slide.subtitles[activeLanguage] || ''}
              onChange={(e) => {
                const newSubtitles = { ...slide.subtitles, [activeLanguage]: e.target.value };
                onUpdate(slide.id, 'subtitles', newSubtitles);
              }}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder={`輸入${languageNames[activeLanguage] || activeLanguage}的副標題（支援 Markdown 格式）`}
            />
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

export default function HomepagePage() {
  const [slides, setSlides] = useState<HomepageSlide[]>([]);
  const [buttonText, setButtonText] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [i18nSettings, setI18nSettings] = useState<I18nSettings | null>(null);

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
      setI18nSettings(i18nData);
    } catch (error: any) {
      console.error('獲取設定失敗:', error);
      setMessage({ type: 'error', text: error.message || '載入設定失敗' });
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 檢查是否已達上限
    if (slides.length >= 5) {
      setMessage({ type: 'error', text: '最多只能上傳 5 張圖片' });
      return;
    }

    // 檢查文件類型
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setMessage({ type: 'error', text: '不支援的圖片格式，僅支援 PNG, JPG, JPEG, GIF, WEBP' });
      return;
    }

    // 檢查文件大小（10MB）
    if (file.size > 10 * 1024 * 1024) {
      setMessage({ type: 'error', text: '圖片大小不能超過 10MB' });
      return;
    }

    try {
      setUploading(true);
      setMessage(null); // 清除舊訊息
      const result = await homepageApi.uploadSlideImage(file);

      // 創建新的幻燈片
      const newSlide: HomepageSlide = {
        id: `slide-${Date.now()}`,
        image_url: result.image_url,
        alt_text: '',
        sort_order: slides.length,
        subtitles: {},
      };

      setSlides([...slides, newSlide]);
      setMessage({ type: 'success', text: '圖片上傳成功' });

      // 清空 input，允許重複上傳同一檔案
      e.target.value = '';
    } catch (error: any) {
      console.error('上傳圖片失敗:', error);

      // 檢查是否為認證錯誤
      if (error.status === 401) {
        setMessage({
          type: 'error',
          text: '您的登入已過期，請重新登入後再試'
        });
        // 可選：3秒後自動跳轉到登入頁面
        setTimeout(() => {
          window.location.href = '/admin/login';
        }, 3000);
      } else if (error.status === 403) {
        setMessage({
          type: 'error',
          text: '您沒有權限執行此操作，需要編輯或管理員權限'
        });
      } else {
        setMessage({
          type: 'error',
          text: error.message || '上傳圖片失敗，請稍後再試'
        });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSlides((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const reordered = arrayMove(items, oldIndex, newIndex);
        // 更新 sort_order
        return reordered.map((item, index) => ({ ...item, sort_order: index }));
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
      setMessage(null); // 清除舊訊息
      await homepageApi.updateSettings({ slides, button_text: buttonText });
      setMessage({ type: 'success', text: '設定儲存成功' });
    } catch (error: any) {
      console.error('儲存失敗:', error);

      // 檢查是否為認證錯誤
      if (error.status === 401) {
        setMessage({
          type: 'error',
          text: '您的登入已過期，請重新登入後再試'
        });
        setTimeout(() => {
          window.location.href = '/admin/login';
        }, 3000);
      } else if (error.status === 403) {
        setMessage({
          type: 'error',
          text: '您沒有權限執行此操作，需要編輯或管理員權限'
        });
      } else {
        setMessage({
          type: 'error',
          text: error.message || '儲存設定失敗，請稍後再試'
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const enabledLanguages = i18nSettings?.languages || [];
  const languageNames = i18nSettings?.language_names || {};

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* 頁面標題 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">首頁設定</h1>
            <p className="text-gray-600 mt-2">管理首頁 Hero Section 的幻燈片內容</p>
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

        {/* 按鈕文字設定 */}
        <Card>
          <CardHeader>
            <CardTitle>按鈕文字設定</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              設定首頁「關於我們」按鈕的多語言文字
            </p>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>幻燈片管理</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              最多上傳 5 張圖片，拖拉調整順序，每張圖片可設定多語言副標題
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {/* 上傳按鈕 */}
                {slides.length < 5 && (
                  <div className="mb-6">
                    <label className="flex items-center justify-center gap-2 px-6 py-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                      <Upload className="h-5 w-5 text-gray-600" />
                      <span className="text-gray-700">
                        {uploading ? '上傳中...' : `上傳圖片 (${slides.length}/5)`}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploading}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {/* 幻燈片列表 */}
                {slides.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Upload className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p>尚未上傳任何圖片</p>
                    <p className="text-sm mt-1">點擊上方按鈕開始上傳</p>
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
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
