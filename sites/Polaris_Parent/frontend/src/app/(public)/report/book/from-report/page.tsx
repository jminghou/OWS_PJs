'use client';

/**
 * 用我的報告做成書：選一份已購買的報告 → 加購頁（只處理實體書：規格、數量、客製、設計你的書、收件資料）。
 * 書裡的改寫與加內容只套用在這本書上，原本的報告不受影響；付款後會員中心會多一本新的書。
 * 未登入 → 先登入再回來。在外部平台購買的報告官網暫不開放加購，列出但不能選。
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import { brandButton } from '@/components/ui/BrandButton';
import { useAuthStore } from '@/store/auth';
import { reportOrdersApi } from '@/lib/api';
import { bookTitle, ownedBooks, reportStatusText, type OwnedBook } from '@/components/account/orderModel';
import { OFFER_HREFS, OFFER_NAMES } from '@/lib/report/offers';

const HERE = OFFER_HREFS.fromReport;

export default function FromReportPage() {
  const router = useRouter();
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [checked, setChecked] = useState(false);
  const [books, setBooks] = useState<OwnedBook[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuth().finally(() => setChecked(true));
  }, [checkAuth]);

  useEffect(() => {
    if (!checked) return;
    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(HERE)}`);
      return;
    }
    reportOrdersApi.list()
      .then((r) => setBooks(ownedBooks(r.orders)))
      .catch((e) => setError(e.message || '無法載入你的報告'));
  }, [checked, isAuthenticated, router]);

  if (!checked || !isAuthenticated) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 md:px-6 md:py-16">
      <Link href={OFFER_HREFS.book} className="inline-flex min-h-[44px] items-center gap-1 text-sm text-muted hover:text-blue-500">
        <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> 回到{OFFER_NAMES.book}
      </Link>
      <h1 className="mt-2 font-heading text-[28px] font-normal text-ink md:text-h2">要把哪一份報告做成書？</h1>
      <p className="mt-2 text-text">
        選好之後，可以挑規格與數量，並在書裡修改文字、放進照片。這些修改只會出現在這本書上，原本的報告不會被改動。
      </p>

      <div className="mt-8 space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        {books === null ? (!error && <p className="text-muted">載入中…</p>) : books.length === 0 ? (
          <div className="rounded-card bg-white p-7 text-text">
            <p>你還沒有已完成付款的報告。</p>
            <p className="mt-1 text-sm text-muted">可以直接做一本{OFFER_NAMES.newBook}，或先購買{OFFER_NAMES.digital}。</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={OFFER_HREFS.newBook} className={brandButton({ variant: 'primary', size: 'S' })}>{OFFER_NAMES.newBook}</Link>
              <Link href={OFFER_HREFS.digital} className={brandButton({ variant: 'soft', size: 'S' })}>購買{OFFER_NAMES.digital}</Link>
            </div>
          </div>
        ) : books.map((b) => (
          <div key={b.order.order_no} className="flex flex-wrap items-center gap-4 rounded-card bg-white p-5 md:p-6">
            <BookOpen className="h-6 w-6 shrink-0 text-blue-500" strokeWidth={1.75} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{bookTitle(b.order)}</p>
              <p className="mt-0.5 text-sm text-text">
                {b.isPhysical ? `${OFFER_NAMES.digital}＋${OFFER_NAMES.book}` : OFFER_NAMES.digital}・{reportStatusText(b.order)}
              </p>
              {b.external && <p className="mt-1 text-caption text-muted">在外部平台購買的報告，請透過原平台與我們聯繫加印。</p>}
              {!b.external && !b.canPrint && <p className="mt-1 text-caption text-muted">{OFFER_NAMES.book}目前沒有開放購買。</p>}
            </div>
            {b.canPrint && (
              <Link href={OFFER_HREFS.bookFor(b.order.order_no)} className={brandButton({ variant: 'primary', size: 'S' })}>
                {b.isPhysical ? '再印一本' : '做成書'}
                <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
