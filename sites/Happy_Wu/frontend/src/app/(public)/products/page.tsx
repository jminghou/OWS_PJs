import { Metadata } from 'next';
import { productApi } from '@/lib/api';
import ProductsContent from './ProductsContent';

// ISR: 每 30 分鐘重新驗證
export const revalidate = 1800;

export const metadata: Metadata = {
  title: '服務與產品 | Happy Wu',
  description: '瀏覽 Happy Wu 提供的服務與產品。',
  openGraph: {
    title: '服務與產品 | Happy Wu',
    description: '瀏覽 Happy Wu 提供的服務與產品。',
    type: 'website',
  },
};

export default async function ProductsPage() {
  let products: any[] = [];

  try {
    const response = await productApi.getList({
      language: 'zh-TW',
      per_page: 100,
    });
    products = response.products;
  } catch (error: any) {
    console.error('Failed to fetch products:', error.message || error);
  }

  return <ProductsContent products={products} />;
}
