'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ZiweiChart, NAMED_THEMES } from '@ows/ziwei-chart';
import { StarfieldSection } from '@ows/ziwei-app';
import { useAuthStore } from '@/store/auth';
import { astrologyApi, membershipApi } from '@/lib/api';
import type {
  MyPerson,
  MyChart,
  MyFavorite,
  ZiweiCalcResponse,
  SaveMyChartRequest,
} from '@/lib/api/astrology';
import { MemberChartForm as MemberChartForm } from '@ows/ziwei-app';
import type {
  ExternalProduct,
  OrderSubmission,
  MemberReward,
  SavedArticle,
} from '@/lib/api/membership';
import Button from '@/components/platform/ui/Button';

const RELATION_LABELS: Record<string, string> = {
  self: '我自己',
  father: '父親',
  mother: '母親',
  son: '兒子',
  daughter: '女兒',
  brother: '兄弟',
  sister: '姊妹',
  spouse: '配偶',
  friend: '朋友',
};
const relLabel = (r?: string | null) => (r ? RELATION_LABELS[r] || r : '');
const birthText = (c: MyChart) =>
  c.birth
    ? `${c.birth.year}/${c.birth.month}/${c.birth.day} ${String(c.birth.hour).padStart(2, '0')}:${String(c.birth.minute).padStart(2, '0')}`
    : c.clock_time || '';

