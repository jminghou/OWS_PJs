'use client';
import Link from 'next/link';
import { Briefcase, Heart, Coffee, ArrowUpRight, BookOpen } from 'lucide-react';
import HeroSection from './HeroSection';
import HomepageArticleTile from './HomepageArticleTile';
import { JsonLd, buildItemListJsonLd } from '@ows/site-kit';
import { Content, HomepageSettings } from '@/types';
import { localeContent } from '@/i18n/homePageData';
import { resolveAbout, safeAboutLink } from '@/i18n/aboutDefaults';
import { getImageUrl } from '@/lib/utils';
interface Props {
    domainSection?: React.ReactNode;
    locale: string;
    content: typeof localeContent[string];
    latestPosts: Content[];
    homepageSettings: HomepageSettings;
}
export default function HomePageContent({ domainSection, locale, content, latestPosts, homepageSettings }: Props) {
    const base = locale === 'zh-TW' ? '' : `/${locale}`;
    const itemList = buildItemListJsonLd(latestPosts);
    const zh = locale === 'zh-TW' || locale === 'zh-CN';
    const about = resolveAbout(homepageSettings, locale);
    const aboutLink = safeAboutLink(about.button_url);
    const banner = homepageSettings.banner_section?.[locale] || homepageSettings.banner_section?.['zh-TW'];
    const topics = [
        { icon: Briefcase, title: zh ? '工作裡的我' : 'At work', desc: zh ? '在會議、待辦與期待之間，練習找到自己的步調。' : 'Finding a personal rhythm between meetings and expectations.' },
        { icon: Heart, title: zh ? '媽媽的日常' : 'Motherhood', desc: zh ? '有愛，也有快沒電的時候。記錄育兒路上的真實心情。' : 'The love, the exhaustion, and the everyday moments in between.' },
        { icon: Coffee, title: zh ? '留一點給自己' : 'A little me time', desc: zh ? '一杯咖啡、一本書、一段散步，把生活慢慢找回來。' : 'A cup of coffee, a book, a walk. Small ways to return to yourself.' },
    ];
    return <div className="hw-home">
    {itemList && <JsonLd data={itemList}/>}
    <HeroSection eyebrow="— A little pause in everyday life —" title={content.heroTitle} subtitle={content.heroSubtitle} buttonText={homepageSettings.button_text?.[locale] || homepageSettings.button_text?.['zh-TW'] || content.aboutBtn} buttonLink={`${base}/articles`} backgroundSlides={homepageSettings.slides} locale={locale} pauseOnHover={homepageSettings.pause_on_hover ?? true} lazyLoading={homepageSettings.lazy_loading ?? true}/>
    <section className="hw-section hw-intro" aria-labelledby="intro-title"><div className="hw-container">
      <p className="hw-eyebrow">THE BEAUTY OF REAL LIFE</p><h2 id="intro-title">{banner?.heading || (zh ? '生活不必完美，真實就很好。' : 'Real life. Room to breathe.')}</h2><p className="hw-section-intro">{banner?.description || (zh ? '在職場與家庭之間來回切換，也別忘了照顧那個叫「自己」的人。' : content.bannerDescription)}</p>
      <div className="hw-topics">{topics.map(({ icon: Icon, title, desc }, i) => <div className="hw-topic" key={title}><span className="hw-topic-icon"><Icon size={28} strokeWidth={1.2}/></span><small>0{i + 1}</small><h3>{title}</h3><p>{desc}</p></div>)}</div>
    </div></section>
    <section id="articles" className="hw-section hw-journal" aria-labelledby="journal-title"><div className="hw-container"><div className="hw-section-heading"><div><p className="hw-eyebrow">NOTES FROM EVERYDAY</p><h2 id="journal-title">{zh ? '最近，想和你聊聊' : content.featuredTitle}</h2></div><Link className="hw-text-link" href={`${base}/articles`}>{content.viewMore} <ArrowUpRight size={17}/></Link></div>
      {latestPosts.length ? <div className="hw-article-wall">{latestPosts.map(post => <HomepageArticleTile key={`${post.id}-${post.cover_image}-${post.featured_image}`} post={post} basePath={base} />)}</div> : <div className="hw-empty"><BookOpen size={32} strokeWidth={1}/><h3>{zh ? '故事，正在慢慢寫下。' : content.noContent}</h3><p>{zh ? '新的生活手記會出現在這裡。先坐一下，留一點時間給自己。' : content.bannerDescription}</p></div>}
    </div></section>
    {about.quote && <section className="hw-quote"><p className="hw-eyebrow">A GENTLE REMINDER</p><blockquote>{about.quote}</blockquote><span className="hw-quote-line"/></section>}
    <section id="about" className="hw-section">
      <div className="hw-container hw-about">
        {about.image_url ? <img className="hw-about-photo" src={getImageUrl(about.image_url)} alt={about.title || ''} loading="lazy" /> :
          <div className="hw-about-art"><span className="hw-about-caption">{about.image_caption}</span></div>}
        <div>
          {about.eyebrow && <p className="hw-eyebrow">{about.eyebrow}</p>}
          {about.title && <h2>{about.title}</h2>}
          {about.philosophy && <p className="hw-about-philosophy">{about.philosophy}</p>}
          {about.description && <p className="hw-about-philosophy">{about.description}</p>}
          {!!about.mission_points?.length && <ul className="hw-about-missions">{about.mission_points.filter(point => point.trim()).map((point, index) => <li key={index}>{point}</li>)}</ul>}
          {about.button_text && aboutLink && <Link className="hw-button" href={aboutLink}>{about.button_text} <ArrowUpRight size={16}/></Link>}
        </div>
      </div>
    </section>
    <section id="products" className="hw-products"><div className="hw-container hw-section-heading"><div><p className="hw-eyebrow">MORE WAYS TO CONNECT</p><h2>{content.featuresTitle}</h2><p>{zh ? '把文字之外的想法，慢慢變成新的可能。' : content.featuresDescription}</p></div><Link className="hw-button hw-button-light" href={`${base}/products`}>{zh ? '探索服務與產品' : content.featuresTitle} <ArrowUpRight size={16}/></Link></div></section>
    {domainSection}
  </div>;
}
