'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { productApi, categoryApi, tagApi } from '@/lib/api';
import { Category, Tag } from '@/types';
import AdminLayout from '@/components/admin/AdminLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import TiptapEditor from '@/components/admin/TiptapEditor';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { ArrowLeft, Plus } from 'lucide-react';

export default function NewProductPage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  const [formData, setFormData] = useState({
    product_id: '',
    name_zh: '',
    name_en: '',
    description_zh: '',
    description_en: '',
    short_description_zh: '',
    short_description_en: '',
    price: '',
    original_price: '',
    stock_quantity: '-1',
    stock_status: 'in_stock',
    category_id: '',
    tag_ids: [] as number[],
    is_active: true,
    is_featured: false,
    sort_order: '0',
    meta_title: '',
    meta_description: '',
  });

  useEffect(() => {
    fetchCategories();
    fetchTags();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await categoryApi.getList();
      setCategories(response);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await tagApi.getList();
      setTags(response);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.product_id || !formData.name_zh || !formData.price) {
      alert('請填寫必填欄位：產品ID、名稱（中文）、價格');
      return;
    }

    try {
      setSaving(true);

      const createData = {
        product_id: formData.product_id,
        names: {
          'zh-TW': formData.name_zh,
          'en': formData.name_en,
        },
        descriptions: {
          'zh-TW': formData.description_zh,
          'en': formData.description_en,
        },
        short_descriptions: {
          'zh-TW': formData.short_description_zh,
          'en': formData.short_description_en,
        },
        price: parseInt(formData.price),
        original_price: formData.original_price ? parseInt(formData.original_price) : undefined,
        stock_quantity: parseInt(formData.stock_quantity),
        stock_status: formData.stock_status,
        category_id: formData.category_id ? parseInt(formData.category_id) : undefined,
        tag_ids: formData.tag_ids,
        is_active: formData.is_active,
        is_featured: formData.is_featured,
        sort_order: parseInt(formData.sort_order),
        meta_title: formData.meta_title,
        meta_description: formData.meta_description,
      };

      await productApi.adminCreate(createData);
      alert('產品建立成功');
      router.push('/admin/products');
    } catch (error: any) {
      console.error('Failed to create product:', error);
      alert(error.message || '建立失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleTagChange = (tagId: number) => {
    setFormData(prev => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter(id => id !== tagId)
        : [...prev.tag_ids, tagId]
    }));
  };

  const generateProductId = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[\u4e00-\u9fff]/g, '') // 移除中文字元
      .replace(/[^\w\s-]/g, '') // 移除特殊符號
      .trim()
      .replace(/\s+/g, '-'); // 空格替換為連字號
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormData(prev => ({
      ...prev,
      name_zh: name,
      product_id: prev.product_id || generateProductId(name),
      meta_title: prev.meta_title || name,
    }));
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/admin/products')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">新增產品</h1>
              <p className="mt-1 text-sm text-gray-500">建立新的產品項目</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>基本資訊</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  產品 ID <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  name="product_id"
                  value={formData.product_id}
                  onChange={handleChange}
                  placeholder="例如: consultation-basic"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">唯一識別碼，建議使用英文小寫和連字號</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    產品名稱（中文）<span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    name="name_zh"
                    value={formData.name_zh}
                    onChange={handleNameChange}
                    placeholder="基礎紫微斗數諮詢"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    產品名稱（英文）
                  </label>
                  <Input
                    type="text"
                    name="name_en"
                    value={formData.name_en}
                    onChange={handleChange}
                    placeholder="Basic Consultation"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    產品描述（中文）
                  </label>
                  <TiptapEditor
                    content={formData.description_zh}
                    onChange={(content) => setFormData(prev => ({ ...prev, description_zh: content }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    產品描述（英文）
                  </label>
                  <TiptapEditor
                    content={formData.description_en}
                    onChange={(content) => setFormData(prev => ({ ...prev, description_en: content }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    簡短描述（中文）
                  </label>
                  <Input
                    type="text"
                    name="short_description_zh"
                    value={formData.short_description_zh}
                    onChange={handleChange}
                    placeholder="簡短的產品介紹"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    簡短描述（英文）
                  </label>
                  <Input
                    type="text"
                    name="short_description_en"
                    value={formData.short_description_en}
                    onChange={handleChange}
                    placeholder="Short description"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing & Inventory */}
          <Card>
            <CardHeader>
              <CardTitle>價格與庫存</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    售價 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="1200"
                    required
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    原價
                  </label>
                  <Input
                    type="number"
                    name="original_price"
                    value={formData.original_price}
                    onChange={handleChange}
                    placeholder="1500"
                    min="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    庫存數量
                  </label>
                  <Input
                    type="number"
                    name="stock_quantity"
                    value={formData.stock_quantity}
                    onChange={handleChange}
                    placeholder="-1 表示無限庫存"
                  />
                  <p className="mt-1 text-xs text-gray-500">-1 表示無限庫存</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    庫存狀態
                  </label>
                  <select
                    name="stock_status"
                    value={formData.stock_status}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="in_stock">有貨</option>
                    <option value="out_of_stock">缺貨</option>
                    <option value="pre_order">預購</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Categories & Tags */}
          <Card>
            <CardHeader>
              <CardTitle>分類與標籤</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  產品分類
                </label>
                <select
                  name="category_id"
                  value={formData.category_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">無分類</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name || category.code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  產品標籤
                </label>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <label
                      key={tag.id}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={formData.tag_ids.includes(tag.id)}
                        onChange={() => handleTagChange(tag.id)}
                        className="mr-2"
                      />
                      {tag.name || tag.code}
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Display Settings */}
          <Card>
            <CardHeader>
              <CardTitle>展示設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-6">
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">啟用產品</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    name="is_featured"
                    checked={formData.is_featured}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">設為精選</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  排序順序
                </label>
                <Input
                  type="number"
                  name="sort_order"
                  value={formData.sort_order}
                  onChange={handleChange}
                  placeholder="0"
                  min="0"
                />
                <p className="mt-1 text-xs text-gray-500">數字越小排序越前面</p>
              </div>
            </CardContent>
          </Card>

          {/* SEO */}
          <Card>
            <CardHeader>
              <CardTitle>SEO 設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meta 標題
                </label>
                <Input
                  type="text"
                  name="meta_title"
                  value={formData.meta_title}
                  onChange={handleChange}
                  placeholder="產品的 SEO 標題"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meta 描述
                </label>
                <textarea
                  name="meta_description"
                  value={formData.meta_description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="產品的 SEO 描述"
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/admin/products')}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {saving ? '建立中...' : '建立產品'}
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
