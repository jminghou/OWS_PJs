'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { contentApi, categoryApi, tagApi, i18nApi } from '@/lib/api';
import { Category, Tag, TranslationInfo } from '@/types';
import ArticleEditor, { ArticleFormData } from '@/components/admin/ArticleEditor';

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
  const [existingTags, setExistingTags] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);

  // 多語言相關狀態
  const [i18nSettings, setI18nSettings] = useState<I18nSettings | null>(null);
  const [originalId, setOriginalId] = useState<number | null>(null);
  const [translations, setTranslations] = useState<TranslationInfo[]>([]);

  const [formData, setFormData] = useState<ArticleFormData>({
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

      setOriginalId(post.original_id || null);

      if (post.translations && post.translations.length > 0) {
        setTranslations(post.translations);
      }

      if (post.tags && post.tags.length > 0) {
        setExistingTags(post.tags);
        // 將現有標籤轉換為 tagInput 格式以便在 ArticleSettingsPanel 中顯示
        const tagsString = post.tags.map((t: Tag) => `#${t.name}`).join(' ');
        setTagInput(tagsString);
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

  const parseTagInput = (input: string): string[] => {
    const matches = input.match(/#[\w\u4e00-\u9fff]+/g) || [];
    return matches.map(tag => tag.slice(1).trim()).filter(tag => tag.length > 0);
  };

  const handleSave = async (status?: 'draft' | 'published') => {
    if (!formData.title.trim()) {
      alert('請輸入標題');
      return;
    }

    try {
      setLoading(true);

      const finalStatus = status || formData.status;

      const tagNames = parseTagInput(tagInput);
      let tagIds: number[] = [];

      if (tagNames.length > 0) {
        const tagResult = await tagApi.findOrCreate(tagNames);
        tagIds = tagResult.tag_ids;
      }

      let publishedAtStr = undefined;
      if (formData.published_at) {
        publishedAtStr = formData.published_at + ':00';
      }

      const submitData = {
        ...formData,
        status: finalStatus,
        category_id: formData.category_id ? parseInt(formData.category_id) : undefined,
        tag_ids: tagIds,
        language: formData.language,
        original_id: originalId,
        published_at: publishedAtStr
      };

      await contentApi.update(postId, submitData);

      const successMessage = finalStatus === 'published' ? '文章發佈成功！' : '草稿儲存成功！';
      alert(successMessage);
      router.push('/admin/posts');
    } catch (error: any) {
      console.error('Error updating content:', error);
      alert(error.message || '更新失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <ArticleEditor
      mode="edit"
      formData={formData}
      setFormData={setFormData}
      categories={categories}
      tagInput={tagInput}
      setTagInput={setTagInput}
      parseTagInput={parseTagInput}
      i18nSettings={i18nSettings}
      isFeatured={isFeatured}
      setIsFeatured={setIsFeatured}
      loading={loading}
      onSave={handleSave}
      articleId={postId}
      translations={translations}
      onRefresh={fetchPost}
    />
  );
}
