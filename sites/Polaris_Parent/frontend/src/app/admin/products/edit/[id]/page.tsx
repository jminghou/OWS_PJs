'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { productApi, categoryApi, tagApi } from '@/lib/api';
import { ProductAdmin, Category, Tag } from '@/types';
import AdminLayout from '@/components/admin/AdminLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import TiptapEditor from '@/components/admin/TiptapEditor';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { ArrowLeft, Save } from 'lucide-react';
import ContentSelector from '@/components/admin/ContentSelector';
import PriceManager from '@/components/admin/PriceManager';
import ProductLanguageManager from '@/components/admin/ProductLanguageManager';

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState<ProductAdmin | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  const [formData, setFormData] = useState({
    product_id: '',
    name: '',
    description: '',
    short_description: '',
    price: '',
    original_price: '',
    stock_quantity: '',
    stock_status: 'in_stock',
    category_id: '',
    tag_ids: [] as number[],
    is_active: true,
    is_featured: false,
    sort_order: '0',
    meta_title: '',
    meta_description: '',
    detail_content_id: '',
  });

  useEffect(() => {
    fetchProduct();
    fetchCategories();
    fetchTags();
  }, [productId]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const productData = await productApi.adminGetById(parseInt(productId));
      setProduct(productData);

      // 使用產品當前的語言版本
      const currentLanguage = productData.language || 'zh-TW';

      setFormData({
        product_id: productData.product_id,
        name: productData.names[currentLanguage] || productData.names['zh-TW'] || '',
        description: productData.descriptions[currentLanguage] || productData.descriptions['zh-TW'] || '',
        short_description: productData.short_descriptions[currentLanguage] || productData.short_descriptions['zh-TW'] || '',
        price: productData.price.toString(),
        original_price: productData.original_price?.toString() || '',
        stock_quantity: productData.stock_quantity.toString(),
        stock_status: productData.stock_status,
        category_id: productData.category_id?.toString() || '',
        tag_ids: productData.tag_ids || [],
        is_active: productData.is_active,
        is_featured: productData.is_featured,
        sort_order: productData.sort_order.toString(),
        meta_title: productData.meta_title || '',
        meta_description: productData.meta_description || '',
        detail_content_id: productData.detail_content_id?.toString() || '',
      });
    } catch (error) {
      console.error('Failed to fetch product:', error);
      alert('載入產品失敗');
      router.push('/admin/products');
    } finally {
      setLoading(false);
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

    if (!formData.product_id || !formData.name || !formData.price) {
      alert('請填寫必填欄位：產品ID、名稱、價格');
      return;
    }

    if (!product) {
      alert('產品資料載入失敗');
      return;
    }

    try {
      setSaving(true);

      // 使用產品當前的語言版本
      const currentLanguage = product.language || 'zh-TW';

      const updateData = {
        product_id: formData.product_id,
        name: formData.name,
        description: formData.description,
        short_description: formData.short_description,
        language: currentLanguage,  // 保持當前語言
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
        detail_content_id: formData.detail_content_id ? parseInt(formData.detail_content_id) : undefined,
      };

      await productApi.adminUpdate(parseInt(productId), updateData);
      alert('產品更新成功');
      router.push('/admin/products');
    } catch (error: any) {
      console.error('Failed to update product:', error);
      alert(error.message || '更新失敗');
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

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-gray-500">載入中...</div>
        </div>
      </AdminLayout>
    );
  }

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
              <h1 className="text-2xl font-bold text-gray-900">編輯產品</h1>
              <p className="mt-1 text-sm text-gray-500">修改產品資訊</p>
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
                  disabled
                  className="bg-gray-100"
                />
                <p className="mt-1 text-xs text-gray-500">產品ID不可修改</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  產品名稱 <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="產品名稱"
                  required
                />
                {product && (
                  <p className="mt-1 text-xs text-gray-500">
                    當前語言版本：{product.language || 'zh-TW'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  產品描述
                </label>
                <TiptapEditor
                  content={formData.description}
                  onChange={(content) => setFormData(prev => ({ ...prev, description: content }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  簡短描述
                </label>
                <Input
                  type="text"
                  name="short_description"
                  value={formData.short_description}
                  onChange={handleChange}
                  placeholder="簡短的產品介紹"
                />
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

          {/* Multi-Currency Pricing Management */}
          {product && (
            <Card>
              <CardHeader>
                <CardTitle>多幣值價格管理</CardTitle>
              </CardHeader>
              <CardContent>
                <PriceManager productId={parseInt(productId)} language="zh-TW" />
              </CardContent>
            </Card>
          )}

          {/* Multi-Language Management */}
          {product && (
            <Card>
              <CardHeader>
                <CardTitle>多語言版本管理</CardTitle>
              </CardHeader>
              <CardContent>
                <ProductLanguageManager
                  productId={parseInt(productId)}
                  currentLanguage={product.language || 'zh-TW'}
                />
              </CardContent>
            </Card>
          )}

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

          {/* 詳情內容關聯 */}
          <Card>
            <CardHeader>
              <CardTitle>詳情內容關聯</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  關聯文章內容
                </label>
                <ContentSelector
                  value={formData.detail_content_id}
                  onChange={(value) => setFormData(prev => ({ ...prev, detail_content_id: value }))}
                />
                <p className="mt-1 text-xs text-gray-500">
                  選擇一篇已發佈的文章作為產品詳情頁內容。
                  如需多語言支援,請在文章編輯器中創建翻譯版本。
                </p>
              </div>
              {formData.detail_content_id && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <p className="text-sm text-blue-800">
                    詳情頁預覽:{' '}
                    <a
                      href={`/products/${formData.product_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-blue-600"
                    >
                      /products/{formData.product_id}
                    </a>
                  </p>
                </div>
              )}
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
              <Save className="w-4 h-4" />
              {saving ? '儲存中...' : '儲存變更'}
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
