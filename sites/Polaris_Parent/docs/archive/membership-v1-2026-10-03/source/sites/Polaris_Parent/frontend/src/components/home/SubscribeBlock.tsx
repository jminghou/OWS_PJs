import Link from 'next/link';
import SubscribeForm from '@ows/newsletter/components/SubscribeForm';
import { getNewsletterContent, localePath } from '@/i18n/newsletterContent';

const INPUT_CLS =
  'w-full min-w-0 flex-1 rounded-banner border border-warm-300 bg-white px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-purple-500';
const BUTTON_CLS =
  'rounded-banner bg-brand-purple-700 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-brand-purple-800 focus:outline-none focus:ring-2 focus:ring-brand-purple-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

/** 訂閱表單＋站台文案與隱私權連結。source 會記進訂閱紀錄，後台可分辨是哪個位置帶來的。 */
export default function SubscribeBlock({ locale, source }: { locale: string; source: string }) {
  const content = getNewsletterContent(locale);
  const [before, after = ''] = content.formNote.split('{privacy}');
  return (
    <SubscribeForm
      locale={locale}
      source={source}
      labels={content.form}
      inputClassName={INPUT_CLS}
      buttonClassName={BUTTON_CLS}
      note={
        <>
          {before}
          <Link href={localePath(locale, '/privacy')} className="underline underline-offset-2 hover:text-gray-700">
            {content.privacyLinkText}
          </Link>
          {after}
        </>
      }
    />
  );
}
