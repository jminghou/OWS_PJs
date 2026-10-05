'use client';

import { useRouter } from 'next/navigation';
import { Product } from '@/types';
import { Heart, ShoppingBag } from 'lucide-react';

interface ProductsContentProps {
  products: Product[];
}

export default function ProductsContent({ products }: ProductsContentProps) {
  const router = useRouter();

  return (
    <div className="bg-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            服務與產品
          </h1>
          <p className="mt-4 text-xl text-gray-500">
            選擇適合您的紫微斗數諮詢服務
          </p>
        </div>

        <div className="grid grid-cols-1 gap-y-10 sm:grid-cols-2 gap-x-6 lg:grid-cols-3 xl:gap-x-8">
          {products.map((product) => (
            <div
              key={product.id}
              className="group relative flex flex-col bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100"
            >
              {/* 1. 產品名稱與標籤區域 (最上方) */}
              <div className="px-4 pt-5 pb-3">
                <h3
                  className="text-lg font-bold text-gray-900 cursor-pointer hover:text-indigo-600 transition-colors"
                  onClick={() => router.push(`/products/${product.product_id}`)}
                >
                  {product.name}
                </h3>

                {/* 支援標籤系統 */}
                <div className="flex flex-wrap gap-2 mt-2 min-h-[24px]">
                  {product.tags?.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
                    >
                      {tag.slug}
                    </span>
                  ))}
                </div>
              </div>

              {/* 2. 圖片區域 (高長方型比例) */}
              <div
                className="relative aspect-[3/4] w-full overflow-hidden bg-gray-200 cursor-pointer"
                onClick={() => router.push(`/products/${product.product_id}`)}
              >
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    No Image
                  </div>
                )}

                {/* 售完遮罩 */}
                {product.stock_status === 'out_of_stock' && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
                    <span className="text-white font-bold text-lg tracking-wider">已售完</span>
                  </div>
                )}
              </div>

              {/* 3. 底部區域 (價錢與Icon) */}
              <div className="px-4 py-4 mt-auto border-t border-gray-50 flex items-center justify-between bg-white">
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-2">
                    <p className="text-xl font-bold text-gray-900">
                      NT$ {product.price}
                    </p>
                    {product.original_price && product.original_price > product.price && (
                      <p className="text-xs text-gray-400 line-through">
                        NT$ {product.original_price}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="p-2 rounded-full text-gray-400 hover:bg-pink-50 hover:text-pink-500 transition-colors focus:outline-none"
                    aria-label="加入最愛"
                  >
                    <Heart size={20} />
                  </button>
                  <button
                    className="p-2 rounded-full text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400"
                    disabled={product.stock_status === 'out_of_stock'}
                    aria-label="加入購物車"
                  >
                    <ShoppingBag size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {products.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            目前沒有可用的產品
          </div>
        )}
      </div>
    </div>
  );
}
