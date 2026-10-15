/**
 * 在瀏覽器裡讀報告 PDF（「設計你的書」整本預覽用）。
 *
 * pdf.js 4.10.38 的 legacy 版放在 public/vendor/pdfjs-4.10.38（自己提供，不經過 npm／打包工具），
 * 用到時才載入；legacy 版支援較舊的 iOS Safari。授權：Apache 2.0（同資料夾 LICENSE）。
 */

const BASE = '/vendor/pdfjs-4.10.38';

type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: Record<string, unknown>) => { promise: Promise<PdfDocument> };
};

export interface PdfPage {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void>; cancel: () => void };
}

export interface PdfDocument {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
}

let lib: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  if (!lib) {
    // 用 Function 包一層，讓打包工具（Turbopack／webpack）不去解析這個網址
    const dynamicImport = new Function('u', 'return import(u)') as (u: string) => Promise<PdfJs>;
    lib = dynamicImport(`${BASE}/pdf.min.mjs`).then((m) => {
      m.GlobalWorkerOptions.workerSrc = `${BASE}/pdf.worker.min.mjs`;
      return m;
    });
    lib.catch(() => { lib = null; });
  }
  return lib;
}

export async function openPdf(url: string): Promise<PdfDocument> {
  const pdfjs = await loadPdfJs();
  // 後端整份串流，不支援分段請求
  return pdfjs.getDocument({ url, disableRange: true, disableStream: true }).promise;
}

/** 把某一頁畫進 canvas，寬度以 CSS 像素計（會依螢幕密度放大）。回傳取消函式。 */
export function renderPage(pdf: PdfDocument, pageNo: number, canvas: HTMLCanvasElement, cssWidth: number): () => void {
  let cancelled = false;
  let task: { cancel: () => void } | null = null;
  pdf.getPage(pageNo).then((page) => {
    if (cancelled) return;
    const base = page.getViewport({ scale: 1 });
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale: (cssWidth / base.width) * ratio });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const t = page.render({ canvasContext: ctx, viewport });
    task = t;
    t.promise.catch(() => { /* 取消或頁面損毀時不處理 */ });
  }).catch(() => { /* 讀頁失敗：保留空白 */ });
  return () => {
    cancelled = true;
    task?.cancel();
  };
}
