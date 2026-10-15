'use client';

/**
 * 設計你的書：用報告完整 PDF 做整本翻頁預覽，在書上填寫與標註（docs/report-physical-addon-plan.md 階段 2）。
 *
 * - 封面、扉頁：翻到那一頁直接填（封面名字、款式或客製封面圖、扉頁贈言）
 * - 指定跨頁：客人自選插在哪一頁後面，放照片與文字
 * - 報告每一頁：「在這一頁提出修改」——改寫文字／換成指定圖片（需對應的特殊客製）／回報錯誤（免費）
 * - 修改清單：彙整所有標註，可跳頁、刪除
 * 內容自動儲存到後端（設計草稿或已連到訂單的設計）；實際印刷版由管理者依此排版，再請客人確認打樣。
 *
 * 付款前（加購頁）傳 onAddCustom：需要特殊客製的標註可以直接加進訂單；付款後不傳（改在打樣時補購）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, PencilLine, Plus, Trash2, X } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import BrandButton from '@/components/ui/BrandButton';
import {
  privateFileUrl, reportOrdersApi,
  type AnnotationType, type CustomKey, type DesignAsset, type DesignData, type DesignView, type PhysicalConfig,
} from '@/lib/api/reportOrders';
import { openPdf, renderPage, type PdfDocument } from '@/lib/report/pdf';
import { formatPrice } from '@/lib/report/prices';
import { getImageUrl } from '@/lib/utils';

type BookPage =
  | { kind: 'cover' } | { kind: 'dedication' } | { kind: 'back' }
  | { kind: 'pdf'; page: number }
  | { kind: 'spread-l'; index: number }
  | { kind: 'spread-r'; index: number };

const ANNO: Record<AnnotationType, { label: string; need: CustomKey | null; hint: string }> = {
  text: { label: '改寫文字', need: 'text_unlock', hint: '例如：把第二段改成更口語的說法。' },
  image: { label: '換成指定圖片', need: 'image_insert', hint: '上傳圖片，並說明要換掉這頁的哪一張圖。' },
  fix: { label: '回報錯誤（免費）', need: null, hint: '錯字、稱呼或資料錯誤。' },
};
const COVER_COLORS = ['linear-gradient(160deg,#0967e7,#08326f)', 'linear-gradient(160deg,#ffdcec,#ff7ab8)',
  'linear-gradient(160deg,#dcf5ea,#21b07a)', 'linear-gradient(160deg,#fff4d6,#ffc23d)'];
const inputCls =
  'w-full rounded-2xl border-[1.5px] border-line-strong bg-white px-[16px] py-[11px] text-base text-ink placeholder:text-muted ' +
  'focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
const toolTitle = 'font-heading text-[17px] font-normal text-ink';

const newId = () => Math.random().toString(36).slice(2, 10);

function padSpreads(data: DesignData, count: number): DesignData {
  const spreads = [...(data.spreads ?? [])].slice(0, count);
  while (spreads.length < count) spreads.push({ index: spreads.length, after_page: null, text: '', asset_ids: [] });
  return { ...data, spreads: spreads.map((s, i) => ({ ...s, index: i })) };
}

/** 確認前的檢查（與後端 design.problems 相同規則） */
export function designProblems(data: DesignData, bought: { custom: CustomKey[]; spreads: number }): string[] {
  const out: string[] = [];
  if (!data.cover_name.trim()) out.push('請填寫封面上的名字');
  if (bought.custom.includes('custom_cover') && !data.cover_asset_id) out.push('請上傳客製封面的圖片');
  for (let i = 0; i < bought.spreads; i++) {
    const sp = data.spreads[i];
    if (!sp?.after_page) out.push(`請為「你的跨頁 ${i + 1}」選擇位置`);
    else if (!sp.asset_ids.length && !sp.text.trim()) out.push(`請放上「你的跨頁 ${i + 1}」的照片或文字`);
  }
  for (const a of data.annotations) {
    const need = ANNO[a.type].need;
    if (need && !bought.custom.includes(need)) out.push(`第 ${a.page} 頁的「${ANNO[a.type].label}」需要加購對應的特殊客製`);
  }
  return out;
}

