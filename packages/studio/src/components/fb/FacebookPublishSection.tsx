'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@ows/platform-api';
import { documentApi, publishRequestApi } from '../../api';
import { STUDIO_ROUTES } from '../../constants';
import type { PublishRequest } from '../../types';
import { ModeBanner, PublishPanel, publishStateLabel } from './publishUi';
import { btnGhost } from '../ui';

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return '操作失敗';
}

function useAllowlistedApprover(): boolean {
  const permissions = useAuthStore((s) => s.user?.permissions);
  const [allowed, setAllowed] = useState(false);
  const hasPermission = Boolean(
    permissions?.includes('studio.publish_approve') || permissions?.includes('*'),
  );
  useEffect(() => {
    if (!hasPermission) {
      setAllowed(false);
      return;
    }
    let live = true;
    publishRequestApi.health()
      .then(() => { if (live) setAllowed(true); })
      .catch(() => { if (live) setAllowed(false); });
    return () => { live = false; };
  }, [hasPermission]);
  return allowed;
}

function usePublishMode(): string | null {
  const [mode, setMode] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    publishRequestApi.list({ per_page: 1 })
      .then((res) => { if (live) setMode(res.publish_mode ?? 'off'); })
      .catch(() => { if (live) setMode(null); });
    return () => { live = false; };
  }, []);
  return mode;
}

export function FacebookPublishSection({
  documentId,
  projectId,
  platform,
  title,
  body,
  beforeSubmit,
  onCreated,
}: {
  documentId: number;
  projectId: number;
  platform: string;
  title?: string | null;
  body?: string;
  beforeSubmit?: () => Promise<void>;
  onCreated?: (documentId: number) => void;
}) {
  const canApprove = useAllowlistedApprover();
  const [mode, setMode] = useState<string | null>(null);
  const [request, setRequest] = useState<PublishRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    return publishRequestApi.list({ document_id: documentId, per_page: 1 }).then((res) => {
      setMode(res.publish_mode ?? 'off');
      setRequest(res.publish_requests[0] ?? null);
    });
  }, [documentId]);

  useEffect(() => {
    load().catch((error: unknown) => setError(errorMessage(error)));
  }, [load]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await load();
    } catch (error: unknown) {
      setError(errorMessage(error));
      throw error;
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {error && <p role="alert" className="px-3 py-2 text-sm text-destructive sm:px-4">{error}</p>}
      <PublishPanel
        platform={platform}
        canApprove={canApprove}
        mode={mode}
        request={request}
        draftMessage={body}
        busy={busy}
        onCreateFacebook={() => {
          void run(async () => {
            await beforeSubmit?.();
            const created = await documentApi.create(projectId, {
              platform: 'facebook',
              title: title || undefined,
              body: body || undefined,
            });
            onCreated?.(created.id);
          }).catch(() => undefined);
        }}
        onSubmit={({ link }) => {
          void run(async () => {
            await beforeSubmit?.();
            await publishRequestApi.create(documentId, {
              target: 'facebook_page',
              link: link.trim() || undefined,
            });
          }).catch(() => undefined);
        }}
        onApprove={() => {
          if (!request) return;
          void run(() => publishRequestApi.approve(request.id, request.content_hash).then(() => undefined)).catch(() => undefined);
        }}
        onPublish={() => {
          if (!request) return undefined;
          return run(() => publishRequestApi.publish(request.id).then(() => undefined));
        }}
        onReconcile={() => {
          if (!request) return;
          void run(() => publishRequestApi.reconcile(request.id).then(() => undefined)).catch(() => undefined);
        }}
      />
    </>
  );
}

export function PublishAttention({ title = '粉專待處理' }: { title?: string }) {
  const canApprove = useAllowlistedApprover();
  const mode = usePublishMode();
  const [rows, setRows] = useState<PublishRequest[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    return Promise.all([
      publishRequestApi.list({ state: 'unknown', per_page: 20 }),
      publishRequestApi.list({ state: 'failed', per_page: 20 }),
    ]).then(([unknowns, failed]) => {
      const merged = [...unknowns.publish_requests, ...failed.publish_requests];
      merged.sort((a, b) => b.id - a.id);
      setRows(merged);
    });
  }, []);

  useEffect(() => {
    load().catch((error: unknown) => setError(errorMessage(error)));
  }, [load]);

  if (!error && rows.length === 0 && (mode === null || mode === 'live')) return null;

  const reconcile = (row: PublishRequest) => {
    setBusyId(row.id);
    setError('');
    publishRequestApi.reconcile(row.id)
      .then(() => load())
      .catch((error: unknown) => setError(errorMessage(error)))
      .finally(() => setBusyId(null));
  };

  return (
    <section aria-label={title} className="mb-4 space-y-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      <ModeBanner mode={mode} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {rows.length === 0 ? null : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <Link href={STUDIO_ROUTES.workspace(row.document_id)} className="font-medium underline">文件 #{row.document_id}</Link>
              <span className={row.state === 'failed' || row.state === 'unknown' ? 'text-destructive' : 'text-muted-foreground'}>
                {publishStateLabel(row.state)}
              </span>
              {row.state === 'unknown' && (
                <span className="text-xs text-muted-foreground">不會自動重發。</span>
              )}
              {row.state === 'failed' && row.error_message && (
                <span className="text-xs text-destructive">{row.error_message}</span>
              )}
              {canApprove && row.state === 'unknown' && (
                <button type="button" className={`${btnGhost} ml-auto text-xs`} disabled={busyId === row.id} onClick={() => reconcile(row)}>對帳</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
