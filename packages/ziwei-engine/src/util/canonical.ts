/**
 * 與 scripts/gen_ziwei_golden.py 的 canonical_json() / sha256_of() 對應。
 * 鍵排序、無空白、非 ASCII 原樣、整數值的 float 視為整數（JS 本來就如此）。
 */
import { sha256 } from "js-sha256";

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

export function sha256Of(value: unknown): string {
  return sha256(canonicalJson(value));
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    // Python sort_keys 依 Unicode code point 排序；JS 預設 sort 依 UTF-16 code unit，
    // 對 BMP 內字元結果一致。鍵名含 emoji 等增補平面字元時才會有差，本引擎不會出現。
    for (const k of Object.keys(v as Record<string, unknown>).sort(codePointCompare)) {
      out[k] = sortKeys((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return v;
}

function codePointCompare(a: string, b: string): number {
  const ia = a[Symbol.iterator]();
  const ib = b[Symbol.iterator]();
  for (;;) {
    const ra = ia.next();
    const rb = ib.next();
    if (ra.done && rb.done) return 0;
    if (ra.done) return -1;
    if (rb.done) return 1;
    const ca = ra.value.codePointAt(0)!;
    const cb = rb.value.codePointAt(0)!;
    if (ca !== cb) return ca - cb;
  }
}
