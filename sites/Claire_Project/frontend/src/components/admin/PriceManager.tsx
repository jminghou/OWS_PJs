'use client';

import { useState, useEffect } from 'react';
import { productApi } from '@/lib/api';
import { ProductPrice, CreateProductPriceData } from '@/types';
import { getCurrencySymbol, getCurrencyName, getSupportedCurrencies } from '@/lib/currency';

interface PriceManagerProps {
  productId: number;
  language?: string;
}

export default function PriceManager({ productId, language = 'zh-TW' }: PriceManagerProps) {
  const [prices, setPrices] = useState<ProductPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // 新增/編輯表單狀態
  const [formData, setFormData] = useState<CreateProductPriceData>({
    currency: 'TWD',
    price: 0,
    original_price: undefined,
    is_active: true,
  });

  // 載入價格列表
  const loadPrices = async () => {
    try {
      setLoading(true);
      const response = await productApi.adminGetPrices(productId);
      setPrices(response.prices);
      setError(null);
    } catch (err: any) {
      setError(err.message || '載入價格失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrices();
  }, [productId]);

  // 新增價格
  const handleAddPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await productApi.adminCreatePrice(productId, formData);
      await loadPrices();
      setShowAddForm(false);
      setFormData({
        currency: 'TWD',
        price: 0,
        original_price: undefined,
        is_active: true,
      });
    } catch (err: any) {
      alert(err.message || '新增價格失敗');
    }
  };

  // 更新價格
  const handleUpdatePrice = async (priceId: number) => {
    try {
      await productApi.adminUpdatePrice(productId, priceId, formData);
      await loadPrices();
      setEditingId(null);
      setFormData({
        currency: 'TWD',
        price: 0,
        original_price: undefined,
        is_active: true,
      });
    } catch (err: any) {
      alert(err.message || '更新價格失敗');
    }
  };

  // 刪除價格
  const handleDeletePrice = async (priceId: number) => {
    if (!confirm('確定要刪除此價格設定嗎？')) return;

    try {
      await productApi.adminDeletePrice(productId, priceId);
      await loadPrices();
    } catch (err: any) {
      alert(err.message || '刪除價格失敗');
    }
  };

  // 開始編輯
  const startEdit = (price: ProductPrice) => {
    setEditingId(price.id);
    setFormData({
      currency: price.currency,
      price: price.price,
      original_price: price.original_price,
      is_active: price.is_active,
    });
    setShowAddForm(false);
  };

  // 取消編輯
  const cancelEdit = () => {
    setEditingId(null);
    setFormData({
      currency: 'TWD',
      price: 0,
      original_price: undefined,
      is_active: true,
    });
  };

  // 獲取已使用的幣值
  const usedCurrencies = prices.map(p => p.currency);
  const availableCurrencies = getSupportedCurrencies().filter(
    c => !usedCurrencies.includes(c) || formData.currency === c
  );

  if (loading) {
    return <div className="text-center py-4">載入中...</div>;
  }

  if (error) {
    return <div className="text-red-600 py-4">錯誤: {error}</div>;
  }

  return (
    <div className="price-manager">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">多幣值價格管理</h3>
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {showAddForm ? '取消新增' : '新增價格'}
        </button>
      </div>

      {/* 新增價格表單 */}
      {showAddForm && (
        <form onSubmit={handleAddPrice} className="mb-6 p-4 border rounded bg-gray-50">
          <h4 className="font-semibold mb-3">新增價格設定</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">幣值</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                required
              >
                {availableCurrencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {getCurrencySymbol(currency)} {getCurrencyName(currency, language)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">售價</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded"
                required
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">原價 (選填)</label>
              <input
                type="number"
                value={formData.original_price || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    original_price: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                className="w-full px-3 py-2 border rounded"
                min="0"
              />
            </div>
            <div className="flex items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm font-medium">啟用</span>
              </label>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
              確認新增
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
            >
              取消
            </button>
          </div>
        </form>
      )}

      {/* 價格列表 */}
      <div className="space-y-2">
        {prices.length === 0 ? (
          <p className="text-gray-500">尚未設定任何價格</p>
        ) : (
          prices.map((price) => (
            <div
              key={price.id}
              className={`p-4 border rounded ${!price.is_active ? 'bg-gray-100' : 'bg-white'}`}
            >
              {editingId === price.id ? (
                // 編輯模式
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">幣值</label>
                      <input
                        type="text"
                        value={formData.currency}
                        className="w-full px-3 py-2 border rounded bg-gray-100"
                        disabled
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">售價</label>
                      <input
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border rounded"
                        required
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">原價 (選填)</label>
                      <input
                        type="number"
                        value={formData.original_price || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            original_price: e.target.value ? parseInt(e.target.value) : undefined,
                          })
                        }
                        className="w-full px-3 py-2 border rounded"
                        min="0"
                      />
                    </div>
                    <div className="flex items-center">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.is_active}
                          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm font-medium">啟用</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdatePrice(price.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      儲存
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                // 顯示模式
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold">
                      {getCurrencySymbol(price.currency)} {getCurrencyName(price.currency, language)}
                    </div>
                    <div className="text-sm text-gray-600">
                      售價: {price.price}
                      {price.original_price && ` / 原價: ${price.original_price}`}
                    </div>
                    <div className="text-xs text-gray-500">
                      狀態: {price.is_active ? '啟用' : '停用'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(price)}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePrice(price.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      刪除
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
