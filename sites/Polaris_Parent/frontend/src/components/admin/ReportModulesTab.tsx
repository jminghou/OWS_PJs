'use client';

/**
 * 產品管理的「頁面模組」分頁：商品頁每個固定位置用下拉選單選一個模組（產品管理 › 模組管理建立的）。
 * 存在 attributes.report_modules（{slot: module_key}；空字串＝不顯示）。同一個語言版本的商品取模組的同語言版本，
 * 缺該語言版本或未啟用的模組，商品不能上架（後端 page_modules 的上架檢查）。
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import type { ProductAttributeTab, ProductAttributesSectionProps } from '@ows/commerce';
import { REPORT_PRODUCTS } from '@/lib/report/catalog';
import { SALES_LANGUAGES } from '@/lib/report/locale';
import { PRODUCT_MODULES_KEY, PRODUCT_SLOTS, moduleTypeInfo, productModuleRefs, type ModuleRefs } from '@/lib/report/modules';
import { pageModuleApi, type PageModuleGroup } from '@/lib/api/pageModules';
import { fieldCls } from '@/components/admin/modules/ModuleDataEditor';

const reportFor = (productId: string) => REPORT_PRODUCTS.find((p) => p.displayProductId === productId);
const langShort = (code: string) => SALES_LANGUAGES.find((l) => l.code === code)?.short ?? code;

/** 這個模組在某個語言能不能用 */
export function moduleAvailability(g: PageModuleGroup, language: string) {
  const v = g.versions.find((x) => x.language === language);
  if (!v) return { ok: false, note: `缺${langShort(language)}版` };
  if (!v.is_active) return { ok: false, note: `${langShort(language)}版未啟用` };
  return { ok: true, note: '' };
}

function ReportModulesTab({ productId, attributes, onChange, language = 'zh-TW' }: ProductAttributesSectionProps) {
  const report = reportFor(productId)!; // appliesTo 保證有值
  const refs = productModuleRefs(attributes);
  const [groups, setGroups] = useState<PageModuleGroup[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    pageModuleApi.list().then((r) => setGroups(r.modules)).catch((e) => setError(e.message || '讀取模組失敗'));
  }, []);

  const setRefs = (next: ModuleRefs) => onChange({ ...attributes, [PRODUCT_MODULES_KEY]: next });

  if (!refs) {
    return (
      <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
        <p className="font-medium">這個商品頁還沒改用模組，前台目前顯示舊的「商品頁內容」設定。</p>
        <p className="text-xs leading-relaxed">
          第一次使用請到「產品管理 › 模組管理」按「從現有內容建立模組」：會把現有內容轉成模組並自動幫報告商品選好，前台看起來不變。
          如果是全新的報告，也可以直接在這裡開始選模組（沒選的位置前台不顯示）。
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/page-modules" className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700">
            前往模組管理 <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <button type="button" className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium hover:bg-amber-100"
            onClick={() => { if (confirm('改用模組後，前台只顯示你選的模組，沒選的位置不顯示。要開始嗎？（儲存後才生效）')) setRefs({}); }}>
            直接開始選模組
          </button>
        </div>
      </div>
    );
  }

  const missing = groups
    ? PRODUCT_SLOTS.filter(({ slot }) => refs[slot]).map(({ slot, label }) => {
        const g = groups.find((x) => x.module_key === refs[slot]);
        return { label, note: g ? moduleAvailability(g, language).note : '模組已不存在' };
      }).filter((x) => x.note)
    : [];

  return (
    <>
      <p className="rounded-lg bg-muted px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        對應前台 /report/{report.slug} 商品頁從價格卡以下的各段內容。每個位置選一個模組，選「不顯示」就隱藏那一段。
        模組的內容在「產品管理 › 模組管理」編輯，改一次所有用到它的商品一起更新；選完記得按「儲存變更」。
        {language !== 'zh-TW' && ` 這是${langShort(language)}版商品：前台會顯示每個模組的${langShort(language)}版本。`}
      </p>
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {missing.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            以下模組還不能在這個語言使用，前台那一段不會顯示，商品也不能上架：
            {missing.map((m) => `「${m.label}」${m.note}`).join('、')}。
          </div>
        </div>
      )}
      <div className="divide-y divide-border rounded-lg border border-border">
        {PRODUCT_SLOTS.map(({ slot, type, label }) => {
          const options = (groups ?? []).filter((g) => g.type === type);
          const current = options.find((g) => g.module_key === refs[slot]);
          return (
            <div key={slot} className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[9rem_1fr_auto] sm:items-center">
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-[11px] text-muted-foreground">{moduleTypeInfo(type)?.where.replace(/^商品頁：/, '')}</p>
              </div>
              <select
                className={fieldCls}
                value={refs[slot] ?? ''}
                disabled={!groups}
                onChange={(e) => setRefs({ ...refs, [slot]: e.target.value })}
              >
                <option value="">不顯示</option>
                {options.map((g) => {
                  const a = moduleAvailability(g, language);
                  return <option key={g.module_key} value={g.module_key}>{g.name}{a.note ? `（${a.note}）` : ''}</option>;
                })}
                {refs[slot] && !current && groups && <option value={refs[slot]}>（已刪除的模組）</option>}
              </select>
              {current ? (
                <Link href={`/admin/page-modules?key=${encodeURIComponent(current.module_key)}&lang=${language}`}
                  className="inline-flex items-center gap-1 text-xs text-admin-accent-600 hover:underline">
                  編輯模組 <ExternalLink className="h-3 w-3" />
                </Link>
              ) : <span />}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        目錄頁（/report）的文字、送禮對象與常見問題在「模組管理」的「報告目錄頁」設定，所有報告共用。
      </p>
    </>
  );
}

export const reportModulesTab: ProductAttributeTab = {
  key: 'report-modules',
  label: '頁面模組',
  Component: ReportModulesTab,
  appliesTo: (id) => !!reportFor(id),
};
