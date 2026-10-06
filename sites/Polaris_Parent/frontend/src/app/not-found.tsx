import Link from 'next/link';
import { brandButton } from '@/components/ui/BrandButton';

// 根層級 404 不在 .public-site 裡，字體與底色要自己帶（docs/BRAND_GUIDELINES.md §3、§4）
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper font-body">
      <div className="px-4 text-center md:px-6">
        <h1 className="mb-4 font-latin text-[40px] font-extrabold leading-[1.25] text-blue-500 md:text-display">404</h1>
        <h2 className="mb-2 font-heading text-[22px] font-normal leading-[1.4] text-ink md:text-h3">
          找不到頁面
        </h2>
        <p className="mb-8 text-text [text-wrap:pretty]">
          您要找的頁面不存在或已被移除。
        </p>
        <Link href="/" className={brandButton({ variant: 'primary' })}>
          返回首頁
        </Link>
      </div>
    </div>
  );
}
