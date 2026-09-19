'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LanguageSwitcher } from '@ows/site-kit';
export default function PublicHeader() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [i18nEnabled, setI18nEnabled] = useState(false);
    const locale = ['zh-CN', 'en', 'ja'].includes(pathname.split('/')[1]) ? pathname.split('/')[1] : 'zh-TW';
    const base = locale === 'zh-TW' ? '' : `/${locale}`;
    const labels = locale === 'en' ? ['Home', 'About', 'Journal', 'Services'] : locale === 'ja' ? ['ホーム', '私について', '記事', 'サービス'] : locale === 'zh-CN' ? ['首页', '关于我', '生活专栏', '服务与产品'] : ['首頁', '關於我', '生活專欄', '服務與產品'];
    const links = [`${base || '/'}#hero`, `${base || '/'}#about`, `${base || '/'}#articles`, `${base || '/'}#products`];
    useEffect(() => { setOpen(false); }, [pathname]);
    useEffect(() => {
        const controller = new AbortController();
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5010/api'}/settings/i18n`, { signal: controller.signal })
            .then(r => r.ok ? r.json() : null).then(data => setI18nEnabled(Boolean(data?.enabled))).catch(() => { });
        return () => controller.abort();
    }, []);
    const navLink = (index: number) => <Link key={index} href={links[index]} onClick={() => setOpen(false)}>{labels[index]}</Link>;
    return <header className="hw-header">
    <div className="hw-topline"><span>A LITTLE SPACE FOR YOURSELF</span><span>工作・育兒・生活，還有我自己</span></div>
    <div className="hw-nav">
      <nav className="hw-nav-side" aria-label="主要導覽">{[0, 1].map(navLink)}</nav>
      <Link className="hw-logo" href={base || '/'} aria-label="職場媽媽崩潰啥？ 首頁"><span className="hw-logo-flower" aria-hidden="true">✳</span><strong>職場媽媽崩潰啥？</strong><small>HAPPY WU · LIFE JOURNAL</small></Link>
      <nav className="hw-nav-side hw-nav-right" aria-label="內容導覽">{[2, 3].map(navLink)}{i18nEnabled && <LanguageSwitcher />}</nav>
      <button className="hw-menu-button" aria-expanded={open} aria-controls="hw-mobile-nav" aria-label={open ? '關閉選單' : '開啟選單'} onClick={() => setOpen(!open)}>{open ? '✕' : '☰'}</button>
    </div>
    {open && <nav id="hw-mobile-nav" className="hw-mobile-nav" aria-label="手機導覽">{[0, 1, 2, 3].map(navLink)}{i18nEnabled && <LanguageSwitcher />}</nav>}
  </header>;
}
