import Link from 'next/link';
import SubscribeForm from '@ows/newsletter/components/SubscribeForm';
import { brandButton } from '@/components/ui/BrandButton';
import { getNewsletterContent, localePath } from '@/i18n/newsletterContent';

/*
 * 電子報膠囊輸入框（docs/BRAND_GUIDELINES.md §6.3、§6.5）。
 * SubscribeForm 在 packages/ 共用、不能改，所以樣式全部從它開放的 className props 帶進去：
 * - 手機：輸入框與按鈕上下排，各自是膠囊；
 * - sm 以上：表單第一層的 flex 容器變成白色膠囊外框（p-[5px]），裡面是無邊框輸入框＋右側 accent 按鈕；
 * - 錯誤訊息、下方小字、送出成功的訊息框也用子選擇器換成品牌 token（覆寫套件內建的 red / gray / green）。
 */
const INPUT_CLS =
  'w-full min-w-0 flex-1 rounded-full border-[1.5px] border-line-strong bg-white px-[18px] py-[13px] text-base text-ink ' +
  'placeholder:text-muted focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 ' +
  'aria-[invalid=true]:border-error ' +
  'sm:border-0 sm:bg-transparent sm:py-2 sm:focus:ring-0';

const BUTTON_CLS = brandButton({ variant: 'accent', size: 'M', className: 'w-full sm:w-auto' });

const FORM_CLS = [
  // sm 以上：外層膠囊
  'sm:[&>div:first-child]:items-center sm:[&>div:first-child]:gap-2 sm:[&>div:first-child]:rounded-full',
  'sm:[&>div:first-child]:bg-white sm:[&>div:first-child]:p-[5px]',
  'sm:[&>div:first-child]:transition-shadow sm:[&>div:first-child]:duration-150 sm:[&>div:first-child]:ease-out',
  'sm:[&>div:first-child:focus-within]:ring-4 sm:[&>div:first-child:focus-within]:ring-blue-100',
  // 錯誤訊息（§6.3：13px、error-fg）
  '[&_[role=alert]]:text-[13px] [&_[role=alert]]:text-error-fg',
  // 表單下方小字
  '[&>div:last-child]:text-muted',
  // 送出成功後的訊息框（§6.4 success 提示框）
  '[&[role=status]]:rounded-inner [&[role=status]]:border-0 [&[role=status]]:bg-success-bg [&[role=status]]:text-success-fg',
  '[&[role=status]]:px-[18px] [&[role=status]]:py-[14px] [&[role=status]]:text-sm [&[role=status]]:leading-relaxed',
].join(' ');

/** 訂閱表單＋站台文案與隱私權連結。source 會記進訂閱紀錄，後台可分辨是哪個位置帶來的。 */
export default function SubscribeBlock({ locale, source }: { locale: string; source: string }) {
  const content = getNewsletterContent(locale);
  const [before, after = ''] = content.formNote.split('{privacy}');
  return (
    <SubscribeForm
      locale={locale}
      source={source}
      labels={content.form}
      className={FORM_CLS}
      inputClassName={INPUT_CLS}
      buttonClassName={BUTTON_CLS}
      note={
        <>
          {before}
          <Link
            href={localePath(locale, '/privacy')}
            className="text-blue-500 underline underline-offset-[3px] transition-colors duration-150 ease-out hover:text-pink-600 focus-visible:rounded-sm2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
          >
            {content.privacyLinkText}
          </Link>
          {after}
        </>
      }
    />
  );
}
