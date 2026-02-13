'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Languages, Plus, Check, ExternalLink, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Popover from '@/components/ui/Popover';
import { contentApi } from '@/lib/api';
import { TranslationInfo } from '@/types';
import { SUPPORTED_LANGUAGES } from '@/lib/constants';

interface I18nSettings {
  enabled: boolean;
  default_language: string;
  languages: string[];
  language_names: Record<string, string>;
}

interface LanguageSelectorProps {
  mode: 'create' | 'edit';
  currentLanguage: string;
  articleId?: number;
  translations?: TranslationInfo[];
  i18nSettings: I18nSettings;
  onLanguageChange?: (lang: string) => void;
  onRefresh?: () => void;
  formData: any;
}

export default function LanguageSelector({
  mode,
  currentLanguage,
  articleId,
  translations = [],
  i18nSettings,
  onLanguageChange,
  onRefresh,
  formData
}: LanguageSelectorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  const sortedLanguages = SUPPORTED_LANGUAGES
    .filter(lang => i18nSettings.languages.includes(lang.code))
    .map(lang => lang.code);

  const otherLanguages = i18nSettings.languages.filter(
    code => !SUPPORTED_LANGUAGES.some(sl => sl.code === code)
  );

  const displayLanguages = [...sortedLanguages, ...otherLanguages];

  const getTranslation = (langCode: string) => {
    return translations.find(t => t.language === langCode);
  };

  const handleCreateTranslation = async (langCode: string) => {
    if (!articleId || !formData) return;
    
    setLoadingMap(prev => ({ ...prev, [langCode]: true }));
    try {
      const translationData = {
        title: `[${langCode}] ${formData.title}`,
        content: formData.content,
        summary: formData.summary,
        slug: `${formData.slug}-${langCode.toLowerCase()}`,
        status: 'draft' as const,
        content_type: 'article' as const,
        category_id: formData.category_id ? parseInt(formData.category_id) : undefined,
        featured_image: formData.featured_image,
        cover_image: formData.cover_image,
        meta_title: formData.meta_title,
        meta_description: formData.meta_description,
        language: langCode,
        original_id: articleId
      };

      const newPost = await contentApi.create(translationData);
      if (onRefresh) onRefresh();
      router.push(`/admin/editor/${newPost.id}`);
      setOpen(false);
    } catch (error: any) {
      console.error(`Error creating translation for ${langCode}:`, error);
      alert(`建立失敗：${error.message || '未知錯誤'}`);
    } finally {
      setLoadingMap(prev => ({ ...prev, [langCode]: false }));
    }
  };

  const handleSwitchLanguage = (langCode: string) => {
    if (langCode === currentLanguage) return;

    if (mode === 'create') {
      onLanguageChange?.(langCode);
      setOpen(false);
    } else {
      const translation = getTranslation(langCode);
      if (translation) {
        router.push(`/admin/editor/${translation.id}`);
        setOpen(false);
      }
    }
  };

  const trigger = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="flex items-center gap-1 px-2.5 py-1 text-xs h-7"
      title="語言管理"
    >
      <Languages size={14} />
      {i18nSettings.language_names[currentLanguage] || currentLanguage}
    </Button>
  );

  const content = (
    <div className="w-56 py-1">
      <div className="px-3 py-2 border-b border-gray-100">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          切換或新增語言
        </span>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {displayLanguages.map((langCode) => {
          const isCurrent = langCode === currentLanguage;
          const translation = getTranslation(langCode);
          const exists = !!translation;
          const isLoading = loadingMap[langCode];
          const langName = i18nSettings.language_names[langCode] || langCode;

          return (
            <div
              key={langCode}
              className="group flex items-center justify-between px-2 py-1 hover:bg-gray-50 transition-colors"
            >
              <button
                type="button"
                onClick={() => handleSwitchLanguage(langCode)}
                disabled={isCurrent || (mode === 'edit' && !exists)}
                className={`flex-1 flex items-center gap-2 px-2 py-1.5 text-sm text-left rounded-md transition-colors ${
                  isCurrent 
                    ? 'text-brand-purple-600 font-medium bg-brand-purple-50' 
                    : (mode === 'edit' && !exists)
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <span className="flex-1">{langName}</span>
                {isCurrent && <Check size={14} className="text-brand-purple-500" />}
                {exists && !isCurrent && <ExternalLink size={12} className="text-gray-400" />}
              </button>

              {mode === 'edit' && !exists && !isCurrent && (
                <button
                  type="button"
                  onClick={() => handleCreateTranslation(langCode)}
                  disabled={isLoading}
                  className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                  title="新增此語系版本"
                >
                  {isLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {mode === 'create' && (
        <div className="px-3 py-2 border-t border-gray-100">
          <p className="text-[10px] text-gray-400 leading-tight">
            建立後即可為其他語系新增翻譯版本
          </p>
        </div>
      )}
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      trigger={trigger}
      content={content}
    />
  );
}
