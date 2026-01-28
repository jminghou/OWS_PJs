'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MoreVertical } from 'lucide-react';
import { contentApi, categoryApi, tagApi, i18nApi } from '@/lib/api';
import { Category } from '@/types';
import AdminLayout from '@/components/admin/AdminLayout';
import Button from '@/components/ui/Button';
import Popover from '@/components/ui/Popover';
import TiptapEditor from '@/components/admin/TiptapEditor';
import NotionTitleInput from '@/components/admin/NotionTitleInput';
import ArticleSettingsPanel from '@/components/admin/ArticleSettingsPanel';

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
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[\u4e00-\u9fff]/g, (match) => encodeURIComponent(match))
      .replace(/[^\w\-]/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleTitleChange = (title: string) => {
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

  const handleSaveDraft = async () => {
    setSettingsOpen(false);
    await handleSubmit(new Event('submit') as any, 'draft');
  };

  const handlePublish = async () => {
    setSettingsOpen(false);
    await handleSubmit(new Event('submit') as any, 'published');
  };

  return (
    <AdminLayout>
      <div className="h-full flex flex-col bg-white">
        {/* 頂部工具列 */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={18} className="mr-1" />
            返回
          </Button>

          <Popover
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            placement="bottom-end"
            trigger={
              <Button
                type="button"
                variant="ghost"
                className="text-gray-600 hover:text-gray-900 p-2"
              >
                <MoreVertical size={20} />
              </Button>
            }
            content={
              <ArticleSettingsPanel
                formData={formData}
                setFormData={setFormData}
                categories={categories}
                tagInput={tagInput}
                setTagInput={setTagInput}
                parseTagInput={parseTagInput}
                i18nSettings={i18nSettings}
                onSaveDraft={handleSaveDraft}
                onPublish={handlePublish}
                loading={loading}
                onClose={() => setSettingsOpen(false)}
              />
            }
          />
        </div>

        {/* 主編輯區 */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-8">
            {/* Notion 風格標題 */}
            <NotionTitleInput
              value={formData.title}
              onChange={handleTitleChange}
              placeholder="無標題"
            />

            {/* 編輯器 */}
            <div className="mt-4">
              <TiptapEditor
                content={formData.content}
                onChange={(content) => setFormData(prev => ({ ...prev, content }))}
              />
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
