'use client';

/**
 * 客製報告的「實體書設定」：後台只在數位版商品裡以一個分頁出現（實體書不是另一本書）。
 *
 * 設定存在數位版的 attributes.report_addon；結帳金額一律由後端依這份設定計算
 * （backend/extensions/report_orders/physical.py，docs/report-physical-addon-plan.md 第 10 節）：
 *   實體書＝第一本（含規格加減價）＋第二本起×(數量−1)＋特殊客製（一張訂單收一次）＋跨頁數×跨頁價
 *   專人解讀＝次數×單價（任何報告都能加購）
 *
 * 後端的 natal-report-physical 那一筆商品仍保留（訂單項目指向它），但不在產品清單露出。
 * 數位版儲存成功後，syncReportAddon 會把它的啟用狀態設成「是否開放實體書」，
 * 顯示售價（含台幣價格那一列）設成「數位版售價＋第一本價格」。
 */
import { useEffect, useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import Input from '@ows/ui/ui/Input';
import { getCurrencySymbol } from '@ows/ui/lib/currency';
import MediaBrowser from '@ows/admin-app/components/MediaBrowser';
import { productApi, type ProductAttributesSectionProps } from '@ows/commerce';
import { getImageUrl } from '@/lib/utils';
import { REPORT_PRODUCTS, variantInfo } from '@/lib/report/catalog';

export const REPORT_ADDON_KEY = 'report_addon';

type CustomKey = 'custom_cover' | 'text_unlock' | 'image_insert';
interface Spec { key: string; label: string; price_delta: number }
interface CoverStyle { key: string; label: string; image?: string }
interface CustomOption { label: string; note: string; price: number; enabled: boolean }

export interface ReportAddonAttributes {
  physical_enabled: boolean;
  first_copy_price: number;
  extra_copy_price: number;
  specs: Spec[];
  cover_styles: CoverStyle[];
  custom_options: Record<CustomKey, CustomOption>;
  spreads: { label: string; price: number; max: number; enabled: boolean };
  consult: { label: string; minutes: number; price: number; max_sessions: number; enabled: boolean };
}

const CUSTOM_KEYS: CustomKey[] = ['custom_cover', 'text_unlock', 'image_insert'];

/** 第一次打開時的預設值（2026-10-10 定案的價格），按儲存才生效 */
const DEFAULTS: Omit<ReportAddonAttributes, 'physical_enabled'> = {
  first_copy_price: 1200,
  extra_copy_price: 600,
  specs: [
    { key: 'softcover', label: '平裝', price_delta: -300 },
    { key: 'hardcover-coated', label: '精裝（銅西卡紙質）', price_delta: 0 },
    { key: 'hardcover-thin', label: '精裝（薄紙版）', price_delta: 0 },
  ],
  cover_styles: [
    { key: 'style-1', label: '封面款式一', image: '' },
    { key: 'style-2', label: '封面款式二', image: '' },
  ],
  custom_options: {
    custom_cover: { label: '客製封面', note: '需自行提供封面圖片；如需另外設計封面，費用另計。', price: 300, enabled: true },
    text_unlock: { label: '解鎖內容文字修改', note: '可以要求改寫報告裡的文字。', price: 500, enabled: true },
    image_insert: { label: '修改及置入指定圖片', note: '把書裡的圖片換成你指定的圖片。', price: 500, enabled: true },
  },
  spreads: { label: '加入自己的指定頁面', price: 300, max: 10, enabled: true },
  consult: { label: '專人解讀', minutes: 30, price: 1500, max_sessions: 4, enabled: true },
};

const DIGITAL_ID = variantInfo('digital').productId;
const PHYSICAL_ID = variantInfo('physical').productId;

/** 數位版商品才有這個分頁 */
export const isAddonOwner = (productId: string) => productId === DIGITAL_ID;

/** 產品清單裡要藏起來的加購品 */
export const REPORT_ADDON_HIDDEN_IDS = [PHYSICAL_ID];

/** 同一個產品 ID 的某個語言版本（每個語言一筆商品） */
async function findProduct(productId: string, language: string) {
  const res = await productApi.adminGetList({ search: productId, per_page: 50 });
  return res.products.find((p) => p.product_id === productId && (p.language || 'zh-TW') === language) ?? null;
}

/** 結帳實際用的價格：有該幣別的「其他幣別價格」那一列就用它，否則用基本售價 */
async function effectivePrice(product: { id: number; price: number }, currency: string) {
  const { prices } = await productApi.adminGetPrices(product.id);
  const row = prices.find((p) => p.currency === currency && p.is_active);
  return { price: row ? row.price : product.price, currencyRow: prices.find((p) => p.currency === currency) ?? null };
}

const newKey = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const toInt = (v: string, allowNegative = false) => {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return 0;
  return allowNegative ? n : Math.max(0, n);
};

const labelCls = 'block text-sm font-medium text-foreground mb-2';
const hintCls = 'mt-1.5 text-xs text-muted-foreground';
const iconBtn = 'inline-flex h-10 w-10 md:h-8 md:w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30';
const addBtn = 'inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground';

function Group({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className={hintCls}>{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" className="mt-0.5 h-5 w-5 md:h-4 md:w-4" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

const isNewSchema = (v: unknown): v is ReportAddonAttributes =>
  !!v && typeof v === 'object' && 'first_copy_price' in (v as Record<string, unknown>);

export function ReportAddonTab({ attributes, onChange, price = 0, language = 'zh-TW', currency = 'TWD' }: ProductAttributesSectionProps) {
  const symbol = getCurrencySymbol(currency);
  const signed = (n: number) => (n < 0 ? `−${symbol}${(-n).toLocaleString('zh-TW')}` : `${symbol}${n.toLocaleString('zh-TW')}`);
  const saved = attributes[REPORT_ADDON_KEY];
  const ready = isNewSchema(saved);
  const [loading, setLoading] = useState(!ready);
  const [error, setError] = useState('');
  const [browsingStyle, setBrowsingStyle] = useState<number | null>(null);

  // 第一次打開（或舊版設定）：帶入定案的預設值，啟用狀態沿用現有的實體書商品
  useEffect(() => {
    if (ready) return;
    let alive = true;
    findProduct(PHYSICAL_ID, language)
      .then((physical) => {
        if (!alive) return;
        onChange({ ...attributes, [REPORT_ADDON_KEY]: { physical_enabled: !!physical?.is_active, ...DEFAULTS } });
      })
      .catch((e) => alive && setError(e?.message || '讀取實體書設定失敗'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">讀取中…</p>;
  if (error || !isNewSchema(attributes[REPORT_ADDON_KEY])) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error || '讀取實體書設定失敗'}。請重新整理頁面後再試，在設定正確帶入前請不要儲存。
      </p>
    );
  }

  const value = attributes[REPORT_ADDON_KEY] as ReportAddonAttributes;
  const set = (patch: Partial<ReportAddonAttributes>) => onChange({ ...attributes, [REPORT_ADDON_KEY]: { ...value, ...patch } });
  const styles = value.cover_styles.length ? value.cover_styles : DEFAULTS.cover_styles;
  const setSpec = (i: number, patch: Partial<Spec>) => set({ specs: value.specs.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const setStyle = (i: number, patch: Partial<CoverStyle>) => set({ cover_styles: styles.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const setCustom = (k: CustomKey, patch: Partial<CustomOption>) =>
    set({ custom_options: { ...value.custom_options, [k]: { ...value.custom_options[k], ...patch } } });
  const move = <T,>(list: T[], i: number, d: -1 | 1) => {
    const next = [...list];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    return next;
  };
  const minDelta = value.specs.length ? Math.min(...value.specs.map((s) => s.price_delta)) : 0;

  return (
    <div className="space-y-6">
      <p className="rounded-lg bg-muted px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        實體書是「{REPORT_PRODUCTS[0]?.name}」的加購選項，不是另一本書；專人解讀可以加購在任何報告上。
        實體書＝第一本（含規格加減價）＋第二本起×(數量−1)＋特殊客製＋跨頁。結帳金額由系統依這裡的設定計算，改完請按下方「儲存」。
      </p>

      <Toggle checked={value.physical_enabled} onChange={(v) => set({ physical_enabled: v })} label="開放實體書"
        hint="關閉時，前台不提供實體書版，也不能事後加購；已成立的實體書訂單不受影響。專人解讀另外設定。" />

      <div className={value.physical_enabled ? 'space-y-6' : 'space-y-6 opacity-50 pointer-events-none'}>
        <Group title="價格（含運費）">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>第一本（NT$）</label>
              <Input type="number" inputMode="numeric" min={0} value={String(value.first_copy_price)}
                onChange={(e) => set({ first_copy_price: toInt(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>第二本起，每本（NT$）</label>
              <Input type="number" inputMode="numeric" min={0} value={String(value.extra_copy_price)}
                onChange={(e) => set({ extra_copy_price: toInt(e.target.value) })} />
            </div>
          </div>
          <p className={hintCls}>
            下單選實體書版：數位版 {symbol}{price.toLocaleString('zh-TW')} ＋ 實體書 {signed(value.first_copy_price + minDelta)} 起。
          </p>
        </Group>

        <Group title="規格（必選一個）" description="加減價只影響第一本，可以填負數（例如平裝 −300）。沒有任何規格時，客人不需要選。">
          <ul className="space-y-2">
            {value.specs.map((s, i) => (
              <li key={s.key} className="flex flex-wrap sm:flex-nowrap items-center gap-2 pb-2 border-b border-border/60 last:border-0 sm:border-0 sm:pb-0">
                <Input className="w-full sm:flex-1" value={s.label} maxLength={60} placeholder="規格名稱，例如：平裝"
                  onChange={(e) => setSpec(i, { label: e.target.value })} aria-label="規格名稱" />
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">加減 NT$</span>
                  <Input type="number" inputMode="numeric" className="w-28" value={String(s.price_delta)}
                    onChange={(e) => setSpec(i, { price_delta: toInt(e.target.value, true) })} aria-label="加減價" />
                </div>
                <div className="flex items-center ml-auto sm:ml-0">
                  <button type="button" className={iconBtn} disabled={i === 0} onClick={() => set({ specs: move(value.specs, i, -1) })} aria-label="上移"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" className={iconBtn} disabled={i === value.specs.length - 1} onClick={() => set({ specs: move(value.specs, i, 1) })} aria-label="下移"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" className={iconBtn} onClick={() => set({ specs: value.specs.filter((_, j) => j !== i) })} aria-label="刪除規格"><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" className={addBtn} onClick={() => set({ specs: [...value.specs, { key: newKey('spec'), label: '', price_delta: 0 }] })}>
            <Plus className="h-4 w-4" /> 新增規格
          </button>
        </Group>

        <Group title="特殊客製（一張訂單收一次）" description="客人在下單頁展開「特殊客製」才會看到。名稱、說明與價格都可以改；取消勾選就不提供。">
          {CUSTOM_KEYS.map((k) => {
            const o = value.custom_options[k];
            return (
              <div key={k} className="space-y-2 border-b border-border/60 pb-4 last:border-0 last:pb-0">
                <Toggle checked={o.enabled} onChange={(v) => setCustom(k, { enabled: v })} label={`提供「${o.label}」`} />
                <div className={`grid grid-cols-1 sm:grid-cols-[1fr_8rem] gap-2 ${o.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
                  <Input value={o.label} maxLength={60} onChange={(e) => setCustom(k, { label: e.target.value })} aria-label="名稱" />
                  <Input type="number" inputMode="numeric" min={0} value={String(o.price)} onChange={(e) => setCustom(k, { price: toInt(e.target.value) })} aria-label="價格" />
                  <Input className="sm:col-span-2" value={o.note} maxLength={200} onChange={(e) => setCustom(k, { note: e.target.value })} aria-label="說明" placeholder="給客人看的說明" />
                </div>
              </div>
            );
          })}
          <div className="space-y-2">
            <Toggle checked={value.spreads.enabled} onChange={(v) => set({ spreads: { ...value.spreads, enabled: v } })} label={`提供「${value.spreads.label}」`} />
            <div className={`grid grid-cols-1 sm:grid-cols-3 gap-2 ${value.spreads.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
              <Input value={value.spreads.label} maxLength={60} onChange={(e) => set({ spreads: { ...value.spreads, label: e.target.value } })} aria-label="名稱" />
              <label className="text-xs text-muted-foreground">每個跨頁 NT$
                <Input type="number" inputMode="numeric" min={0} value={String(value.spreads.price)} onChange={(e) => set({ spreads: { ...value.spreads, price: toInt(e.target.value) } })} />
              </label>
              <label className="text-xs text-muted-foreground">每本最多幾個跨頁
                <Input type="number" inputMode="numeric" min={0} value={String(value.spreads.max)} onChange={(e) => set({ spreads: { ...value.spreads, max: toInt(e.target.value) } })} />
              </label>
            </div>
          </div>
        </Group>

        <Group title="封面款式" description="客人設計時選一種（買了「客製封面」的人改用自己的圖片）。可以上傳示意圖。">
          <ul className="space-y-3">
            {styles.map((s, i) => (
              <li key={s.key} className="flex flex-wrap sm:flex-nowrap items-center gap-3 pb-3 border-b border-border/60 last:border-0">
                <button type="button" onClick={() => setBrowsingStyle(i)}
                  className="h-20 w-16 flex-shrink-0 overflow-hidden rounded-md border border-border bg-muted text-[11px] text-muted-foreground">
                  {s.image
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={getImageUrl(s.image, 'small')} alt={s.label} className="h-full w-full object-cover" />
                    : '選擇示意圖'}
                </button>
                <Input className="flex-1 min-w-[10rem]" value={s.label} maxLength={60} placeholder="款式名稱"
                  onChange={(e) => setStyle(i, { label: e.target.value })} aria-label="款式名稱" />
                <div className="flex items-center ml-auto sm:ml-0">
                  {s.image && <button type="button" className="px-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setStyle(i, { image: '' })}>移除圖</button>}
                  <button type="button" className={iconBtn} disabled={i === 0} onClick={() => set({ cover_styles: move(styles, i, -1) })} aria-label="上移"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" className={iconBtn} disabled={i === styles.length - 1} onClick={() => set({ cover_styles: move(styles, i, 1) })} aria-label="下移"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" className={iconBtn} disabled={styles.length <= 1} onClick={() => set({ cover_styles: styles.filter((_, j) => j !== i) })} aria-label="刪除款式"><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" className={addBtn} onClick={() => set({ cover_styles: [...styles, { key: newKey('style'), label: '', image: '' }] })}>
            <Plus className="h-4 w-4" /> 新增封面款式
          </button>
        </Group>
      </div>

      <Group title="專人解讀" description="任何報告訂單都能加購（含只買數位版），也可以單獨加購。取消與退款由你在後台「專人解讀」代為處理，前台不顯示取消規則。">
        <Toggle checked={value.consult.enabled} onChange={(v) => set({ consult: { ...value.consult, enabled: v } })} label="提供專人解讀" />
        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 ${value.consult.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
          <label className="col-span-2 text-xs text-muted-foreground">名稱
            <Input value={value.consult.label} maxLength={60} onChange={(e) => set({ consult: { ...value.consult, label: e.target.value } })} />
          </label>
          <label className="text-xs text-muted-foreground">每次分鐘
            <Input type="number" inputMode="numeric" min={1} value={String(value.consult.minutes)} onChange={(e) => set({ consult: { ...value.consult, minutes: toInt(e.target.value) } })} />
          </label>
          <label className="text-xs text-muted-foreground">每次 NT$
            <Input type="number" inputMode="numeric" min={0} value={String(value.consult.price)} onChange={(e) => set({ consult: { ...value.consult, price: toInt(e.target.value) } })} />
          </label>
          <label className="text-xs text-muted-foreground">一次最多買幾次
            <Input type="number" inputMode="numeric" min={1} value={String(value.consult.max_sessions)} onChange={(e) => set({ consult: { ...value.consult, max_sessions: toInt(e.target.value) } })} />
          </label>
        </div>
      </Group>

      <MediaBrowser
        isOpen={browsingStyle !== null}
        onClose={() => setBrowsingStyle(null)}
        onSelect={(media: any) => {
          if (browsingStyle !== null) setStyle(browsingStyle, { image: media.file_path });
          setBrowsingStyle(null);
        }}
      />
    </div>
  );
}

/** 數位版儲存成功後，把實體書設定同步到實體書那筆商品（ProductsAdmin 的 onAfterSave） */
export async function syncReportAddon(saved: {
  productId: string; price: number; attributes: Record<string, any>; language: string; currency: string;
}) {
  if (!isAddonOwner(saved.productId)) return;
  const addon = saved.attributes[REPORT_ADDON_KEY];
  if (!isNewSchema(addon)) return; // 還沒打開過實體書設定分頁：維持原狀

  // 每個語言版本各有一筆實體書商品，跟著該語言數位版的售價與幣別
  const { language, currency } = saved;
  const digital = await findProduct(DIGITAL_ID, language);
  const base = digital ? (await effectivePrice(digital, currency)).price : saved.price;
  const total = base + addon.first_copy_price;

  const physical = await findProduct(PHYSICAL_ID, language);
  if (physical) {
    await productApi.adminUpdate(physical.id, { price: total, is_active: addon.physical_enabled, currency });
    const { currencyRow } = await effectivePrice(physical, currency);
    if (currencyRow && currencyRow.price !== total) await productApi.adminUpdatePrice(physical.id, currencyRow.id, { price: total });
  } else if (addon.physical_enabled) {
    const name = `${digital?.names?.[language] || REPORT_PRODUCTS[0]?.name || '客製報告'}（實體書）`;
    await productApi.adminCreate({
      product_id: PHYSICAL_ID,
      language,
      currency,
      names: { [language]: name },
      descriptions: { [language]: '' },
      short_descriptions: { [language]: '' },
      price: total,
      stock_quantity: -1,
      stock_status: 'in_stock',
      is_active: true,
      is_featured: false,
      sort_order: 0,
    } as any);
  }
}
