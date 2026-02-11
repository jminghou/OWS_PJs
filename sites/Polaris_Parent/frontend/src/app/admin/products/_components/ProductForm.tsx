'use client';

import { ProductAdmin, Category, Tag } from '@/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import TiptapEditor from '@/components/admin/TiptapEditor';
import ContentSelector from '@/components/admin/ContentSelector';
import PriceManager from '@/components/admin/PriceManager';
import ProductLanguageManager from '@/components/admin/ProductLanguageManager';
import { Save, Plus } from 'lucide-react';

// --- Create mode types ---

interface CreateFormData {
  product_id: string;
  name_zh: string;
  name_en: string;
  description_zh: string;
  description_en: string;
  short_description_zh: string;
  short_description_en: string;
  price: string;
  original_price: string;
  stock_quantity: string;
  stock_status: string;
  category_id: string;
  tag_ids: number[];
  is_active: boolean;
  is_featured: boolean;
  sort_order: string;
  meta_title: string;
  meta_description: string;
}

// --- Edit mode types ---

interface EditFormData {
  product_id: string;
  name: string;
  description: string;
  short_description: string;
  price: string;
  original_price: string;
  stock_quantity: string;
  stock_status: string;
  category_id: string;
  tag_ids: number[];
  is_active: boolean;
  is_featured: boolean;
  sort_order: string;
  meta_title: string;
  meta_description: string;
  detail_content_id: string;
}

// --- Props ---