export default function AccountPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, checkAuth, logout } = useAuthStore();

  const [tab, setTab] = useState<'charts' | 'favorites' | 'orders' | 'articles'>('charts');
  const [people, setPeople] = useState<MyPerson[]>([]);
  const [favorites, setFavorites] = useState<MyFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [viewing, setViewing] = useState<ZiweiCalcResponse | null>(null);
  const [viewBusy, setViewBusy] = useState(false);
  // 進階檢視工具（互動／靜態、版型、下載）— 進階功能只在會員專區提供
  const [viewMode, setViewMode] = useState<'interactive' | 'static'>('interactive');
  const [chartTheme, setChartTheme] = useState<'light' | 'dark' | 'sepia'>('light');
  /** 互動命盤上點到的宮位（1…C）；星場分析的星曜能量分頁會收斂到這一宮。 */
  const [axisPalace, setAxisPalace] = useState<string | null>(null);
  const [pngBusy, setPngBusy] = useState(false);

  // 會員中心排盤：表單開關 + 未儲存的草稿盤（排好後按「儲存命盤」才歸檔）
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState<SaveMyChartRequest | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // 我的訂單 / 折扣券
  const [submissions, setSubmissions] = useState<OrderSubmission[]>([]);
  const [rewards, setRewards] = useState<MemberReward[]>([]);
  const [products, setProducts] = useState<ExternalProduct[]>([]);
  const [commerceLoaded, setCommerceLoaded] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [form, setForm] = useState({ product_type_id: 0, external_order_no: '', chart_id: '', note: '' });
  // 退回重送
  const [resubmitTarget, setResubmitTarget] = useState<OrderSubmission | null>(null);
  const [resubmitNo, setResubmitNo] = useState('');
  const [resubmitNote, setResubmitNote] = useState('');
  const [resubmitBusy, setResubmitBusy] = useState(false);

  // 收藏文章
  const [savedArticles, setSavedArticles] = useState<SavedArticle[]>([]);
  const [articlesLoaded, setArticlesLoaded] = useState(false);

  // 守衛：未登入 → 導向登入頁
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isLoading, isAuthenticated, router]);

  // 載入資料（儲存命盤後也會重載）
  const loadCharts = async () => {
    setLoading(true);
    setErr('');
    try {
      const [c, f] = await Promise.all([
        astrologyApi.myCharts(),
        astrologyApi.myFavorites(),
      ]);
      setPeople(c.people || []);
      setFavorites(f.favorites || []);
    } catch (e: any) {
      setErr(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!isAuthenticated) return;
    loadCharts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const viewChart = async (c: MyChart) => {
    if (!c.birth) {
      setErr('此命盤缺少生辰資料，無法重繪');
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
      setViewMode('interactive');
      setDraft(null); // 檢視已儲存的命盤 → 不顯示「儲存命盤」按鈕
      setSaveMsg('');
      setViewing(res);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setErr(e.message || '重繪失敗');
    } finally {
      setViewBusy(false);
    }
  };

  // ── 會員中心排盤：計算完成 → 以草稿盤呈現（待按「儲存命盤」歸檔）──
  const onComposed = (res: ZiweiCalcResponse, payload: SaveMyChartRequest) => {
    setViewMode('interactive');
    setViewing(res);
    setDraft(payload);
    setSaveMsg('');
    setErr('');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveDraft = async () => {
    if (!draft) return;
    setSaveBusy(true);
    setErr('');
    try {
      const res = await astrologyApi.saveMyChart(draft);
      setDraft(null);
      setSaveMsg(
        res.is_existing
          ? '這張命盤先前已儲存過，已沿用既有命盤（未重複建檔）。'
          : '已儲存！這張命盤已歸檔到你的帳號。'
      );
      setComposerOpen(false);
      await loadCharts();
    } catch (e: any) {
      setErr(e.message || '儲存失敗，請稍後再試');
    } finally {
      setSaveBusy(false);
    }
  };

  // ── 下載（全部在前端，零伺服器成本；自公開頁搬入，進階功能限會員專區）──
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSvg = () => {
    if (!viewing?.svg) return;
    downloadBlob(
      new Blob([viewing.svg], { type: 'image/svg+xml;charset=utf-8' }),
      `ziwei_${viewing.chart_id || 'chart'}.svg`
    );
  };

  // 用 canvas 把 SVG 點陣化成 PNG（2x 清晰度），全在瀏覽器完成
  const downloadPng = async (scale = 2) => {
    if (!viewing?.svg) return;
    setPngBusy(true);
    try {
      const svg = viewing.svg;
      const m =
        svg.match(/viewBox="0\s+0\s+([\d.]+)\s+([\d.]+)"/) ||
        svg.match(/width="([\d.]+)"[^>]*height="([\d.]+)"/);
      const w = m ? parseFloat(m[1]) : 800;
      const h = m ? parseFloat(m[2]) : 800;

      const svgUrl = URL.createObjectURL(
        new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      );
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('SVG 載入失敗'));
        img.src = svgUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('無法建立繪圖環境');
      ctx.fillStyle = '#ffffff'; // 白底，避免透明背景
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(svgUrl);

      await new Promise<void>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) downloadBlob(blob, `ziwei_${viewing.chart_id || 'chart'}.png`);
          resolve();
        }, 'image/png');
      });
    } catch (e: any) {
      setErr(e.message || 'PNG 轉換失敗');
    } finally {
      setPngBusy(false);
    }
  };

  const unfavorite = async (chartId: string) => {
    try {
      await astrologyApi.removeFavorite(chartId);
      setFavorites((prev) => prev.filter((f) => f.chart_id !== chartId));
    } catch (e: any) {
      setErr(e.message || '取消收藏失敗');
    }
  };

  // 切到「我的訂單」時載入商業循環資料
  useEffect(() => {
    if (tab !== 'orders' || !isAuthenticated || commerceLoaded) return;
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
        setErr(e.message || '載入訂單資料失敗');
      }
    })();
  }, [tab, isAuthenticated, commerceLoaded]);

  // 切到「收藏文章」時載入
  useEffect(() => {
    if (tab !== 'articles' || !isAuthenticated || articlesLoaded) return;
    (async () => {
      try {
        const r = await membershipApi.savedArticles();
        setSavedArticles(r.articles || []);
        setArticlesLoaded(true);
      } catch (e: any) {
        setErr(e.message || '載入收藏文章失敗');
      }
    })();
  }, [tab, isAuthenticated, articlesLoaded]);

  const unsaveArticle = async (contentId: number) => {
    try {
      await membershipApi.unsaveArticle(contentId);
      setSavedArticles((prev) => prev.filter((a) => a.content_id !== contentId));
    } catch (e: any) {
      setErr(e.message || '取消收藏失敗');
    }
  };

  const selectedProduct = products.find((p) => p.id === Number(form.product_type_id));

  const submitOrder = async () => {
    if (!form.product_type_id) {
      setErr('請選擇商品');
      return;
    }
    if (!form.external_order_no.trim()) {
      setErr('請輸入訂單號');
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
      setErr(e.message || '登錄訂單失敗');
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
      setErr('請輸入訂單號');
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
      setErr(e.message || '重送失敗');
    } finally {
      setResubmitBusy(false);
    }
  };

  const copyCode = (code: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(
        () => alert(`已複製折扣碼：${code}`),
        () => {/* ignore */},
      );
    }
  };

  const subStatusCls = (s: string) =>
    s === '通過'
      ? 'bg-green-100 text-green-800'
      : s === '退回'
        ? 'bg-red-100 text-red-700'
        : 'bg-yellow-100 text-yellow-800';

  if (isLoading || !isAuthenticated) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-500">載入中…</div>;
  }

  const tabCls = (active: boolean) =>
    `px-5 py-2 text-sm rounded-banner transition-colors ${
      active
        ? 'bg-brand-purple-600 text-white'
        : 'text-brand-purple-700 hover:bg-brand-purple-50 border border-brand-purple-600'
    }`;
  const cardCls =
    'bg-white rounded-banner border border-warm-200/70 p-4 flex flex-wrap items-center justify-between gap-3';

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">會員中心</h1>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{user?.email || user?.username}</span>
          <button onClick={() => logout().then(() => router.push('/login'))} className="text-brand-purple-700 hover:underline">
            登出
          </button>
        </div>
      </div>

      {/* 重繪的命盤（互動命盤 + 進階工具列：會員專區限定）*/}
      {viewing && (viewing.chart_json || viewing.svg) && (
        <div className="mb-8 bg-white rounded-banner border border-warm-200/70 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 text-sm text-gray-600">
            <span>命盤 ID：<span className="font-mono">{viewing.chart_id}</span></span>
            <button onClick={() => { setViewing(null); setDraft(null); }} className="text-gray-400 hover:text-gray-700">關閉 ✕</button>
          </div>

          {/* 草稿盤：尚未歸檔，顯示儲存列 */}
          {draft && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-banner flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-amber-800">
                這張命盤尚未儲存。按「儲存命盤」即可歸檔到你的帳號。
              </span>
              <Button
                type="button"
                onClick={saveDraft}
                disabled={saveBusy}
                className="bg-brand-purple-600 hover:bg-brand-purple-700 text-sm py-2"
              >
                {saveBusy ? '儲存中…' : '儲存命盤'}
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mb-4">
            {/* 互動 / 靜態 檢視切換 */}
            {viewing.chart_json && viewing.svg && (
              <div className="inline-flex rounded-banner border border-brand-purple-600 overflow-hidden text-sm">
                <button
                  type="button"
                  onClick={() => setViewMode('interactive')}
                  className={`px-4 py-2 transition-colors ${
                    viewMode === 'interactive'
                      ? 'bg-brand-purple-600 text-white'
                      : 'text-brand-purple-700 hover:bg-brand-purple-50'
                  }`}
                >
                  互動命盤
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('static')}
                  className={`px-4 py-2 transition-colors ${
                    viewMode === 'static'
                      ? 'bg-brand-purple-600 text-white'
                      : 'text-brand-purple-700 hover:bg-brand-purple-50'
                  }`}
                >
                  靜態圖
                </button>
              </div>
            )}

            {/* 版型樣式（互動命盤）*/}
            {viewing.chart_json && viewMode === 'interactive' && (
              <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                版型
                <select
                  value={chartTheme}
                  onChange={(e) =>
                    setChartTheme(e.target.value as 'light' | 'dark' | 'sepia')
                  }
                  className="px-3 py-2 text-sm rounded-banner border border-gray-300 focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent"
                >
                  <option value="light">淺色</option>
                  <option value="dark">深色</option>
                  <option value="sepia">宣紙</option>
                </select>
              </label>
            )}

            {viewing.svg && (
              <>
                <button
                  type="button"
                  onClick={downloadSvg}
                  className="px-4 py-2 text-sm rounded-banner border border-brand-purple-600 text-brand-purple-700 hover:bg-brand-purple-50 transition-colors"
                >
                  下載 SVG
                </button>
                <button
                  type="button"
                  onClick={() => downloadPng(2)}
                  disabled={pngBusy}
                  className="px-4 py-2 text-sm rounded-banner border border-brand-purple-600 text-brand-purple-700 hover:bg-brand-purple-50 transition-colors disabled:opacity-50"
                >
                  {pngBusy ? '轉換中…' : '下載 PNG'}
                </button>
              </>
            )}
          </div>

          {viewing.chart_json && viewMode === 'interactive' ? (
            <div
              className="w-full rounded-banner p-2 sm:p-4"
              style={{
                background: chartTheme === 'light' ? 'transparent' : NAMED_THEMES[chartTheme].colors?.bg,
                transition: 'background 200ms ease',
              }}
            >
              <ZiweiChart
                chart={viewing.chart_json}
                flow={viewing.flow ?? undefined}
                theme={NAMED_THEMES[chartTheme]}
                onPalaceClick={setAxisPalace}
              />
            </div>
          ) : viewing.svg ? (
            <div
              className="w-full overflow-x-auto flex justify-center [&>svg]:max-w-full [&>svg]:h-auto"
              // SVG 由自家後端 p_e_artist 產生（可信來源）
              dangerouslySetInnerHTML={{ __html: viewing.svg }}
            />
          ) : null}

          {/* 星場分析（點上方互動命盤的宮位，星曜能量會收斂到該宮） */}
          {(viewing.star_energy || viewing.readings) && (
            <div className="mt-6 border-t border-warm-200/70 pt-5">
              <StarfieldSection
                starEnergy={viewing.star_energy}
                readings={viewing.readings}
                palaceCode={axisPalace}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 mb-5">
        <button className={tabCls(tab === 'charts')} onClick={() => setTab('charts')}>
          我的命盤
        </button>
        <button className={tabCls(tab === 'favorites')} onClick={() => setTab('favorites')}>
          我的收藏
        </button>
        <button className={tabCls(tab === 'orders')} onClick={() => setTab('orders')}>
          我的訂單 / 折扣券
        </button>
        <button className={tabCls(tab === 'articles')} onClick={() => setTab('articles')}>
          收藏文章
        </button>
      </div>

      {err && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-banner text-red-700 text-sm">{err}</div>
      )}
      {saveMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-banner text-green-700 text-sm">{saveMsg}</div>
      )}
      {viewBusy && <p className="mb-4 text-sm text-gray-500">重繪命盤中…</p>}

      {/* 排新命盤（會員中心排盤 + 儲存）*/}
      {tab === 'charts' && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setComposerOpen((o) => !o)}
            className="px-4 py-2 text-sm rounded-banner border border-brand-purple-600 text-brand-purple-700 hover:bg-brand-purple-50 transition-colors"
          >
            {composerOpen ? '收合排盤表單 ▲' : '＋ 排新命盤'}
          </button>
          {composerOpen && (
            <div className="mt-4">
              <MemberChartForm onComputed={onComposed} />
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">載入中…</p>
      ) : tab === 'charts' ? (
        people.length === 0 ? (
          <p className="text-gray-500">
            還沒有命盤。按上方「＋ 排新命盤」排一張並儲存，就會歸檔到這裡。
          </p>
        ) : (
          <div className="space-y-6">
            {people.map((p) => (
              <div key={p.user_id}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-gray-800">{p.display_name || '（未命名）'}</span>
                  {p.relation_label && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-brand-purple-100 text-brand-purple-700">
                      {relLabel(p.relation_label)}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {p.charts.map((c) => (
                    <div key={c.chart_id} className={cardCls}>
                      <div className="text-sm text-gray-600">
                        <span className="font-mono text-xs text-gray-400 mr-2">#{c.chart_id.slice(-6)}</span>
                        {c.gender === 'F' || c.gender === '女' ? '女' : '男'}　{birthText(c)}
                        {c.has_fortune && (
                          <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800">
                            完整版
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={() => viewChart(c)}
                          className="bg-brand-purple-600 hover:bg-brand-purple-700 text-sm py-2"
                        >
                          檢視命盤
                        </Button>
                        <Link
                          href={`/account/charts/${c.chart_id}`}
                          className="px-3 py-2 text-sm rounded-banner border border-brand-purple-300 text-brand-purple-700 hover:bg-brand-purple-50 inline-flex items-center"
                        >
                          詳情 / 管理
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === 'favorites' ? (
        favorites.length === 0 ? (
          <p className="text-gray-500">尚無收藏的命盤。</p>
        ) : (
          <div className="space-y-2">
            {favorites.map((f) => (
              <div key={f.chart_id} className={cardCls}>
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-gray-800 mr-2">{f.name || '（未命名）'}</span>
                  {f.gender === 'F' || f.gender === '女' ? '女' : '男'}　{birthText(f)}
                  {f.note && <span className="ml-2 text-gray-400">— {f.note}</span>}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => viewChart(f)}
                    className="bg-brand-purple-600 hover:bg-brand-purple-700 text-sm py-2"
                  >
                    檢視
                  </Button>
                  <button
                    type="button"
                    onClick={() => unfavorite(f.chart_id)}
                    className="px-3 py-2 text-sm rounded-banner border border-gray-300 text-gray-500 hover:bg-gray-50"
                  >
                    取消收藏
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === 'orders' ? (
        // ── 我的訂單 / 折扣券 ──────────────────────────────
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-gray-800">我的折扣券</h2>
          </div>
          {rewards.length === 0 ? (
            <p className="text-gray-500 text-sm">尚無折扣券。完成購買並登錄訂單號、經審核通過後即可領取。</p>
          ) : (
            <div className="space-y-2">
              {rewards.map((r) => (
                <div key={r.id} className={cardCls}>
                  <div className="text-sm text-gray-600">
                    <span className="font-mono font-medium text-green-700 mr-2">{r.coupon_code_snapshot}</span>
                    <span className="text-gray-400">{r.platform}・{r.product_name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyCode(r.coupon_code_snapshot)}
                    className="px-3 py-2 text-sm rounded-banner border border-gray-300 text-gray-600 hover:bg-gray-50"
                  >
                    複製折扣碼
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="font-medium text-gray-800">訂單登錄</h2>
            <Button
              type="button"
              onClick={() => { setSubmitOpen(true); setErr(''); }}
              className="bg-brand-purple-600 hover:bg-brand-purple-700 text-sm py-2"
            >
              登錄訂單號
            </Button>
          </div>
          {submissions.length === 0 ? (
            <p className="text-gray-500 text-sm">尚無訂單登錄記錄。</p>
          ) : (
            <div className="space-y-2">
              {submissions.map((s) => (
                <div key={s.id} className={cardCls}>
                  <div className="text-sm text-gray-600 flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-800">{s.product_name}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${subStatusCls(s.status)}`}>{s.status}</span>
                    </div>
                    <span className="text-gray-400">{s.platform}・訂單號 </span>
                    <span className="font-mono text-xs">{s.external_order_no}</span>
                    {s.status === '退回' && s.note && (
                      <p className="text-red-600 text-xs mt-1">退回原因：{s.note}</p>
                    )}
                    {s.coupon_code && (
                      <p className="text-green-700 text-xs mt-1">折扣碼：<span className="font-mono">{s.coupon_code}</span></p>
                    )}
                  </div>
                  {s.status === '退回' && (
                    <button
                      type="button"
                      onClick={() => openResubmit(s)}
                      className="px-3 py-2 text-sm rounded-banner border border-brand-purple-300 text-brand-purple-700 hover:bg-brand-purple-50 whitespace-nowrap"
                    >
                      修正並重送
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // ── 收藏文章 ──────────────────────────────────────
        savedArticles.length === 0 ? (
          <p className="text-gray-500 text-sm">尚無收藏文章。在文章頁點「收藏文章」即可加入。</p>
        ) : (
          <div className="space-y-2">
            {savedArticles.map((a) => (
              <div key={a.id} className={cardCls}>
                <a
                  href={`/posts/${a.slug}`}
                  className="text-sm font-medium text-brand-purple-700 hover:underline flex-1 min-w-0 truncate"
                >
                  {a.title}
                </a>
                <button
                  type="button"
                  onClick={() => unsaveArticle(a.content_id)}
                  className="px-3 py-2 text-sm rounded-banner border border-gray-300 text-gray-500 hover:bg-gray-50"
                >
                  取消收藏
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {/* 登錄訂單號 Modal */}
      {submitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setSubmitOpen(false)} />
          <div className="relative bg-white rounded-banner shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-medium text-gray-900">登錄訂單號</h3>
            {products.length === 0 ? (
              <p className="text-sm text-gray-500">目前沒有可登錄的商品。</p>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">商品</label>
                  <select
                    value={form.product_type_id}
                    onChange={(e) => setForm({ ...form, product_type_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-banner"
                  >
                    <option value={0}>請選擇…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}（{p.platform}）</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">訂單號</label>
                  <input
                    value={form.external_order_no}
                    onChange={(e) => setForm({ ...form, external_order_no: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-banner"
                    placeholder="在蝦皮 / Pinkoi 完成購買後的訂單編號"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">關聯命盤（選填）</label>
                  <select
                    value={form.chart_id}
                    onChange={(e) => setForm({ ...form, chart_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-banner"
                  >
                    <option value="">不指定</option>
                    {people.flatMap((p) =>
                      p.charts.map((c) => (
                        <option key={c.chart_id} value={c.chart_id}>
                          {p.display_name || '（未命名）'}・#{c.chart_id.slice(-6)}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSubmitOpen(false)}
                    className="px-4 py-2 text-sm rounded-banner border border-gray-300 text-gray-600 hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <Button
                    type="button"
                    onClick={submitOrder}
                    disabled={submitBusy}
                    className="bg-brand-purple-600 hover:bg-brand-purple-700 text-sm py-2"
                  >
                    {submitBusy ? '送出中…' : '送出審核'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 退回重送 Modal */}
      {resubmitTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setResubmitTarget(null)} />
          <div className="relative bg-white rounded-banner shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-medium text-gray-900">修正並重送</h3>
            <p className="text-sm text-gray-500">
              {resubmitTarget.product_name}（{resubmitTarget.platform}）
              {resubmitTarget.note && (
                <span className="block text-red-600 mt-1">退回原因：{resubmitTarget.note}</span>
              )}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">訂單號</label>
              <input
                value={resubmitNo}
                onChange={(e) => setResubmitNo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-banner"
                placeholder="修正後的訂單編號"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">補充說明（選填）</label>
              <input
                value={resubmitNote}
                onChange={(e) => setResubmitNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-banner"
                placeholder="給審核者的補充說明"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setResubmitTarget(null)}
                className="px-4 py-2 text-sm rounded-banner border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
              <Button
                type="button"
                onClick={doResubmit}
                disabled={resubmitBusy}
                className="bg-brand-purple-600 hover:bg-brand-purple-700 text-sm py-2"
              >
                {resubmitBusy ? '送出中…' : '重新送審'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
