'use client';

/**
 * 固定比例的圖片裁切對話框。
 *
 * 使用者在固定比例的取景框裡拖曳、縮放圖片；按「套用」後把取景範圍（相對於原圖的
 * 0~1 比例座標）送到後端 POST /media-lib/files/:id/crop，由後端用原檔裁切並**另存新檔**，
 * 原圖不動。這裡刻意不用 canvas：圖片來自另一個網域（本機 /uploads、正式 GCS）且沒有
 * CORS 標頭，canvas 會被汙染而無法輸出；用純 CSS 位移預覽、後端實際裁切就沒有這個限制。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { mediaApi } from '@ows/platform-api';
import type { MediaItem } from '@ows/platform-api/strapi';
import { getAdminConfig } from '../config';

interface Props {
  media: MediaItem;
  /** 寬 / 高，例如 3:4 傳 { w: 3, h: 4 } */
  aspect: { w: number; h: number };
  title?: string;
  onCancel: () => void;
  onDone: (cropped: MediaItem) => void;
}

const VIEW_H = 400; // 取景框高度（px）；寬度依比例推算
const MAX_ZOOM = 4;

export default function ImageCropDialog({ media, aspect, title, onCancel, onDone }: Props) {
  const viewW = Math.round((VIEW_H * aspect.w) / aspect.h);
  const viewH = VIEW_H;

  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // 圖片左上角相對取景框的位移（≤ 0）
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const baseScale = natural ? Math.max(viewW / natural.w, viewH / natural.h) : 1; // 剛好蓋滿取景框
  const dispW = natural ? natural.w * baseScale * zoom : viewW;
  const dispH = natural ? natural.h * baseScale * zoom : viewH;

  const clamp = useCallback(
    (x: number, y: number, w = dispW, h = dispH) => ({
      x: Math.min(0, Math.max(viewW - w, x)),
      y: Math.min(0, Math.max(viewH - h, y)),
    }),
    [dispW, dispH, viewW, viewH],
  );

  // 圖片載入後置中
  useEffect(() => {
    if (!natural) return;
    const s = Math.max(viewW / natural.w, viewH / natural.h);
    setZoom(1);
    setOffset({ x: (viewW - natural.w * s) / 2, y: (viewH - natural.h * s) / 2 });
  }, [natural, viewW, viewH]);

  // 縮放時以取景框中心為錨點
  const changeZoom = (next: number) => {
    if (!natural) return;
    const z = Math.min(MAX_ZOOM, Math.max(1, next));
    const nw = natural.w * baseScale * z;
    const nh = natural.h * baseScale * z;
    const cx = (viewW / 2 - offset.x) / dispW;
    const cy = (viewH / 2 - offset.y) / dispH;
    setZoom(z);
    setOffset(clamp(viewW / 2 - cx * nw, viewH / 2 - cy * nh, nw, nh));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setOffset(clamp(drag.current.ox + e.clientX - drag.current.px, drag.current.oy + e.clientY - drag.current.py));
  };
  const onPointerUp = () => { drag.current = null; };

  const apply = async () => {
    if (!natural) return;
    setSaving(true);
    setError(null);
    try {
      const cropped = await mediaApi.cropMedia(media.id, {
        x: -offset.x / dispW,
        y: -offset.y / dispH,
        width: viewW / dispW,
        height: viewH / dispH,
      }, `${aspect.w}:${aspect.h}`);
      onDone(cropped);
    } catch (e: any) {
      setError(e?.message || '裁切失敗，請再試一次');
      setSaving(false);
    }
  };

  const { getImageUrl } = getAdminConfig();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={title || '裁切圖片'}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card text-card-foreground shadow-xl">
        <div className="px-5 pt-4">
          <h2 className="text-sm font-semibold">{title || '裁切圖片'}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            這個位置固定使用 {aspect.w}:{aspect.h} 的圖片。拖曳調整位置、用滑桿縮放；套用後會另存一張新圖，原圖不變。
          </p>
        </div>

        <div className="flex justify-center px-5 py-4">
          <div
            className="relative overflow-hidden rounded-md bg-muted touch-none select-none cursor-grab active:cursor-grabbing"
            style={{ width: viewW, height: viewH }}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
            onWheel={(e) => changeZoom(zoom - e.deltaY * 0.0015)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getImageUrl(media.file_path)} alt="" draggable={false}
              onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={() => setError('圖片載入失敗')}
              style={{ position: 'absolute', left: offset.x, top: offset.y, width: dispW, height: dispH, maxWidth: 'none' }}
            />
            {/* 三分線 */}
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
              {Array.from({ length: 9 }).map((_, i) => <div key={i} className="border border-white/25" />)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-5">
          <span className="text-xs text-muted-foreground">縮放</span>
          <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom} disabled={!natural}
            onChange={(e) => changeZoom(Number(e.target.value))} className="flex-1" aria-label="縮放" />
        </div>

        {error && <p role="alert" className="px-5 pt-3 text-xs text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 px-5 py-4">
          <button type="button" onClick={onCancel} disabled={saving}
            className="rounded-lg bg-muted px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50">取消</button>
          <button type="button" onClick={apply} disabled={saving || !natural}
            className="rounded-lg bg-admin-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-admin-accent-700 disabled:opacity-50">
            {saving ? '裁切中…' : '套用裁切'}
          </button>
        </div>
      </div>
    </div>
  );
}
