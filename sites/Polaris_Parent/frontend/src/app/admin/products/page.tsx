'use client';

import { useState, useEffect } from 'react';
import { productApi } from '@/lib/api';
import { ProductAdmin } from '@/types';
import AdminLayout from '@/components/admin/AdminLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import {
  Search,
  Edit2,
  Trash2,
  Plus,
  Power,
  PowerOff,
  ChevronLeft,
  ChevronRight,
  Package,
  GripVertical
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 可排序的表格行組件
interface SortableRowProps {
  product: ProductAdmin;
  onToggleStatus: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number, name: string) => void;
}

function SortableRow({ product, onToggleStatus, onEdit, onDelete }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap">
        <button
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-5 h-5" />
        </button>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        {product.product_id}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          {product.featured_image && (
            <img
              src={product.featured_image.file_path}
              alt={product.names['zh-TW'] || ''}
              className="w-10 h-10 rounded object-cover mr-3"
            />
          )}
          <div>
            <div className="text-sm font-medium text-gray-900">
              {product.names['zh-TW'] || product.product_id}
            </div>
            {product.is_featured && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                精選
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        <div>NT$ {product.price}</div>
        {product.original_price && product.original_price > product.price && (
          <div className="text-xs text-gray-400 line-through">
            NT$ {product.original_price}
          </div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {product.stock_quantity === -1 ? (
          <span className="text-green-600">無限</span>
        ) : (
          <span className={product.stock_quantity > 0 ? 'text-green-600' : 'text-red-600'}>
            {product.stock_quantity}
          </span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {product.sales_count}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            product.is_active
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {product.is_active ? '啟用' : '停用'}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onToggleStatus(product.id)}
            className="text-gray-600 hover:text-gray-900"
            title={product.is_active ? '停用' : '啟用'}
          >
            {product.is_active ? (
              <PowerOff className="w-4 h-4" />
            ) : (
              <Power className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => onEdit(product.id)}
            className="text-blue-600 hover:text-blue-900"
            title="編輯"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(product.id, product.names['zh-TW'] || product.product_id)}
            className="text-red-600 hover:text-red-900"
            title="刪除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchProducts();
  }, [page, statusFilter, search]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        per_page: perPage,
      };

      if (statusFilter) {
        params.is_active = statusFilter;
      }

      if (search) {
        params.search = search;
      }

      const response = await productApi.adminGetList(params);
      setProducts(response.products);
      setTotalPages(response.pagination.pages);
      setTotal(response.pagination.total);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      alert('載入產品失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProducts();
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`確定要刪除產品「${name}」嗎？`)) {
      return;
    }

    try {
      await productApi.adminDelete(id);
      alert('產品刪除成功');
      fetchProducts();
    } catch (error: any) {
      console.error('Failed to delete product:', error);
      alert(error.message || '刪除失敗');
    }
  };

  const handleToggleStatus = async (id: number) => {
    try {
      await productApi.adminToggleStatus(id);
      fetchProducts();
    } catch (error: any) {
      console.error('Failed to toggle status:', error);
      alert(error.message || '操作失敗');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = products.findIndex((p) => p.id === active.id);
    const newIndex = products.findIndex((p) => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // 樂觀更新 UI
    const newProducts = arrayMove(products, oldIndex, newIndex);
    setProducts(newProducts);

    try {
      // 更新排序順序到後端
      const sortOrders = newProducts.map((product, index) => ({
        id: product.id,
        sort_order: index + 1,
      }));

      await productApi.adminUpdateSortOrder(sortOrders);
      console.log('排序更新成功');
    } catch (error: any) {
      console.error('Failed to update sort order:', error);

      // 檢查錯誤類型並給出更具體的訊息
      let errorMessage = '更新排序失敗';

      if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
        errorMessage = '無法連接到後端伺服器。請確認：\n1. 後端伺服器是否在 http://localhost:5000 運行\n2. 後端是否已實作 PUT /admin/products/sort-order API';
      } else if (error.status === 404) {
        errorMessage = '後端 API 端點不存在。請在後端實作 PUT /admin/products/sort-order';
      } else if (error.message) {
        errorMessage = error.message;
      }

      alert(errorMessage);
      // 失敗時重新載入資料
      fetchProducts();
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-7 h-7" />
              產品管理
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              管理您的產品，包含價格、庫存和展示設定
            </p>
          </div>
          <Button
            onClick={() => router.push('/admin/products/new')}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新增產品
          </Button>
        </div>

        {/* Search and Filter */}
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    type="text"
                    placeholder="搜尋產品 ID 或名稱..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部狀態</option>
                <option value="true">已啟用</option>
                <option value="false">已停用</option>
              </select>
              <Button type="submit">搜尋</Button>
            </form>
          </CardContent>
        </Card>

        {/* Products Table */}
        <Card>
          <CardHeader>
            <CardTitle>產品列表 ({total} 個產品)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-pulse text-gray-500">載入中...</div>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                沒有找到產品
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          排序
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          產品 ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          名稱
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          價格
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          庫存
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          銷售數
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          狀態
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <SortableContext
                      items={products.map((p) => p.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <tbody className="bg-white divide-y divide-gray-200">
                        {products.map((product) => (
                          <SortableRow
                            key={product.id}
                            product={product}
                            onToggleStatus={handleToggleStatus}
                            onEdit={(id) => router.push(`/admin/products/edit/${id}`)}
                            onDelete={handleDelete}
                          />
                        ))}
                      </tbody>
                    </SortableContext>
                  </table>
                </div>
              </DndContext>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
                <div className="text-sm text-gray-500">
                  第 {page} / {totalPages} 頁
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    上一頁
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                    className="flex items-center gap-1"
                  >
                    下一頁
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
