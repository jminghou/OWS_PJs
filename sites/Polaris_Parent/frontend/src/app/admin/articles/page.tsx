'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { contentApi, categoryApi, tagApi, i18nApi } from '@/lib/api';
import { Content, Category, Tag, TranslationInfo } from '@/types';
import AdminLayout from '@/components/admin/AdminLayout';
import ArticleEditor, { ArticleFormData } from '@/components/admin/ArticleEditor';
import { AdminListLayout, AdminEmptyState } from '@/components/admin/shared';
import { ArticleSidebar } from './_components';
import { FileText } from 'lucide-react';

interface I18nSettings {
  enabled: boolean;
  default_language: string;
  languages: string[];
  language_names: Record<string, string>;
}

const emptyFormData: ArticleFormData = {
  title: '',
  content: '',
  summary: '',
  slug: '',
  status: 'draft',
  content_type: 'article',
  category_id: '',
  featured_image: '',
  cover_image: '',
  meta_title: '',
  meta_description: '',
  language: 'zh-TW',
  published_at: '',
};

function ArticlesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL-driven state
  const articleIdParam = searchParams.get('id');
  const isNewParam = searchParams.get('new');
  const selectedArticleId = articleIdParam ? parseInt(articleIdParam) : null;
  const isCreateMode = isNewParam === 'true';

  // List state
  const [articles, setArticles] = useState<Content[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listPagination, setListPagination] = useState<any>(null);
  const [listPage, setListPage] = useState(1);
  const [listFilters, setListFilters] = useState({ search: '', status: 'all' });

  // Editor state
  const [formData, setFormData] = useState<ArticleFormData>({ ...emptyFormData });
  const [categories, setCategories] = useState<Category[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [i18nSettings, setI18nSettings] = useState<I18nSettings | null>(null);
  const [isFeatured, setIsFeatured] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);

  // Edit mode extras
  const [originalId, setOriginalId] = useState<number | null>(null);
  const [translations, setTranslations] = useState<TranslationInfo[]>([]);

  // Dirty state tracking
  const cleanSnapshotRef = useRef<string>('');
  const [isDirty, setIsDirty] = useState(false);

  // Track current fetch to avoid race conditions
  const fetchIdRef = useRef(0);

  // Update dirty state when formData changes
  useEffect(() => {
    if (cleanSnapshotRef.current) {
      setIsDirty(JSON.stringify(formData) !== cleanSnapshotRef.current);
    }
  }, [formData]);

  // Warn on tab close if dirty
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Fetch categories and i18n settings on mount
  useEffect(() => {
    fetchCategories();
    fetchI18nSettings();
  }, []);

  // Fetch article list when page/filters change
  useEffect(() => {
    fetchArticles();
  }, [listPage, listFilters]);

  // Load article or reset form when URL changes
  useEffect(() => {
    if (selectedArticleId) {
      loadArticle(selectedArticleId);
    } else if (isCreateMode) {
      resetToCreateMode();
    }
  }, [selectedArticleId, isCreateMode]);

  // ---- Data fetching ----

  const fetchArticles = useCallback(async () => {
    try {
      setListLoading(true);
      const params: any = { page: listPage, per_page: 15 };
      if (listFilters.status !== 'all') params.status = listFilters.status;
      if (listFilters.search) params.search = listFilters.search;

      const response = await contentApi.getList(params);
      setArticles(response.contents);
      setListPagination(response.pagination);
    } catch (error) {
      console.error('Error fetching articles:', error);
    } finally {
      setListLoading(false);
    }
  }, [listPage, listFilters]);

  const fetchCategories = async () => {
    try {
      const response = await categoryApi.getList();
      setCategories(response);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchI18nSettings = async () => {
    try {
      const settings = await i18nApi.getSettings();
      setI18nSettings(settings);
    } catch (error) {
      console.error('Error fetching i18n settings:', error);
    }
  };

  const toLocalISOString = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      const offset = date.getTimezoneOffset() * 60000;
      const localDate = new Date(date.getTime() - offset);
      return localDate.toISOString().slice(0, 16);
    } catch {
      return '';
    }
  };

  const loadArticle = async (id: number) => {
    const currentFetchId = ++fetchIdRef.current;
    try {
      setEditorLoading(true);
      const post = await contentApi.getById(id);

      // Stale request check
      if (currentFetchId !== fetchIdRef.current) return;

      const loaded: ArticleFormData = {
        title: post.title || '',
        content: post.content || '',
        summary: post.summary || '',
        slug: post.slug || '',
        status: (post.status as 'draft' | 'published') || 'draft',
        content_type: 'article',
        category_id: post.category?.id?.toString() || '',
        featured_image: post.featured_image || '',
        cover_image: post.cover_image || '',
        meta_title: post.meta_title || '',
        meta_description: post.meta_description || '',
        language: post.language || 'zh-TW',
        published_at: toLocalISOString(post.published_at || ''),
      };

      setFormData(loaded);
      cleanSnapshotRef.current = JSON.stringify(loaded);
      setIsDirty(false);
      setOriginalId(post.original_id || null);
      setTranslations(post.translations || []);
      setIsFeatured(false);

      if (post.tags && post.tags.length > 0) {
        setTagInput(post.tags.map((t: Tag) => `#${t.name}`).join(' '));
      } else {
        setTagInput('');
      }
    } catch (error) {
      console.error('Error loading article:', error);
      alert('載入文章失敗');
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setEditorLoading(false);
      }
    }
  };

  const resetToCreateMode = () => {
    const defaultLang = i18nSettings?.default_language || 'zh-TW';
    const fresh = { ...emptyFormData, language: defaultLang };
    setFormData(fresh);
    cleanSnapshotRef.current = JSON.stringify(fresh);
    setIsDirty(false);
    setTagInput('');
    setIsFeatured(false);
    setOriginalId(null);
    setTranslations([]);
  };

  // ---- Actions ----

  const confirmIfDirty = (): boolean => {
    if (isDirty) {
      return confirm('有未儲存的變更，確定要離開嗎？');
    }
    return true;
  };

  const handleSelectArticle = (id: number) => {
    if (selectedArticleId === id) return;
    if (!confirmIfDirty()) return;
    router.push(`/admin/articles?id=${id}`);
  };

  const handleNewArticle = () => {
    if (isCreateMode) return;
    if (!confirmIfDirty()) return;
    router.push('/admin/articles?new=true');
  };

  const handleDeleteArticle = async (id: number) => {
    if (!confirm('確定要刪除這篇文章嗎？此操作無法復原。')) return;
    try {
      await contentApi.delete(id);
      fetchArticles();
      // If deleted article was selected, clear selection
      if (selectedArticleId === id) {
        router.push('/admin/articles');
      }
    } catch (error: any) {
      const msg = error.message || '刪除失敗';
      alert(`刪除失敗：${msg}`);
    }
  };

  const handleFilterChange = (newFilters: { search: string; status: string }) => {
    setListFilters(newFilters);
    setListPage(1);
  };

  const parseTagInput = (input: string): string[] => {
    const matches = input.match(/#[\w\u4e00-\u9fff]+/g) || [];
    return matches.map(tag => tag.slice(1).trim()).filter(tag => tag.length > 0);
  };

  const handleSave = async (overrideStatus?: 'draft' | 'published') => {
    if (!formData.title.trim()) {
      alert('請輸入標題');
      return;
    }

    try {
      setSaveLoading(true);
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
        published_at: publishedAtStr,
      };

      if (isCreateMode) {
        // Create
        const result = await contentApi.create(submitData);
        const successMsg = finalStatus === 'published' ? '文章發佈成功！' : '草稿儲存成功！';
        alert(successMsg);

        // Mark clean, refresh list, switch to edit the new article
        setIsDirty(false);
        cleanSnapshotRef.current = JSON.stringify(formData);
        fetchArticles();

        if (result.id) {
          router.push(`/admin/articles?id=${result.id}`);
        }
      } else if (selectedArticleId) {
        // Update
        const updateData = {
          ...submitData,
          language: formData.language,
          original_id: originalId,
        };
        await contentApi.update(selectedArticleId, updateData);
        const successMsg = finalStatus === 'published' ? '文章發佈成功！' : '草稿儲存成功！';
        alert(successMsg);

        // Mark clean and refresh list
        cleanSnapshotRef.current = JSON.stringify(formData);
        setIsDirty(false);
        fetchArticles();
      }
    } catch (error: any) {
      console.error('Error saving article:', error);
      alert(error.message || '儲存失敗，請稍後再試');
    } finally {
      setSaveLoading(false);
    }
  };

  // ---- Render ----

  const showEditor = isCreateMode || selectedArticleId !== null;
  const editorMode = isCreateMode ? 'create' : 'edit';
  const editorKey = isCreateMode ? 'new' : `edit-${selectedArticleId}`;

  return (
    <AdminLayout>
      <AdminListLayout
        sidebarWidth={300}
        sidebar={
          <ArticleSidebar
            articles={articles}
            loading={listLoading}
            selectedArticleId={selectedArticleId}
            isCreateMode={isCreateMode}
            pagination={listPagination}
            currentPage={listPage}
            filters={listFilters}
            onSelectArticle={handleSelectArticle}
            onNewArticle={handleNewArticle}
            onPageChange={setListPage}
            onFilterChange={handleFilterChange}
            onDeleteArticle={handleDeleteArticle}
          />
        }
      >
        {editorLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse space-y-4 w-full max-w-2xl px-6">
              <div className="h-8 bg-gray-200 rounded w-1/3" />
              <div className="h-6 bg-gray-200 rounded w-2/3" />
              <div className="h-64 bg-gray-100 rounded" />
            </div>
          </div>
        ) : showEditor ? (
          <ArticleEditor
            key={editorKey}
            mode={editorMode}
            formData={formData}
            setFormData={setFormData}
            categories={categories}
            tagInput={tagInput}
            setTagInput={setTagInput}
            parseTagInput={parseTagInput}
            i18nSettings={i18nSettings}
            isFeatured={isFeatured}
            setIsFeatured={setIsFeatured}
            loading={saveLoading}
            onSave={handleSave}
            articleId={selectedArticleId || undefined}
            translations={translations}
            onRefresh={selectedArticleId ? () => loadArticle(selectedArticleId) : undefined}
            embedded
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <AdminEmptyState
              icon={<FileText size={48} className="text-gray-300" />}
              title="選擇文章開始編輯"
              description="從左側選擇一篇文章，或點擊「新文章」建立新內容"
            />
          </div>
        )}
      </AdminListLayout>
    </AdminLayout>
  );
}

export default function ArticlesPage() {
  return (
    <Suspense fallback={<div className="p-6">載入中...</div>}>
      <ArticlesPageContent />
    </Suspense>
  );
}
