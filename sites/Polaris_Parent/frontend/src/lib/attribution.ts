/**
 * 訂單來源歸因（官網）。
 *
 * 客人進站時記下「從哪裡來」，下單時隨建單 payload 一起送（`attribution: {first, last}`），
 * 後端寫進 shop.order_attributions，只有後台訂單詳細看得到。
 *
 * - 只存在瀏覽器 localStorage（key `ows_attr_v1`），不含任何個資：只有 UTM、referrer 的 host、落地頁 pathname。
 * - 來源判定：網址有 utm_* 就用 UTM；沒有就看 document.referrer 的 host（站外才算）；都沒有＝直接進站，不更新。
 * - first：沒有或已過期才寫（30 天）；last：每次有新來源就覆寫（30 天）；直接進站兩者都不動。
 * - landing_path 只存 pathname，不存 query（query 可能帶 email、token 之類的東西）。
 * - storage 不可用（隱私模式、被停用、配額滿）一律靜默略過，不能影響瀏覽與下單（同 lib/report/draft.ts）。
 */

export const ATTRIBUTION_KEY = 'ows_attr_v1';
export const ATTRIBUTION_TTL_DAYS = 30;
const TTL_MS = ATTRIBUTION_TTL_DAYS * 24 * 60 * 60 * 1000;
const UTM_MAX = 100;
const PATH_MAX = 200;

const UTM_FIELDS = ['source', 'medium', 'campaign', 'content', 'term'] as const;

export interface AttributionTouch {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  referrer_host: string | null;
  landing_path: string;
  /** 這次來源被記下的時間（ISO） */
  at: string;
}

export interface StoredAttribution {
  first: AttributionTouch | null;
  first_expires_at: string | null;
  last: AttributionTouch | null;
  last_expires_at: string | null;
}

/** 建單 payload 用：過期的給 null */
export interface OrderAttribution {
  first: AttributionTouch | null;
  last: AttributionTouch | null;
}

/** 進站當下的環境；測試時直接給值，瀏覽器裡由 currentVisit() 從 window 取 */
export interface Visit {
  /** location.search，例如 `?utm_source=ig` */
  search: string;
  /** document.referrer（可能是空字串） */
  referrer: string;
  /** location.pathname */
  pathname: string;
  /** location.hostname：referrer 是自己站內就不算新來源 */
  hostname: string;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const EMPTY: StoredAttribution = { first: null, first_expires_at: null, last: null, last_expires_at: null };

function clip(value: string | null, max: number): string | null {
  const v = (value ?? '').trim();
  return v ? v.slice(0, max) : null;
}

function referrerHost(referrer: string): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

/** 由這次進站判定來源；直接進站或站內跳轉回傳 null（不更新） */
export function touchFromVisit(visit: Visit, now: Date = new Date()): AttributionTouch | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(visit.search);
  } catch {
    params = new URLSearchParams();
  }
  const utm = Object.fromEntries(UTM_FIELDS.map((f) => [f, clip(params.get(`utm_${f}`), UTM_MAX)])) as
    Record<(typeof UTM_FIELDS)[number], string | null>;
  const host = referrerHost(visit.referrer);
  const external = host && host !== visit.hostname.toLowerCase() ? host : null;
  const hasUtm = UTM_FIELDS.some((f) => utm[f] !== null);
  if (!hasUtm && !external) return null;
  return {
    ...utm,
    referrer_host: external,
    landing_path: (visit.pathname.split(/[?#]/)[0] || '/').slice(0, PATH_MAX),
    at: now.toISOString(),
  };
}

function isAlive(expiresAt: string | null, now: Date): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  return Number.isFinite(t) && t > now.getTime();
}

/** 讀出來並把過期的那一側清成 null */
export function readAttribution(storage: StorageLike, now: Date = new Date()): StoredAttribution {
  try {
    const raw = storage.getItem(ATTRIBUTION_KEY);
    if (!raw) return { ...EMPTY };
    const s = JSON.parse(raw) as Partial<StoredAttribution>;
    const firstOk = !!s.first && isAlive(s.first_expires_at ?? null, now);
    const lastOk = !!s.last && isAlive(s.last_expires_at ?? null, now);
    return {
      first: firstOk ? s.first! : null,
      first_expires_at: firstOk ? s.first_expires_at! : null,
      last: lastOk ? s.last! : null,
      last_expires_at: lastOk ? s.last_expires_at! : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

/** 記錄一次進站。回傳寫入後的狀態（storage 壞掉時回傳讀到的狀態，不丟例外） */
export function recordVisit(storage: StorageLike, visit: Visit, now: Date = new Date()): StoredAttribution {
  const state = readAttribution(storage, now);
  const touch = touchFromVisit(visit, now);
  if (!touch) return state;
  const expires = new Date(now.getTime() + TTL_MS).toISOString();
  const next: StoredAttribution = {
    first: state.first ?? touch,
    first_expires_at: state.first ? state.first_expires_at : expires,
    last: touch,
    last_expires_at: expires,
  };
  try {
    storage.setItem(ATTRIBUTION_KEY, JSON.stringify(next));
    return next;
  } catch {
    return state;
  }
}

function browserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** 瀏覽器裡的這次進站 */
export function currentVisit(): Visit | null {
  if (typeof window === 'undefined') return null;
  try {
    return {
      search: window.location.search,
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      pathname: window.location.pathname,
      hostname: window.location.hostname,
    };
  } catch {
    return null;
  }
}

/** AttributionTracker 掛在公開頁 layout，每次整頁載入呼叫一次 */
export function trackVisit(): void {
  try {
    const storage = browserStorage();
    const visit = currentVisit();
    if (storage && visit) recordVisit(storage, visit);
  } catch {
    // 歸因是附加資料，任何錯誤都不能影響瀏覽
  }
}

/** 建單時帶上；沒有 storage 或都過期就是 {first: null, last: null} */
export function attributionForOrder(now: Date = new Date()): OrderAttribution {
  const storage = browserStorage();
  if (!storage) return { first: null, last: null };
  const s = readAttribution(storage, now);
  return { first: s.first, last: s.last };
}
