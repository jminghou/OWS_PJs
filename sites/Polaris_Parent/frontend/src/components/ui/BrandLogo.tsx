/**
 * 親紫之間 Logo（docs/BRAND_GUIDELINES.md §2）
 *
 * 背景對應：白／暖白／墨底用 brand（全彩）；品牌藍底用 white；品牌粉底、輔助色淡底用 ink。
 * 一律只設寬度、讓高度依原始比例算出，禁止變形、換色、加效果。
 */
import Image from 'next/image';
import { clsx } from 'clsx';

export type LogoTone = 'brand' | 'white' | 'ink';

// 圖形 viewBox 307.9 × 149.37
const RATIO = 149.37 / 307.9;

interface LogoMarkProps {
  tone?: LogoTone;
  /** 圖形寬度（px）；單圖形最小 32px */
  width?: number;
  className?: string;
  priority?: boolean;
  /** 單獨使用圖形時給替代文字；跟字標一起出現時留空避免重複朗讀 */
  alt?: string;
}

/** C 單圖形：兩隻青蛙 */
export function LogoMark({ tone = 'brand', width = 58, className, priority, alt = '親紫之間' }: LogoMarkProps) {
  return (
    <Image
      src={`/brand/logo-qinzi-${tone}.svg`}
      alt={alt}
      width={width}
      height={Math.round(width * RATIO)}
      priority={priority}
      unoptimized
      className={clsx('shrink-0', className)}
      style={{ width, height: 'auto' }}
    />
  );
}

interface LogoLockupProps {
  tone?: LogoTone;
  /** 圖形寬度（px） */
  markWidth?: number;
  /** 字標，預設「親紫之間」（各語系可傳入對應站名） */
  name?: string;
  /** 是否顯示英文副標 POLARIS PARENT */
  tagline?: boolean;
  /** 字標的字級 class */
  nameClassName?: string;
  className?: string;
  priority?: boolean;
}

/** A 橫式（標準）：圖形在左、字標在右。用在頁首、頁尾。 */
export function LogoLockup({
  tone = 'brand',
  markWidth = 58,
  name = '親紫之間',
  tagline = false,
  nameClassName = 'text-[19px]',
  className,
  priority,
}: LogoLockupProps) {
  // 墨底用全彩圖形時，字標要反白；藍底反白版同理
  const nameColor = tone === 'brand' ? 'text-ink' : tone === 'white' ? 'text-white' : 'text-ink';
  return (
    <span className={clsx('inline-flex items-center gap-3', className)}>
      <LogoMark tone={tone} width={markWidth} alt="" priority={priority} />
      <span className="flex flex-col leading-none">
        <span className={clsx('font-heading tracking-[.06em]', nameColor, nameClassName)}>{name}</span>
        {tagline && (
          <span className="mt-1.5 font-latin text-[12px] tracking-[.2em] text-muted">POLARIS PARENT</span>
        )}
      </span>
    </span>
  );
}
