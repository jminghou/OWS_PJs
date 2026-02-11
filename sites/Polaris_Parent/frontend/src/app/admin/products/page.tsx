'use client';

import { useState, useEffect, useCallback } from 'react';
import { productApi, categoryApi, tagApi } from '@/lib/api';
import { ProductAdmin, Category, Tag } from '@/types';
import AdminLayout from '@/components/admin/AdminLayout';
import { AdminListLayout, AdminEmptyState } from '@/components/admin/shared';
import { ProductSidebar, ProductForm } from './_components';
import type { CreateFormData, EditFormData } from './_components';
import { Package } from 'lucide-react';

const emptyCreateForm: CreateFormData = {
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
  tag_ids: [],
  is_active: true,
  is_featured: false,
  sort_order: '0',
  meta_title: '',
  meta_description: '',
};

const emptyEditForm: EditFormData = {
  product_id: '',
  name: '',
  description: '',
  short_description: '',
  price: '',
  original_price: '',
  stock_quantity: '',
  stock_status: 'in_stock',
  category_id: '',
  tag_ids: [],
  is_active: true,
  is_featured: false,
  sort_order: '0',
  meta_title: '',
  meta_description: '',
  detail_content_id: '',
};

export default function ProductsPage() {
  // List state
  const [products, setProducts] = useState<ProductAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, has_prev: false, has_next: false, total: 0 });
  const perPage = 20;

  // Selection state
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);

  // Form state
  const [createForm, setCreateForm] = useState<CreateFormData>({ ...emptyCreateForm });
  const [editForm, setEditForm] = useState<EditFormData>({ ...emptyEditForm });
  const [selectedProduct, setSelectedProduct] = useState<ProductAdmin | null>(null);
  const [saving, setSaving] = useState(false);

  // Shared data
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  // Fetch categories and tags once
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [cats, tgs] = await Promise.all([categoryApi.getList(), tagApi.getList()]);
        setCategories(cats);
        setTags(tgs);
      } catch (error) {
        console.error('Error fetching categories/tags:', error);
      }
    };
    fetchMeta();
  }, []);

  // Fetch product list
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { page: currentPage, per_page: perPage };
      if (statusFilter) params.is_active = statusFilter;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const response = await productApi.adminGetList(params);
      setProducts(response.products);
      setPagination({
        page: response.pagination.page || currentPage,
        pages: response.pagination.pages,
        has_prev: currentPage > 1,
        has_next: currentPage < response.pagination.pages,
        total: response.pagination.total,
      });
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, searchTerm]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Fetch single product for editing
  const fetchProduct = async (id: number) => {
    try {
      const productData = await productApi.adminGetById(id);
      setSelectedProduct(productData);

      const currentLanguage = productData.language || 'zh-TW';
      setEditForm({
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
      setSelectedId(null);
    }
  };

  // Handlers
  const handleSelectProduct = (id: number) => {
    if (selectedId === id) return;
    setSelectedId(id);
    setIsCreateMode(false);
    setSelectedProduct(null);
    fetchProduct(id);
  };

  const handleNewProduct = () => {
    if (isCreateMode) return;
    setSelectedId(null);
    setIsCreateMode(true);
    setSelectedProduct(null);
    setCreateForm({ ...emptyCreateForm });
  };

  const handleCancel = () => {
    setSelectedId(null);
    setIsCreateMode(false);
    setSelectedProduct(null);
    setCreateForm({ ...emptyCreateForm });
    setEditForm({ ...emptyEditForm });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.product_id || !createForm.name_zh || !createForm.price) {
      alert('請填寫必填欄位：產品ID、名稱（中文）、價格');
      return;
    }

    try {
      setSaving(true);
      const createData = {
        product_id: createForm.product_id,
        names: { 'zh-TW': createForm.name_zh, 'en': createForm.name_en },
        descriptions: { 'zh-TW': createForm.description_zh, 'en': createForm.description_en },
        short_descriptions: { 'zh-TW': createForm.short_description_zh, 'en': createForm.short_description_en },
        price: parseInt(createForm.price),
        original_price: createForm.original_price ? parseInt(createForm.original_price) : undefined,
        stock_quantity: parseInt(createForm.stock_quantity),
        stock_status: createForm.stock_status,
        category_id: createForm.category_id ? parseInt(createForm.category_id) : undefined,
        tag_ids: createForm.tag_ids,
        is_active: createForm.is_active,
        is_featured: createForm.is_featured,
        sort_order: parseInt(createForm.sort_order),
        meta_title: createForm.meta_title,
        meta_description: createForm.meta_description,
      };

      const result = await productApi.adminCreate(createData);
      alert('產品建立成功');
      fetchProducts();

      // Switch to edit mode for the new product
      if (result.id) {
        setIsCreateMode(false);
        setSelectedId(result.id);
        fetchProduct(result.id);
      }
    } catch (error: any) {
      alert(error.message || '建立失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !selectedProduct) return;
    if (!editForm.product_id || !editForm.name || !editForm.price) {
      alert('請填寫必填欄位：產品ID、名稱、價格');
      return;
    }

    try {
      setSaving(true);
      const currentLanguage = selectedProduct.language || 'zh-TW';

      const updateData = {
        product_id: editForm.product_id,
        name: editForm.name,
        description: editForm.description,
        short_description: editForm.short_description,
        language: currentLanguage,
        price: parseInt(editForm.price),
        original_price: editForm.original_price ? parseInt(editForm.original_price) : undefined,
        stock_quantity: parseInt(editForm.stock_quantity),
        stock_status: editForm.stock_status,
        category_id: editForm.category_id ? parseInt(editForm.category_id) : undefined,
        tag_ids: editForm.tag_ids,
        is_active: editForm.is_active,
        is_featured: editForm.is_featured,
        sort_order: parseInt(editForm.sort_order),
        meta_title: editForm.meta_title,
        meta_description: editForm.meta_description,
        detail_content_id: editForm.detail_content_id ? parseInt(editForm.detail_content_id) : undefined,
      };

      await productApi.adminUpdate(selectedId, updateData);
      alert('產品更新成功');
      fetchProducts();
    } catch (error: any) {
      alert(error.message || '更新失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (id: number, name: string) => {
    if (!confirm(`確定要刪除產品「${name}」嗎？`)) return;
    try {
      await productApi.adminDelete(id);
      alert('產品刪除成功');
      fetchProducts();
      if (selectedId === id) {
        handleCancel();
      }
    } catch (error: any) {
      alert(error.message || '刪除失敗');
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedId) return;
    try {
      const result = await productApi.adminToggleStatus(selectedId);
      fetchProducts();
      // Update local state
      setEditForm(prev => ({ ...prev, is_active: result.is_active }));
      if (selectedProduct) {
        setSelectedProduct({ ...selectedProduct, is_active: result.is_active });
      }
    } catch (error: any) {
      alert(error.message || '操作失敗');
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const showForm = isCreateMode || (selectedId !== null && selectedProduct !== null);

  return (
    <AdminLayout>
      <AdminListLayout
        sidebarWidth={280}
        sidebar={
          <ProductSidebar
            products={products}
            loading={loading}
            selectedId={selectedId}
            isCreateMode={isCreateMode}
            pagination={pagination}
            currentPage={currentPage}
            searchTerm={searchTerm}
            statusFilter={statusFilter}
            onSelectProduct={handleSelectProduct}
            onNewProduct={handleNewProduct}
            onPageChange={setCurrentPage}
            onSearchChange={handleSearchChange}
            onStatusFilterChange={handleStatusFilterChange}
            onDeleteProduct={handleDeleteProduct}
          />
        }
      >
        {showForm ? (
          isCreateMode ? (
            <ProductForm
              key="new"
              mode="create"
              formData={createForm}
              categories={categories}
              tags={tags}
              saving={saving}
              onFormChange={(updates) => setCreateForm(prev => ({ ...prev, ...updates }))}
              onSubmit={handleCreateSubmit}
              onCancel={handleCancel}
            />
          ) : (
            <ProductForm
              key={`edit-${selectedId}`}
              mode="edit"
              formData={editForm}
              product={selectedProduct!}
              categories={categories}
              tags={tags}
              saving={saving}
              onFormChange={(updates) => setEditForm(prev => ({ ...prev, ...updates }))}
              onSubmit={handleEditSubmit}
              onCancel={handleCancel}
              onToggleStatus={handleToggleStatus}
            />
          )
        ) : (
          <div className="flex items-center justify-center h-full">
            <AdminEmptyState
              icon={<Package size={48} className="text-gray-300" />}
              title="選擇產品開始編輯"
              description="從左側選擇一個產品，或點擊「新增產品」建立新項目"
            />
          </div>
        )}
      </AdminListLayout>
    </AdminLayout>
  );
}
