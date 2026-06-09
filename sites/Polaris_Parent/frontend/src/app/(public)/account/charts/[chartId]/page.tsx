'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ZiweiChart, NAMED_THEMES } from '@ows/ziwei-chart';
import { useAuthStore } from '@/store/auth';
import { astrologyApi, membershipApi } from '@/lib/api';
import type { MyPerson, MyChart, ZiweiCalcResponse } from '@/lib/api/astrology';
import type { ExternalProduct, OrderSubmission, SavedArticle } from '@/lib/api/membership';
import Button from '@/components/ui/Button';

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
    return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-500">載入中…</div>;
  }

  if (!chart) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 mb-4">找不到這張命盤，或它不屬於你的帳號。</p>
        <Link href="/account" className="text-brand-purple-700 hover:underline">← 回會員中心</Link>
      </div>
    );
  }

  const cardCls = 'bg-white rounded-banner border border-warm-200/70 p-4';
  const statusCls = (s: string) =>
    s === '通過' ? 'bg-green-100 text-green-800' : s === '退回' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800';

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/account" className="text-sm text-brand-purple-700 hover:underline">← 會員中心</Link>
        <button onClick={removeChart} className="text-sm text-red-500 hover:underline">刪除命盤</button>
      </div>

      {err && <div className="p-3 bg-red-50 border border-red-200 rounded-banner text-red-700 text-sm">{err}</div>}
      {msg && <div className="p-3 bg-green-50 border border-green-200 rounded-banner text-green-700 text-sm">{msg}</div>}

      {/* 基本資料 + 編輯 */}
      <div className={cardCls}>
        <h1 className="text-xl font-bold text-gray-900 mb-1">{chart.name || '（未命名）'}</h1>
        <p className="text-sm text-gray-500 mb-4">
          {chart.gender === 'F' || chart.gender === '女' ? '女' : '男'}　{birthText(chart)}
          <span className="ml-2 font-mono text-xs text-gray-400">#{chartId.slice(-6)}</span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">名稱</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-banner"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">與本人的關係</label>
            <select
              value={editRelation}
              onChange={(e) => setEditRelation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-banner"
            >
              <option value="">未設定</option>
              {RELATIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 text-right">
          <Button onClick={saveEdit} disabled={savingEdit} className="bg-brand-purple-600 hover:bg-brand-purple-700 text-sm py-2">
            {savingEdit ? '儲存中…' : '儲存變更'}
          </Button>
        </div>
      </div>

      {/* 盤面 */}
      {chartRender?.chart_json ? (
        <div className={cardCls}>
          <ZiweiChart chart={chartRender.chart_json} flow={chartRender.flow ?? undefined} theme={NAMED_THEMES.light} />
        </div>
      ) : chart.birth ? (
        <p className="text-sm text-gray-500">命盤繪製中…</p>
      ) : (
        <p className="text-sm text-gray-500">此命盤缺少生辰資料，無法繪製盤面。</p>
      )}

      {/* 為這張盤下單 */}
      <div className={cardCls}>
        <h2 className="font-medium text-gray-800 mb-3">為這張盤下單</h2>
        {products.length === 0 ? (
          <p className="text-sm text-gray-500">目前沒有可購買的商品。</p>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {products.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-700">{p.name}<span className="text-gray-400 ml-1">（{p.platform}）</span></span>
                  {p.external_url && (
                    <a
                      href={p.external_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-banner border border-brand-purple-300 text-brand-purple-700 hover:bg-brand-purple-50"
                    >
                      前往購買 ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-warm-200/70 pt-3">
              <p className="text-sm text-gray-600 mb-2">在平台完成購買後，於此登錄訂單號（會自動關聯這張盤）：</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={orderProductId}
                  onChange={(e) => setOrderProductId(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-banner text-sm"
                >
                  <option value={0}>選擇商品…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input
                  value={orderNo}
                  onChange={(e) => setOrderNo(e.target.value)}
                  placeholder="訂單號"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-banner text-sm"
                />
                <Button onClick={submitChartOrder} disabled={orderBusy} className="bg-brand-purple-600 hover:bg-brand-purple-700 text-sm py-2">
                  {orderBusy ? '送出中…' : '登錄訂單'}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 此盤的購買記錄 */}
      <div className={cardCls}>
        <h2 className="font-medium text-gray-800 mb-3">此盤的購買記錄</h2>
        {chartOrders.length === 0 ? (
          <p className="text-sm text-gray-500">尚無購買記錄。</p>
        ) : (
          <div className="space-y-2">
            {chartOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-gray-800">{o.product_name}</span>
                  <span className="text-gray-400 ml-2 font-mono text-xs">{o.external_order_no}</span>
                  {o.coupon_code && <span className="ml-2 text-green-700 font-mono text-xs">{o.coupon_code}</span>}
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full ${statusCls(o.status)}`}>{o.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 相關收藏文章 */}
      {chartArticles.length > 0 && (
        <div className={cardCls}>
          <h2 className="font-medium text-gray-800 mb-3">相關收藏文章</h2>
          <div className="space-y-1">
            {chartArticles.map((a) => (
              <a key={a.id} href={`/posts/${a.slug}`} className="block text-sm text-brand-purple-700 hover:underline">
                {a.title}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
