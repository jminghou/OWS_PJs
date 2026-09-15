'use client';

import { useCallback, useEffect, useState } from 'react';
import { inboxApi } from '../api';
import { INBOX_CHANGED_EVENT } from './QuickCollect';

/** 側欄「收集箱」右側的待整理數；收集箱有異動時透過 studio:inbox-changed 事件重抓。 */
export function InboxBadge() {
  const [count, setCount] = useState<number | null>(null);
  const load = useCallback(() => {
    inboxApi.list({ status: 'new', per_page: 1 }).then((r) => setCount(r.pagination.total)).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    window.addEventListener(INBOX_CHANGED_EVENT, load);
    return () => window.removeEventListener(INBOX_CHANGED_EVENT, load);
  }, [load]);
  if (!count) return null;
  return <span className="tabular-nums">{count}</span>;
}
