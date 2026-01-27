'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';

interface I18nSettings {
  enabled: boolean;
  default_language: string;
  languages: string[];
  language_names: Record<string, string>;
}

export default function LanguageSwitcher() {
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

  // 如果多語言功能關閉或載入中，不顯示切換器
  if (isLoading || !i18nSettings?.enabled) {
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

  // 使用後端設定的語言列表和名稱
  const availableLanguages = i18nSettings.languages;
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
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
