'use client';

import { useState, type ReactNode } from 'react';
import { ProductAdmin, Category, Tag } from '@ows/platform-api/types';
import Button from '@ows/ui/ui/Button';
import Input from '@ows/ui/ui/Input';
import TiptapEditor from '@ows/admin-app/components/TiptapEditor';
import ContentSelector from '@ows/admin-app/components/ContentSelector';
import PriceManager from '../../../components/PriceManager';
import ProductLanguageManager from '../../../components/ProductLanguageManager';
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

/** 站台注入的分頁（例如 Polaris 的前台文字、前台圖片），排在「價格與庫存」之後 */
export interface ProductFormExtraTab {
  key: string;
  label: string;
  content: ReactNode;
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
  extraTabs?: ProductFormExtraTab[];
  /** @deprecated 改用 extraTabs；仍傳入時會變成一個「站台設定」分頁 */
  extraSection?: ReactNode;
}

type ProductFormProps = ProductFormCreateProps | ProductFormEditProps;

export type { CreateFormData, EditFormData };

// --- Shared pieces ---

const labelCls = 'mb-1 block text-sm font-medium text-foreground';
const hintCls = 'mt-1 text-xs text-muted-foreground';
const selectCls =
  'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-admin-accent-500';

/** 分頁內的一組欄位：小標題＋選填說明，組與組之間留白分隔，不再用滿版分隔線 */
function Group({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Required() {
  return <span className="text-red-500"> *</span>;
}

export default function ProductForm(props: ProductFormProps) {
  const { mode, formData, categories, tags, saving, onFormChange, onSubmit, onCancel } = props;
  const edit = mode === 'edit' ? (props as ProductFormEditProps) : null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      onFormChange({ [name]: (e.target as HTMLInputElement).checked } as any);
    } else {
      onFormChange({ [name]: value } as any);
    }
  };

  const handleTagChange = (tagId: number) => {
    const currentIds = formData.tag_ids;
    const newIds = currentIds.includes(tagId) ? currentIds.filter((id) => id !== tagId) : [...currentIds, tagId];
    onFormChange({ tag_ids: newIds } as any);
  };

  // ── 分頁 ────────────────────────────────────────────────
  const extraTabs: ProductFormExtraTab[] = [
    ...(edit?.extraTabs ?? []),
    ...(edit?.extraSection ? [{ key: 'site', label: '站台設定', content: edit.extraSection }] : []),
  ];
  const tabs = [
    { key: 'basic', label: '基本資料' },
    { key: 'pricing', label: '價格與庫存' },
    ...extraTabs.map(({ key, label }) => ({ key: `x-${key}`, label })),
    { key: 'publish', label: '上架與 SEO' },
    ...(edit ? [{ key: 'advanced', label: '進階' }] : []),
  ];
  const [activeTab, setActiveTab] = useState('basic');

  // 必填欄位在別的分頁時，瀏覽器的驗證會擋下送出：切到該欄位所在的分頁，讓使用者看得到
  const handleInvalid = (e: React.FormEvent<HTMLFormElement>) => {
    const panel = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
    if (panel?.dataset.tab && panel.dataset.tab !== activeTab) setActiveTab(panel.dataset.tab);
  };

  const panel = (key: string, children: ReactNode) => (
    <div key={key} data-tab={key} hidden={activeTab !== key} role="tabpanel" className="space-y-8">
      {children}
    </div>
  );

  const product = edit?.product;
  const isActive = edit ? product!.is_active : formData.is_active;

  return (
    <div className="flex h-full flex-col bg-card">
      {/* ── 標頭：名稱、代碼、狀態 ── */}
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 pb-0 pt-5">
        <div className="min-w-0 pb-4">
          <h2 className="truncate text-lg font-semibold text-foreground">
            {edit ? (edit.formData.name || '未命名產品') : '新增產品'}
          </h2>
          {edit ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              <code className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{formData.product_id}</code>
              <span className="text-muted-foreground">{product!.language || 'zh-TW'}</span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-muted-foreground/60'}`} />
                {isActive ? '啟用中' : '已停用'}
              </span>
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">填寫必要欄位後建立，其餘設定之後都能再改</p>
          )}
        </div>
        {edit && (
          <button
            type="button"
            onClick={edit.onToggleStatus}
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            {isActive ? '停用產品' : '啟用產品'}
          </button>
        )}
      </div>

      {/* ── 分頁列 ── */}
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border px-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
              activeTab === tab.key
                ? 'border-admin-accent-600 font-medium text-admin-accent-700 dark:text-admin-accent-200'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} onInvalidCapture={handleInvalid} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl p-6">
            {/* ═══ 基本資料 ═══ */}
            {panel('basic', (
              <>
                <Group title="名稱與描述">
                  {mode === 'create' && (
                    <div>
                      <label className={labelCls}>產品 ID<Required /></label>
                      <Input
                        type="text"
                        name="product_id"
                        value={formData.product_id}
                        onChange={handleChange}
                        placeholder="例如：consultation-basic"
                        required
                      />
                      <p className={hintCls}>唯一識別碼，建立後不能修改；建議用英文小寫和連字號</p>
                    </div>
                  )}

                  {mode === 'create' ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className={labelCls}>產品名稱（中文）<Required /></label>
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
                                .replace(/[一-鿿]/g, '')
                                .replace(/[^\w\s-]/g, '')
                                .trim()
                                .replace(/\s+/g, '-');
                            }
                            if (!formData.meta_title) updates.meta_title = name;
                            onFormChange(updates);
                          }}
                          placeholder="基礎紫微斗數諮詢"
                          required
                        />
                      </div>
                      <div>
                        <label className={labelCls}>產品名稱（英文）</label>
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
                      <label className={labelCls}>產品名稱<Required /></label>
                      <Input
                        type="text"
                        name="name"
                        value={(formData as EditFormData).name}
                        onChange={handleChange}
                        placeholder="產品名稱"
                        required
                      />
                    </div>
                  )}

                  {mode === 'create' ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className={labelCls}>簡短描述（中文）</label>
                        <Input
                          type="text"
                          name="short_description_zh"
                          value={(formData as CreateFormData).short_description_zh}
                          onChange={handleChange}
                          placeholder="一句話介紹，顯示在列表與卡片上"
                        />
                      </div>
                      <div>
                        <label className={labelCls}>簡短描述（英文）</label>
                        <Input
                          type="text"
                          name="short_description_en"
                          value={(formData as CreateFormData).short_description_en}
                          onChange={handleChange}
                          placeholder="Short description"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className={labelCls}>簡短描述</label>
                      <Input
                        type="text"
                        name="short_description"
                        value={(formData as EditFormData).short_description}
                        onChange={handleChange}
                        placeholder="一句話介紹，顯示在列表與卡片上"
                      />
                    </div>
                  )}

                  {mode === 'create' ? (
                    <>
                      <div>
                        <label className={`${labelCls} mb-2`}>產品描述（中文）</label>
                        <TiptapEditor
                          content={(formData as CreateFormData).description_zh}
                          onChange={(content) => onFormChange({ description_zh: content } as any)}
                        />
                      </div>
                      <div>
                        <label className={`${labelCls} mb-2`}>產品描述（英文）</label>
                        <TiptapEditor
                          content={(formData as CreateFormData).description_en}
                          onChange={(content) => onFormChange({ description_en: content } as any)}
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className={`${labelCls} mb-2`}>產品描述</label>
                      <TiptapEditor
                        content={(formData as EditFormData).description}
                        onChange={(content) => onFormChange({ description: content } as any)}
                      />
                    </div>
                  )}
                </Group>

                <Group title="分類與標籤">
                  <div>
                    <label className={labelCls}>產品分類</label>
                    <select name="category_id" value={formData.category_id} onChange={handleChange} className={selectCls}>
                      <option value="">無分類</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name || category.code}
                        </option>
                      ))}
                    </select>
                  </div>
                  {tags.length > 0 && (
                    <div>
                      <label className={`${labelCls} mb-2`}>產品標籤</label>
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => {
                          const checked = formData.tag_ids.includes(tag.id);
                          return (
                            <label
                              key={tag.id}
                              className={`inline-flex cursor-pointer items-center rounded-full border px-3 py-1 text-sm transition-colors ${
                                checked
                                  ? 'border-admin-accent-500 bg-admin-accent-50 text-admin-accent-700 dark:bg-admin-accent-500/15 dark:text-admin-accent-200'
                                  : 'border-border text-foreground hover:bg-muted'
                              }`}
                            >
                              <input type="checkbox" checked={checked} onChange={() => handleTagChange(tag.id)} className="sr-only" />
                              {tag.name || tag.code}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Group>
              </>
            ))}

            {/* ═══ 價格與庫存 ═══ */}
            {panel('pricing', (
              <>
                <Group title="售價">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className={labelCls}>售價<Required /></label>
                      <Input type="number" name="price" value={formData.price} onChange={handleChange} placeholder="1200" required min="0" />
                    </div>
                    <div>
                      <label className={labelCls}>原價</label>
                      <Input type="number" name="original_price" value={formData.original_price} onChange={handleChange} placeholder="1500" min="0" />
                      <p className={hintCls}>有填才會顯示劃線原價</p>
                    </div>
                  </div>
                </Group>

                <Group title="庫存">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className={labelCls}>庫存數量</label>
                      <Input type="number" name="stock_quantity" value={formData.stock_quantity} onChange={handleChange} placeholder="-1" />
                      <p className={hintCls}>-1 表示不限庫存（數位商品用這個）</p>
                    </div>
                    <div>
                      <label className={labelCls}>庫存狀態</label>
                      <select name="stock_status" value={formData.stock_status} onChange={handleChange} className={selectCls}>
                        <option value="in_stock">有貨</option>
                        <option value="out_of_stock">缺貨</option>
                        <option value="pre_order">預購</option>
                      </select>
                    </div>
                  </div>
                </Group>

                {edit && (
                  <Group title="其他幣別的價格" description="這一塊各自有儲存按鈕，不受下方「儲存變更」影響。">
                    <PriceManager productId={product!.id} language="zh-TW" />
                  </Group>
                )}
              </>
            ))}

            {/* ═══ 站台分頁 ═══ */}
            {extraTabs.map((tab) => panel(`x-${tab.key}`, tab.content))}

            {/* ═══ 上架與 SEO ═══ */}
            {panel('publish', (
              <>
                <Group title="上架">
                  <div className="space-y-3">
                    <label className="flex items-start gap-3">
                      <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="mt-0.5 h-4 w-4" />
                      <span>
                        <span className="block text-sm font-medium text-foreground">啟用產品</span>
                        <span className="block text-xs text-muted-foreground">關閉時前台看不到、也不能購買</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3">
                      <input type="checkbox" name="is_featured" checked={formData.is_featured} onChange={handleChange} className="mt-0.5 h-4 w-4" />
                      <span>
                        <span className="block text-sm font-medium text-foreground">設為精選</span>
                        <span className="block text-xs text-muted-foreground">站台有精選區塊時會優先顯示</span>
                      </span>
                    </label>
                  </div>
                  <div className="max-w-[12rem]">
                    <label className={labelCls}>排序</label>
                    <Input type="number" name="sort_order" value={formData.sort_order} onChange={handleChange} placeholder="0" min="0" />
                    <p className={hintCls}>數字越小越前面</p>
                  </div>
                </Group>

                <Group title="搜尋引擎（SEO）" description="留空時使用產品名稱與簡短描述。">
                  <div>
                    <label className={labelCls}>Meta 標題</label>
                    <Input type="text" name="meta_title" value={formData.meta_title} onChange={handleChange} placeholder="產品的 SEO 標題" />
                  </div>
                  <div>
                    <label className={labelCls}>Meta 描述</label>
                    <textarea
                      name="meta_description"
                      value={formData.meta_description}
                      onChange={handleChange}
                      rows={3}
                      className={selectCls}
                      placeholder="產品的 SEO 描述"
                    />
                  </div>
                </Group>
              </>
            ))}

            {/* ═══ 進階（僅編輯）═══ */}
            {edit &&
              panel('advanced', (
                <>
                  <Group title="產品 ID">
                    <div>
                      <Input type="text" value={formData.product_id} disabled className="bg-muted" />
                      <p className={hintCls}>建立後不能修改；站台程式依這個代碼對應商品</p>
                    </div>
                  </Group>

                  <Group title="多語言版本" description="這一塊各自儲存，不受下方「儲存變更」影響。">
                    <ProductLanguageManager productId={product!.id} currentLanguage={product!.language || 'zh-TW'} />
                  </Group>

                  <Group title="詳情內容關聯" description="選一篇已發佈的文章作為產品詳情頁內容。">
                    <ContentSelector
                      value={edit.formData.detail_content_id}
                      onChange={(value) => onFormChange({ detail_content_id: value } as any)}
                    />
                    {edit.formData.detail_content_id && (
                      <p className="text-sm text-muted-foreground">
                        詳情頁預覽：
                        <a
                          href={`/products/${formData.product_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1 text-admin-accent-600 underline hover:text-admin-accent-700"
                        >
                          /products/{formData.product_id}
                        </a>
                      </p>
                    )}
                  </Group>
                </>
              ))}
          </div>
        </div>

        {/* ── 固定在底部的儲存列：任何分頁都看得到 ── */}
        <div className="flex items-center justify-end gap-2 border-t border-border bg-card px-6 py-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button type="submit" disabled={saving} className="flex items-center gap-2">
            {mode === 'create' ? (
              <>
                <Plus size={16} />
                {saving ? '建立中…' : '建立產品'}
              </>
            ) : (
              <>
                <Save size={16} />
                {saving ? '儲存中…' : '儲存變更'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
