import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { brandButton } from '@/components/ui/BrandButton';
import { reportUi } from '@/lib/report/locale';

/** 某個語言的報告還沒上架：用該語言說明，並附中文版連結 */
export default function ReportUnavailable({ locale, chineseHref }: { locale: string; chineseHref: string }) {
  const ui = reportUi(locale);
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center md:px-6 md:py-24">
      <h1 className="font-heading text-[26px] font-normal text-ink md:text-h2">{ui.unavailableTitle}</h1>
      <p className="mt-3 text-text">{ui.unavailableBody}</p>
      <Link href={chineseHref} className={brandButton({ variant: 'primary', className: 'mt-8' })}>
        {ui.goChinese}
        <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      </Link>
    </div>
  );
}
