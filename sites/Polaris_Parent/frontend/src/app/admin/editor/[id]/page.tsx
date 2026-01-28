'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { contentApi, categoryApi, tagApi, i18nApi } from '@/lib/api';
import { Category, Tag, Content, TranslationInfo } from '@/types';
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

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams();
  const postId = parseInt(params.id as string);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [existingTags, setExistingTags] = useState<Tag[]>([]); // 現有標籤（可刪除的 chips）
  const [newTagInput, setNewTagInput] = useState(''); // 新增標籤輸入框

  // 多語言相關狀態
  const [i18nSettings, setI18nSettings] = useState<I18nSettings | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState('zh-TW');
  const [originalId, setOriginalId] = useState<number | null>(null);
  const [translations, setTranslations] = useState<TranslationInfo[]>([]);

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
    language: 'zh-TW',
    published_at: ''
  });

  useEffect(() => {
    if (postId) {
      fetchI18nSettings();
      fetchPost();
      fetchCategories();
    }
  }, [postId]);

  const fetchI18nSettings = async () => {
    try {
      const settings = await i18nApi.getSettings();
      setI18nSettings(settings);
    } catch (error) {
      console.error('Error fetching i18n settings:', error);
    }
  };

  // 輔助函式：將 UTC 時間轉為本地時間格式 (YYYY-MM-DDThh:mm) 給 input 使用
  const toLocalISOString = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      const offset = date.getTimezoneOffset() * 60000; // ms
      const localDate = new Date(date.getTime() - offset);
      return localDate.toISOString().slice(0, 16);
    } catch (e) {
      console.error('Error parsing date:', dateStr, e);
      return '';
    }
  };

  const fetchPost = async () => {
    try {
      setInitialLoading(true);
      const post = await contentApi.getById(postId);

      setFormData({
        title: post.title || '',
        content: post.content || '',
        summary: post.summary || '',
        slug: post.slug || '',
        status: post.status as 'draft' | 'published',
        content_type: 'article',
        category_id: post.category?.id?.toString() || '',
        featured_image: post.featured_image || '',
        cover_image: post.cover_image || '',
        meta_title: post.meta_title || '',
        meta_description: post.meta_description || '',
        language: post.language || 'zh-TW',
        published_at: toLocalISOString(post.published_at || '')
      });


      // 設定語言相關狀態
      setCurrentLanguage(post.language || 'zh-TW');
      setOriginalId(post.original_id || null);

      // 如果有翻譯關聯，載入相關翻譯
      if (post.translations && post.translations.length > 0) {
        setTranslations(post.translations);
      }

      // 設定現有標籤
      if (post.tags && post.tags.length > 0) {
        setExistingTags(post.tags);
      }
    } catch (error) {
      console.error('Error fetching post:', error);
      alert('載入文章失敗');
      router.push('/admin/posts');
    } finally {
      setInitialLoading(false);
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

  // 刪除現有標籤
  const handleRemoveExistingTag = (tagId: number) => {
    setExistingTags(prev => prev.filter(tag => tag.id !== tagId));
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
      meta_title: prev.meta_title || title
    }));
  };

  // 處理標籤並提交更新
  const processTagsAndSubmit = async (status: 'draft' | 'published') => {
    if (!formData.title.trim()) {
      alert('請輸入標題');
      return;
    }

    try {
      setLoading(true);

      // 收集現有標籤的 ID
      const existingTagIds = existingTags.map(tag => tag.id);

      // 解析新標籤輸入並透過 API 查找或建立標籤
      const newTagNames = parseTagInput(newTagInput);
      let newTagIds: number[] = [];

      if (newTagNames.length > 0) {
        const tagResult = await tagApi.findOrCreate(newTagNames);
        newTagIds = tagResult.tag_ids;
      }

      // 合併現有標籤 + 新標籤（去重）
      const allTagIds = [...new Set([...existingTagIds, ...newTagIds])];

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
        status,
        category_id: formData.category_id ? parseInt(formData.category_id) : undefined,
        tag_ids: allTagIds,
        language: formData.language,
        original_id: originalId,
        published_at: publishedAtStr
      };

      await contentApi.update(postId, submitData);

      const successMessage = status === 'published' ? '文章發佈成功！' : '草稿儲存成功！';
      alert(successMessage);
      router.push('/admin/posts');
    } catch (error: any) {
      console.error('Error updating content:', error);
      alert(error.message || '更新失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await processTagsAndSubmit(formData.status);
  };

  const handleSaveDraft = async () => {
    await processTagsAndSubmit('draft');
  };

  const handlePublish = async () => {
    await processTagsAndSubmit('published');
  };

  // 建立新語言版本的翻譯
  const handleCreateTranslation = async (targetLanguage: string) => {
    try {
      setLoading(true);

      // 建立新的翻譯版本，複製原文內容但設定不同語言
      // 處理發布時間 - 直接發送台灣時間給後端
      let publishedAtStr = undefined;
      if (formData.published_at) {
        publishedAtStr = formData.published_at + ':00';
      }

      const translationData = {
        title: `[${targetLanguage}] ${formData.title}`,
        content: formData.content,
        summary: formData.summary,
        slug: `${formData.slug}-${targetLanguage.toLowerCase()}`,
        status: 'draft' as const,
        content_type: 'article' as const,
        category_id: formData.category_id ? parseInt(formData.category_id) : undefined,
        featured_image: formData.featured_image,
        cover_image: formData.cover_image,
        meta_title: formData.meta_title,
        meta_description: formData.meta_description,
        language: targetLanguage,
        original_id: postId, // 關聯到當前文章作為原文
        published_at: publishedAtStr
      };

      const newPost = await contentApi.create(translationData);
      alert(`已建立 ${i18nSettings?.language_names[targetLanguage] || targetLanguage} 版本！`);
      router.push(`/admin/editor/${newPost.id}`);
    } catch (error: any) {
      console.error('Error creating translation:', error);
      alert(error.message || '建立翻譯版本失敗');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <AdminLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">編輯內容</h1>
              <p className="text-gray-600">修改現有的文章內容</p>
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
                      用於網址中，修改後舊連結可能失效
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
              {/* 多語言設定 - 只在 i18n 啟用時顯示 */}
              {i18nSettings?.enabled && (
                <LanguageManager
                  mode="edit"
                  currentLanguage={formData.language}
                  articleId={postId}
                  translations={translations}
                  i18nSettings={i18nSettings}
                  formData={formData}
                  onRefresh={fetchPost}
                />
              )}

              <Card>
                <CardHeader>
                  <CardTitle>發布設定</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      狀態
                    </label>
                    <div className="flex items-center space-x-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          formData.status === 'published'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {formData.status === 'published' ? '已發布' : '草稿'}
                      </span>
                    </div>
                  </div>

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
                      發布時間（台灣時間）
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
                      {loading ? '發布中...' : '立即發佈'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>標籤</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 現有標籤 - 可刪除的 chips */}
                  {existingTags.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        現有標籤
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {existingTags.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-brand-purple-100 text-brand-purple-800"
                          >
                            #{tag.slug || tag.name}
                            <button
                              type="button"
                              onClick={() => handleRemoveExistingTag(tag.id)}
                              className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-brand-purple-200 transition-colors"
                              title="移除標籤"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 新增標籤輸入框 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      新增標籤
                    </label>
                    <Input
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      placeholder="#ABC #EDF #GHI"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      使用 # 開頭輸入標籤，用空格分隔多個標籤
                    </p>
                  </div>

                  {/* 新增標籤預覽 */}
                  {parseTagInput(newTagInput).length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        即將新增
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {parseTagInput(newTagInput).map((tag, index) => (
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