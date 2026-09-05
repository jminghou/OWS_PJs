import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { productApi } from '@/lib/api';
import { Product } from '@/types';
import ProductDetailContent from './ProductDetailContent';
import JsonLd from '@/components/platform/seo/JsonLd';
import { buildProductJsonLd, absoluteUrl } from '@/lib/seo';

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
    alternates: { canonical: absoluteUrl(`/products/${product.product_id}`) },
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

  return (
    <>
      <JsonLd data={buildProductJsonLd(product, language)} />
      <ProductDetailContent product={product} language={language} />
    </>
  );
}
