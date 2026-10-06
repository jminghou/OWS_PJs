import type { CoverPalette, ReportProduct } from '@/lib/report/catalog';
import { LogoMark, type LogoTone } from '@/components/ui/BrandLogo';

/**
 * 書封配色：品牌規範 v3 不用紫色與神祕漸層，改為平塗的品牌色。
 * palette 的鍵名沿用 catalog 既有值（purple / indigo / rose / teal），只換成對應的品牌色。
 * Logo 依規範 §2.2 背景對應：墨底全彩、藍底反白、淡底單色墨。
 */
const PALETTES: Record<
  CoverPalette,
  { bg: string; text: string; spine: string; rule: string; eyebrow: string; sub: string; logo: LogoTone }
> = {
  purple: { bg: 'bg-ink', text: 'text-white', spine: 'bg-white/10', rule: 'bg-white/20', eyebrow: 'text-[#D5D7E0]', sub: 'text-[#D5D7E0]', logo: 'brand' },
  indigo: { bg: 'bg-blue-500', text: 'text-white', spine: 'bg-ink/20', rule: 'bg-white/30', eyebrow: 'text-blue-50', sub: 'text-blue-50', logo: 'white' },
  rose: { bg: 'bg-pink-50', text: 'text-ink', spine: 'bg-ink/5', rule: 'bg-ink/10', eyebrow: 'text-pink-800', sub: 'text-pink-800', logo: 'ink' },
  teal: { bg: 'bg-blue-50', text: 'text-ink', spine: 'bg-ink/5', rule: 'bg-ink/10', eyebrow: 'text-blue-800', sub: 'text-blue-800', logo: 'ink' },
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
  const titleCls =
    size === 'lg' ? 'text-[28px]' : size === 'sm' ? 'text-[18px]' : size === 'xs' ? 'text-[9px]' : 'text-[22px]';
  const thumb = size === 'xs';
  // 單圖形最小 32px（規範 §2.3）；縮圖太小就不放 Logo
  const logoWidth = size === 'lg' ? 64 : size === 'md' ? 56 : 40;
  return (
    <div
      className={`relative aspect-[3/4] w-full overflow-hidden ${
        thumb ? 'rounded-l-sm rounded-r-md' : 'rounded-l-md rounded-r-sm2'
      } ${c.bg} ${c.text} shadow-md ${className}`}
    >
      {/* 書背 */}
      <div className={`absolute inset-y-0 left-0 w-[7%] ${c.spine}`} aria-hidden="true" />
      <div className={`absolute inset-y-0 left-[7%] w-px ${c.rule}`} aria-hidden="true" />
      <div className="relative flex h-full flex-col items-center justify-center px-[14%] text-center">
        {!thumb && <LogoMark tone={c.logo} width={logoWidth} alt="" className="mb-4" />}
        {!thumb && <p className={`text-[10px] tracking-[0.3em] ${c.eyebrow}`}>{product.cover.eyebrow}</p>}
        <p className={`font-heading leading-snug ${thumb ? '' : 'mt-3'} ${titleCls}`}>{title ?? product.cover.title}</p>
        {!thumb && <p className={`mt-3 text-xs leading-5 ${c.sub}`}>{subtitle ?? product.cover.subtitle}</p>}
      </div>
    </div>
  );
}
