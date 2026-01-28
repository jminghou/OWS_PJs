'use client';

import { X } from 'lucide-react';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import Input from '@/components/ui/Input';
import LanguageManager from '@/components/admin/LanguageManager';
import { Category } from '@/types';

interface I18nSettings {
  enabled: boolean;
  default_language: string;
  languages: string[];
  language_names: Record<string, string>;
}

interface FormData {
  title: string;
  content: string;
  summary: string;
  slug: string;
  status: 'draft' | 'published';
  content_type: 'article';
  category_id: string;
  featured_image: string;
  cover_image: string;
  meta_title: string;
  meta_description: string;
  language: string;
  published_at: string;
}

interface ArticleSettingsPanelProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  categories: Category[];
  tagInput: string;
  setTagInput: (value: string) => void;
  parseTagInput: (input: string) => string[];
  i18nSettings?: I18nSettings | null;
  onSaveDraft?: () => void;
  onPublish?: () => void;
  loading?: boolean;
  onClose?: () => void;
}

export default function ArticleSettingsPanel({
  formData,
  setFormData,
  categories,
  tagInput,
  setTagInput,
  parseTagInput,
  i18nSettings,
  onClose,
}: ArticleSettingsPanelProps) {
  return (
    <div className="w-[380px] max-h-[80vh] overflow-y-auto">
      {/* 標題 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 sticky top-0 bg-white z-10">
        <h3 className="text-base font-semibold text-gray-900">文章設定</h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div className="px-4 py-2">
        {/* 發布設定 */}
        <CollapsibleSection title="發布設定" defaultOpen>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                分類
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent"
              >
                <option value="">選擇分類</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                預約發布時間
              </label>
              <Input
                type="datetime-local"
                value={formData.published_at}
                onChange={(e) => setFormData(prev => ({ ...prev, published_at: e.target.value }))}
                className="text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                使用台灣時區 UTC+8
              </p>
            </div>
          </div>
        </CollapsibleSection>

        {/* 圖片設定 */}
        <CollapsibleSection title="圖片設定" defaultOpen>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                封面圖片 URL (1:1)
              </label>
              <Input
                value={formData.cover_image}
                onChange={(e) => setFormData(prev => ({ ...prev, cover_image: e.target.value }))}
                placeholder="https://example.com/cover.jpg"
                className="text-sm"
              />
              <p className="text-xs text-blue-500 mt-1">
                用於首頁和列表頁縮圖
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                精選圖片 URL (16:9)
              </label>
              <Input
                value={formData.featured_image}
                onChange={(e) => setFormData(prev => ({ ...prev, featured_image: e.target.value }))}
                placeholder="https://example.com/image.jpg"
                className="text-sm"
              />
              <p className="text-xs text-blue-500 mt-1">
                用於文章內文顯示
              </p>
            </div>
          </div>
        </CollapsibleSection>

        {/* 標籤 */}
        <CollapsibleSection title="標籤" defaultOpen>
          <div className="space-y-3">
            <div>
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="#ABC #EDF #GHI"
                className="text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                使用 # 開頭，空格分隔
              </p>
            </div>

            {parseTagInput(tagInput).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {parseTagInput(tagInput).map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* 摘要 - 預設收合 */}
        <CollapsibleSection title="摘要" defaultOpen={false}>
          <div>
            <textarea
              value={formData.summary}
              onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent resize-none"
              rows={3}
              placeholder="簡短描述文章內容..."
            />
          </div>
        </CollapsibleSection>

        {/* SEO 設定 - 預設收合 */}
        <CollapsibleSection title="SEO 設定" defaultOpen={false}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                網址別名 (Slug)
              </label>
              <Input
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="url-friendly-name"
                className="text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                SEO 標題
              </label>
              <Input
                value={formData.meta_title}
                onChange={(e) => setFormData(prev => ({ ...prev, meta_title: e.target.value }))}
                placeholder="搜尋引擎顯示的標題"
                className="text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                SEO 描述
              </label>
              <textarea
                value={formData.meta_description}
                onChange={(e) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="搜尋引擎顯示的描述..."
              />
            </div>
          </div>
        </CollapsibleSection>

        {/* 多語言管理 - 預設收合 */}
        {i18nSettings?.enabled && (
          <CollapsibleSection title="多語言管理" defaultOpen={false}>
            <LanguageManager
              mode="create"
              currentLanguage={formData.language}
              i18nSettings={i18nSettings}
              onLanguageChange={(lang) => setFormData(prev => ({ ...prev, language: lang }))}
            />
          </CollapsibleSection>
        )}
      </div>

    </div>
  );
}
