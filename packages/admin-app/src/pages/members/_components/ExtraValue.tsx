'use client';

import type { MemberColumnKind } from '@ows/platform-api';
import { nf } from './format';

/** 依模組登記的 kind 畫出欄位值。 */
export default function ExtraValue({ kind, value }: { kind: MemberColumnKind; value: unknown }) {
  if (value === undefined || value === null) return <span className="text-muted-foreground">—</span>;
  switch (kind) {
    case 'boolean':
      return value ? (
        <span className="inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">是</span>
      ) : (
        <span className="text-muted-foreground">否</span>
      );
    case 'number':
      return <span className="tabular-nums">{nf.format(Number(value) || 0)}</span>;
    case 'badges': {
      const items = Array.isArray(value) ? value : [];
      if (!items.length) return <span className="text-muted-foreground">—</span>;
      return (
        <span className="flex flex-wrap gap-1">
          {items.map((v) => (
            <span key={String(v)} className="inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium bg-admin-accent-50 text-admin-accent-700 dark:bg-admin-accent-800/40 dark:text-admin-accent-100">
              {String(v)}
            </span>
          ))}
        </span>
      );
    }
    default:
      return <span>{String(value)}</span>;
  }
}
