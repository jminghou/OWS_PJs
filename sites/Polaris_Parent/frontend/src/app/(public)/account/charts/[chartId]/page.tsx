'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ZiweiChart, NAMED_THEMES } from '@ows/ziwei-chart';
import { StarfieldSection } from '@ows/ziwei-app';
import { useAuthStore } from '@/store/auth';
import { astrologyApi, membershipApi } from '@/lib/api';
import type { MyPerson, MyChart, ZiweiCalcResponse } from '@/lib/api/astrology';
import type { ExternalProduct, OrderSubmission, SavedArticle } from '@/lib/api/membership';
import { ArrowLeft, ExternalLink, SearchX, Trash2 } from 'lucide-react';
import BrandButton, { brandButton } from '@/components/ui/BrandButton';
import Alert from '@/components/ui/Alert';
import Tag, { TAG_BASE } from '@/components/ui/Tag';

// 表單（品牌規範 §6.3）
const INPUT =
  'w-full rounded-2xl border-[1.5px] border-line-strong bg-white px-[18px] py-[13px] text-base text-ink ' +
  'placeholder:text-muted focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
const LABEL = 'mb-1.5 block text-sm font-medium text-ink';

const RELATIONS: { value: string; label: string }[] = [
  { value: 'self', label: '我自己' },
  { value: 'father', label: '父親' },
  { value: 'mother', label: '母親' },
  { value: 'son', label: '兒子' },
  { value: 'daughter', label: '女兒' },
  { value: 'brother', label: '兄弟' },
  { value: 'sister', label: '姊妹' },
  { value: 'spouse', label: '配偶' },
  { value: 'friend', label: '朋友' },
  { value: 'other', label: '其他' },
];

const birthText = (c?: MyChart | null) =>
  c?.birth
    ? `${c.birth.year}/${c.birth.month}/${c.birth.day} ${String(c.birth.hour).padStart(2, '0')}:${String(c.birth.minute).padStart(2, '0')}`
    : c?.clock_time || '';

