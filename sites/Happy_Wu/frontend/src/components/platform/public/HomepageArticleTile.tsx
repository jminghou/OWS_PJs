'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { Content } from '@/types';
import { getGcsImageUrl, getImageUrl } from '@/lib/utils';

export default function HomepageArticleTile({ post, basePath }: { post: Content; basePath: string }) {
  const image = post.cover_image || post.featured_image;
  const original = image ? getImageUrl(image) : '';
  const [src, setSrc] = useState(image ? getGcsImageUrl(image, 'medium') : '');
  return <Link className="hw-wall-tile" href={`${basePath}/posts/${post.slug}`} aria-label={post.title}>
    {src ? <img src={src} alt={post.title} loading="lazy" onError={() => setSrc(src !== original ? original : '')} /> : <span className="hw-wall-fallback"><small>生活手記</small><span>{post.title}</span></span>}
    <span className="hw-wall-caption" aria-hidden="true">{post.title}</span>
  </Link>;
}
