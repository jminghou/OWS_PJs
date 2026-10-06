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
import {
  BookOpen,
  Bookmark,
  ChevronUp,
  Copy,
  Download,
  LayoutGrid,
  LogOut,
  Plus,
  Receipt,
  RotateCcw,
  Ticket,
  X,
  type LucideIcon,
} from 'lucide-react';
import BrandButton, { brandButton } from '@/components/ui/BrandButton';
import Alert from '@/components/ui/Alert';
import Tag, { TAG_BASE } from '@/components/ui/Tag';

// 表單（品牌規範 §6.3）
const INPUT =
  'w-full rounded-2xl border-[1.5px] border-line-strong bg-white px-[18px] py-[13px] text-base text-ink ' +
  'placeholder:text-muted focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
// 工具列內的小型下拉（同樣式、內距縮小以對齊 S 按鈕高度）
const INPUT_SM =
  'rounded-2xl border-[1.5px] border-line-strong bg-white px-3.5 py-1.5 text-sm text-ink ' +
  'focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
const LABEL = 'mb-1.5 block text-sm font-medium text-ink';
// 分頁／切換：膠囊項目，跟頁首導覽同一套（選中淡藍底、其他 hover 暖灰底）
const pillCls = (active: boolean) =>
  'whitespace-nowrap rounded-full px-3.5 py-2 text-[15px] font-medium transition-colors duration-150 ease-out ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ' +
  (active ? 'bg-blue-50 text-blue-800' : 'text-ink hover:bg-tint active:bg-line');
// 低調的文字按鈕（關閉）
const QUIET_BTN =
  'inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm text-muted transition-colors duration-150 ease-out ' +
  'hover:bg-tint hover:text-ink active:bg-line focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100';
