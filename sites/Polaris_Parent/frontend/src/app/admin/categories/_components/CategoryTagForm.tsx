'use client';

import { Category, Tag } from '@/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Globe } from 'lucide-react';

interface I18nSettings {
  enabled: boolean;
  default_language: string;
  languages: string[];
  language_names: Record<string, string>;
}

interface CategoryTagFormProps {
  type: 'categories' | 'tags';
  isEditing: boolean;
  code: string;
  slugs: Record<string, string>;
  parentId?: number;
  sortOrder?: number;
  categories?: Category[]; // for parent selector
  i18nSettings: I18nSettings | null;
  onCodeChange: (value: string) => void;
  onSlugChange: (lang: string, value: string) => void;
  onParentIdChange?: (value: number | undefined) => void;
  onSortOrderChange?: (value: number) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export default function CategoryTagForm({
  type,
  isEditing,
  code,
  slugs,
  parentId,
  sortOrder,
  categories,
  i18nSettings,
  onCodeChange,
  onSlugChange,
  onParentIdChange,
  onSortOrderChange,
  onSubmit,
  onCancel,
}: CategoryTagFormProps) {
  const isCategory = type === 'categories';
  const label = isCategory ? '分類' : '標籤';

  const getDisplayLanguages = () => {
    if (!i18nSettings?.enabled) return ['zh-TW'];
    const langs = new Set([i18nSettings.default_language, ...i18nSettings.languages]);
    return Array.from(langs);
  };

  const displayLanguages = getDisplayLanguages();

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">
          {isEditing ? `編輯${label}` : `新增${label}`}
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {isEditing ? `修改${label}的代碼和多語言名稱` : `建立新的${label}代碼及其多語言對照`}
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto">
        <form onSubmit={onSubmit} className="p-6 space-y-6 max-w-xl">
          {/* Code field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {label}代碼 (Code) *
            </label>
            <Input
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              placeholder={isCategory ? '例如: 1POL' : '例如: HOT'}
              required
            />
            <p className="text-xs text-gray-500 mt-1">內部識別用的唯一代碼</p>
          </div>

          {/* Parent category (categories only) */}
          {isCategory && categories && onParentIdChange && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                父分類
              </label>
              <select
                value={parentId || ''}
                onChange={(e) => onParentIdChange(e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">無（頂層分類）</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {Object.values(cat.slugs || {})[0] || cat.code}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sort order (categories only) */}
          {isCategory && onSortOrderChange !== undefined && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                排序
              </label>
              <Input
                type="number"
                value={sortOrder ?? 0}
                onChange={(e) => onSortOrderChange?.(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-gray-500 mt-1">數字越小排越前面</p>
            </div>
          )}

          {/* Multi-language slugs */}
          <div className="border-t pt-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <Globe className="w-4 h-4 inline mr-1" />
              多語言顯示名稱 (Slug)
            </label>
            <div className="space-y-3">
              {displayLanguages.map(lang => (
                <div key={lang}>
                  <label className="block text-xs text-gray-500 mb-1">
                    {i18nSettings?.language_names[lang] || lang} ({lang})
                  </label>
                  <Input
                    value={slugs[lang] || ''}
                    onChange={(e) => onSlugChange(lang, e.target.value)}
                    placeholder={`輸入 ${lang} 的顯示名稱`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-2 pt-4 border-t">
            <Button type="submit" className="flex-1">
              {isEditing ? `更新${label}` : `新增${label}`}
            </Button>
            {isEditing && (
              <Button type="button" variant="outline" onClick={onCancel}>
                取消
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