export default function ChartDetailPage() {
  const router = useRouter();
  const params = useParams();
  const chartId = String(params?.chartId || '');
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

  const [people, setPeople] = useState<MyPerson[]>([]);
  const [products, setProducts] = useState<ExternalProduct[]>([]);
  const [orders, setOrders] = useState<OrderSubmission[]>([]);
  const [articles, setArticles] = useState<SavedArticle[]>([]);
  const [chartRender, setChartRender] = useState<ZiweiCalcResponse | null>(null);
  /** 命盤上點到的宮位（1…C）；星場分析的星曜能量分頁會收斂到這一宮。 */
  const [axisPalace, setAxisPalace] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  // 編輯狀態
  const [editName, setEditName] = useState('');
  const [editRelation, setEditRelation] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // 訂單登錄
  const [orderProductId, setOrderProductId] = useState(0);
  const [orderNo, setOrderNo] = useState('');
  const [orderBusy, setOrderBusy] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isLoading, isAuthenticated, router]);

  // 找出本命盤所屬的人與命盤
  const { person, chart } = useMemo(() => {
    for (const p of people) {
      const c = p.charts.find((x) => x.chart_id === chartId);
      if (c) return { person: p, chart: c };
    }
    return { person: null as MyPerson | null, chart: null as MyChart | null };
  }, [people, chartId]);

  const reload = async () => {
    const [c, p, o, a] = await Promise.all([
      astrologyApi.myCharts(),
      membershipApi.products(),
      membershipApi.myOrderSubmissions(),
      membershipApi.savedArticles(),
    ]);
    setPeople(c.people || []);
    setProducts(p.products || []);
    setOrders(o.submissions || []);
    setArticles(a.articles || []);
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        await reload();
      } catch (e: any) {
        setErr(e.message || '載入失敗');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated]);

  // 取得人/盤後，初始化編輯欄並重繪命盤
  useEffect(() => {
    if (!chart) return;
    setEditName(chart.name || '');
    setEditRelation(person?.relation_label || '');
    if (!chart.birth) return;
    let active = true;
    (async () => {
      try {
        const res = await astrologyApi.calculate({
          year: chart.birth!.year,
          month: chart.birth!.month,
          day: chart.birth!.day,
          hour: chart.birth!.hour,
          minute: chart.birth!.minute,
          gender: chart.gender || '男',
          name: chart.name || '',
          render: false,
          include_chart_json: true,
          include_flow: true,
          // 星場分析：與排盤同一次請求算完（實測 ~1.2 ms），
          // 之後點星曜／切分頁都是純查表，不再打 API。
          include_star_energy: true,
          include_readings: true,
        });
        if (active) setChartRender(res);
      } catch {
        /* 重繪失敗不阻斷頁面 */
      }
    })();
    return () => {
      active = false;
    };
  }, [chart, person]);

  const chartOrders = orders.filter((o) => String(o.chart_id ?? '') === chartId);
  const chartArticles = articles.filter((a) => String(a.related_chart_id ?? '') === chartId);

  const saveEdit = async () => {
    setSavingEdit(true);
    setErr('');
    setMsg('');
    try {
      await astrologyApi.updateChart(chartId, { name: editName, relation_label: editRelation });
      await reload();
      setMsg('已更新');
    } catch (e: any) {
      setErr(e.message || '更新失敗');
    } finally {
      setSavingEdit(false);
    }
  };

  // ── 命盤升級 / 降級（流運資料）──
  const [fortuneBusy, setFortuneBusy] = useState(false);

  const upgradeFortune = async () => {
    setFortuneBusy(true);
    setErr('');
    setMsg('');
    try {
      await astrologyApi.upgradeChart(chartId);
      await reload();
      setMsg('已升級為完整版（含大限 / 流年 / 小限流運資料）。');
    } catch (e: any) {
      setErr(e.message || '升級失敗');
    } finally {
      setFortuneBusy(false);
    }
  };

  const downgradeFortune = async () => {
    if (!confirm('確認降級為本命版？流運資料將被移除（之後可隨時再升級補回，無資料損失）。')) return;
    setFortuneBusy(true);
    setErr('');
    setMsg('');
    try {
      await astrologyApi.downgradeChart(chartId);
      await reload();
      setMsg('已降級為本命版。');
    } catch (e: any) {
      setErr(e.message || '降級失敗');
    } finally {
      setFortuneBusy(false);
    }
  };

  const removeChart = async () => {
    if (!confirm('確認刪除此命盤？此動作無法復原。')) return;
    setErr('');
    try {
      await astrologyApi.deleteChart(chartId);
      router.push('/account');
    } catch (e: any) {
      setErr(e.message || '刪除失敗');
    }
  };

  const submitChartOrder = async () => {
    if (!orderProductId) {
      setErr('請選擇商品');
      return;
    }
    if (!orderNo.trim()) {
      setErr('請輸入訂單號');
      return;
    }
    const product = products.find((p) => p.id === orderProductId);
    setOrderBusy(true);
    setErr('');
    setMsg('');
    try {
      await membershipApi.submitOrder({
        product_type_id: orderProductId,
        platform: product?.platform || '蝦皮',
        external_order_no: orderNo.trim(),
        chart_id: chartId,
      });
      setOrderNo('');
      setOrderProductId(0);
      const o = await membershipApi.myOrderSubmissions();
      setOrders(o.submissions || []);
      setMsg('訂單已送出審核');
    } catch (e: any) {
      setErr(e.message || '登錄訂單失敗');
    } finally {
      setOrderBusy(false);
    }
  };

  if (isLoading || !isAuthenticated || loading) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted">載入中…</div>;
  }

  if (!chart) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="flex flex-col items-center gap-3 rounded-card bg-white px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-500">
            <SearchX className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
          </span>
          <p className="text-sm text-text">找不到這張命盤，或它不屬於你的帳號。</p>
          <Link href="/account" className={brandButton({ variant: 'soft', size: 'S' })}>
            <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            回會員中心
          </Link>
        </div>
      </div>
    );
  }

  const cardCls = 'rounded-card bg-white p-6 md:p-8';
  // 盤面卡片：手機內距縮小，讓十二宮盤面有足夠寬度
  const chartCardCls = 'rounded-card bg-white p-3 md:p-8';
  const sectionTitle = 'mb-3 font-heading text-[18px] font-normal text-ink md:text-h4';
  const statusCls = (s: string) =>
    s === '通過' ? 'bg-success-bg text-success-fg' : s === '退回' ? 'bg-error-bg text-error-fg' : 'bg-warning-bg text-warning-fg';

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 md:py-12">
      <div className="flex items-center justify-between">
        <Link
          href="/account"
          className="inline-flex items-center gap-1 rounded-full text-sm text-blue-500 transition-colors duration-150 ease-out hover:text-pink-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          會員中心
        </Link>
        <button
          type="button"
          onClick={removeChart}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm text-error-fg transition-colors duration-150 ease-out hover:bg-error-bg active:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          刪除命盤
        </button>
      </div>

      {err && <Alert tone="error">{err}</Alert>}
      {msg && <Alert tone="success">{msg}</Alert>}

      {/* 基本資料 + 編輯 */}
      <div className={cardCls}>
        <h1 className="mb-1 font-heading text-[26px] font-normal text-ink md:text-h2">{chart.name || '（未命名）'}</h1>
        <p className="mb-5 text-sm text-muted">
          {chart.gender === 'F' || chart.gender === '女' ? '女' : '男'}　<span className="font-latin">{birthText(chart)}</span>
          <span className="ml-2 font-latin text-xs">#{chartId.slice(-6)}</span>
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cd-name" className={LABEL}>名稱</label>
            <input
              id="cd-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="cd-relation" className={LABEL}>與本人的關係</label>
            <select
              id="cd-relation"
              value={editRelation}
              onChange={(e) => setEditRelation(e.target.value)}
              className={INPUT}
            >
              <option value="">未設定</option>
              {RELATIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <BrandButton variant="secondary" size="S" onClick={saveEdit} disabled={savingEdit}>
            {savingEdit ? '儲存中…' : '儲存變更'}
          </BrandButton>
        </div>
      </div>

      {/* 命盤版本（本命版 / 完整版）*/}
      <div className={cardCls}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-text">
            <span className="font-medium text-ink">命盤版本</span>
            {chart.has_fortune ? (
              <Tag tone="category">完整版（含大限 / 流年 / 小限）</Tag>
            ) : (
              <span className={`${TAG_BASE} bg-tint text-text`}>本命版</span>
            )}
          </div>
          {chart.has_fortune ? (
            <BrandButton variant="soft" size="S" onClick={downgradeFortune} disabled={fortuneBusy}>
              {fortuneBusy ? '處理中…' : '降級為本命版'}
            </BrandButton>
          ) : (
            <BrandButton variant="primary" size="S" onClick={upgradeFortune} disabled={fortuneBusy}>
              {fortuneBusy ? '處理中…' : '升級為完整版'}
            </BrandButton>
          )}
        </div>
        <p className="mt-3 text-caption text-muted">
          完整版會建立大限 / 流年 / 小限的流運檢索資料（需付費會員資格）；降級僅移除流運資料，本命盤保留，可隨時再升級補回。
        </p>
      </div>

      {/* 盤面 */}
      {chartRender?.chart_json ? (
        <div className={chartCardCls}>
          <ZiweiChart
            chart={chartRender.chart_json}
            flow={chartRender.flow ?? undefined}
            theme={NAMED_THEMES.light}
            onPalaceClick={setAxisPalace}
          />
        </div>
      ) : chart.birth ? (
        <p className="text-sm text-muted">命盤繪製中…</p>
      ) : (
        <p className="text-sm text-muted">此命盤缺少生辰資料，無法繪製盤面。</p>
      )}

      {/* 星場分析（點上方命盤的宮位，星曜能量會收斂到該宮） */}
      {(chartRender?.star_energy || chartRender?.readings) && (
        <div className={chartCardCls}>
          <StarfieldSection
            starEnergy={chartRender.star_energy}
            readings={chartRender.readings}
            palaceCode={axisPalace}
          />
        </div>
      )}

      {/* 為這張盤下單 */}
      <div className={cardCls}>
        <h2 className={sectionTitle}>為這張盤下單</h2>
        {products.length === 0 ? (
          <p className="text-sm text-muted">目前沒有可購買的商品。</p>
        ) : (
          <>
            <div className="mb-5 space-y-2">
              {products.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-text">{p.name}<span className="ml-1 text-muted">（{p.platform}）</span></span>
                  {p.external_url && (
                    <a
                      href={p.external_url}
                      target="_blank"
                      rel="noreferrer"
                      className={brandButton({ variant: 'soft', size: 'S' })}
                    >
                      前往購買
                      <ExternalLink className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                    </a>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-line pt-4">
              <p className="mb-3 text-sm text-text">在平台完成購買後，於此登錄訂單號（會自動關聯這張盤）：</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  aria-label="商品"
                  value={orderProductId}
                  onChange={(e) => setOrderProductId(Number(e.target.value))}
                  className={`${INPUT} sm:w-auto`}
                >
                  <option value={0}>選擇商品…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input
                  aria-label="訂單號"
                  value={orderNo}
                  onChange={(e) => setOrderNo(e.target.value)}
                  placeholder="訂單號"
                  className={`${INPUT} flex-1 font-latin`}
                />
                <BrandButton variant="secondary" size="M" onClick={submitChartOrder} disabled={orderBusy}>
                  {orderBusy ? '送出中…' : '登錄訂單'}
                </BrandButton>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 此盤的購買記錄 */}
      <div className={cardCls}>
        <h2 className={sectionTitle}>此盤的購買記錄</h2>
        {chartOrders.length === 0 ? (
          <p className="text-sm text-muted">尚無購買記錄。</p>
        ) : (
          <div className="divide-y divide-line">
            {chartOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <span className="text-ink">{o.product_name}</span>
                  <span className="ml-2 font-latin text-xs text-muted">{o.external_order_no}</span>
                  {o.coupon_code && <span className="ml-2 font-latin text-xs font-semibold text-success-fg">{o.coupon_code}</span>}
                </div>
                <span className={`${TAG_BASE} ${statusCls(o.status)}`}>{o.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 相關收藏文章 */}
      {chartArticles.length > 0 && (
        <div className={cardCls}>
          <h2 className={sectionTitle}>相關收藏文章</h2>
          <div className="space-y-1.5">
            {chartArticles.map((a) => (
              <a
                key={a.id}
                href={`/posts/${a.slug}`}
                className="block rounded-sm2 text-sm text-blue-500 underline-offset-[3px] transition-colors duration-150 ease-out hover:text-pink-600 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
              >
                {a.title}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
