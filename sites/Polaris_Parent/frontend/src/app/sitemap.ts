import { MetadataRoute } from 'next';
import { contentApi, productApi } from '@/lib/api';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 靜態頁面
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/about`,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/contact`,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/products`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/posts`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];

  // 動態文章頁面
  let postPages: MetadataRoute.Sitemap = [];
  try {
    const response = await contentApi.getList({
      status: 'published',
      per_page: 1000,
      language: 'zh-TW',
    });
    postPages = response.contents.map((post) => ({
      url: `${BASE_URL}/posts/${post.slug}`,
      lastModified: post.updated_at ? new Date(post.updated_at) : new Date(post.created_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch (error) {
    console.error('Sitemap: Failed to fetch posts:', error);
  }

  // 動態商品頁面
  let productPages: MetadataRoute.Sitemap = [];
  try {
    const response = await productApi.getList({
      language: 'zh-TW',
      per_page: 1000,
    });
    productPages = response.products.map((product) => ({
      url: `${BASE_URL}/products/${product.product_id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
  } catch (error) {
    console.error('Sitemap: Failed to fetch products:', error);
  }

  return [...staticPages, ...postPages, ...productPages];
}
