'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { i18nApi } from '@/lib/api';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/constants';
import AdminLayout from '@/components/admin/AdminLayout';
import Button from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [activeLanguages, setActiveLanguages] = useState<string[]>([]);
  const [defaultLanguage, setDefaultLanguage] = useState(DEFAULT_LANGUAGE);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const settings = await i18nApi.getSettings();
      if (settings && settings.languages) {
        setActiveLanguages(settings.languages);
        setDefaultLanguage(settings.default_language || DEFAULT_LANGUAGE);
      } else {
        // 如果 API 返回空或錯誤，預設只啟用繁中和英文（或全部啟用，視需求而定）
        // 根據使用者需求，預設啟用：繁中、簡中、英、西、日
        // 預設關閉：法、挪威、越南
        const defaultActive = ['zh-TW', 'zh-CN', 'en', 'es', 'ja'];
        setActiveLanguages(defaultActive);
        
        // 嘗試初始化後端設定
        // 注意：這可能需要後端支援批量更新，或是我們在這裡逐一呼叫 API
        // 由於我們不能確定後端狀態，這裡主要只設定前端顯示狀態，並在儲存時同步
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      // Fallback defaults
      setActiveLanguages(['zh-TW', 'en']);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLanguage = (langCode: string) => {
    // 防止取消選取預設語言
    if (langCode === defaultLanguage) {
      alert('無法關閉預設語言');
      return;
    }

    setActiveLanguages(prev => {
      if (prev.includes(langCode)) {
        return prev.filter(c => c !== langCode);
      } else {
        return [...prev, langCode];
      }
    });
  };

  const handleSetDefault = (langCode: string) => {
    if (!activeLanguages.includes(langCode)) {
      setActiveLanguages(prev => [...prev, langCode]);
    }
    setDefaultLanguage(langCode);
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      // 這裡的邏輯取決於後端 API 如何運作
      // 假設 i18nApi.updateSettings 接受完整的語言列表
      // 如果後端只能透過 add/remove API 操作，我們需要計算差異
      // 為了簡化，我們先嘗試更新設定物件。如果後端需要逐個 add/remove，這裡需要修改。
      
      // 根據 api.ts 的定義: updateSettings: async (data: I18nSettings)
      
      const languageNames: Record<string, string> = {};
      SUPPORTED_LANGUAGES.forEach(lang => {
        if (activeLanguages.includes(lang.code)) {
          languageNames[lang.code] = lang.name;
        }
      });

      await i18nApi.updateSettings({
        enabled: true,
        default_language: defaultLanguage,
        languages: activeLanguages,
        language_names: languageNames
      });

      alert('設定已儲存');
      
      // 因為修改了語言設定，可能需要重新整理頁面或通知其他元件
      router.refresh();
      
    } catch (error: any) {
      console.error('Error saving settings:', error);
      
      // 如果 updateSettings 失敗（可能是後端沒實作完整覆蓋），嘗試使用 add/remove
      // 這是一個 fallback 策略
      try {
        const currentSettings = await i18nApi.getSettings();
        const currentActive = currentSettings.languages || [];

        // 找出需要移除的
        const toRemove = currentActive.filter(l => !activeLanguages.includes(l));
        for (const code of toRemove) {
          await i18nApi.removeLanguage(code);
        }

        // 找出需要新增的
        const toAdd = activeLanguages.filter(l => !currentActive.includes(l));
        for (const code of toAdd) {
           const langDef = SUPPORTED_LANGUAGES.find(l => l.code === code);
           if (langDef) {
             await i18nApi.addLanguage(code, langDef.name);
           }
        }
        
        alert('設定已儲存 (透過逐項更新)');
        router.refresh();

      } catch (retryError: any) {
        alert(`儲存失敗：${error.message || '未知錯誤'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">系統設定</h1>
          <p className="text-gray-600">管理網站的全域設定</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>多語言設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200 mb-4">
                <p className="text-sm text-yellow-800">
                  在此選擇要在前台顯示和後台編輯的語言。關閉語言不會刪除已存在的文章，但會隱藏相關的管理介面。
                </p>
              </div>

              <div className="space-y-4">
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const isActive = activeLanguages.includes(lang.code);
                  const isDefault = defaultLanguage === lang.code;

                  return (
                    <div 
                      key={lang.code} 
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        {/* Toggle Switch */}
                        <button
                          type="button"
                          onClick={() => handleToggleLanguage(lang.code)}
                          disabled={isDefault} // 預設語言不能關閉
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            isActive ? 'bg-blue-600' : 'bg-gray-200'
                          } ${isDefault ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              isActive ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            {lang.name}
                          </span>
                          <span className="text-xs text-gray-500">
                            {lang.code}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center">
                        {isDefault ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            預設語言
                          </span>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs text-gray-500 hover:text-blue-600"
                            onClick={() => handleSetDefault(lang.code)}
                          >
                            設為預設
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-gray-100">
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={loading}
                  className="w-full sm:w-auto"
                >
                  {loading ? '儲存中...' : '儲存變更'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}


