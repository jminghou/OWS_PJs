'use client';

/**
 * 專欄頁頭（IG 個人檔案版位）與精選主題圓圈。
 *
 * 手機：頭像在左、名稱與數字在右；簡介、連結、行動按鈕跨欄放在下方。
 * 桌面：頭像獨立一欄，右側是名稱＋按鈕、數字、簡介（IG 桌面版的排法）。
 * 兩種排法共用同一份 DOM（只有一個 h1），靠 grid 換位置。
 * 圓圈對應「標籤」：點了篩選，再點一次取消。
 */
import Link from 'next/link';
import { Link2, Search } from 'lucide-react';
import { clsx } from 'clsx';
import type { ColumnHighlight, ColumnProfile, ColumnProfileFields, ColumnProfileLink } from '@/lib/api';
import { brandButton } from '@/components/ui/BrandButton';
import { getImageUrl } from '@/lib/utils';
import type { ColumnCopy } from './columnCopy';

/** 品牌雙色漸層環：藍 → 粉（IG 限動環的品牌版） */
const BRAND_RING = 'bg-[linear-gradient(135deg,#0967e7_0%,#3d8af2_35%,#ff3d9b_75%,#ff0084_100%)]';

function SmartLink({ link, className }: { link: ColumnProfileLink; className: string }) {
  return /^https?:\/\//.test(link.url) ? (
    <a href={link.url} target="_blank" rel="noopener noreferrer" className={className}>
      {link.label}
    </a>
  ) : (
    <Link href={link.url} className={className}>
      {link.label}
    </Link>
  );
}

function Stat({ value, label }: { value?: number; label: string }) {
  return (
    <li className="flex flex-col items-center leading-tight md:flex-row md:gap-1.5">
      <span className="font-latin text-[17px] font-bold text-ink md:text-base">
        {value === undefined ? '–' : value.toLocaleString()}
      </span>
      <span className="text-[13px] text-text md:text-base">{label}</span>
    </li>
  );
}

interface ColumnHeaderProps {
  profile: ColumnProfile;
  text: Required<ColumnProfileFields>;
  actions: ColumnProfileLink[];
  copy: ColumnCopy;
  stats: { posts?: number; categories: number; topics: number };
  searchOpen: boolean;
  onToggleSearch: () => void;
}

export default function ColumnHeader({ profile, text, actions, copy, stats, searchOpen, onToggleSearch }: ColumnHeaderProps) {
  return (
    <header className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-x-5 gap-y-1 pt-6 md:grid-cols-[224px_auto_minmax(0,1fr)] lg:grid-cols-[256px_auto_minmax(0,1fr)] md:gap-x-0 md:gap-y-5 md:pt-12 lg:px-12">
      {/* 頭像：品牌漸層環。可能是媒體庫路徑或外部網址，用 img 避開 next/image 網域白名單 */}
      <div
        className={clsx(
          'col-start-1 row-span-2 row-start-1 h-[88px] w-[88px] shrink-0 self-center rounded-full p-[3px] md:row-span-3 md:h-[160px] md:w-[160px]',
          BRAND_RING
        )}
      >
        <div className="h-full w-full overflow-hidden rounded-full border-[3px] border-paper bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={profile.avatar_url ? getImageUrl(profile.avatar_url) : '/brand/logo-qinzi-brand.svg'}
            alt={text.name}
            className={clsx('h-full w-full', profile.avatar_url ? 'object-cover' : 'object-contain p-3 md:p-6')}
          />
        </div>
      </div>

      <h1 className="col-start-2 row-start-1 self-end truncate font-heading text-[22px] font-normal text-ink md:text-h3">
        {text.name}
      </h1>

      <div className="col-span-2 col-start-1 row-start-4 mt-4 flex gap-2 md:col-span-1 md:col-start-3 md:row-start-1 md:ml-6 md:mt-0">
        {actions.map((action, i) => (
          <SmartLink
            key={action.url + i}
            link={action}
            className={brandButton({ variant: i === 0 ? 'secondary' : 'soft', size: 'S', className: 'flex-1 md:flex-none' })}
          />
        ))}
        <button
          type="button"
          onClick={onToggleSearch}
          aria-expanded={searchOpen}
          aria-controls="column-search"
          aria-label={copy.search}
          title={copy.search}
          className={brandButton({ variant: 'soft', size: 'S', className: 'w-9 shrink-0 !px-0' })}
        >
          <Search className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        </button>
      </div>

      <ul className="col-start-2 row-start-2 flex justify-around self-start md:col-span-2 md:col-start-2 md:justify-start md:gap-10">
        <Stat value={stats.posts} label={copy.posts} />
        <Stat value={stats.categories} label={copy.categories} />
        <Stat value={stats.topics} label={copy.topics} />
      </ul>

      <div className="col-span-2 col-start-1 row-start-3 mt-3 space-y-1 md:col-start-2 md:mt-0">
        <p className="text-small text-muted">{text.subtitle}</p>
        <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink [text-wrap:pretty]">{text.bio}</p>
        {profile.links.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
            <Link2 className="h-4 w-4 text-blue-500" strokeWidth={2.25} aria-hidden="true" />
            {profile.links.map((link, i) => (
              <SmartLink
                key={link.url + i}
                link={link}
                className="text-[15px] font-bold text-blue-500 no-underline transition-colors duration-150 ease-out hover:text-pink-600"
              />
            ))}
          </p>
        )}
      </div>
    </header>
  );
}

export function ColumnHighlights({
  highlights,
  activeTag,
  onSelect,
  label,
}: {
  highlights: ColumnHighlight[];
  activeTag: string;
  onSelect: (code: string) => void;
  label: string;
}) {
  if (highlights.length === 0) return null;

  return (
    <nav aria-label={label} className="-mx-4 mt-6 md:mx-0 md:mt-12">
      <ul className="flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:gap-8 md:px-12 [&::-webkit-scrollbar]:hidden">
        {highlights.map((h) => {
          const active = activeTag === h.code;
          const name = h.name || h.code || '';
          return (
            <li key={h.tag_id} className="snap-start">
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(active ? '' : h.code || '')}
                className="group flex w-[72px] flex-col items-center gap-1.5 rounded-sm2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 md:w-[96px]"
              >
                <span
                  className={clsx(
                    'block h-[68px] w-[68px] rounded-full p-[2.5px] transition-transform duration-150 ease-out group-active:scale-95 md:h-[88px] md:w-[88px]',
                    active ? BRAND_RING : 'bg-line-strong'
                  )}
                >
                  <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-[3px] border-paper bg-tint">
                    {h.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getImageUrl(h.image_url)} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span className="font-heading text-[22px] text-blue-600 md:text-[28px]" aria-hidden="true">
                        {Array.from(name)[0]}
                      </span>
                    )}
                  </span>
                </span>
                <span className={clsx('w-full truncate text-center text-[12px] md:text-[13px]', active ? 'font-bold text-blue-600' : 'text-ink')}>
                  {name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
