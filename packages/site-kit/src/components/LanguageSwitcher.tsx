'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';

interface I18nSettings {
  enabled: boolean;
  default_language: string;
  languages: string[];
  language_names: Record<string, string>;
  // 訪客看得到的語言；languages 裡其餘的是「編輯中」，不出現在切換器（舊後端沒有這欄＝全部公開）
  public_languages?: string[];
}

/**
 * showUnpublished：持語言預覽通行證的人（站台自己判斷）也列出編輯中的語言，並標「未公開」。
 * 一般訪客只看到 public_languages。
 */
export default function LanguageSwitcher({ showUnpublished = false }: { showUnpublished?: boolean } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [i18nSettings, setI18nSettings] = useState<I18nSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentLocale, setCurrentLocale] = useState('zh-TW');

  // 從後端獲取 i18n 設定
  useEffect(() => {
    const fetchI18nSettings = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/settings/i18n`
        );
        if (response.ok) {
          const data = await response.json();
          setI18nSettings(data);
        }
      } catch (error) {
        console.error('Failed to fetch i18n settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchI18nSettings();
  }, []);

  // 從路徑中獲取當前語言
  useEffect(() => {
    if (i18nSettings) {
      const pathLocale = pathname.split('/')[1];
      if (i18nSettings.languages.includes(pathLocale)) {
        setCurrentLocale(pathLocale);
      } else {
        setCurrentLocale(i18nSettings.default_language);
      }
    }
  }, [pathname, i18nSettings]);

  const publicLanguages = i18nSettings?.public_languages ?? i18nSettings?.languages ?? [];
  const availableLanguages = showUnpublished ? i18nSettings?.languages ?? [] : publicLanguages;

  // 多語言功能關閉、載入中、或只有一種公開語言時，不顯示切換器
  if (isLoading || !i18nSettings?.enabled || availableLanguages.length < 2) {
    return null;
  }

  const handleLocaleChange = (newLocale: string) => {
    // 移除當前語言前綴（如果有的話）
    let newPath = pathname;

    // 檢查路徑是否以語言代碼開頭
    for (const loc of i18nSettings.languages) {
      if (pathname.startsWith(`/${loc}/`) || pathname === `/${loc}`) {
        newPath = pathname.replace(`/${loc}`, '') || '/';
        break;
      }
    }

    // 設置 cookie
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;

    // 如果新語言不是預設語言，添加語言前綴
    if (newLocale !== i18nSettings.default_language) {
      newPath = `/${newLocale}${newPath}`;
    }

    router.push(newPath);
    setIsOpen(false);
  };

  const languageNames = i18nSettings.language_names;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors"
        aria-label="切換語言"
      >
        <Globe className="w-4 h-4" />
        <span>{languageNames[currentLocale] || currentLocale}</span>
      </button>

      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* 下拉選單 */}
          <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-20">
            <div className="py-1">
              {availableLanguages.map((lang) => (
                <button
                  key={lang}
                  onClick={() => handleLocaleChange(lang)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    currentLocale === lang
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {languageNames[lang] || lang}
                  {!publicLanguages.includes(lang) && <span className="ml-1.5 text-[11px] text-amber-700">未公開</span>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