function PdfCanvas({ pdf, page, width, lazy = false }: { pdf: PdfDocument | null; page: number; width: number; lazy?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(!lazy);
  useEffect(() => {
    if (!lazy || !ref.current) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: '200px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [lazy]);
  useEffect(() => {
    if (!pdf || !visible || !ref.current || width <= 0) return;
    return renderPage(pdf, page, ref.current, width);
  }, [pdf, page, width, visible]);
  return <canvas ref={ref} className="block h-auto w-full bg-white" aria-hidden="true" />;
}

export default function BookDesigner({ design, onDesignChange, cfg, purchased, onAddCustom }: {
  design: DesignView;
  onDesignChange: (d: DesignView) => void;
  cfg: PhysicalConfig | null;
  purchased: { custom: CustomKey[]; spreads: number };
  onAddCustom?: (key: CustomKey) => void;
}) {
  const editable = design.editable;
  const [data, setData] = useState<DesignData>(() => padSpreads(design.data, purchased.spreads));
  const [assets, setAssets] = useState<DesignAsset[]>(design.assets);
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pdf, setPdf] = useState<PdfDocument | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pdfError, setPdfError] = useState('');
  const [view, setView] = useState(0);
  const [anno, setAnno] = useState<{ page: number; type: AnnotationType; text: string; asset_ids: number[] } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(320);
  const first = useRef(true);

  // 跨頁數改變（付款前在加購頁加減跨頁）時補齊或截掉
  useEffect(() => { setData((d) => padSpreads(d, purchased.spreads)); }, [purchased.spreads]);

  // 讀報告 PDF
  useEffect(() => {
    if (!design.report_token) return;
    let alive = true;
    let doc: PdfDocument | null = null;
    openPdf(privateFileUrl(design.report_token))
      .then((d) => { if (!alive) { d.destroy(); return; } doc = d; setPdf(d); setPageCount(d.numPages); })
      .catch(() => alive && setPdfError('報告預覽暫時無法載入，請重新整理頁面。'));
    return () => { alive = false; doc?.destroy(); };
  }, [design.report_token]);

  useEffect(() => {
    if (!stageRef.current) return;
    const ro = new ResizeObserver(([e]) => setStageWidth(e.contentRect.width));
    ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, []);

  // 自動儲存（停止輸入 0.8 秒後）
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!editable) return;
    setSave('saving');
    const t = setTimeout(() => {
      reportOrdersApi.saveDesign(design.id, data, pageCount || undefined)
        .then((r) => { setSave('saved'); onDesignChange(r.design); })
        .catch(() => setSave('error'));
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const set = useCallback((patch: Partial<DesignData>) => setData((d) => ({ ...d, ...patch })), []);

  // ── 書頁 ──
  const pages: BookPage[] = useMemo(() => {
    const out: BookPage[] = [{ kind: 'cover' }, { kind: 'dedication' }];
    for (let p = 1; p <= pageCount; p++) {
      out.push({ kind: 'pdf', page: p });
      data.spreads.forEach((s, i) => {
        if (s.after_page === p) out.push({ kind: 'spread-l', index: i }, { kind: 'spread-r', index: i });
      });
    }
    out.push({ kind: 'back' });
    return out;
  }, [pageCount, data.spreads]);
  const views: BookPage[][] = useMemo(() => {
    const out: BookPage[][] = [[pages[0]]];
    for (let i = 1; i < pages.length; i += 2) out.push(pages.slice(i, i + 2));
    return out;
  }, [pages]);
  const v = Math.min(view, views.length - 1);
  const cur = views[v] ?? [];
  const curPdfPages = cur.filter((p): p is { kind: 'pdf'; page: number } => p.kind === 'pdf').map((p) => p.page);
  const goPage = (page: number) => {
    const idx = views.findIndex((vv) => vv.some((p) => p.kind === 'pdf' && p.page === page));
    if (idx >= 0) { setView(idx); setAnno(null); }
  };
  const goSpread = (index: number) => {
    const idx = views.findIndex((vv) => vv.some((p) => (p.kind === 'spread-l' || p.kind === 'spread-r') && p.index === index));
    if (idx >= 0) setView(idx);
  };

  const assetUrl = (id: number | null | undefined) => {
    const a = assets.find((x) => x.id === id);
    return a ? privateFileUrl(a.token) : null;
  };
  const styles = cfg?.cover_styles?.length ? cfg.cover_styles : [{ key: 'style-1', label: '封面款式一' }, { key: 'style-2', label: '封面款式二' }];
  const styleIndex = Math.max(0, styles.findIndex((s) => s.key === data.cover_style));
  const coverBg = (() => {
    const custom = purchased.custom.includes('custom_cover') ? assetUrl(data.cover_asset_id) : null;
    if (custom) return `center/cover no-repeat url("${custom}")`;
    const st = styles[styleIndex] as { image?: string };
    // 後台有上傳款式示意圖就用圖，沒有就用預設配色
    return st?.image ? `center/cover no-repeat url("${getImageUrl(st.image)}")` : COVER_COLORS[styleIndex % COVER_COLORS.length];
  })();

  const pageWidth = Math.max(80, (stageWidth - 4) / 2);
  const annCount = (page: number) => data.annotations.filter((a) => a.page === page).length;

  // 一般函式（不是元件）：打字時不會讓 PDF 畫布重新掛載、重畫
  function pageEl(p: BookPage, w: number, small = false) {
    const base = 'relative aspect-[3/4] w-full overflow-hidden bg-white';
    if (p.kind === 'cover') {
      return (
        <div className={`${base} flex flex-col justify-end rounded-r-lg`} style={{ background: coverBg, padding: small ? 4 : 16 }}>
          <span className="text-white/90" style={{ fontSize: small ? 5 : 11, letterSpacing: '.1em', textShadow: '0 1px 3px rgba(0,0,0,.3)' }}>本命客製報告</span>
          <span className="font-heading text-white" style={{ fontSize: small ? 8 : 26, lineHeight: 1.15, textShadow: '0 1px 4px rgba(0,0,0,.35)' }}>
            {data.cover_name || '（名字）'}
          </span>
        </div>
      );
    }
    if (p.kind === 'back') return <div className={`${base} rounded-l-lg`} style={{ background: COVER_COLORS[styleIndex % COVER_COLORS.length], opacity: 0.9 }} />;
    if (p.kind === 'dedication') {
      return (
        <div className={`${base} flex items-center justify-center p-[10%] text-center font-heading text-ink whitespace-pre-line`} style={{ fontSize: small ? 4 : 13, lineHeight: 1.8 }}>
          {data.dedication || (small ? '' : '（扉頁贈言）')}
        </div>
      );
    }
    if (p.kind === 'spread-l' || p.kind === 'spread-r') {
      const sp = data.spreads[p.index];
      const img = p.kind === 'spread-l' ? assetUrl(sp?.asset_ids[0]) : null;
      return (
        <div className={`${base} flex items-center justify-center text-center`} style={{ background: img ? `center/cover no-repeat url("${img}")` : 'repeating-linear-gradient(45deg,#f3f1ec 0 8px,#ebe8e1 8px 16px)' }}>
          {p.kind === 'spread-r' && sp?.text
            ? <span className="p-[10%] text-text whitespace-pre-line" style={{ fontSize: small ? 4 : 12 }}>{sp.text}</span>
            : !img && <span className="text-text" style={{ fontSize: small ? 4 : 12 }}>你的跨頁 {p.index + 1}<br />{p.kind === 'spread-l' ? '（照片）' : '（文字）'}</span>}
        </div>
      );
    }
    const n = annCount(p.page);
    return (
      <div className={base}>
        <PdfCanvas pdf={pdf} page={p.page} width={w} lazy={small} />
        {n > 0 && <span className="absolute right-1 top-1 rounded-full bg-pink-500 px-1.5 font-latin text-white" style={{ fontSize: small ? 7 : 11 }}>✎{n}</span>}
        {!small && <span className="absolute bottom-1 left-0 right-0 text-center font-latin text-[10px] text-muted">{p.page}</span>}
      </div>
    );
  }

  // ── 上傳 ──
  const upload = async (files: FileList | null): Promise<number[]> => {
    if (!files?.length) return [];
    setUploading(true);
    setError('');
    const ids: number[] = [];
    try {
      for (const f of Array.from(files)) {
        const r = await reportOrdersApi.uploadDesignAsset(design.id, f);
        setAssets((a) => [...a, r.asset]);
        ids.push(r.asset.id);
      }
    } catch (e: any) {
      setError(e.message || '上傳失敗，請稍後再試');
    } finally {
      setUploading(false);
    }
    return ids;
  };
  const removeAsset = async (id: number) => {
    try {
      const r = await reportOrdersApi.deleteDesignAsset(design.id, id);
      setAssets((a) => a.filter((x) => x.id !== id));
      setData((d) => ({
        ...d,
        cover_asset_id: d.cover_asset_id === id ? null : d.cover_asset_id,
        annotations: d.annotations.map((x) => ({ ...x, asset_ids: x.asset_ids.filter((i) => i !== id) })),
        spreads: d.spreads.map((x) => ({ ...x, asset_ids: x.asset_ids.filter((i) => i !== id) })),
      }));
      onDesignChange(r.design);
    } catch (e: any) {
      setError(e.message || '刪除失敗');
    }
  };

  const thumbEl = (id: number) => {
    const url = assetUrl(id);
    return (
      <span key={id} className="relative inline-block h-16 w-16 overflow-hidden rounded-lg bg-tint">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url && <img src={url} alt="" className="h-full w-full object-cover" />}
        {editable && (
          <button type="button" onClick={() => removeAsset(id)} aria-label="移除這張圖片"
            className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </span>
    );
  };

  const filePick = (label: string, onPicked: (ids: number[]) => void, multiple = true) => (
    <label className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-dashed border-blue-500 px-4 text-sm text-blue-600 ${!editable || uploading ? 'pointer-events-none opacity-50' : ''}`}>
      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
      {uploading ? '上傳中…' : label}
      <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple={multiple} className="hidden"
        onChange={async (e) => { const ids = await upload(e.target.files); e.target.value = ''; if (ids.length) onPicked(ids); }} />
    </label>
  );

  // ── 目前跨頁的工具 ──
  const tools: React.ReactNode[] = [];
  if (cur.some((p) => p.kind === 'cover')) {
    tools.push(
      <div key="cover" className="space-y-3">
        <p className={toolTitle}>封面</p>
        <label className="block text-sm text-ink">封面上的名字
          <input className={`${inputCls} mt-1.5`} value={data.cover_name} maxLength={20} disabled={!editable}
            onChange={(e) => set({ cover_name: e.target.value })} />
        </label>
        {purchased.custom.includes('custom_cover') ? (
          <div className="space-y-2">
            <p className="text-sm text-text">客製封面：上傳你要放在封面的圖片（如需另外設計封面，費用另計）。</p>
            {data.cover_asset_id ? thumbEl(data.cover_asset_id) : (
              filePick('上傳封面圖片', (ids) => set({ cover_asset_id: ids[0] }), false)
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {styles.map((s, i) => (
              <button key={s.key} type="button" disabled={!editable} onClick={() => set({ cover_style: s.key })}
                className={`flex min-h-[52px] items-center gap-3 rounded-inner border-[1.5px] px-3 py-2 text-left text-sm ${styleIndex === i ? 'border-blue-500 bg-blue-50' : 'border-line bg-white'}`}>
                <span className="h-9 w-7 shrink-0 rounded" style={{ background: COVER_COLORS[i % COVER_COLORS.length] }} />
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>,
    );
  }
  if (cur.some((p) => p.kind === 'dedication')) {
    tools.push(
      <label key="ded" className="block space-y-1.5">
        <span className={toolTitle}>扉頁贈言</span>
        <textarea className={`${inputCls} min-h-[96px]`} maxLength={200} value={data.dedication} disabled={!editable}
          placeholder="寫給他的一段話（選填，200 字以內）" onChange={(e) => set({ dedication: e.target.value })} />
      </label>,
    );
  }
  const spreadHere = cur.find((p): p is { kind: 'spread-l'; index: number } | { kind: 'spread-r'; index: number } => p.kind === 'spread-l' || p.kind === 'spread-r');
  if (spreadHere) {
    const i = spreadHere.index;
    const sp = data.spreads[i];
    const setSp = (patch: Partial<typeof sp>) => set({ spreads: data.spreads.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
    tools.push(
      <div key="spread" className="space-y-3">
        <p className={toolTitle}>你的跨頁 {i + 1}</p>
        <div className="flex flex-wrap gap-2">{sp.asset_ids.map((id) => thumbEl(id))}</div>
        {filePick('放照片', (ids) => setSp({ asset_ids: [...sp.asset_ids, ...ids].slice(0, 10) }))}
        <textarea className={`${inputCls} min-h-[80px]`} maxLength={1000} value={sp.text} disabled={!editable}
          placeholder="寫在這個跨頁的文字（選填）" onChange={(e) => setSp({ text: e.target.value })} />
        {editable && <BrandButton variant="soft" size="S" onClick={() => setSp({ after_page: null })}>移到別的位置</BrandButton>}
      </div>,
    );
  }
  const unplaced = data.spreads.findIndex((s) => !s.after_page);
  if (curPdfPages.length && editable) {
    const last = curPdfPages[curPdfPages.length - 1];
    if (unplaced >= 0) {
      tools.push(
        <button key="insert" type="button" onClick={() => {
          set({ spreads: data.spreads.map((x, j) => (j === unplaced ? { ...x, after_page: last } : x)) });
          setTimeout(() => goSpread(unplaced), 0);
        }} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-inner border-[1.5px] border-dashed border-blue-500 text-sm text-blue-600">
          <Plus className="h-4 w-4" /> 在第 {last} 頁後面插入「你的跨頁 {unplaced + 1}」
        </button>,
      );
    }
    if (anno) {
      const t = ANNO[anno.type];
      const locked = t.need && !purchased.custom.includes(t.need);
      const opt = t.need ? cfg?.custom_options.find((o) => o.key === t.need) : undefined;
      tools.push(
        <div key="anno" className="space-y-3 rounded-inner border-[1.5px] border-blue-500 p-4">
          <div className="flex items-center gap-2">
            <p className="font-medium text-ink">提出修改</p>
            {curPdfPages.length > 1 && (
              <div className="ml-auto flex gap-1">
                {curPdfPages.map((pg) => (
                  <button key={pg} type="button" onClick={() => setAnno({ ...anno, page: pg })}
                    className={`min-h-[36px] rounded-full px-3 font-latin text-sm ${anno.page === pg ? 'bg-blue-500 text-white' : 'bg-tint text-text'}`}>第 {pg} 頁</button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ANNO) as AnnotationType[]).map((k) => (
              <button key={k} type="button" onClick={() => setAnno({ ...anno, type: k })}
                className={`min-h-[40px] rounded-full px-4 text-sm ${anno.type === k ? 'bg-blue-500 text-white' : 'bg-tint text-text'}`}>{ANNO[k].label}</button>
            ))}
          </div>
          {locked ? (
            <Alert tone="warning">
              「{t.label}」需要加購「{opt?.label ?? '特殊客製'}」{opt ? `+${formatPrice(opt.price)}` : ''}。
              {onAddCustom && opt
                ? <BrandButton variant="primary" size="S" className="mt-2" onClick={() => onAddCustom(opt.key)}>加入並繼續</BrandButton>
                : ' 付款後無法在這裡加購，可以在確認打樣時補購。'}
            </Alert>
          ) : (
            <>
              <textarea className={`${inputCls} min-h-[80px]`} maxLength={1000} value={anno.text} placeholder={t.hint}
                onChange={(e) => setAnno({ ...anno, text: e.target.value })} />
              {anno.type === 'image' && (
                <div className="flex flex-wrap items-center gap-2">
                  {anno.asset_ids.map((id) => thumbEl(id))}
                  {filePick('選擇圖片', (ids) => setAnno((a) => (a ? { ...a, asset_ids: [...a.asset_ids, ...ids] } : a)))}
                </div>
              )}
              <div className="flex gap-2">
                <BrandButton variant="soft" size="S" onClick={() => setAnno(null)}>取消</BrandButton>
                <BrandButton variant="primary" size="S" disabled={!anno.text.trim() && !anno.asset_ids.length}
                  onClick={() => {
                    set({ annotations: [...data.annotations, { id: newId(), page: anno.page, type: anno.type, text: anno.text.trim(), asset_ids: anno.asset_ids }] });
                    setAnno(null);
                  }}>加入修改清單</BrandButton>
              </div>
            </>
          )}
        </div>,
      );
    } else {
      tools.push(
        <BrandButton key="anno-btn" variant="soft" className="w-full" onClick={() => setAnno({ page: curPdfPages[0], type: 'fix', text: '', asset_ids: [] })}>
          <PencilLine className="h-4 w-4" /> 在這一頁提出修改
        </BrandButton>,
      );
    }
  }

  const label = cur[0]?.kind === 'cover' ? '封面' : cur.some((p) => p.kind === 'back') ? '封底'
    : curPdfPages.length ? `第 ${curPdfPages.join('–')} 頁` : `你的跨頁 ${(spreadHere?.index ?? 0) + 1}`;
  const problems = designProblems(data, purchased);

  return (
    <div className="space-y-4">
      {!editable && <Alert tone="info">內容已確認，正在製作打樣；想修改請在確認打樣時提出。</Alert>}
      {pdfError && <Alert tone="error">{pdfError}</Alert>}
      {unplaced >= 0 && editable && <Alert tone="warning">還有跨頁沒選位置：翻到想放的地方，按「在第 N 頁後面插入」。</Alert>}

      {/* 翻書 */}
      <section className="rounded-card bg-[#eef1f7] p-3 md:p-5" aria-label="整本書預覽">
        <div ref={stageRef} className="mx-auto max-w-2xl">
          {!pageCount && !pdfError ? (
            <div className="flex aspect-[3/2] items-center justify-center text-sm text-text"><Loader2 className="mr-2 h-4 w-4 animate-spin" />讀取報告中…</div>
          ) : (
            <div className={`flex shadow-md ${cur.length === 1 ? 'ml-auto w-1/2' : ''}`}>
              {cur.map((p, i) => <div key={i} className="min-w-0 flex-1">{pageEl(p, pageWidth)}</div>)}
            </div>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            <button type="button" onClick={() => { setView(Math.max(0, v - 1)); setAnno(null); }} disabled={v === 0} aria-label="上一頁"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-sm disabled:opacity-30"><ChevronLeft className="h-5 w-5" /></button>
            <span className="font-latin text-sm text-text">{label}・共 {pages.length} 頁</span>
            <button type="button" onClick={() => { setView(Math.min(views.length - 1, v + 1)); setAnno(null); }} disabled={v >= views.length - 1} aria-label="下一頁"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-sm disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button>
          </div>
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" aria-label="全部頁面">
            {views.map((vv, i) => (
              <button key={i} type="button" onClick={() => { setView(i); setAnno(null); }}
                className={`flex shrink-0 overflow-hidden rounded ${i === v ? 'ring-2 ring-blue-500' : 'ring-1 ring-line'}`}
                style={{ width: vv.length === 1 ? 30 : 60 }} aria-label={`跳到第 ${i + 1} 個跨頁`}>
                {vv.map((p, j) => <div key={j} className="min-w-0 flex-1">{pageEl(p, 30, true)}</div>)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 工具 */}
      {tools.length > 0 && <section className="space-y-4 rounded-card bg-white p-5 md:p-6">{tools}</section>}
      {error && <Alert tone="error">{error}</Alert>}

      {/* 修改清單 */}
      <section className="rounded-card bg-white p-5 md:p-6">
        <div className="flex items-center gap-2">
          <h3 className={toolTitle}>修改清單</h3>
          <span className="ml-auto rounded-full bg-tint px-3 py-1 text-[13px] text-text">{data.annotations.length} 則</span>
        </div>
        {data.annotations.length === 0 ? (
          <p className="mt-2 text-sm text-text">還沒有標註。翻到想修改的頁面，按「在這一頁提出修改」。</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {data.annotations.map((a) => (
              <li key={a.id} className="flex items-start gap-3 py-3 text-sm">
                <button type="button" onClick={() => goPage(a.page)} className="min-h-[32px] shrink-0 font-latin font-semibold text-blue-600">第 {a.page} 頁</button>
                <span className="min-w-0 flex-1">
                  <span className="mr-1.5 rounded-full bg-tint px-2 py-0.5 text-[12px] text-text">{ANNO[a.type].label.replace('（免費）', '')}</span>
                  {a.text}{a.asset_ids.length ? `（附圖 ${a.asset_ids.length} 張）` : ''}
                </span>
                {editable && (
                  <button type="button" aria-label="刪除這則標註" onClick={() => set({ annotations: data.annotations.filter((x) => x.id !== a.id) })}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-tint"><Trash2 className="h-4 w-4" /></button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 檢查與儲存狀態 */}
      {editable && problems.length > 0 && (
        <Alert tone="warning">
          <p className="font-medium">還沒完成的項目</p>
          <ul className="mt-1 list-disc pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </Alert>
      )}
      {editable && (
        <p className="text-right text-caption text-muted" aria-live="polite">
          {save === 'saving' ? '儲存中…' : save === 'saved' ? '已自動儲存' : save === 'error' ? '儲存失敗，請檢查網路' : '內容會自動儲存'}
        </p>
      )}
    </div>
  );
}
