import type { CoverPalette, ReportProduct } from '@/lib/report/catalog';

const PALETTES: Record<CoverPalette, { bg: string; spine: string; eyebrow: string; sub: string }> = {
  purple: { bg: 'from-brand-purple-600 to-brand-purple-900', spine: 'bg-brand-purple-950/40', eyebrow: 'text-brand-purple-200', sub: 'text-brand-purple-100' },
  indigo: { bg: 'from-indigo-600 to-indigo-900', spine: 'bg-indigo-950/40', eyebrow: 'text-indigo-200', sub: 'text-indigo-100' },
  rose: { bg: 'from-rose-500 to-rose-800', spine: 'bg-rose-950/40', eyebrow: 'text-rose-200', sub: 'text-rose-100' },
  teal: { bg: 'from-teal-600 to-teal-900', spine: 'bg-teal-950/40', eyebrow: 'text-teal-200', sub: 'text-teal-100' },
};

interface ReportBookCoverProps {
  product: ReportProduct;
  /** 預覽頁用主角姓名取代書名 */
  title?: string;
  subtitle?: string;
  /** xs：圖庫縮圖，只顯示書名 */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * 報告的書封（尚無正式封面圖時以 CSS 繪製）。
 * 之後有設計稿可在 ReportProduct.cover 加圖片欄位，這裡改成顯示圖片。
 */
export default function ReportBookCover({ product, title, subtitle, size = 'md', className = '' }: ReportBookCoverProps) {
  const c = PALETTES[product.cover.palette];
  const titleCls = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg' : size === 'xs' ? 'text-[9px]' : 'text-2xl';
  const thumb = size === 'xs';
  return (
    <div
      className={`relative aspect-[3/4] w-full overflow-hidden rounded-r-lg rounded-l-sm bg-gradient-to-br ${c.bg} text-white shadow-[6px_8px_24px_rgba(40,20,80,0.25)] ${className}`}
    >
      {/* 書背 */}
      <div className={`absolute inset-y-0 left-0 w-[7%] ${c.spine}`} aria-hidden="true" />
      <div className="absolute inset-y-0 left-[7%] w-px bg-white/20" aria-hidden="true" />
      {/* 星點裝飾 */}
      <svg className="absolute right-[10%] top-[8%] h-1/4 w-1/4 opacity-30" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="0.6" />
        <path d="M50 14 L54 46 L86 50 L54 54 L50 86 L46 54 L14 50 L46 46 Z" fill="currentColor" />
      </svg>
      <div className="relative flex h-full flex-col items-center justify-center px-[14%] text-center">
        {!thumb && <p className={`text-[10px] tracking-[0.3em] ${c.eyebrow}`}>{product.cover.eyebrow}</p>}
        <p className={`font-bold leading-snug ${thumb ? '' : 'mt-4'} ${titleCls}`}>{title ?? product.cover.title}</p>
        {!thumb && <p className={`mt-3 text-xs leading-5 ${c.sub}`}>{subtitle ?? product.cover.subtitle}</p>}
      </div>
    </div>
  );
}
