'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { productApi } from '@/lib/api';
import { Product } from '@/types';
import { useAuthStore } from '@/store/auth';
import { formatPrice } from '@/lib/currency';

// 多語言翻譯
const translations: Record<string, any> = {
  'zh-TW': {
    title: '服務與產品',
    subtitle: '選擇適合您的紫微斗數諮詢服務',
    loading: '載入中...',
    noProducts: '目前沒有可用的產品',
    outOfStock: '已售完',
    learnMore: '了解更多',
  },
  'en': {
    title: 'Services & Products',
    subtitle: 'Choose the Purple Star Astrology consultation service that suits you',
    loading: 'Loading...',
    noProducts: 'No products available',
    outOfStock: 'Out of Stock',
    learnMore: 'Learn More',
  },
  'ja': {
    title: 'サービスと製品',
    subtitle: 'あなたに合った紫微斗数コンサルティングサービスをお選びください',
    loading: '読み込み中...',
    noProducts: '利用可能な製品はありません',
    outOfStock: '在庫切れ',
    learnMore: '詳細を見る',
  },
  'zh-CN': {
    title: '服务与产品',
    subtitle: '选择适合您的紫微斗数咨询服务',
    loading: '加载中...',
    noProducts: '目前没有可用的产品',
    outOfStock: '已售完',
    learnMore: '了解更多',
  },
};

export default function ProductsPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'zh-TW';
  const { checkAuth } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const t = translations[locale] || translations['zh-TW'];

  useEffect(() => {
    // 初始化認證狀態
    checkAuth();
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await productApi.getList({
        language: locale,
        per_page: 100
      });
      setProducts(response.products);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProductClick = (productId: string) => {
    router.push(`/${locale}/products/${productId}`);
  };

  if (loading) {
    return (
      <div className="bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">{t.loading}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            {t.title}
          </h1>
          <p className="mt-4 text-xl text-gray-500">
            {t.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-y-10 sm:grid-cols-2 gap-x-6 lg:grid-cols-3 xl:gap-x-8">
          {products.map((product) => (
            <div
              key={product.id}
              className="group relative border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="aspect-w-3 aspect-h-2 bg-gray-200 group-hover:opacity-75 relative h-48 w-full">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover object-center"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
                    No Image
                  </div>
                )}
              </div>
              <div className="p-6 flex flex-col justify-between h-[calc(100%-12rem)]">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    {product.name}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    {product.short_description || product.description}
                  </p>
                  {product.stock_status === 'out_of_stock' && (
                    <p className="mt-2 text-sm text-red-600 font-semibold">
                      {t.outOfStock}
                    </p>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-xl font-bold text-gray-900">
                      {formatPrice(product.price, product.currency || 'TWD', locale)}
                    </p>
                    {product.original_price && product.original_price > product.price && (
                      <p className="text-sm text-gray-400 line-through">
                        {formatPrice(product.original_price, product.currency || 'TWD', locale)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleProductClick(product.product_id)}
                    disabled={product.stock_status === 'out_of_stock'}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {product.stock_status === 'out_of_stock' ? t.outOfStock : t.learnMore}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {products.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            {t.noProducts}
          </div>
        )}
      </div>
    </div>
  );
}
