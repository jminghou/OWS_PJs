import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { contentApi } from '@/lib/api';
import { TranslationInfo } from '@/types';
import { SUPPORTED_LANGUAGES } from '@/lib/constants';
import Button from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

interface I18nSettings {
  enabled: boolean;
  default_language: string;
  languages: string[];
  language_names: Record<string, string>;
}

interface LanguageManagerProps {
  mode: 'create' | 'edit';
  currentLanguage: string;
  articleId?: number; // Required for 'edit' mode
  translations?: TranslationInfo[];
  i18nSettings: I18nSettings;
  onLanguageChange?: (lang: string) => void; // For 'create' mode switching
  onRefresh?: () => void; // To reload data after changes
  formData?: any; // For cloning data when creating new translation
}

export default function LanguageManager({
  mode,
  currentLanguage,
  articleId,
  translations = [],
  i18nSettings,
  onLanguageChange,
  onRefresh,
  formData
}: LanguageManagerProps) {
  const router = useRouter();
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  // Sort languages based on SUPPORTED_LANGUAGES order
  // Filter only enabled languages from settings
  const sortedLanguages = SUPPORTED_LANGUAGES
    .filter(lang => i18nSettings.languages.includes(lang.code))
    .map(lang => lang.code);

  // Also include any languages that are in settings but not in SUPPORTED_LANGUAGES (just in case)
  const otherLanguages = i18nSettings.languages.filter(
    code => !SUPPORTED_LANGUAGES.some(sl => sl.code === code)
  );

  const displayLanguages = [...sortedLanguages, ...otherLanguages];

  // Helper to check if a language exists in translations
  const getTranslation = (langCode: string) => {
    return translations.find(t => t.language === langCode);
  };

  const handleAction = async (langCode: string, action: 'create' | 'publish' | 'delete') => {
    setLoadingMap(prev => ({ ...prev, [langCode]: true }));
    try {
      if (action === 'create' && articleId && formData) {
        // Create new translation
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
          original_id: articleId // Link to current article
        };

        const newPost = await contentApi.create(translationData);
        alert(`已建立 ${i18nSettings.language_names[langCode]} 版本！`);
        // Refresh to update the list
        if (onRefresh) onRefresh();
      } else if (action === 'publish') {
        const trans = getTranslation(langCode);
        if (trans) {
            // Need to fetch full content to get status first? 
            // Or just blindly set to published? User asked for "Publish immediately".
            await contentApi.update(trans.id, { status: 'published' });
            alert(`${i18nSettings.language_names[langCode]} 版本已發佈！`);
            if (onRefresh) onRefresh();
        }
      } else if (action === 'delete') {
        const trans = getTranslation(langCode);
        if (trans) {
          if (confirm(`確定要刪除 ${i18nSettings.language_names[langCode]} 版本嗎？此動作無法復原。`)) {
            await contentApi.delete(trans.id);
            alert(`${i18nSettings.language_names[langCode]} 版本已刪除！`);
            if (onRefresh) onRefresh();
          }
        }
      }
    } catch (error: any) {
      console.error(`Error performing ${action} on ${langCode}:`, error);
      alert(`操作失敗：${error.message || '未知錯誤'}`);
    } finally {
      setLoadingMap(prev => ({ ...prev, [langCode]: false }));
    }
  };

  const navigateToEdit = (id: number) => {
    router.push(`/admin/editor/${id}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>多語言管理</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2">
          {displayLanguages.map((langCode) => {
            const isCurrent = langCode === currentLanguage;
            const translation = getTranslation(langCode);
            const exists = !!translation;
            const isLoading = loadingMap[langCode];
            const langName = i18nSettings.language_names[langCode] || langCode;

            return (
              <div 
                key={langCode} 
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  isCurrent ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-700">{langName}</span>
                    {isCurrent && <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">當前編輯</span>}
                </div>

                <div className="flex items-center gap-1">
                  {mode === 'create' ? (
                    // Create Mode: Only allow switching main language
                    !isCurrent ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 px-2"
                            onClick={() => onLanguageChange && onLanguageChange(langCode)}
                        >
                            切換為此語系
                        </Button>
                    ) : (
                        <span className="text-xs text-gray-400">主要語言</span>
                    )
                  ) : (
                    // Edit Mode: Full controls
                    <>
                      {/* (+) Create Button */}
                      {!exists && !isCurrent && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 rounded-full text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => handleAction(langCode, 'create')}
                          disabled={isLoading}
                          title="新增此語系版本"
                        >
                          {isLoading ? '...' : '+'}
                        </Button>
                      )}

                      {/* Edit Button (Jump) */}
                      {(exists || isCurrent) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 rounded-full text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                          onClick={() => exists ? navigateToEdit(translation!.id) : null}
                          disabled={isCurrent || isLoading}
                          title={isCurrent ? "正在編輯" : "編輯此版本"}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        </Button>
                      )}

                      {/* Publish Button */}
                      {(exists || isCurrent) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 rounded-full text-gray-500 hover:text-green-600 hover:bg-green-50"
                          onClick={() => exists ? handleAction(langCode, 'publish') : null}
                          disabled={isCurrent || isLoading} // Can't fast-publish current doc from side bar (use main form)
                          title="立即發佈"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </Button>
                      )}

                      {/* (X) Delete Button */}
                      {(exists) && !isCurrent && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleAction(langCode, 'delete')}
                          disabled={isLoading}
                          title="刪除此版本"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {mode === 'create' && (
            <p className="text-xs text-gray-500">
                請先儲存當前語言版本，即可新增其他語言的翻譯。
            </p>
        )}
      </CardContent>
    </Card>
  );
}

