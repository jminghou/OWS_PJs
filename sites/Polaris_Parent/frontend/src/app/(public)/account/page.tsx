'use client';

/**
 * 會員中心：以家人為中心（2026-10-21 改版，取代 10-12 的「以訂單為中心」）。
 * 頁首打招呼 →（有事才出現）需要你幫忙的事 → 分頁：我的家（一位家人一張卡，報告／書／解讀／命盤都掛在人底下）
 * ／購買紀錄／我的優惠。新會員的「我的家」是引導區。訂單號只在購買紀錄與訂單詳情出現。
 */
import MyReportOrders from '@/components/report/orders/MyReportOrders';
import AccountTodos from '@/components/account/AccountTodos';
import FamilyCard from '@/components/account/FamilyCard';
import FamilyChartViewer from '@/components/account/FamilyChartViewer';
import Welcome from '@/components/account/Welcome';
import { buildTodos, groupFamily, groupReports } from '@/components/account/orderModel';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { astrologyApi, membershipApi, reportOrdersApi, type ReportOrderSummary } from '@/lib/api';
import type { MyPerson, MyChart, ZiweiCalcResponse } from '@/lib/api/astrology';
import type {
  ExternalProduct,
  OrderSubmission,
  MemberReward,
} from '@/lib/api/membership';
import {
  ChevronDown,
  Copy,
  LogOut,
  Receipt,
  RotateCcw,
  Ticket,
  type LucideIcon,
} from 'lucide-react';
import BrandButton from '@/components/ui/BrandButton';
import Alert from '@/components/ui/Alert';
import { TAG_BASE } from '@/components/ui/Tag';

// 表單（品牌規範 §6.3）
const INPUT =
  'w-full rounded-2xl border-[1.5px] border-line-strong bg-white px-[18px] py-[13px] text-base text-ink ' +
  'placeholder:text-muted focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
const LABEL = 'mb-1.5 block text-sm font-medium text-ink';
// 分頁／切換：膠囊項目，跟頁首導覽同一套（選中淡藍底、其他 hover 暖灰底）
const pillCls = (active: boolean) =>
  'whitespace-nowrap rounded-full px-3.5 py-2 text-[15px] font-medium transition-colors duration-150 ease-out ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ' +
  (active ? 'bg-blue-50 text-blue-800' : 'text-ink hover:bg-tint active:bg-line');
type Tab = 'home' | 'orders' | 'coupons';
const TABS: { key: Tab; label: string }[] = [
  { key: 'home', label: '我的家' },
  { key: 'orders', label: '購買紀錄' },
  { key: 'coupons', label: '我的優惠' },
];
/** 通知信與舊連結的 ?tab= 值（reports、charts 是改版前的分頁）→ 現在的分頁 */
const TAB_ALIASES: Record<string, Tab> = { home: 'home', reports: 'home', charts: 'home', orders: 'orders', coupons: 'coupons' };
// 登出：結束性動作，hover 走 error 色（不用品牌粉）
const QUIET_DANGER_BTN =
  'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-text transition-colors duration-150 ease-out ' +
  'hover:bg-error-bg hover:text-error-fg active:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100';

/** 回購優惠的送審狀態：後端值不變，只換成客人看得懂的說法 */
const SUB_STATUS_LABELS: Record<string, string> = { 待審核: '確認中', 通過: '已發券', 退回: '需要補資料' };

