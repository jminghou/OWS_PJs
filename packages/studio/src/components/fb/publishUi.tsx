'use client';

import { useEffect, useRef, useState } from 'react';
import type { PublishCheck } from '../../types';

const btnPrimary = 'inline-flex items-center justify-center gap-1.5 min-h-[40px] md:min-h-0 px-3 py-1.5 text-sm font-medium rounded-lg bg-admin-accent-600 text-white hover:bg-admin-accent-700 disabled:opacity-50 transition';
const btnGhost = 'inline-flex items-center justify-center gap-1.5 min-h-[40px] md:min-h-0 px-3 py-1.5 text-sm font-medium rounded-lg bg-muted text-foreground hover:bg-accent disabled:opacity-50 transition';

/** 粉專發送開關。live 不另外佔一條警告；其餘模式都要讓人一眼看到。 */
export type ShownPublishMode = 'off' | 'dry_run' | 'fake' | 'live' | string;

const MODE_COPY: Record<string, string> = {
  off: '目前模式：off（關閉）。不會發到粉專。',
  dry_run: '目前模式：dry_run（演練）。只記錄計畫，不連粉專。',
  fake: '目前模式：fake（假伺服器）。只打本機，不連正式粉專。',
};

const STATE_LABEL: Record<string, string> = {
  pending_review: '核查未過',
  pending_approval: '待核准',
  approved: '已核准',
  publishing: '送出中',
  published: '已發布',
  scheduled: '已排程',
  failed: '失敗',
  unknown: '結果未知',
  rejected: '已退回',
  cancelled: '已取消',
};

const OPEN_FOR_NEW_SUBMIT = new Set(['failed', 'rejected', 'cancelled', 'published']);

export interface PublishPanelRequest {
  id: number;
  state: string;
  content_hash: string;
  check_report?: PublishCheck[];
  payload?: { message?: string; link?: string | null; media?: { public_url?: string }[] };
  error_code?: string | null;
  error_message?: string | null;
  external_url?: string | null;
}

export function publishStateLabel(state: string): string {
  return STATE_LABEL[state] ?? state;
}

export function ModeBanner({ mode }: { mode?: string | null }) {
  if (!mode || mode === 'live') return null;
  const text = MODE_COPY[mode] ?? `目前模式：${mode}。不是正式發送。`;
  return (
    <div role="status" data-testid="publish-mode" className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
      {text}
    </div>
  );
}

export function FbPreview({
  pageName = '粉專',
  message,
  images = [],
  link,
}: {
  pageName?: string;
  message?: string | null;
  images?: string[];
  link?: string | null;
}) {
  return (
    <article aria-label="Facebook 貼文預覽" className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
      <div className="flex items-center gap-2 p-3">
        <span aria-hidden className="h-9 w-9 flex-shrink-0 rounded-full bg-muted" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{pageName}</div>
          <div className="text-[11px] text-muted-foreground">純文字與圖片預覽</div>
        </div>
      </div>
      <p className="whitespace-pre-wrap px-3 pb-3 text-sm">{message?.trim() ? message : '（沒有文字）'}</p>
      {images.length > 0 && (
        <div className={images.length > 1 ? 'grid grid-cols-2 gap-0.5 bg-muted' : 'bg-muted'}>
          {images.map((src, index) => (
            <img key={`${src}-${index}`} src={src} alt="" className="max-h-64 w-full object-cover" />
          ))}
        </div>
      )}
      {link ? <div className="break-all border-t border-border px-3 py-2 text-xs text-muted-foreground">{link}</div> : null}
    </article>
  );
}

const LEVEL_TONE: Record<PublishCheck['level'], string> = {
  block: 'text-destructive',
  warn: 'text-amber-800',
  pass: 'text-emerald-700',
};

const LEVEL_LABEL: Record<PublishCheck['level'], string> = {
  block: '阻擋',
  warn: '提醒',
  pass: '通過',
};

