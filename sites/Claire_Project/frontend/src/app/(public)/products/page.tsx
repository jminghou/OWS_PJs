import { Metadata } from 'next';
import { productApi } from '@/lib/api';
import ProductsContent from './ProductsContent';

// ISR: 每 30 分鐘重新驗證
export const revalidate = 1800;

export const metadata: Metadata = {
  title: '服務與產品 | 策略顧問服務',
  description: '選擇適合您的策略顧問服務，包含數位轉型診斷、MarTech 架構規劃、電商增長策略等專業服務。',
  openGraph: {
    title: '服務與產品 | 策略顧問服務',
    description: '選擇適合您的策略顧問服務，包含數位轉型診斷、MarTech 架構規劃、電商增長策略等專業服務。',
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
