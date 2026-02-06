'use client';

import { useState, useEffect } from 'react';
import { categoryApi, tagApi } from '@/lib/api';
import { Category, Tag } from '@/types';
import AdminLayout from '@/components/admin/AdminLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Globe,
  Languages
} from 'lucide-react';

// i18n 設定介面
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

  // --- i18n 狀態 ---
  const [i18nSettings, setI18nSettings] = useState<I18nSettings | null>(null);
  // -----------------

  // --- 標籤管理專用狀態 ---
  const [tagSearch, setTagSearch] = useState('');
  const [tagPage, setTagPage] = useState(1);
  const [tagViewMode, setTagViewMode] = useState<'grid' | 'table'>('table');
  const TAGS_PER_PAGE = 20;
  // -----------------------

  // 分類表單
  const [categoryForm, setCategoryForm] = useState({
    code: '',
    slugs: {} as Record<string, string>,
    parent_id: undefined as number | undefined,
    sort_order: 0
  });
  const [categoryEditing, setCategoryEditing] = useState<number | null>(null);

  // 標籤表單
  const [tagForm, setTagForm] = useState({
    code: '',
    slugs: {} as Record<string, string>
  });
  const [tagEditing, setTagEditing] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
    fetchI18nSettings();
  }, []);

  // 當搜尋關鍵字改變時，重置頁碼
  useEffect(() => {
    setTagPage(1);
  }, [tagSearch]);

  // 獲取 i18n 設定
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
        tagApi.getList()
      ]);
      setCategories(categoriesRes);
      setTags(tagsRes);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 分類操作
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
        sort_order: categoryForm.sort_order
      };

      if (categoryEditing) {
        await categoryApi.update(categoryEditing, submitData);
        alert('分類更新成功');
      } else {
        await categoryApi.create(submitData);
        alert('分類創建成功');
      }

      resetCategoryForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving category:', error);
      alert(error.message || '操作失敗，請稍後再試');
    }
  };

  const resetCategoryForm = () => {
    setCategoryForm({
      code: '',
      slugs: {},
      parent_id: undefined,
      sort_order: 0
    });
    setCategoryEditing(null);
  };

  const editCategory = (category: Category) => {
    setCategoryForm({
      code: category.code,
      slugs: category.slugs || {},
      parent_id: category.parent_id,
      sort_order: category.sort_order
    });
    setCategoryEditing(category.id);
  };

  const deleteCategory = async (id: number) => {
    if (confirm('確定要刪除這個分類嗎？關聯的文章將變為未分類。')) {
      try {
        await categoryApi.delete(id);
        alert('分類刪除成功');
        fetchData();
      } catch (error) {
        console.error('Error deleting category:', error);
        alert('刪除失敗，請稍後再試');
      }
    }
  };

  // 標籤操作
  const handleTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tagForm.code.trim()) {
      alert('請輸入標籤代碼');
      return;
    }

    try {
      const submitData = {
        code: tagForm.code,
        slugs: tagForm.slugs
      };

      if (tagEditing) {
        await tagApi.update(tagEditing, submitData);
        alert('標籤更新成功');
      } else {
        await tagApi.create(submitData);
        alert('標籤創建成功');
      }

      resetTagForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving tag:', error);
      alert(error.message || '操作失敗，請稍後再試');
    }
  };

  const resetTagForm = () => {
    setTagForm({
      code: '',
      slugs: {}
    });
    setTagEditing(null);
  };

  const editTag = (tag: Tag) => {
    setTagForm({
      code: tag.code,
      slugs: tag.slugs || {}
    });
    setTagEditing(tag.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteTag = async (id: number) => {
    if (confirm('確定要刪除這個標籤嗎？關聯的文章將移除此標籤。')) {
      try {
        await tagApi.delete(id);
        alert('標籤刪除成功');
        fetchData();
      } catch (error) {
        console.error('Error deleting tag:', error);
        alert('刪除失敗，請稍後再試');
      }
    }
  };

  const cancelEdit = () => {
    resetCategoryForm();
    resetTagForm();
  };

  // --- 標籤過濾與分頁邏輯 ---
  const getFilteredTags = () => {
    return tags.filter(tag => {
      // 搜尋篩選 (搜尋 code 或任意 slug)
      const searchLower = tagSearch.toLowerCase();
      if (tag.code.toLowerCase().includes(searchLower)) return true;
      if (tag.slugs) {
        return Object.values(tag.slugs).some(slug => slug.toLowerCase().includes(searchLower));
      }
      return false;
    });
  };

  // --- 分類過濾邏輯 ---
  const filteredCategories = categories; // 目前沒有分類搜尋，直接顯示所有

  const filteredTags = getFilteredTags();
  const totalPages = Math.ceil(filteredTags.length / TAGS_PER_PAGE);
  const currentTags = filteredTags.slice(
    (tagPage - 1) * TAGS_PER_PAGE,
    tagPage * TAGS_PER_PAGE
  );

  // Helper to update slugs
  const updateCategorySlug = (lang: string, value: string) => {
    setCategoryForm(prev => ({
      ...prev,
      slugs: {
        ...prev.slugs,
        [lang]: value
      }
    }));
  };

  const updateTagSlug = (lang: string, value: string) => {
    setTagForm(prev => ({
      ...prev,
      slugs: {
        ...prev.slugs,
        [lang]: value
      }
    }));
  };

  // 獲取要顯示的語言列表 (預設語言 + 其他語言)
  const getDisplayLanguages = () => {
    if (!i18nSettings?.enabled) return ['zh-TW']; // Default fallback
    const langs = new Set([i18nSettings.default_language, ...i18nSettings.languages]);
    return Array.from(langs);
  };

  const displayLanguages = getDisplayLanguages();

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">分類標籤管理 (統一架構版)</h1>
            <p className="text-gray-600">管理文章的分類和標籤代碼及其多語言對照</p>
          </div>
        </div>

        {/* 分頁標籤切換 */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('categories')}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === 'categories'
                    ? 'border-brand-purple-500 text-brand-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                分類管理
              </button>
              <button
                onClick={() => setActiveTab('tags')}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === 'tags'
                    ? 'border-brand-purple-500 text-brand-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Filter className="w-4 h-4" />
                標籤管理
              </button>
            </nav>
          </div>
        </div>

        {activeTab === 'categories' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 分類表單 */}
            <div className="lg:col-span-1">
              <Card className="sticky top-6">
                <CardHeader>
                  <CardTitle>
                    {categoryEditing ? '編輯分類' : '新增分類'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCategorySubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        分類代碼 (Code) *
                      </label>
                      <Input
                        value={categoryForm.code}
                        onChange={(e) => setCategoryForm(prev => ({ ...prev, code: e.target.value }))}
                        placeholder="例如: 1POL"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">內部識別用的唯一代碼</p>
                    </div>

                    <div className="border-t pt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        <Globe className="w-4 h-4 inline mr-1" />
                        多語言顯示名稱 (Slug)
                      </label>
                      <div className="space-y-3">
                        {displayLanguages.map(lang => (
                          <div key={lang}>
                            <label className="block text-xs text-gray-500 mb-1">
                              {i18nSettings?.language_names[lang] || lang} ({lang})
                            </label>
                            <Input
                              value={categoryForm.slugs[lang] || ''}
                              onChange={(e) => updateCategorySlug(lang, e.target.value)}
                              placeholder={`輸入 ${lang} 的顯示名稱`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex space-x-2 pt-2">
                      <Button type="submit" className="flex-1">
                        {categoryEditing ? '更新分類' : '新增分類'}
                      </Button>
                      {categoryEditing && (
                        <Button type="button" variant="outline" onClick={cancelEdit}>
                          取消
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* 分類列表 */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>
                    分類列表
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      共 {filteredCategories.length} 個
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
                      ))}
                    </div>
                  ) : filteredCategories.length > 0 ? (
                    <div className="space-y-3">
                      {filteredCategories.map((category) => (
                        <div key={category.id} className="p-4 border border-gray-200 rounded-lg bg-white hover:shadow-sm transition-shadow">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  {category.code}
                                </span>
                              </div>
                              <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-600">
                                {Object.entries(category.slugs || {}).map(([lang, slug]) => (
                                  <div key={lang} className="flex items-center gap-1">
                                    <span className="text-xs bg-blue-50 text-blue-700 px-1 rounded">
                                      {lang}
                                    </span>
                                    <span className="truncate">{slug}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => editCategory(category)}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteCategory(category.id)}
                                className="hover:bg-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">還沒有任何分類</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 標籤表單 */}
            <div className="lg:col-span-1">
              <Card className="sticky top-6">
                <CardHeader>
                  <CardTitle>
                    {tagEditing ? '編輯標籤' : '新增標籤'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleTagSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        標籤代碼 (Code) *
                      </label>
                      <Input
                        value={tagForm.code}
                        onChange={(e) => setTagForm(prev => ({ ...prev, code: e.target.value }))}
                        placeholder="例如: HOT"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">內部識別用的唯一代碼</p>
                    </div>

                    <div className="border-t pt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        <Globe className="w-4 h-4 inline mr-1" />
                        多語言顯示名稱 (Slug)
                      </label>
                      <div className="space-y-3">
                        {displayLanguages.map(lang => (
                          <div key={lang}>
                            <label className="block text-xs text-gray-500 mb-1">
                              {i18nSettings?.language_names[lang] || lang} ({lang})
                            </label>
                            <Input
                              value={tagForm.slugs[lang] || ''}
                              onChange={(e) => updateTagSlug(lang, e.target.value)}
                              placeholder={`輸入 ${lang} 的顯示名稱`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex space-x-2 pt-2">
                      <Button type="submit" className="flex-1">
                        {tagEditing ? '更新標籤' : '新增標籤'}
                      </Button>
                      {tagEditing && (
                        <Button type="button" variant="outline" onClick={cancelEdit}>
                          取消
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* 標籤列表 */}
            <div className="lg:col-span-2">
              <Card className="min-h-[600px] flex flex-col">
                <CardHeader className="border-b pb-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <CardTitle>標籤列表</CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        共 {filteredTags.length} 個標籤
                        {tagSearch && ` (搜尋結果: ${filteredTags.length})`}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2 w-full md:w-auto">
                      <div className="relative flex-1 md:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-brand-purple-500 focus:border-brand-purple-500 sm:text-sm"
                          placeholder="搜尋代碼..."
                          value={tagSearch}
                          onChange={(e) => setTagSearch(e.target.value)}
                        />
                      </div>
                      
                      <div className="flex items-center border rounded-lg bg-gray-50 p-1">
                        <button
                          onClick={() => setTagViewMode('table')}
                          className={`p-1.5 rounded ${tagViewMode === 'table' ? 'bg-white shadow-sm text-brand-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                          title="列表視圖"
                        >
                          <ListIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setTagViewMode('grid')}
                          className={`p-1.5 rounded ${tagViewMode === 'grid' ? 'bg-white shadow-sm text-brand-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                          title="網格視圖"
                        >
                          <LayoutGrid className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1 p-0">
                  {loading ? (
                    <div className="p-6 space-y-4">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-12 bg-gray-100 rounded animate-pulse"></div>
                      ))}
                    </div>
                  ) : filteredTags.length > 0 ? (
                    <div className="flex flex-col h-full">
                      <div className="flex-1 overflow-auto">
                        {tagViewMode === 'table' ? (
                          <div className="min-w-full align-middle">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    代碼 (Code)
                                  </th>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    多語言別名 (Slugs)
                                  </th>
                                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    操作
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {currentTags.map((tag) => (
                                  <tr key={tag.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <span className="text-sm font-medium text-gray-900">{tag.code}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                      <div className="flex flex-wrap gap-2">
                                        {Object.entries(tag.slugs || {}).map(([lang, slug]) => (
                                          <span key={lang} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                            <span className="text-gray-500 mr-1">{lang}:</span>
                                            {slug}
                                          </span>
                                        ))}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                      <div className="flex items-center justify-end space-x-1">
                                        <button
                                          onClick={() => editTag(tag)}
                                          className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => deleteTag(tag.id)}
                                          className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="p-6 flex flex-wrap gap-3">
                            {currentTags.map((tag) => (
                              <div
                                key={tag.id}
                                className="group relative inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:border-brand-purple-300 hover:shadow-sm transition-all"
                              >
                                <span className="text-sm font-medium text-gray-700">{tag.code}</span>
                                <div className="hidden group-hover:flex absolute -top-2 -right-2 bg-white shadow-md border rounded-full overflow-hidden">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); editTag(tag); }}
                                    className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); deleteTag(tag.id); }}
                                    className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 分頁控制 */}
                      {totalPages > 1 && (
                        <div className="border-t px-4 py-3 flex items-center justify-between sm:px-6 bg-gray-50 rounded-b-lg">
                          <div className="flex-1 flex justify-between sm:hidden">
                            <Button
                              onClick={() => setTagPage(p => Math.max(1, p - 1))}
                              disabled={tagPage === 1}
                              variant="outline"
                              size="sm"
                            >
                              上一頁
                            </Button>
                            <Button
                              onClick={() => setTagPage(p => Math.min(totalPages, p + 1))}
                              disabled={tagPage === totalPages}
                              variant="outline"
                              size="sm"
                            >
                              下一頁
                            </Button>
                          </div>
                          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm text-gray-700">
                                顯示第 <span className="font-medium">{(tagPage - 1) * TAGS_PER_PAGE + 1}</span> 到 <span className="font-medium">{Math.min(tagPage * TAGS_PER_PAGE, filteredTags.length)}</span> 筆，
                                共 <span className="font-medium">{filteredTags.length}</span> 筆
                              </p>
                            </div>
                            <div>
                              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                <button
                                  onClick={() => setTagPage(p => Math.max(1, p - 1))}
                                  disabled={tagPage === 1}
                                  className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                                    tagPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                                  }`}
                                >
                                  <span className="sr-only">上一頁</span>
                                  <ChevronLeft className="h-5 w-5" />
                                </button>
                                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                  {tagPage} / {totalPages}
                                </span>
                                <button
                                  onClick={() => setTagPage(p => Math.min(totalPages, p + 1))}
                                  disabled={tagPage === totalPages}
                                  className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                                    tagPage === totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                                  }`}
                                >
                                  <span className="sr-only">下一頁</span>
                                  <ChevronRight className="h-5 w-5" />
                                </button>
                              </nav>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 flex flex-col items-center justify-center h-full">
                      <div className="p-3 rounded-full bg-gray-100 mb-4">
                        <Search className="w-6 h-6 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900">沒有找到標籤</h3>
                      <p className="mt-1 text-sm text-gray-500">試試看其他代碼，或是新增一個標籤。</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
