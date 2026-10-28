'use client';

/**
 * 家人卡裡打開的命盤：互動命盤／靜態圖、版型、下載圖片，以及星場分析。
 * 自會員中心原本的「命盤資料」分頁搬來；下載全部在前端完成，零伺服器成本。
 */
import { useState } from 'react';
import { Download, X } from 'lucide-react';
import { ZiweiChart, NAMED_THEMES } from '@ows/ziwei-chart';
import { StarfieldSection } from '@ows/ziwei-app';
import BrandButton from '@/components/ui/BrandButton';
import Alert from '@/components/ui/Alert';
import type { ZiweiCalcResponse } from '@/lib/api/astrology';

// 工具列內的小型下拉（品牌規範 §6.3 的表單樣式、內距縮小以對齊 S 按鈕高度）
const INPUT_SM =
  'rounded-2xl border-[1.5px] border-line-strong bg-white px-3.5 py-1.5 text-sm text-ink ' +
  'focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
// 膠囊切換：跟頁首導覽同一套（選中淡藍底、其他 hover 暖灰底）
const pillCls = (active: boolean) =>
  'whitespace-nowrap rounded-full px-3.5 py-2 text-[15px] font-medium transition-colors duration-150 ease-out ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ' +
  (active ? 'bg-blue-50 text-blue-800' : 'text-ink hover:bg-tint active:bg-line');
const QUIET_BTN =
  'inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm text-muted transition-colors duration-150 ease-out ' +
  'hover:bg-tint hover:text-ink active:bg-line focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100';

export default function FamilyChartViewer({ viewing, name, onClose }: {
  viewing: ZiweiCalcResponse;
  /** 檔名用（例如「小寶的命盤.png」） */
  name: string;
  onClose: () => void;
}) {
  const [viewMode, setViewMode] = useState<'interactive' | 'static'>(viewing.chart_json ? 'interactive' : 'static');
  const [chartTheme, setChartTheme] = useState<'light' | 'dark' | 'sepia'>('light');
  /** 互動命盤上點到的宮位（1…C）；星場分析的星曜能量分頁會收斂到這一宮。 */
  const [axisPalace, setAxisPalace] = useState<string | null>(null);
  const [pngBusy, setPngBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileBase = `${name || '命盤'}的命盤`;

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSvg = () => {
    if (!viewing.svg) return;
    downloadBlob(new Blob([viewing.svg], { type: 'image/svg+xml;charset=utf-8' }), `${fileBase}.svg`);
  };

  // 用 canvas 把 SVG 點陣化成 PNG（2x 清晰度），全在瀏覽器完成
  const downloadPng = async (scale = 2) => {
    if (!viewing.svg) return;
    setPngBusy(true);
    setErr('');
    try {
      const svg = viewing.svg;
      const m =
        svg.match(/viewBox="0\s+0\s+([\d.]+)\s+([\d.]+)"/) ||
        svg.match(/width="([\d.]+)"[^>]*height="([\d.]+)"/);
      const w = m ? parseFloat(m[1]) : 800;
      const h = m ? parseFloat(m[2]) : 800;

      const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('圖片產生失敗'));
        img.src = svgUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('圖片產生失敗');
      ctx.fillStyle = '#ffffff'; // 白底，避免透明背景
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(svgUrl);

      await new Promise<void>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) downloadBlob(blob, `${fileBase}.png`);
          resolve();
        }, 'image/png');
      });
    } catch (e: any) {
      setErr(e.message || '圖片產生失敗，請稍後再試');
    } finally {
      setPngBusy(false);
    }
  };

  return (
    <div className="rounded-inner border border-line p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {viewing.chart_json && viewing.svg && (
          <div className="inline-flex gap-1" role="group" aria-label="檢視方式">
            <button type="button" aria-pressed={viewMode === 'interactive'} onClick={() => setViewMode('interactive')} className={pillCls(viewMode === 'interactive')}>
              互動命盤
            </button>
            <button type="button" aria-pressed={viewMode === 'static'} onClick={() => setViewMode('static')} className={pillCls(viewMode === 'static')}>
              靜態圖
            </button>
          </div>
        )}
        {viewing.chart_json && viewMode === 'interactive' && (
          <label className="inline-flex items-center gap-2 text-sm font-medium text-ink">
            版型
            <select value={chartTheme} onChange={(e) => setChartTheme(e.target.value as 'light' | 'dark' | 'sepia')} className={`${INPUT_SM} w-auto`}>
              <option value="light">淺色</option>
              <option value="dark">深色</option>
              <option value="sepia">宣紙</option>
            </select>
          </label>
        )}
        {viewing.svg && (
          <BrandButton variant="soft" size="S" onClick={() => downloadPng(2)} disabled={pngBusy}>
            <Download className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            {pngBusy ? '產生中…' : '下載圖片'}
          </BrandButton>
        )}
        <button type="button" onClick={onClose} className={`${QUIET_BTN} ml-auto`}>
          收起
          <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      {err && <Alert tone="error" className="mb-4">{err}</Alert>}

      {viewing.chart_json && viewMode === 'interactive' ? (
        <div
          className="w-full rounded-inner p-2 sm:p-4"
          style={{
            background: chartTheme === 'light' ? 'transparent' : NAMED_THEMES[chartTheme].colors?.bg,
            transition: 'background 200ms ease-out',
          }}
        >
          <ZiweiChart chart={viewing.chart_json} flow={viewing.flow ?? undefined} theme={NAMED_THEMES[chartTheme]} onPalaceClick={setAxisPalace} />
        </div>
      ) : viewing.svg ? (
        <div
          className="flex w-full justify-center overflow-x-auto [&>svg]:h-auto [&>svg]:max-w-full"
          // SVG 由自家後端 p_e_artist 產生（可信來源）
          dangerouslySetInnerHTML={{ __html: viewing.svg }}
        />
      ) : null}

      {viewing.svg && (
        <p className="mt-2 text-right">
          <button type="button" onClick={downloadSvg} className="text-[13px] text-muted underline-offset-2 hover:text-blue-500 hover:underline">
            需要印刷用的向量檔（SVG）？
          </button>
        </p>
      )}

      {/* 星場分析（點上方互動命盤的宮位，星曜能量會收斂到該宮） */}
      {(viewing.star_energy || viewing.readings) && (
        <div className="mt-6 border-t border-line pt-5">
          <StarfieldSection starEnergy={viewing.star_energy} readings={viewing.readings} palaceCode={axisPalace} />
        </div>
      )}
    </div>
  );
}
