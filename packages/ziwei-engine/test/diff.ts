/** 找出兩個 JSON 值的第一個差異路徑（測試訊息用） */
export function firstDiff(a: any, b: any, path = "$", out: string[] = [], limit = 8): string[] {
  if (out.length >= limit) return out;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) { out.push(`${path}: length ${a.length} vs ${b.length}`); }
    for (let i = 0; i < Math.min(a.length, b.length); i++) firstDiff(a[i], b[i], `${path}[${i}]`, out, limit);
    return out;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a), kb = Object.keys(b);
    for (const k of kb) if (!(k in a)) out.push(`${path}.${k}: missing in got`);
    for (const k of ka) if (!(k in b)) out.push(`${path}.${k}: extra in got`);
    for (const k of ka) if (k in b) firstDiff(a[k], b[k], `${path}.${k}`, out, limit);
    return out;
  }
  if (a !== b && !(Number.isNaN(a) && Number.isNaN(b))) out.push(`${path}: got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`);
  return out;
}
