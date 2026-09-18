'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
export default function PublicFooter() {
    const pathname = usePathname();
    const locale = pathname.split('/')[1];
    const base = ['zh-CN', 'en', 'ja'].includes(locale) ? `/${locale}` : '';
    return <footer className="hw-footer"><div className="hw-container hw-footer-inner"><div><Link href={base || '/'} className="hw-footer-brand">職場媽媽崩潰啥？</Link><p>把生活寫下來，也把自己找回來。</p></div><nav aria-label="頁尾導覽"><Link href={`${base}/about`}>關於 Happy Wu</Link><Link href={`${base}/articles`}>所有文章</Link><Link href={`${base}/contact`}>聯絡我</Link></nav></div><div className="hw-container hw-copyright">© {new Date().getFullYear()} 職場媽媽崩潰啥？ <span>Made for real life, with a little room to breathe.</span></div></footer>;
}