// 登出：結束性動作，hover 走 error 色（不用品牌粉）
const QUIET_DANGER_BTN =
  'inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm text-text transition-colors duration-150 ease-out ' +
  'hover:bg-error-bg hover:text-error-fg active:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100';

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

  // 審核狀態徽章：通過 success、退回 error、其餘（審核中）warning（品牌規範 §3.4）
  const subStatusCls = (s: string) =>
    s === '通過'
      ? 'bg-success-bg text-success-fg'
      : s === '退回'
        ? 'bg-error-bg text-error-fg'
        : 'bg-warning-bg text-warning-fg';

  if (isLoading || !isAuthenticated) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted">載入中…</div>;
  }

  const cardCls = 'flex flex-wrap items-center justify-between gap-3 rounded-inner bg-white p-4 md:px-6';

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:py-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-[32px] font-normal text-ink md:text-h1">會員中心</h1>
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="min-w-0 truncate">{user?.email || user?.username}</span>
          <button
            type="button"
            onClick={() => logout().then(() => router.push('/login'))}
            className={QUIET_DANGER_BTN}
          >
            <LogOut className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            登出
          </button>
        </div>
      </div>

      {/* 重繪的命盤（互動命盤 + 進階工具列：會員專區限定）*/}
      {viewing && (viewing.chart_json || viewing.svg) && (
        <div className="mb-8 rounded-card bg-white p-6 md:p-8">
          <div className="mb-3 flex items-center justify-between text-sm text-text">
            <span>命盤 ID：<span className="font-latin">{viewing.chart_id}</span></span>
            <button
              type="button"
              onClick={() => { setViewing(null); setDraft(null); }}
              className={QUIET_BTN}
            >
              關閉
              <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          {/* 草稿盤：尚未歸檔，顯示儲存列 */}
          {draft && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-inner bg-warning-bg px-[18px] py-[14px]">
              <span className="text-sm text-warning-fg">
                這張命盤尚未儲存。按「儲存命盤」即可歸檔到你的帳號。
              </span>
              <BrandButton variant="primary" size="S" onClick={saveDraft} disabled={saveBusy}>
                {saveBusy ? '儲存中…' : '儲存命盤'}
              </BrandButton>
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center gap-3">
            {/* 互動 / 靜態 檢視切換 */}
            {viewing.chart_json && viewing.svg && (
              <div className="inline-flex gap-1" role="group" aria-label="檢視方式">
                <button
                  type="button"
                  aria-pressed={viewMode === 'interactive'}
                  onClick={() => setViewMode('interactive')}
                  className={pillCls(viewMode === 'interactive')}
                >
                  互動命盤
                </button>
                <button
                  type="button"
                  aria-pressed={viewMode === 'static'}
                  onClick={() => setViewMode('static')}
                  className={pillCls(viewMode === 'static')}
                >
                  靜態圖
                </button>
              </div>
            )}

            {/* 版型樣式（互動命盤）*/}
            {viewing.chart_json && viewMode === 'interactive' && (
              <label className="inline-flex items-center gap-2 text-sm font-medium text-ink">
                版型
                <select
                  value={chartTheme}
                  onChange={(e) =>
                    setChartTheme(e.target.value as 'light' | 'dark' | 'sepia')
                  }
                  className={`${INPUT_SM} w-auto`}
                >
                  <option value="light">淺色</option>
                  <option value="dark">深色</option>
                  <option value="sepia">宣紙</option>
                </select>
              </label>
            )}

            {viewing.svg && (
              <>
                <BrandButton variant="soft" size="S" onClick={downloadSvg}>
                  <Download className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  下載 SVG
                </BrandButton>
                <BrandButton variant="soft" size="S" onClick={() => downloadPng(2)} disabled={pngBusy}>
                  <Download className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  {pngBusy ? '轉換中…' : '下載 PNG'}
                </BrandButton>
              </>
            )}
          </div>

          {viewing.chart_json && viewMode === 'interactive' ? (
            <div
              className="w-full rounded-inner p-2 sm:p-4"
              style={{
                background: chartTheme === 'light' ? 'transparent' : NAMED_THEMES[chartTheme].colors?.bg,
                transition: 'background 200ms ease-out',
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
              className="flex w-full justify-center overflow-x-auto [&>svg]:h-auto [&>svg]:max-w-full"
              // SVG 由自家後端 p_e_artist 產生（可信來源）
              dangerouslySetInnerHTML={{ __html: viewing.svg }}
            />
          ) : null}

          {/* 星場分析（點上方互動命盤的宮位，星曜能量會收斂到該宮） */}
          {(viewing.star_energy || viewing.readings) && (
            <div className="mt-6 border-t border-line pt-5">
              <StarfieldSection
                starEnergy={viewing.star_energy}
                readings={viewing.readings}
                palaceCode={axisPalace}
              />
            </div>
          )}
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="會員中心分頁">
        <button type="button" role="tab" aria-selected={tab === 'charts'} className={pillCls(tab === 'charts')} onClick={() => setTab('charts')}>
          我的命盤
        </button>
        <button type="button" role="tab" aria-selected={tab === 'favorites'} className={pillCls(tab === 'favorites')} onClick={() => setTab('favorites')}>
          我的收藏
        </button>
        <button type="button" role="tab" aria-selected={tab === 'orders'} className={pillCls(tab === 'orders')} onClick={() => setTab('orders')}>
          我的訂單 / 折扣券
        </button>
        <button type="button" role="tab" aria-selected={tab === 'articles'} className={pillCls(tab === 'articles')} onClick={() => setTab('articles')}>
          收藏文章
        </button>
      </div>

      {err && <Alert tone="error" className="mb-4">{err}</Alert>}
      {saveMsg && <Alert tone="success" className="mb-4">{saveMsg}</Alert>}
      {viewBusy && <p className="mb-4 text-sm text-muted">重繪命盤中…</p>}

      {/* 排新命盤（會員中心排盤 + 儲存）*/}
      {tab === 'charts' && (
        <div className="mb-6">
          <BrandButton
            variant="soft"
            size="S"
            aria-expanded={composerOpen}
            onClick={() => setComposerOpen((o) => !o)}
          >
            {composerOpen ? (
              <>
                收合排盤表單
                <ChevronUp className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                排新命盤
              </>
            )}
          </BrandButton>
          {composerOpen && (
            <div className="mt-4">
              <MemberChartForm onComputed={onComposed} />
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-muted">載入中…</p>
      ) : tab === 'charts' ? (
        people.length === 0 ? (
          <EmptyState
            icon={LayoutGrid}
            action={
              !composerOpen && (
                <BrandButton variant="soft" size="S" onClick={() => setComposerOpen(true)}>
                  <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  排新命盤
                </BrandButton>
              )
            }
          >
            還沒有命盤。按上方「＋ 排新命盤」排一張並儲存，就會歸檔到這裡。
          </EmptyState>
        ) : (
          <div className="space-y-6">
            {people.map((p) => (
              <div key={p.user_id}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-medium text-ink">{p.display_name || '（未命名）'}</span>
                  {p.relation_label && <Tag tone="category">{relLabel(p.relation_label)}</Tag>}
                </div>
                <div className="space-y-2">
                  {p.charts.map((c) => (
                    <div key={c.chart_id} className={cardCls}>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text">
                        <span className="font-latin text-xs text-muted">#{c.chart_id.slice(-6)}</span>
                        <span>
                          {c.gender === 'F' || c.gender === '女' ? '女' : '男'}　<span className="font-latin">{birthText(c)}</span>
                        </span>
                        {c.has_fortune && <Tag tone="category">完整版</Tag>}
                      </div>
                      <div className="flex gap-2">
                        <BrandButton variant="secondary" size="S" onClick={() => viewChart(c)}>
                          檢視命盤
                        </BrandButton>
                        <Link href={`/account/charts/${c.chart_id}`} className={brandButton({ variant: 'soft', size: 'S' })}>
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
          <EmptyState icon={Bookmark}>尚無收藏的命盤。</EmptyState>
        ) : (
          <div className="space-y-2">
            {favorites.map((f) => (
              <div key={f.chart_id} className={cardCls}>
                <div className="text-sm text-text">
                  <span className="mr-2 font-medium text-ink">{f.name || '（未命名）'}</span>
                  {f.gender === 'F' || f.gender === '女' ? '女' : '男'}　<span className="font-latin">{birthText(f)}</span>
                  {f.note && <span className="ml-2 text-muted">— {f.note}</span>}
                </div>
                <div className="flex gap-2">
                  <BrandButton variant="secondary" size="S" onClick={() => viewChart(f)}>
                    檢視
                  </BrandButton>
                  <BrandButton variant="soft" size="S" onClick={() => unfavorite(f.chart_id)}>
                    取消收藏
                  </BrandButton>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === 'orders' ? (
        // ── 我的訂單 / 折扣券 ──────────────────────────────
        <div className="space-y-8">
          <div className="space-y-3">
            <h2 className="font-heading text-[18px] font-normal text-ink md:text-h4">我的折扣券</h2>
            {rewards.length === 0 ? (
              <EmptyState icon={Ticket}>尚無折扣券。完成購買並登錄訂單號、經審核通過後即可領取。</EmptyState>
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
                      複製折扣碼
                    </BrandButton>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-heading text-[18px] font-normal text-ink md:text-h4">訂單登錄</h2>
              <BrandButton
                variant="secondary"
                size="S"
                onClick={() => { setSubmitOpen(true); setErr(''); }}
              >
                登錄訂單號
              </BrandButton>
            </div>
            {submissions.length === 0 ? (
              <EmptyState icon={Receipt}>尚無訂單登錄記錄。</EmptyState>
            ) : (
              <div className="space-y-2">
                {submissions.map((s) => (
                  <div key={s.id} className={cardCls}>
                    <div className="min-w-0 flex-1 text-sm text-text">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink">{s.product_name}</span>
                        <span className={`${TAG_BASE} ${subStatusCls(s.status)}`}>{s.status}</span>
                      </div>
                      <span className="text-muted">{s.platform}・訂單號 </span>
                      <span className="font-latin text-xs">{s.external_order_no}</span>
                      {s.status === '退回' && s.note && (
                        <p className="mt-1 text-[13px] text-error-fg">退回原因：{s.note}</p>
                      )}
                      {s.coupon_code && (
                        <p className="mt-1 text-[13px] text-success-fg">折扣碼：<span className="font-latin font-semibold">{s.coupon_code}</span></p>
                      )}
                    </div>
                    {s.status === '退回' && (
                      <BrandButton variant="soft" size="S" onClick={() => openResubmit(s)}>
                        <RotateCcw className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                        修正並重送
                      </BrandButton>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        // ── 收藏文章 ──────────────────────────────────────
        savedArticles.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            action={
              <Link href="/articles" className={brandButton({ variant: 'soft', size: 'S' })}>
                逛逛專欄
              </Link>
            }
          >
            尚無收藏文章。在文章頁點「收藏文章」即可加入。
          </EmptyState>
        ) : (
          <div className="space-y-2">
            {savedArticles.map((a) => (
              <div key={a.id} className={cardCls}>
                <a
                  href={`/posts/${a.slug}`}
                  className="min-w-0 flex-1 truncate rounded-sm2 text-sm font-medium text-blue-500 underline-offset-[3px] transition-colors duration-150 ease-out hover:text-pink-600 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                >
                  {a.title}
                </a>
                <BrandButton variant="soft" size="S" onClick={() => unsaveArticle(a.content_id)}>
                  取消收藏
                </BrandButton>
              </div>
            ))}
          </div>
        )
      )}

      {/* 登錄訂單號 Modal */}
      {submitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-ink/40" onClick={() => setSubmitOpen(false)} />
          <div role="dialog" aria-modal="true" aria-labelledby="submit-order-title" className="relative w-full max-w-md space-y-5 rounded-card bg-white p-7 shadow-lg md:p-8">
            <h3 id="submit-order-title" className="font-heading text-[18px] font-normal text-ink md:text-h4">登錄訂單號</h3>
            {products.length === 0 ? (
              <p className="text-sm text-muted">目前沒有可登錄的商品。</p>
            ) : (
              <>
                <div>
                  <label htmlFor="so-product" className={LABEL}>商品</label>
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
                  <label htmlFor="so-order-no" className={LABEL}>訂單號</label>
                  <input
                    id="so-order-no"
                    value={form.external_order_no}
                    onChange={(e) => setForm({ ...form, external_order_no: e.target.value })}
                    className={`${INPUT} font-latin`}
                    placeholder="在蝦皮 / Pinkoi 完成購買後的訂單編號"
                  />
                </div>
                <div>
                  <label htmlFor="so-chart" className={LABEL}>關聯命盤（選填）</label>
                  <select
                    id="so-chart"
                    value={form.chart_id}
                    onChange={(e) => setForm({ ...form, chart_id: e.target.value })}
                    className={INPUT}
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
                  <BrandButton variant="soft" size="S" onClick={() => setSubmitOpen(false)}>
                    取消
                  </BrandButton>
                  <BrandButton variant="primary" size="S" onClick={submitOrder} disabled={submitBusy}>
                    {submitBusy ? '送出中…' : '送出審核'}
                  </BrandButton>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 退回重送 Modal */}
      {resubmitTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-ink/40" onClick={() => setResubmitTarget(null)} />
          <div role="dialog" aria-modal="true" aria-labelledby="resubmit-title" className="relative w-full max-w-md space-y-5 rounded-card bg-white p-7 shadow-lg md:p-8">
            <h3 id="resubmit-title" className="font-heading text-[18px] font-normal text-ink md:text-h4">修正並重送</h3>
            <p className="text-sm text-text">
              {resubmitTarget.product_name}（{resubmitTarget.platform}）
              {resubmitTarget.note && (
                <span className="mt-1 block text-[13px] text-error-fg">退回原因：{resubmitTarget.note}</span>
              )}
            </p>
            <div>
              <label htmlFor="rs-order-no" className={LABEL}>訂單號</label>
              <input
                id="rs-order-no"
                value={resubmitNo}
                onChange={(e) => setResubmitNo(e.target.value)}
                className={`${INPUT} font-latin`}
                placeholder="修正後的訂單編號"
              />
            </div>
            <div>
              <label htmlFor="rs-note" className={LABEL}>補充說明（選填）</label>
              <input
                id="rs-note"
                value={resubmitNote}
                onChange={(e) => setResubmitNote(e.target.value)}
                className={INPUT}
                placeholder="給審核者的補充說明"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <BrandButton variant="soft" size="S" onClick={() => setResubmitTarget(null)}>
                取消
              </BrandButton>
              <BrandButton variant="primary" size="S" onClick={doResubmit} disabled={resubmitBusy}>
                {resubmitBusy ? '送出中…' : '重新送審'}
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