export function CheckReport({ report }: { report?: PublishCheck[] | null }) {
  const items = report ?? [];
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">還沒有自動核查結果。</p>;
  }
  const flagged = items.filter((item) => item.level !== 'pass');
  const passed = items.filter((item) => item.level === 'pass');
  return (
    <div aria-label="自動核查結果">
      {flagged.length === 0 ? (
        <p className="text-sm text-emerald-700">自動核查沒有阻擋或提醒。</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {flagged.map((item, index) => (
            <li key={`${item.rule}-${index}`} className={LEVEL_TONE[item.level]}>
              <span className="font-medium">{LEVEL_LABEL[item.level]}</span>
              {' '}{item.message}
              {item.location ? <span className="text-muted-foreground">（{item.location}）</span> : null}
            </li>
          ))}
        </ul>
      )}
      {passed.length > 0 && (
        <details className="mt-2 text-xs text-muted-foreground">
          <summary>已通過 {passed.length} 項</summary>
          <ul className="mt-1 space-y-1">
            {passed.map((item, index) => (
              <li key={`${item.rule}-${index}`}>{item.message}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function ApproveDialog({
  open,
  intent,
  canApprove,
  contentHash,
  mode,
  message,
  images,
  link,
  pageName,
  busy,
  onApprove,
  onPublish,
  onClose,
}: {
  open: boolean;
  intent: 'approve' | 'publish';
  canApprove: boolean;
  contentHash: string;
  mode?: string | null;
  message?: string | null;
  images?: string[];
  link?: string | null;
  pageName?: string;
  busy?: boolean;
  onApprove: () => void;
  onPublish: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const publishLock = useRef(false);
  const [publishLocked, setPublishLocked] = useState(false);

  useEffect(() => {
    if (!open) {
      setChecked(false);
      publishLock.current = false;
      setPublishLocked(false);
    }
  }, [open]);

  if (!open || !canApprove) return null;

  const confirmPublish = () => {
    if (publishLock.current || busy) return;
    publishLock.current = true;
    setPublishLocked(true);
    void Promise.resolve(onPublish()).catch(() => {
      publishLock.current = false;
      setPublishLocked(false);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="presentation">
      <div role="dialog" aria-label={intent === 'approve' ? '確認核准' : '確認發布'} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xl">
        <h2 className="text-base font-semibold">{intent === 'approve' ? '核對後才核准' : '再確認一次才發布'}</h2>
        <div className="mt-3"><ModeBanner mode={mode} /></div>
        <p className="mt-2 text-xs text-muted-foreground">內容雜湊</p>
        <code className="mt-1 block break-all rounded-md bg-muted px-2 py-1 text-xs">{contentHash}</code>
        <div className="mt-3">
          <FbPreview pageName={pageName} message={message} images={images} link={link} />
        </div>
        {intent === 'approve' ? (
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
            我已核對內容雜湊與預覽
          </label>
        ) : (
          <p className="mt-3 text-sm">送出後這個按鈕會立刻停用，避免按兩次。</p>
        )}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>取消</button>
          {intent === 'approve' ? (
            <button type="button" className={btnPrimary} disabled={!checked || busy} onClick={onApprove}>確認核准</button>
          ) : (
            <button type="button" className={btnPrimary} disabled={publishLocked || busy} onClick={confirmPublish}>確認發布</button>
          )}
        </div>
      </div>
    </div>
  );
}

function previewOf(request: PublishPanelRequest | null, draftMessage?: string) {
  const media = request?.payload?.media ?? [];
  return {
    message: request?.payload?.message ?? draftMessage ?? '',
    link: request?.payload?.link ?? null,
    images: media.map((item) => item.public_url).filter((url): url is string => Boolean(url)),
  };
}

export function PublishPanel({
  platform = 'facebook',
  canApprove,
  mode,
  request,
  draftMessage,
  pageName,
  busy,
  onCreateFacebook,
  onSubmit,
  onApprove,
  onPublish,
  onReconcile,
}: {
  platform?: string;
  canApprove: boolean;
  mode?: string | null;
  request: PublishPanelRequest | null;
  draftMessage?: string;
  pageName?: string;
  busy?: boolean;
  onCreateFacebook?: () => void;
  onSubmit?: (input: { link: string }) => void;
  onApprove?: () => void;
  onPublish?: () => void | Promise<void>;
  onReconcile?: () => void;
}) {
  const [link, setLink] = useState('');
  const [dialog, setDialog] = useState<null | 'approve' | 'publish'>(null);
  const preview = previewOf(request, draftMessage);
  const state = request?.state ?? '';
  useEffect(() => {
    if (dialog === 'publish' && state !== 'approved') setDialog(null);
    if (dialog === 'approve' && state !== 'pending_approval') setDialog(null);
  }, [dialog, state]);
  const canStartSubmit = !request || OPEN_FOR_NEW_SUBMIT.has(state);
  const showPreview = platform === 'facebook';

  return (
    <section aria-label="粉專發文" className="space-y-3 border-b border-border/60 bg-card px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">粉專發文</h2>
        {request ? (
          <span className={`text-xs font-medium ${state === 'failed' || state === 'unknown' ? 'text-destructive' : 'text-muted-foreground'}`}>
            {publishStateLabel(state)}
          </span>
        ) : null}
      </div>
      <ModeBanner mode={mode} />
      {state === 'failed' && (
        <p role="status" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          失敗{request?.error_code ? `（${request.error_code}）` : ''}。{request?.error_message || '沒有錯誤說明。'}不會自動重發。
        </p>
      )}
      {state === 'unknown' && (
        <p role="status" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          結果未知。請對帳。不會自動重發。
        </p>
      )}
      {state === 'published' && request?.external_url && (
        <a href={request.external_url} target="_blank" rel="noreferrer" className="text-sm underline break-all">{request.external_url}</a>
      )}
      {showPreview && <FbPreview pageName={pageName} message={preview.message} images={preview.images} link={preview.link || link || null} />}
      {request && <CheckReport report={request.check_report} />}
      {platform !== 'facebook' && onCreateFacebook && (
        <button type="button" className={btnPrimary} disabled={busy} onClick={onCreateFacebook}>建立 Facebook 版本</button>
      )}
      {platform === 'facebook' && canStartSubmit && onSubmit && state !== 'unknown' && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            aria-label="貼文連結"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https:// 選填"
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
          />
          <button type="button" className={btnPrimary} disabled={busy} onClick={() => onSubmit({ link })}>送審</button>
        </div>
      )}
      {canApprove && state === 'pending_approval' && (
        <button type="button" className={btnPrimary} disabled={busy} onClick={() => setDialog('approve')}>核准</button>
      )}
      {canApprove && state === 'approved' && (
        <button type="button" className={btnPrimary} disabled={busy} onClick={() => setDialog('publish')}>發布到粉專</button>
      )}
      {canApprove && state === 'unknown' && onReconcile && (
        <button type="button" className={btnGhost} disabled={busy} onClick={onReconcile}>對帳</button>
      )}
      {request && (
        <ApproveDialog
          open={dialog !== null}
          intent={dialog === 'publish' ? 'publish' : 'approve'}
          canApprove={canApprove}
          contentHash={request.content_hash}
          mode={mode}
          message={preview.message}
          images={preview.images}
          link={preview.link}
          pageName={pageName}
          busy={busy}
          onClose={() => setDialog(null)}
          onApprove={() => { onApprove?.(); setDialog(null); }}
          onPublish={() => onPublish?.()}
        />
      )}
    </section>
  );
}
