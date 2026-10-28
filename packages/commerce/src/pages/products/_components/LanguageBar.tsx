'use client';

/**
 * 編輯產品時的語言列：同一個產品 ID 的各語言版本（每個語言是一筆獨立商品）。
 * - 點語言切換到那個版本；還沒建立的語言可以「從某個語言複製」建立草稿（停用中）
 * - 複製來的版本要按「確認內容已完成」才能上架；原文改過後顯示「原文已更新」提醒
 */
import { useState } from 'react';
import { AlertTriangle, Plus } from 'lucide-react';

export interface ProductLanguage {
  /** 語言代碼，與前台語系一致，例如 zh-TW、en */
  code: string;
  /** 完整名稱，例如「繁體中文」 */
  label: string;
  /** 清單上的短標，例如「繁中」 */
  short: string;
  /** 建立這個語言版本時預設的售價幣別 */
  currency: string;
}

export interface LanguageVersion {
  id: number;
  language: string;
  is_active: boolean;
  name: string;
  price: number;
  currency: string;
  is_root: boolean;
  stale: boolean;
  confirmed: boolean;
}

export interface TranslationState {
  source_id: number;
  source_language: string;
  confirmed: boolean;
  synced_at: string | null;
  source_updated_at: string | null;
  stale: boolean;
}

export const DEFAULT_LANGUAGES: ProductLanguage[] = [{ code: 'zh-TW', label: '繁體中文', short: '繁中', currency: 'TWD' }];

export const languageLabel = (languages: ProductLanguage[], code: string, short = false) => {
  const l = languages.find((x) => x.code === code);
  return l ? (short ? l.short : l.label) : code;
};

const fmtTime = (iso: string | null) => (iso ? new Date(`${iso}Z`).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }) : '');

/** 清單與語言列共用的語言標記：實心＝上架中、空心＝已建立未上架、虛線＝還沒建立 */
export function LanguageChip({ label, version, current, onClick, title }: {
  label: string;
  version?: LanguageVersion;
  current?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const base = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors';
  const cls = !version
    ? 'border border-dashed border-gray-300 text-gray-400'
    : current
      ? 'border border-blue-600 bg-blue-600 text-white'
      : version.is_active
        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
        : 'border border-gray-300 bg-white text-gray-600 hover:bg-gray-50';
  const content = (
    <>
      {label}
      {version?.stale && <AlertTriangle size={10} aria-label="原文已更新" />}
    </>
  );
  return onClick ? (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} className={`${base} ${cls}`} title={title}>{content}</button>
  ) : (
    <span className={`${base} ${cls}`} title={title}>{content}</span>
  );
}

export const versionTitle = (v?: LanguageVersion) =>
  !v ? '還沒建立' : `${v.is_active ? '上架中' : '未上架'}${v.stale ? '・原文已更新' : ''}${!v.confirmed ? '・待確認內容' : ''}`;

export default function LanguageBar({
  languages,
  versions,
  currentId,
  translation,
  onSwitch,
  onAdd,
  onConfirm,
}: {
  languages: ProductLanguage[];
  versions: LanguageVersion[];
  currentId: number;
  translation: TranslationState | null | undefined;
  onSwitch: (id: number) => void;
  onAdd: (language: ProductLanguage, copyFromId: number) => Promise<void>;
  onConfirm: () => Promise<void>;
}) {
  const [adding, setAdding] = useState<ProductLanguage | null>(null);
  const [copyFrom, setCopyFrom] = useState<number>(currentId);
  const [busy, setBusy] = useState(false);
  const current = versions.find((v) => v.id === currentId);
  const sourceLabel = translation ? languageLabel(languages, translation.source_language) : '';

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 border-b border-border px-6 py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-muted-foreground">語言版本</span>
        {languages.map((l) => {
          const v = versions.find((x) => x.language === l.code);
          return v ? (
            <LanguageChip key={l.code} label={l.label} version={v} current={v.id === currentId}
              onClick={() => v.id !== currentId && onSwitch(v.id)} title={versionTitle(v)} />
          ) : (
            <button key={l.code} type="button"
              onClick={() => { setAdding(l); setCopyFrom(currentId); }}
              className={`inline-flex items-center gap-0.5 rounded-full border border-dashed px-2 py-0.5 text-[11px] font-medium transition-colors ${
                adding?.code === l.code ? 'border-blue-500 text-blue-600' : 'border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600'
              }`}>
              <Plus size={11} /> {l.label}
            </button>
          );
        })}
      </div>

      {adding && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm">
          <span>建立{adding.label}版本，內容先複製自</span>
          <select value={copyFrom} onChange={(e) => setCopyFrom(Number(e.target.value))}
            className="rounded-md border border-border bg-card px-2 py-1 text-sm">
            {versions.map((v) => <option key={v.id} value={v.id}>{languageLabel(languages, v.language)}</option>)}
          </select>
          <button type="button" disabled={busy}
            onClick={() => run(async () => { await onAdd(adding, copyFrom); setAdding(null); })}
            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {busy ? '建立中…' : '建立（先不上架）'}
          </button>
          <button type="button" onClick={() => setAdding(null)} className="text-xs text-muted-foreground hover:text-foreground">取消</button>
          <p className="w-full text-xs text-muted-foreground">
            會建立一筆獨立的{adding.label}商品：文字、圖片與站台設定都先複製一份，售價幣別預設 {adding.currency}，售價需要重新設定。
          </p>
        </div>
      )}

      {translation && !translation.confirmed && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <span className="min-w-0 flex-1">
            這是從其他語言複製來的草稿（原文是{sourceLabel}）。
            把每個分頁的文字改寫成{current ? languageLabel(languages, current.language) : '這個語言'}、設定售價並儲存後，按「確認內容已完成」才能上架。
          </span>
          <button type="button" disabled={busy} onClick={() => run(onConfirm)}
            className="rounded-md bg-amber-600 px-3 py-1 font-medium text-white hover:bg-amber-700 disabled:opacity-50">
            確認內容已完成
          </button>
        </div>
      )}
      {translation && translation.confirmed && translation.stale && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertTriangle size={14} className="shrink-0" />
          <span className="min-w-0 flex-1">
            原文（{sourceLabel}）在 {fmtTime(translation.source_updated_at)} 改過內容，這個版本上次同步是 {fmtTime(translation.synced_at)}。請對照原文更新後再按「已同步原文」。
          </span>
          <button type="button" disabled={busy} onClick={() => run(onConfirm)}
            className="rounded-md border border-amber-300 bg-white px-3 py-1 font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50">
            已同步原文
          </button>
        </div>
      )}
    </div>
  );
}
