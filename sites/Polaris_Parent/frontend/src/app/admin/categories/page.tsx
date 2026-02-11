'use client';

import { useState, useEffect } from 'react';
import { categoryApi, tagApi } from '@/lib/api';
import { Category, Tag } from '@/types';
import AdminLayout from '@/components/admin/AdminLayout';
import { AdminListLayout, AdminEmptyState } from '@/components/admin/shared';
import { CategoryTagSidebar, CategoryTagForm } from './_components';
import { LayoutGrid } from 'lucide-react';

interface I18nSettings {
  enabled: boolean;
  default_language: string;
  languages: string[];
  language_names: Record<string, string>;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'categories' | 'tags'>('categories');
  const [i18nSettings, setI18nSettings] = useState<I18nSettings | null>(null);
  const [tagSearch, setTagSearch] = useState('');

  // Selection state
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);

  // Category form
  const [categoryForm, setCategoryForm] = useState({
    code: '',
    slugs: {} as Record<string, string>,
    parent_id: undefined as number | undefined,
    sort_order: 0,
  });
  const [categoryEditing, setCategoryEditing] = useState<number | null>(null);

  // Tag form
  const [tagForm, setTagForm] = useState({
    code: '',
    slugs: {} as Record<string, string>,
  });
  const [tagEditing, setTagEditing] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
    fetchI18nSettings();
  }, []);

  // Reset selection when switching tabs
  useEffect(() => {
    setSelectedId(null);
    setIsCreateMode(false);
    resetCategoryForm();
    resetTagForm();
  }, [activeTab]);

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
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [categoriesRes, tagsRes] = await Promise.all([
        categoryApi.getList(),
        tagApi.getList(),
      ]);
      setCategories(categoriesRes);
      setTags(tagsRes);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ---- Category operations ----

  const resetCategoryForm = () => {
    setCategoryForm({ code: '', slugs: {}, parent_id: undefined, sort_order: 0 });
    setCategoryEditing(null);
  };

  const handleSelectItem = (id: number) => {
    setSelectedId(id);
    setIsCreateMode(false);

    if (activeTab === 'categories') {
      const cat = categories.find(c => c.id === id);
      if (cat) {
        setCategoryForm({
          code: cat.code,
          slugs: cat.slugs || {},
          parent_id: cat.parent_id,
          sort_order: cat.sort_order,
        });
        setCategoryEditing(cat.id);
      }
    } else {
      const tag = tags.find(t => t.id === id);
      if (tag) {
        setTagForm({ code: tag.code, slugs: tag.slugs || {} });
        setTagEditing(tag.id);
      }
    }
  };

  const handleCreate = () => {
    setSelectedId(null);
    setIsCreateMode(true);
    if (activeTab === 'categories') {
      resetCategoryForm();
    } else {
      resetTagForm();
    }
  };

  const handleCancel = () => {
    setSelectedId(null);
    setIsCreateMode(false);
    resetCategoryForm();
    resetTagForm();
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.code.trim()) {
      alert('請輸入分類代碼');
      return;
    }
    try {
      const submitData = {
        code: categoryForm.code,
        slugs: categoryForm.slugs,
        parent_id: categoryForm.parent_id,
        sort_order: categoryForm.sort_order,
      };
      if (categoryEditing) {
        await categoryApi.update(categoryEditing, submitData);
        alert('分類更新成功');
      } else {
        const result = await categoryApi.create(submitData);
        alert('分類創建成功');
        // Select the newly created category
        if (result.id) {
          setSelectedId(result.id);
          setIsCreateMode(false);
        }
      }
      fetchData();
      if (categoryEditing) {
        // Stay on the item after update
      } else {
        resetCategoryForm();
      }
    } catch (error: any) {
      alert(error.message || '操作失敗，請稍後再試');
    }
  };

  const handleDeleteItem = async (id: number) => {
    const label = activeTab === 'categories' ? '分類' : '標籤';
    const msg = activeTab === 'categories'
      ? '確定要刪除這個分類嗎？關聯的文章將變為未分類。'
      : '確定要刪除這個標籤嗎？關聯的文章將移除此標籤。';

    if (!confirm(msg)) return;
    try {
      if (activeTab === 'categories') {
        await categoryApi.delete(id);
      } else {
        await tagApi.delete(id);
      }
      alert(`${label}刪除成功`);
      fetchData();
      if (selectedId === id) {
        setSelectedId(null);
        setIsCreateMode(false);
        resetCategoryForm();
        resetTagForm();
      }
    } catch (error) {
      alert('刪除失敗，請稍後再試');
    }
  };

  // ---- Tag operations ----

  const resetTagForm = () => {
    setTagForm({ code: '', slugs: {} });
    setTagEditing(null);
  };

  const handleTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagForm.code.trim()) {
      alert('請輸入標籤代碼');
      return;
    }
    try {
      const submitData = { code: tagForm.code, slugs: tagForm.slugs };
      if (tagEditing) {
        await tagApi.update(tagEditing, submitData);
        alert('標籤更新成功');
      } else {
        const result = await tagApi.create(submitData);
        alert('標籤創建成功');
        if (result.id) {
          setSelectedId(result.id);
          setIsCreateMode(false);
        }
      }
      fetchData();
      if (!tagEditing) {
        resetTagForm();
      }
    } catch (error: any) {
      alert(error.message || '操作失敗，請稍後再試');
    }
  };

  // ---- Render ----

  const showForm = isCreateMode || selectedId !== null;
  const isEditing = selectedId !== null;

  return (
    <AdminLayout>
      <AdminListLayout
        sidebarWidth={260}
        sidebar={
          <CategoryTagSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            categories={categories}
            tags={tags}
            loading={loading}
            selectedId={selectedId}
            isCreateMode={isCreateMode}
            tagSearch={tagSearch}
            onTagSearchChange={setTagSearch}
            onSelect={handleSelectItem}
            onCreate={handleCreate}
            onDelete={handleDeleteItem}
          />
        }
      >
        {showForm ? (
          activeTab === 'categories' ? (
            <CategoryTagForm
              key={categoryEditing ? `edit-cat-${categoryEditing}` : 'new-cat'}
              type="categories"
              isEditing={isEditing}
              code={categoryForm.code}
              slugs={categoryForm.slugs}
              parentId={categoryForm.parent_id}
              sortOrder={categoryForm.sort_order}
              categories={categories.filter(c => c.id !== categoryEditing)}
              i18nSettings={i18nSettings}
              onCodeChange={(v) => setCategoryForm(prev => ({ ...prev, code: v }))}
              onSlugChange={(lang, v) => setCategoryForm(prev => ({ ...prev, slugs: { ...prev.slugs, [lang]: v } }))}
              onParentIdChange={(v) => setCategoryForm(prev => ({ ...prev, parent_id: v }))}
              onSortOrderChange={(v) => setCategoryForm(prev => ({ ...prev, sort_order: v }))}
              onSubmit={handleCategorySubmit}
              onCancel={handleCancel}
            />
          ) : (
            <CategoryTagForm
              key={tagEditing ? `edit-tag-${tagEditing}` : 'new-tag'}
              type="tags"
              isEditing={isEditing}
              code={tagForm.code}
              slugs={tagForm.slugs}
              i18nSettings={i18nSettings}
              onCodeChange={(v) => setTagForm(prev => ({ ...prev, code: v }))}
              onSlugChange={(lang, v) => setTagForm(prev => ({ ...prev, slugs: { ...prev.slugs, [lang]: v } }))}
              onSubmit={handleTagSubmit}
              onCancel={handleCancel}
            />
          )
        ) : (
          <div className="flex items-center justify-center h-full">
            <AdminEmptyState
              icon={<LayoutGrid size={48} className="text-gray-300" />}
              title={`選擇${activeTab === 'categories' ? '分類' : '標籤'}開始編輯`}
              description={`從左側選擇一個項目，或點擊「新增${activeTab === 'categories' ? '分類' : '標籤'}」建立新項目`}
            />
          </div>
        )}
      </AdminListLayout>
    </AdminLayout>
  );
}
