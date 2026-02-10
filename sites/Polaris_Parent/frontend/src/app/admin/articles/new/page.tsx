'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { contentApi, categoryApi, tagApi, i18nApi } from '@/lib/api';
import { Category } from '@/types';
import ArticleEditor, { ArticleFormData } from '@/components/admin/ArticleEditor';

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
  const [tagInput, setTagInput] = useState('');
  const [i18nSettings, setI18nSettings] = useState<I18nSettings | null>(null);
  const [isFeatured, setIsFeatured] = useState(false);

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
    fetchCategories();
    fetchI18nSettings();
  }, []);

  const fetchI18nSettings = async () => {
    try {
      const settings = await i18nApi.getSettings();
      setI18nSettings(settings);
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

  const parseTagInput = (input: string): string[] => {
    const matches = input.match(/#[\w\u4e00-\u9fff]+/g) || [];
    return matches.map(tag => tag.slice(1).trim()).filter(tag => tag.length > 0);
  };

  const handleSubmit = async (overrideStatus?: 'draft' | 'published') => {
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

      const finalStatus = overrideStatus || formData.status;

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
        published_at: publishedAtStr
      };

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

  return (
    <ArticleEditor
      mode="create"
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
      onSave={handleSubmit}
    />
  );
}
