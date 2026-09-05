'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { productApi } from '@/lib/api';
import { ProductTranslation } from '@/types';

interface ProductLanguageManagerProps {
  productId: number;
  currentLanguage: string;
}

// 支援的語言列表
const SUPPORTED_LANGUAGES: Record<string, string> = {
  'zh-TW': '繁體中文',
  'en': 'English',
  'ja': '日本語',
  'zh-CN': '简体中文',
  'ko': '한국어',
};

export default function ProductLanguageManager({
  productId,
  currentLanguage,
}: ProductLanguageManagerProps) {
  const router = useRouter();
  const [translations, setTranslations] = useState<ProductTranslation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');

  // 載入翻譯列表
  const loadTranslations = async () => {
    try {
      setLoading(true);
      const response = await productApi.adminGetTranslations(productId);
      setTranslations(response.translations);
      setError(null);
    } catch (err: any) {
      setError(err.message || '載入翻譯失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTranslations();
  }, [productId]);

  // 新增翻譯版本
  const handleCreateTranslation = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await productApi.adminCreateTranslation(productId, {
        language: selectedLanguage,
      });

      // 創建成功後，導航到新產品的編輯頁面
      alert(`${SUPPORTED_LANGUAGES[selectedLanguage]} 版本已創建！即將跳轉到編輯頁面...`);
      router.push(`/admin/products/${response.product.id}/edit`);
    } catch (err: any) {
      alert(err.message || '創建翻譯失敗');
    }
  };

  // 切換到指定語言版本的產品編輯頁面
  const handleSwitchToTranslation = (translationId: number) => {
    router.push(`/admin/products/${translationId}/edit`);
  };

  // 獲取已使用的語言
  const usedLanguages = [currentLanguage, ...translations.map((t) => t.language)];
  const availableLanguages = Object.entries(SUPPORTED_LANGUAGES).filter(
    ([code]) => !usedLanguages.includes(code)
  );

  if (loading) {
    return <div className="text-center py-4">載入中...</div>;
  }

  if (error) {
    return <div className="text-red-600 py-4">錯誤: {error}</div>;
  }

  return (
    <div className="product-language-manager">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">多語言版本管理</h3>
        {availableLanguages.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {showAddForm ? '取消新增' : '新增語言版本'}
          </button>
        )}
      </div>

      {/* 當前語言 */}
      <div className="mb-4 p-4 border-2 border-blue-500 rounded bg-blue-50">
        <div className="flex justify-between items-center">
          <div>
            <div className="font-semibold text-blue-700">
              當前編輯語言: {SUPPORTED_LANGUAGES[currentLanguage]}
            </div>
            <div className="text-sm text-gray-600">產品 ID: {productId}</div>
          </div>
          <div className="px-3 py-1 bg-blue-600 text-white rounded text-sm">當前</div>
        </div>
      </div>

      {/* 新增語言版本表單 */}
      {showAddForm && availableLanguages.length > 0 && (
        <form onSubmit={handleCreateTranslation} className="mb-6 p-4 border rounded bg-gray-50">
          <h4 className="font-semibold mb-3">新增語言版本</h4>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">選擇語言</label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              required
            >
              {availableLanguages.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm text-gray-600">
              將創建一個新的 {SUPPORTED_LANGUAGES[selectedLanguage]} 版本產品，並複製當前產品的基本資訊。
            </p>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
              確認新增
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
            >
              取消
            </button>
          </div>
        </form>
      )}

      {/* 翻譯版本列表 */}
      <div>
        <h4 className="font-semibold mb-3">其他語言版本</h4>
        {translations.length === 0 ? (
          <p className="text-gray-500">尚未建立其他語言版本</p>
        ) : (
          <div className="space-y-2">
            {translations.map((translation) => (
              <div key={translation.id} className="p-4 border rounded bg-white hover:bg-gray-50">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold">{SUPPORTED_LANGUAGES[translation.language]}</div>
                    <div className="text-sm text-gray-600">產品 ID: {translation.id}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      名稱: {translation.name || '(未設定)'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSwitchToTranslation(translation.id)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    編輯此版本
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 提示訊息 */}
      {availableLanguages.length === 0 && translations.length > 0 && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
          <p className="text-sm text-green-800">
            ✓ 已建立所有支援語言的版本
          </p>
        </div>
      )}
    </div>
  );
}
