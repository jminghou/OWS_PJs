/**
 * 公開站按鈕（docs/BRAND_GUIDELINES.md §6.1、§8.3）
 *
 * 膠囊形、135° 斜向漸層、無邊框。專案沒有 class-variance-authority，
 * 所以用 variant 對照表產出與規範相同的 class。
 *
 * - 一般按鈕：<BrandButton variant="primary">送出</BrandButton>
 * - 連結外觀：<Link href="/report" className={brandButton({ variant: 'soft' })}>…</Link>
 * - primary 每屏最多一個；accent 的文字一律 ink（粉底禁白字）。
 */
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export type BrandButtonVariant = 'primary' | 'accent' | 'secondary' | 'soft' | 'link';
export type BrandButtonSize = 'L' | 'M' | 'S';

const BASE =
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-body font-bold border-0 ' +
  'no-underline transition-[filter,box-shadow,color] duration-150 ease-out ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ' +
  'disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-disabled:pointer-events-none';

// 漸層按鈕共用的 hover / pressed / disabled（disabled 移除漸層改平塗 line）
const FILLED =
  'hover:shadow-md active:brightness-90 ' +
  'disabled:bg-none disabled:bg-line disabled:text-muted disabled:shadow-none disabled:brightness-100 ' +
  'aria-disabled:bg-none aria-disabled:bg-line aria-disabled:text-muted aria-disabled:shadow-none';

const VARIANTS: Record<BrandButtonVariant, string> = {
  primary: `${FILLED} bg-btn-primary text-white hover:brightness-[1.08]`,
  accent: `${FILLED} bg-btn-accent text-ink hover:brightness-[1.06]`,
  secondary: `${FILLED} bg-btn-secondary text-white hover:brightness-[1.15]`,
  soft: `${FILLED} bg-btn-soft text-ink hover:brightness-[.97]`,
  link: 'bg-transparent text-blue-500 hover:text-pink-600 disabled:text-muted aria-disabled:text-muted',
};

// S 只有 36px 高：手機上用透明的 before 把可點範圍撐到 44px
const SIZES: Record<BrandButtonSize, string> = {
  L: 'h-14 px-[30px] text-[17px]',
  M: 'h-12 px-6 text-[15px]',
  S:
    'h-9 px-4 text-[14px] ' +
    "before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[''] md:before:hidden",
};

export function brandButton({
  variant = 'primary',
  size = 'M',
  className,
}: { variant?: BrandButtonVariant; size?: BrandButtonSize; className?: string } = {}) {
  // link 變體是文字連結，不吃尺寸的高度與內距
  return clsx(BASE, VARIANTS[variant], variant === 'link' ? 'h-auto p-0 text-[15px]' : SIZES[size], className);
}

export interface BrandButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BrandButtonVariant;
  size?: BrandButtonSize;
}

const BrandButton = forwardRef<HTMLButtonElement, BrandButtonProps>(
  ({ variant, size, className, type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={brandButton({ variant, size, className })} {...props} />
  )
);
BrandButton.displayName = 'BrandButton';

export default BrandButton;
