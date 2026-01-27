import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { productApi } from '@/lib/api';
import { Product } from '@/types';
import ProductDetailContent from './ProductDetailContent';

interface ProductDetailPageProps {
  params: Promise<{
    product_id: string;
  }>;
  searchParams: Promise<{
    lang?: string;
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
    console.error('Error fetching product detail:', error.message || error);
    return null;
  }
}

export async function generateMetadata({ params, searchParams }: ProductDetailPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const language = resolvedSearchParams.lang || 'zh-TW';
  const currency = resolvedSearchParams.currency || 'TWD';
  const product = await getProductDetail(resolvedParams.product_id, language, currency);

  if (!product) {
    return {
      title: '產品不存在',
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
  const language = resolvedSearchParams.lang || 'zh-TW';
  const currency = resolvedSearchParams.currency || 'TWD';
  const product = await getProductDetail(resolvedParams.product_id, language, currency);

  if (!product) {
    notFound();
  }

  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.image || product.detail_content?.featured_image,
    url: `${BASE_URL}/products/${product.product_id}`,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'TWD',
      availability: product.stock_status === 'out_of_stock'
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetailContent product={product} language={language} />
    </>
  );
}
