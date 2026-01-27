'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Product } from '@/types';
import { handleCheckout } from '@/lib/checkout';
import { useAuthStore } from '@/store/auth';
import { formatPrice } from '@/lib/currency';
import CurrencySelector from '@/components/CurrencySelector';

interface ProductDetailContentProps {
  product: Product;
  language?: string;
}

export default function ProductDetailContent({ product, language = 'zh-TW' }: ProductDetailContentProps) {
  const router = useRouter();
  const { checkAuth } = useAuthStore();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // 獲取當前幣值和幣值符號
  const currentCurrency = product.currency || 'TWD';
  const availableCurrencies = product.available_currencies || ['TWD'];

  const handleBuyNow = async () => {
    // 重新檢查認證狀態
    await checkAuth();

    // 檢查是否已登入
    const currentAuthState = useAuthStore.getState();
    if (!currentAuthState.isAuthenticated) {
      alert('請先登入後再進行購買');
      router.push('/admin/login');
      return;
    }

    setCheckoutLoading(true);
    try {
      await handleCheckout(
        [
          {
            product_id: product.product_id,
            name: product.name,
            price: product.price,
            currency: currentCurrency,
          },
        ],
        product.price,
        {
          currency: currentCurrency,
          language: language,
        }
      );
    } catch (error) {
      console.error('Checkout error:', error);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const content = product.detail_content;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {product.name}
              </h1>
              <p className="text-gray-600">{product.short_description}</p>
            </div>
            <div className="ml-8 text-right">
              {/* 幣值選擇器 */}
              <div className="mb-3">
                <CurrencySelector
                  currentCurrency={currentCurrency}
                  availableCurrencies={availableCurrencies}
                  language={language}
                />
              </div>
              <div className="text-3xl font-bold text-indigo-600">
                {formatPrice(product.price, currentCurrency, language)}
              </div>
              {product.original_price && product.original_price > product.price && (
                <div className="text-lg text-gray-400 line-through">
                  {formatPrice(product.original_price, currentCurrency, language)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6">
              <h3 className="font-semibold text-gray-900 mb-4">產品資訊</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-gray-500">產品編號</dt>
                  <dd className="text-sm font-medium text-gray-900">{product.product_id}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">庫存狀態</dt>
                  <dd className="text-sm font-medium">
                    {product.stock_status === 'in_stock' ? (
                      <span className="text-green-600">有貨</span>
                    ) : (
                      <span className="text-red-600">已售完</span>
                    )}
                  </dd>
                </div>
                {product.category && (
                  <div>
                    <dt className="text-sm text-gray-500">分類</dt>
                    <dd className="text-sm font-medium text-gray-900">{product.category.slug}</dd>
                  </div>
                )}
                {product.tags && product.tags.length > 0 && (
                  <div>
                    <dt className="text-sm text-gray-500 mb-2">標籤</dt>
                    <dd className="flex flex-wrap gap-2">
                      {product.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                        >
                          {tag.slug}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Article Content */}
          <div className="lg:col-span-3">
            <article className="bg-white rounded-lg shadow-sm p-8">
              {/* 如果有詳情內容,顯示完整文章 */}
              {content ? (
                <>
                  {/* Featured Image */}
                  {content.featured_image && (
                    <div className="mb-8 rounded-lg overflow-hidden">
                      <img
                        src={content.featured_image}
                        alt={content.title}
                        className="w-full h-auto object-cover"
                      />
                    </div>
                  )}

                  {/* Article Title */}
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    {content.title}
                  </h2>

                  {/* Article Summary */}
                  {content.summary && (
                    <div className="text-lg text-gray-600 mb-6 pb-6 border-b">
                      {content.summary}
                    </div>
                  )}

                  {/* Article Content */}
                  <div
                    className="prose prose-lg max-w-none"
                    dangerouslySetInnerHTML={{ __html: content.content }}
                  />
                </>
              ) : (
                <>
                  {/* 如果沒有詳情內容,顯示產品基本描述 */}
                  {product.image && (
                    <div className="mb-8 rounded-lg overflow-hidden">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-auto object-cover"
                      />
                    </div>
                  )}

                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    產品介紹
                  </h2>

                  <div className="prose prose-lg max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: product.description }} />
                  </div>
                </>
              )}

              {/* Purchase CTA */}
              <div className="mt-12 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-8 text-center">
                <h3 className="text-2xl font-bold text-white mb-4">
                  準備好開始您的紫微斗數之旅了嗎?
                </h3>
                <div className="flex items-center justify-center gap-4 mb-6">
                  <span className="text-3xl font-bold text-white">
                    {formatPrice(product.price, currentCurrency, language)}
                  </span>
                  {product.original_price && product.original_price > product.price && (
                    <span className="text-xl text-indigo-200 line-through">
                      {formatPrice(product.original_price, currentCurrency, language)}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleBuyNow}
                  disabled={checkoutLoading || product.stock_status === 'out_of_stock'}
                  className="inline-flex items-center px-8 py-4 text-lg font-medium rounded-lg shadow-lg text-indigo-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-white focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
                >
                  {checkoutLoading
                    ? '處理中...'
                    : product.stock_status === 'out_of_stock'
                    ? '已售完'
                    : '立即購買'}
                </button>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