export default function AccountPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, checkAuth, logout } = useAuthStore();

  const [tab, setTab] = useState<Tab>('home');
  // 通知信或其他頁面帶 ?tab= 進來時直接開該分頁（舊的 reports／charts 都落在「我的家」）
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t && TAB_ALIASES[t]) setTab(TAB_ALIASES[t]);
  }, []);
  const [reportOrders, setReportOrders] = useState<ReportOrderSummary[] | null>(null);
  const [ordersErr, setOrdersErr] = useState('');
  const [people, setPeople] = useState<MyPerson[]>([]);
  const [chartsDone, setChartsDone] = useState(false);
  const [err, setErr] = useState('');
  const [viewing, setViewing] = useState<{ chartId: string; name: string; res: ZiweiCalcResponse } | null>(null);
  const [viewBusy, setViewBusy] = useState(false);

  // 我的優惠
  const [submissions, setSubmissions] = useState<OrderSubmission[]>([]);
  const [rewards, setRewards] = useState<MemberReward[]>([]);
  const [products, setProducts] = useState<ExternalProduct[]>([]);
  const [commerceLoaded, setCommerceLoaded] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [form, setForm] = useState({ product_type_id: 0, external_order_no: '', chart_id: '', note: '' });
  // 補資料重送
  const [resubmitTarget, setResubmitTarget] = useState<OrderSubmission | null>(null);
  const [resubmitNo, setResubmitNo] = useState('');
  const [resubmitNote, setResubmitNote] = useState('');
  const [resubmitBusy, setResubmitBusy] = useState(false);

  // 守衛：未登入 → 導向登入頁
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isLoading, isAuthenticated, router]);

  // 報告訂單與家人的命盤：一進來就一起載入（我的家要把兩者對起來）
  useEffect(() => {
    if (!isAuthenticated) return;
    reportOrdersApi.list().then((r) => setReportOrders(r.orders)).catch((e) => setOrdersErr(e.message || '暫時讀不到你的報告，請稍後再試'));
    // 命盤服務沒開或失敗時靜默降級：報告改依主角名字分組，不顯示錯誤
    astrologyApi.myCharts()
      .then((c) => setPeople(c.people || []))
      .catch(() => setPeople([]))
      .finally(() => setChartsDone(true));
  }, [isAuthenticated]);

  const viewChart = async (c: MyChart, name: string) => {
    if (viewing?.chartId === c.chart_id) {
      setViewing(null);
      return;
    }
    if (!c.birth) {
      setErr('這張命盤少了生辰資料，暫時無法顯示，請聯絡我們');
      return;
    }
    setViewBusy(true);
    setErr('');
    try {
      const res = await astrologyApi.calculate({
        year: c.birth.year,
        month: c.birth.month,
        day: c.birth.day,
        hour: c.birth.hour,
        minute: c.birth.minute,
        gender: c.gender || '男',
        name: c.name || '',
        render: true, // 也取靜態 SVG（供靜態檢視與下載）
        include_chart_json: true,
        include_flow: true,
        // 星場分析：與排盤同一次請求算完（實測 ~1.2 ms），
        // 之後點星曜／切分頁都是純查表，不再打 API。
        include_star_energy: true,
        include_readings: true,
      });
      setViewing({ chartId: c.chart_id, name, res });
    } catch (e: any) {
      setErr(e.message || '命盤暫時打不開，請稍後再試');
    } finally {
      setViewBusy(false);
    }
  };

  // 切到「我的優惠」時載入
  useEffect(() => {
    if (tab !== 'coupons' || !isAuthenticated || commerceLoaded) return;
    (async () => {
      try {
        const [s, r, p] = await Promise.all([
          membershipApi.myOrderSubmissions(),
          membershipApi.myRewards(),
          membershipApi.products(),
        ]);
        setSubmissions(s.submissions || []);
        setRewards(r.rewards || []);
        setProducts(p.products || []);
        setCommerceLoaded(true);
      } catch (e: any) {
        setErr(e.message || '暫時讀不到優惠資料，請稍後再試');
      }
    })();
  }, [tab, isAuthenticated, commerceLoaded]);

  const selectedProduct = products.find((p) => p.id === Number(form.product_type_id));

  const submitOrder = async () => {
    if (!form.product_type_id) {
      setErr('請選擇你買的商品');
      return;
    }
    if (!form.external_order_no.trim()) {
      setErr('請填寫訂單編號');
      return;
    }
    setSubmitBusy(true);
    setErr('');
    try {
      await membershipApi.submitOrder({
        product_type_id: Number(form.product_type_id),
        platform: selectedProduct?.platform || '蝦皮',
        external_order_no: form.external_order_no.trim(),
        chart_id: form.chart_id || null,
        note: form.note.trim() || undefined,
      });
      setSubmitOpen(false);
      setForm({ product_type_id: 0, external_order_no: '', chart_id: '', note: '' });
      const s = await membershipApi.myOrderSubmissions();
      setSubmissions(s.submissions || []);
    } catch (e: any) {
      setErr(e.message || '送出失敗，請稍後再試');
    } finally {
      setSubmitBusy(false);
    }
  };

  const openResubmit = (s: OrderSubmission) => {
    setResubmitTarget(s);
    setResubmitNo(s.external_order_no);
    setResubmitNote('');
    setErr('');
  };

  const doResubmit = async () => {
    if (!resubmitTarget) return;
    if (!resubmitNo.trim()) {
      setErr('請填寫訂單編號');
      return;
    }
    setResubmitBusy(true);
    setErr('');
    try {
      await membershipApi.resubmitOrder(resubmitTarget.id, {
        external_order_no: resubmitNo.trim(),
        note: resubmitNote.trim() || undefined,
      });
      setResubmitTarget(null);
      const s = await membershipApi.myOrderSubmissions();
      setSubmissions(s.submissions || []);
    } catch (e: any) {
      setErr(e.message || '送出失敗，請稍後再試');
    } finally {
      setResubmitBusy(false);
    }
  };

  const copyCode = (code: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(
        () => alert(`已複製優惠碼：${code}`),
        () => {/* ignore */},
      );
    }
  };

  // 送審狀態徽章：已發券 success、需要補資料 error、其餘（確認中）warning（品牌規範 §3.4）
  const subStatusCls = (s: string) =>
    s === '通過'
      ? 'bg-success-bg text-success-fg'
      : s === '退回'
        ? 'bg-error-bg text-error-fg'
        : 'bg-warning-bg text-warning-fg';

  if (isLoading || !isAuthenticated) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted">載入中…</div>;
  }

  // 稱呼：命盤裡「我自己」的名字 → 非 email 的帳號名 → email 的 @ 前段
  const selfName = people.find((p) => p.relation_label === 'self')?.display_name;
  const handle = user?.username && !user.username.includes('@') ? user.username : (user?.email || '').split('@')[0];
  const greetName = selfName || handle;
  const selfPersonId = people.find((p) => p.relation_label === 'self')?.user_id;
  const todos = reportOrders ? buildTodos(reportOrders, Date.now(), selfPersonId) : [];

  const homeReady = reportOrders !== null && chartsDone;
  const family = homeReady ? groupFamily(groupReports(reportOrders!), people) : [];
  const isNew = homeReady && family.length === 0;

  const cardCls = 'flex flex-wrap items-center justify-between gap-3 rounded-inner bg-white p-4 md:px-6';

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:py-12">
      <div className="mb-8 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-[30px] font-normal text-ink md:text-h1">
            嗨，{greetName || '歡迎回來'}
          </h1>
          <p className="mt-1 text-text">你和家人的命盤、報告與書，都在這裡。</p>
        </div>
        {/* 帳號選單：email 與登出收在這裡，不搶畫面 */}
        <details className="group relative shrink-0">
          <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full px-3 py-2 text-sm text-text transition-colors hover:bg-tint focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 [&::-webkit-details-marker]:hidden">
            帳號
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" strokeWidth={2} aria-hidden="true" />
          </summary>
          <div className="absolute right-0 z-20 mt-1 w-64 rounded-2xl bg-white p-2 shadow-lg">
            <p className="truncate px-3 py-2 text-sm text-muted">{user?.email || user?.username}</p>
            <button
              type="button"
              onClick={() => logout().then(() => router.push('/login'))}
              className={QUIET_DANGER_BTN}
            >
              <LogOut className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              登出
            </button>
          </div>
        </details>
      </div>

      {/* 需要你幫忙的事（沒有就不顯示） */}
      {ordersErr && <Alert tone="error" className="mb-6">{ordersErr}</Alert>}
      {todos.length > 0 && <div className="mb-8"><AccountTodos todos={todos} /></div>}

      <div className="-mx-4 mb-5 overflow-x-auto px-4">
        <div className="flex gap-2" role="tablist" aria-label="會員中心分頁">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={pillCls(tab === t.key)}
              onClick={() => { setTab(t.key); setErr(''); }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {err && <Alert tone="error" className="mb-4">{err}</Alert>}

      {tab === 'home' ? (
        !homeReady ? (
          !ordersErr && <p className="text-muted">載入中…</p>
        ) : isNew ? (
          <Welcome />
        ) : (
          <div className="space-y-5">
            {family.map((m) => (
              <FamilyCard
                key={m.key}
                member={m}
                onViewChart={(c) => viewChart(c, m.name)}
                viewingChartId={viewing?.chartId}
                viewBusy={viewBusy}
                viewer={viewing && <FamilyChartViewer key={viewing.chartId} viewing={viewing.res} name={viewing.name} onClose={() => setViewing(null)} />}
              />
            ))}
            <p className="pt-2 text-sm text-text">
              在小紅書、Etsy、Pinkoi 向我們訂過報告？
              <Link href="/account/claim" className="ml-1 text-blue-700 underline-offset-2 hover:underline">用認領碼接到這個帳號</Link>
            </p>
          </div>
        )
      ) : tab === 'orders' ? (
        !reportOrders ? (
          !ordersErr && <p className="text-muted">載入中…</p>
        ) : (
          <MyReportOrders orders={reportOrders} />
        )
      ) : tab === 'coupons' ? (
        // ── 我的優惠（含外部平台訂單換回購優惠） ─────────────────────
        <div className="space-y-8">
          <div className="space-y-3">
            <h2 className="font-heading text-[18px] font-normal text-ink md:text-h4">可以用的優惠</h2>
            {rewards.length === 0 ? (
              <EmptyState icon={Ticket}>目前還沒有優惠。在蝦皮、Pinkoi 買過我們的商品，可以在下面領一張回購優惠。</EmptyState>
            ) : (
              <div className="space-y-2">
                {rewards.map((r) => (
                  <div key={r.id} className={cardCls}>
                    <div className="text-sm text-text">
                      <span className="mr-2 font-latin font-semibold text-success-fg">{r.coupon_code_snapshot}</span>
                      <span className="text-muted">{r.platform}・{r.product_name}</span>
                    </div>
                    <BrandButton variant="soft" size="S" onClick={() => copyCode(r.coupon_code_snapshot)}>
                      <Copy className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                      複製優惠碼
                    </BrandButton>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-heading text-[18px] font-normal text-ink md:text-h4">在蝦皮、Pinkoi 買過？領一張回購優惠</h2>
                <p className="mt-1 text-sm text-text">填上那邊的訂單編號，我們確認後就把優惠碼放到這裡。</p>
              </div>
              <BrandButton
                variant="secondary"
                size="S"
                onClick={() => { setSubmitOpen(true); setErr(''); }}
              >
                填訂單編號
              </BrandButton>
            </div>
            {submissions.length === 0 ? (
              <EmptyState icon={Receipt}>還沒有填過訂單編號。</EmptyState>
            ) : (
              <div className="space-y-2">
                {submissions.map((s) => (
                  <div key={s.id} className={cardCls}>
                    <div className="min-w-0 flex-1 text-sm text-text">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink">{s.product_name}</span>
                        <span className={`${TAG_BASE} ${subStatusCls(s.status)}`}>{SUB_STATUS_LABELS[s.status] || s.status}</span>
                      </div>
                      <span className="text-muted">{s.platform}・訂單編號 </span>
                      <span className="font-latin text-xs">{s.external_order_no}</span>
                      {s.status === '退回' && s.note && (
                        <p className="mt-1 text-[13px] text-error-fg">需要補充：{s.note}</p>
                      )}
                      {s.coupon_code && (
                        <p className="mt-1 text-[13px] text-success-fg">優惠碼：<span className="font-latin font-semibold">{s.coupon_code}</span></p>
                      )}
                    </div>
                    {s.status === '退回' && (
                      <BrandButton variant="soft" size="S" onClick={() => openResubmit(s)}>
                        <RotateCcw className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                        補上資料
                      </BrandButton>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* 填訂單編號 Modal */}
      {submitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-ink/40" onClick={() => setSubmitOpen(false)} />
          <div role="dialog" aria-modal="true" aria-labelledby="submit-order-title" className="relative w-full max-w-md space-y-5 rounded-card bg-white p-7 shadow-lg md:p-8">
            <h3 id="submit-order-title" className="font-heading text-[18px] font-normal text-ink md:text-h4">領回購優惠</h3>
            {products.length === 0 ? (
              <p className="text-sm text-muted">目前沒有可以領優惠的商品。</p>
            ) : (
              <>
                <div>
                  <label htmlFor="so-product" className={LABEL}>你買的商品</label>
                  <select
                    id="so-product"
                    value={form.product_type_id}
                    onChange={(e) => setForm({ ...form, product_type_id: Number(e.target.value) })}
                    className={INPUT}
                  >
                    <option value={0}>請選擇…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}（{p.platform}）</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="so-order-no" className={LABEL}>訂單編號</label>
                  <input
                    id="so-order-no"
                    value={form.external_order_no}
                    onChange={(e) => setForm({ ...form, external_order_no: e.target.value })}
                    className={`${INPUT} font-latin`}
                    placeholder="在蝦皮 / Pinkoi 的訂單編號"
                  />
                </div>
                {people.some((p) => p.charts.length > 0) && (
                  <div>
                    <label htmlFor="so-chart" className={LABEL}>是買給誰的？（選填）</label>
                    <select
                      id="so-chart"
                      value={form.chart_id}
                      onChange={(e) => setForm({ ...form, chart_id: e.target.value })}
                      className={INPUT}
                    >
                      <option value="">不指定</option>
                      {people.flatMap((p) =>
                        p.charts.map((c, i) => (
                          <option key={c.chart_id} value={c.chart_id}>
                            {p.display_name || '（還沒取名字）'}{p.charts.length > 1 ? `（命盤 ${i + 1}）` : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <BrandButton variant="soft" size="S" onClick={() => setSubmitOpen(false)}>
                    取消
                  </BrandButton>
                  <BrandButton variant="primary" size="S" onClick={submitOrder} disabled={submitBusy}>
                    {submitBusy ? '送出中…' : '送出'}
                  </BrandButton>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 補資料重送 Modal */}
      {resubmitTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-ink/40" onClick={() => setResubmitTarget(null)} />
          <div role="dialog" aria-modal="true" aria-labelledby="resubmit-title" className="relative w-full max-w-md space-y-5 rounded-card bg-white p-7 shadow-lg md:p-8">
            <h3 id="resubmit-title" className="font-heading text-[18px] font-normal text-ink md:text-h4">補上資料</h3>
            <p className="text-sm text-text">
              {resubmitTarget.product_name}（{resubmitTarget.platform}）
              {resubmitTarget.note && (
                <span className="mt-1 block text-[13px] text-error-fg">需要補充：{resubmitTarget.note}</span>
              )}
            </p>
            <div>
              <label htmlFor="rs-order-no" className={LABEL}>訂單編號</label>
              <input
                id="rs-order-no"
                value={resubmitNo}
                onChange={(e) => setResubmitNo(e.target.value)}
                className={`${INPUT} font-latin`}
                placeholder="修正後的訂單編號"
              />
            </div>
            <div>
              <label htmlFor="rs-note" className={LABEL}>想跟我們說的話（選填）</label>
              <input
                id="rs-note"
                value={resubmitNote}
                onChange={(e) => setResubmitNote(e.target.value)}
                className={INPUT}
                placeholder="例如：截圖在小紅書私訊給你們了"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <BrandButton variant="soft" size="S" onClick={() => setResubmitTarget(null)}>
                取消
              </BrandButton>
              <BrandButton variant="primary" size="S" onClick={doResubmit} disabled={resubmitBusy}>
                {resubmitBusy ? '送出中…' : '再送一次'}
              </BrandButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 空狀態：Lucide 圖示＋說明，必要時附一個 soft 按鈕。 */
function EmptyState({
  icon: Icon,
  children,
  action,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-white px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-500">
        <Icon className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
      </span>
      <p className="max-w-sm text-sm text-text [text-wrap:pretty]">{children}</p>
      {action}
    </div>
  );
}
