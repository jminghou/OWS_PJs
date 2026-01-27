import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { productApi } from '@/lib/api';
import { Product } from '@/types';
import ProductDetailContent from '@/app/(public)/products/[product_id]/ProductDetailContent';

// 設定 ISR：每小時重新驗證一次
export const revalidate = 3600;

interface ProductDetailPageProps {
  params: Promise<{
    locale: string;
    product_id: string;
  }>;
  searchParams: Promise<{
    currency?: string;
  }>;
}

async function getProductDetail(
  productId: string,
  language: string = 'zh-TW',
  currency: string = 'TWD'
): Promise<Product | null> {
  try {
    const product = await productApi.getById(productId, language, currency);
    return product;
  } catch (error: any) {
    console.error('Error fetching product detail:', error);
    return null;
  }
}

// 生成靜態路徑以利於 ISR
export async function generateStaticParams() {
  try {
    // 取得所有已啟用的產品列表 (預設抓取首頁顯示的部分產品)
    const response = await productApi.getList({ per_page: 100 });
    
    const locales = ['zh-TW', 'zh-CN', 'en', 'ja'];
    const params = [];

    for (const product of response.products) {
      for (const locale of locales) {
        params.push({
          locale,
          product_id: product.product_id,
        });
      }
    }

    return params;
  } catch (error) {
    console.error('Error generating product static params:', error);
    return [];
  }
}

// 多語言 metadata 翻譯
const metadataTranslations: Record<string, any> = {
  'zh-TW': {
    notFound: '產品不存在',
  },
  'en': {
    notFound: 'Product Not Found',
  },
  'ja': {
    notFound: '製品が見つかりません',
  },
  'zh-CN': {
    notFound: '产品不存在',
  },
};

export async function generateMetadata({ params, searchParams }: ProductDetailPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const language = resolvedParams.locale || 'zh-TW';
  const currency = resolvedSearchParams.currency || 'TWD';
  const product = await getProductDetail(resolvedParams.product_id, language, currency);

  const t = metadataTranslations[language] || metadataTranslations['zh-TW'];

  if (!product) {
    return {
      title: t.notFound,
    };
  }

  const content = product.detail_content;

  return {
    title: content?.title || product.name,
    description: content?.summary || product.description,
    openGraph: {
      type: 'article',
      title: content?.title || product.name,
      description: content?.summary || product.description,
      images: content?.featured_image ? [content.featured_image] : (product.image ? [product.image] : undefined),
    },
    twitter: {
      card: 'summary_large_image',
      title: content?.title || product.name,
      description: content?.summary || product.description,
      images: content?.featured_image ? [content.featured_image] : (product.image ? [product.image] : undefined),
    },
  };
}

export default async function ProductDetailPage({ params, searchParams }: ProductDetailPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const language = resolvedParams.locale || 'zh-TW';
  const currency = resolvedSearchParams.currency || 'TWD';
  const product = await getProductDetail(resolvedParams.product_id, language, currency);

  if (!product) {
    notFound();
  }

  return <ProductDetailContent product={product} language={language} />;
}