interface ProductFormCreateProps {
  mode: 'create';
  formData: CreateFormData;
  categories: Category[];
  tags: Tag[];
  saving: boolean;
  onFormChange: (updates: Partial<CreateFormData>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

interface ProductFormEditProps {
  mode: 'edit';
  formData: EditFormData;
  product: ProductAdmin;
  categories: Category[];
  tags: Tag[];
  saving: boolean;
  onFormChange: (updates: Partial<EditFormData>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onToggleStatus: () => void;
}

type ProductFormProps = ProductFormCreateProps | ProductFormEditProps;

export type { CreateFormData, EditFormData };

// --- Shared section components ---

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-sm font-semibold text-gray-800 pb-2 border-b border-gray-100 mb-4">{title}</h3>
  );
}

export default function ProductForm(props: ProductFormProps) {
  const { mode, formData, categories, tags, saving, onFormChange, onSubmit, onCancel } = props;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      onFormChange({ [name]: checked } as any);
    } else {
      onFormChange({ [name]: value } as any);
    }
  };

  const handleTagChange = (tagId: number) => {
    const currentIds = formData.tag_ids;
    const newIds = currentIds.includes(tagId)
      ? currentIds.filter(id => id !== tagId)
      : [...currentIds, tagId];
    onFormChange({ tag_ids: newIds } as any);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {mode === 'create' ? '新增產品' : '編輯產品'}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {mode === 'create' ? '建立新的產品項目' : '修改產品資訊'}
          </p>
        </div>
        {mode === 'edit' && (
          <button
            type="button"
            onClick={(props as ProductFormEditProps).onToggleStatus}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              (props as ProductFormEditProps).product.is_active
                ? 'text-orange-700 bg-orange-50 hover:bg-orange-100'
                : 'text-green-700 bg-green-50 hover:bg-green-100'
            }`}
          >
            {(props as ProductFormEditProps).product.is_active ? '停用產品' : '啟用產品'}
          </button>
        )}
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto">
        <form onSubmit={onSubmit} className="p-6 space-y-6 max-w-2xl">

          {/* === 基本資訊 === */}
          <section>
            <SectionHeader title="基本資訊" />
            <div className="space-y-4">
              {/* Product ID */}
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
                  disabled={mode === 'edit'}
                  className={mode === 'edit' ? 'bg-gray-100' : ''}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {mode === 'edit' ? '產品ID不可修改' : '唯一識別碼，建議使用英文小寫和連字號'}
                </p>
              </div>

              {/* Names */}
              {mode === 'create' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      產品名稱（中文）<span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      name="name_zh"
                      value={(formData as CreateFormData).name_zh}
                      onChange={(e) => {
                        const name = e.target.value;
                        const updates: Partial<CreateFormData> = { name_zh: name };
                        if (!formData.product_id) {
                          updates.product_id = name
                            .toLowerCase()
                            .replace(/[\u4e00-\u9fff]/g, '')
                            .replace(/[^\w\s-]/g, '')
                            .trim()
                            .replace(/\s+/g, '-');
                        }
                        if (!formData.meta_title) {
                          updates.meta_title = name;
                        }
                        onFormChange(updates);
                      }}
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
                      value={(formData as CreateFormData).name_en}
                      onChange={handleChange}
                      placeholder="Basic Consultation"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    產品名稱 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    name="name"
                    value={(formData as EditFormData).name}
                    onChange={handleChange}
                    placeholder="產品名稱"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    當前語言版本：{(props as ProductFormEditProps).product.language || 'zh-TW'}
                  </p>
                </div>
              )}

              {/* Descriptions */}
              {mode === 'create' ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        產品描述（中文）
                      </label>
                      <TiptapEditor
                        content={(formData as CreateFormData).description_zh}
                        onChange={(content) => onFormChange({ description_zh: content } as any)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        產品描述（英文）
                      </label>
                      <TiptapEditor
                        content={(formData as CreateFormData).description_en}
                        onChange={(content) => onFormChange({ description_en: content } as any)}
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
                        value={(formData as CreateFormData).short_description_zh}
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
                        value={(formData as CreateFormData).short_description_en}
                        onChange={handleChange}
                        placeholder="Short description"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      產品描述
                    </label>
                    <TiptapEditor
                      content={(formData as EditFormData).description}
                      onChange={(content) => onFormChange({ description: content } as any)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      簡短描述
                    </label>
                    <Input
                      type="text"
                      name="short_description"
                      value={(formData as EditFormData).short_description}
                      onChange={handleChange}
                      placeholder="簡短的產品介紹"
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          {/* === 價格與庫存 === */}
          <section>
            <SectionHeader title="價格與庫存" />
            <div className="space-y-4">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="in_stock">有貨</option>
                    <option value="out_of_stock">缺貨</option>
                    <option value="pre_order">預購</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* === 多幣值價格管理 (edit only) === */}
          {mode === 'edit' && (
            <section>
              <SectionHeader title="多幣值價格管理" />
              <PriceManager productId={(props as ProductFormEditProps).product.id} language="zh-TW" />
            </section>
          )}

          {/* === 多語言版本管理 (edit only) === */}
          {mode === 'edit' && (
            <section>
              <SectionHeader title="多語言版本管理" />
              <ProductLanguageManager
                productId={(props as ProductFormEditProps).product.id}
                currentLanguage={(props as ProductFormEditProps).product.language || 'zh-TW'}
              />
            </section>
          )}

          {/* === 分類與標籤 === */}
          <section>
            <SectionHeader title="分類與標籤" />
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  產品分類
                </label>
                <select
                  name="category_id"
                  value={formData.category_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">無分類</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name || category.code}
                    </option>
                  ))}
                </select>
              </div>
              {tags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    產品標籤
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => (
                      <label
                        key={tag.id}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 text-sm"
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
              )}
            </div>
          </section>

          {/* === 展示設定 === */}
          <section>
            <SectionHeader title="展示設定" />
            <div className="space-y-4">
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
            </div>
          </section>

          {/* === SEO 設定 === */}
          <section>
            <SectionHeader title="SEO 設定" />
            <div className="space-y-4">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="產品的 SEO 描述"
                />
              </div>
            </div>
          </section>

          {/* === 詳情內容關聯 (edit only) === */}
          {mode === 'edit' && (
            <section>
              <SectionHeader title="詳情內容關聯" />
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    關聯文章內容
                  </label>
                  <ContentSelector
                    value={(formData as EditFormData).detail_content_id}
                    onChange={(value) => onFormChange({ detail_content_id: value } as any)}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    選擇一篇已發佈的文章作為產品詳情頁內容。
                  </p>
                </div>
                {(formData as EditFormData).detail_content_id && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <p className="text-sm text-blue-800">
                      詳情頁預覽：
                      <a
                        href={`/products/${formData.product_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-blue-600 ml-1"
                      >
                        /products/{formData.product_id}
                      </a>
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* === Actions === */}
          <div className="flex space-x-2 pt-4 border-t">
            <Button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2">
              {mode === 'create' ? (
                <>
                  <Plus size={16} />
                  {saving ? '建立中...' : '建立產品'}
                </>
              ) : (
                <>
                  <Save size={16} />
                  {saving ? '儲存中...' : '儲存變更'}
                </>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              取消
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
