'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { contentApi, categoryApi, tagApi, i18nApi } from '@/lib/api';
import { Category } from '@/types';
import AdminLayout from '@/components/admin/AdminLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import TiptapEditor from '@/components/admin/TiptapEditor';
import LanguageManager from '@/components/admin/LanguageManager';

interface I18nSettings {
  enabled: boolean;
  default_language: string;
  languages: string[];
  language_names: Record<string, string>;
}

export default function NewArticlePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tagInput, setTagInput] = useState(''); // 標籤輸入框，格式：#ABC #EDF
  const [i18nSettings, setI18nSettings] = useState<I18nSettings | null>(null);
  
  // Tiptap 編輯器內容
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    summary: '',
    slug: '',
    status: 'draft' as 'draft' | 'published',
    content_type: 'article' as const,
    category_id: '',
    featured_image: '',
    cover_image: '',
    meta_title: '',
    meta_description: '',
    language: 'zh-TW', // 預設語言
    published_at: '' // 預約發布時間
  });

  useEffect(() => {
    fetchCategories();
    fetchI18nSettings();
  }, []);

  const fetchI18nSettings = async () => {
    try {
      const settings = await i18nApi.getSettings();
      setI18nSettings(settings);
      // 如果有預設語言，設定它
      if (settings.default_language) {
         setFormData(prev => ({ ...prev, language: settings.default_language }));
      }
    } catch (error) {
      console.error('Error fetching i18n settings:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await categoryApi.getList();
      setCategories(response);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // 解析標籤輸入字串，提取標籤名稱
  const parseTagInput = (input: string): string[] => {
    // 匹配 # 開頭的標籤，支援 #ABC 或 #ABC123 格式
    const matches = input.match(/#[\w\u4e00-\u9fff]+/g) || [];
    return matches.map(tag => tag.slice(1).trim()).filter(tag => tag.length > 0);
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[\u4e00-\u9fff]/g, (match) => encodeURIComponent(match))
      .replace(/[^\w\-]/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setFormData(prev => ({
      ...prev,
      title,
      slug: generateSlug(title),
      meta_title: title
    }));
  };

  const handleSubmit = async (e: React.FormEvent, overrideStatus?: 'draft' | 'published') => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('請輸入標題');
      return;
    }

    if (!formData.content.trim()) {
      alert('請輸入文章內容');
      return;
    }

    try {
      setLoading(true);

      // 使用 overrideStatus 參數或 formData.status
      const finalStatus = overrideStatus || formData.status;

      // 解析標籤輸入並透過 API 查找或建立標籤
      const tagNames = parseTagInput(tagInput);
      console.log('DEBUG: tagInput =', tagInput);
      console.log('DEBUG: parsed tagNames =', tagNames);
      let tagIds: number[] = [];

      if (tagNames.length > 0) {
        console.log('DEBUG: calling findOrCreate with:', tagNames);
        const tagResult = await tagApi.findOrCreate(tagNames);
        console.log('DEBUG: findOrCreate result =', tagResult);
        tagIds = tagResult.tag_ids;
      }

      // 處理發布時間 - 直接發送台灣時間給後端，後端會自動處理時區轉換
      let publishedAtStr = undefined;
      if (formData.published_at) {
        // datetime-local 的值格式為 "YYYY-MM-DDThh:mm"
        // 加上秒數，成為完整的 ISO 格式（不含時區，後端會當作台灣時間處理）
        publishedAtStr = formData.published_at + ':00';
        console.log('發送給後端的台灣時間:', publishedAtStr);
      }

      const submitData = {
        ...formData,
        status: finalStatus,
        category_id: formData.category_id ? parseInt(formData.category_id) : undefined,
        tag_ids: tagIds,
        published_at: publishedAtStr
      };

      console.log('DEBUG: Submitting article data with tag_ids:', tagIds);
      console.log('DEBUG: Full submitData:', submitData);

      await contentApi.create(submitData);

      const successMessage = finalStatus === 'published' ? '文章發布成功！' : '草稿儲存成功！';
      alert(successMessage);
      router.push('/admin/posts');
    } catch (error: any) {
      console.error('Error creating article:', error.message || error);

      const errorMessage = error.message || '創建失敗，請稍後再試';
      alert(`創建失敗：${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    await handleSubmit(new Event('submit') as any, 'draft');
  };

  const handlePublish = async () => {
    await handleSubmit(new Event('submit') as any, 'published');
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">新增一般文章</h1>
              <p className="text-gray-600">創建新的親紫專欄文章</p>
            </div>
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                取消
              </Button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 主要內容 */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>基本資訊</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      標題 *
                    </label>
                    <Input
                      value={formData.title}
                      onChange={handleTitleChange}
                      placeholder="輸入文章標題"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      網址別名 (Slug)
                    </label>
                    <Input
                      value={formData.slug}
                      onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                      placeholder="url-friendly-name"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      用於網址中，會自動根據標題生成
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      摘要
                    </label>
                    <textarea
                      value={formData.summary}
                      onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent"
                      rows={3}
                      placeholder="簡短描述文章內容..."
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>文章內容</CardTitle>
                </CardHeader>
                <CardContent>
                  <TiptapEditor
                    content={formData.content}
                    onChange={(content) => setFormData(prev => ({ ...prev, content }))}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    支援豐富文字編輯，圖片可直接貼上網址或未來擴充上傳功能。
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>SEO 設定</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SEO 標題
                    </label>
                    <Input
                      value={formData.meta_title}
                      onChange={(e) => setFormData(prev => ({ ...prev, meta_title: e.target.value }))}
                      placeholder="搜尋引擎顯示的標題"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SEO 描述
                    </label>
                    <textarea
                      value={formData.meta_description}
                      onChange={(e) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent"
                      rows={3}
                      placeholder="搜尋引擎顯示的描述..."
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 側邊欄 */}
            <div className="space-y-6">
              {/* 多語言管理元件 */}
              {i18nSettings?.enabled && (
                <LanguageManager
                  mode="create"
                  currentLanguage={formData.language}
                  i18nSettings={i18nSettings}
                  onLanguageChange={(lang) => setFormData(prev => ({ ...prev, language: lang }))}
                />
              )}

              <Card>
                <CardHeader>
                  <CardTitle>發布設定</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      分類
                    </label>
                    <select
                      value={formData.category_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent"
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      封面圖片 URL (1:1)
                    </label>
                    <Input
                      value={formData.cover_image}
                      onChange={(e) => setFormData(prev => ({ ...prev, cover_image: e.target.value }))}
                      placeholder="https://example.com/cover.jpg"
                    />
                    <p className="text-xs text-blue-500 mt-1">
                      用於首頁和列表頁縮圖，建議比例 1:1 (如：1000×1000px)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      精選圖片 URL (16:9)
                    </label>
                    <Input
                      value={formData.featured_image}
                      onChange={(e) => setFormData(prev => ({ ...prev, featured_image: e.target.value }))}
                      placeholder="https://example.com/image.jpg"
                    />
                    <p className="text-xs text-blue-500 mt-1">
                      用於文章內文顯示，建議比例 16:9 (如：1200×675px)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      預約發布時間（台灣時間）
                    </label>
                    <Input
                      type="datetime-local"
                      value={formData.published_at}
                      onChange={(e) => setFormData(prev => ({ ...prev, published_at: e.target.value }))}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      設定文章的發布時間（使用台灣時區 UTC+8）。若設定未來時間，文章將在該時間到達後才會在前端顯示。
                    </p>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSaveDraft}
                      disabled={loading}
                      className="flex-1"
                    >
                      {loading ? '儲存中...' : '儲存草稿'}
                    </Button>
                    <Button
                      type="button"
                      onClick={handlePublish}
                      disabled={loading}
                      className="flex-1"
                    >
                      {loading ? '發布中...' : '立即發布'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>標籤</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 標籤輸入框 */}
                  <div>
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="#ABC #EDF #GHI"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      使用 # 開頭輸入標籤，用空格分隔多個標籤
                    </p>
                  </div>

                  {/* 標籤預覽 */}
                  {parseTagInput(tagInput).length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        標籤預覽
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {parseTagInput(tagInput).map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}