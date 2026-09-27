/**
 * 與 Python `round(x, nd)` / `f"{x:.{nd}f}"` 逐位一致的十進位捨入。
 *
 * Python 對 float 的捨入是「先取二進位值的精確十進位展開，再對展開做 round-half-even」。
 * JS 的 toFixed 是 half-up、Math.round 走乘法會引入誤差。這裡用 toFixed(30) 取得
 * 精確展開後自行做 half-even，結果與 Python 位元相同（星場視圖每個數字都經此輸出）。
 */

function exactDecimal(x: number): { neg: boolean; int: string; frac: string } {
  // toFixed 最多 100 位；double 的精確展開最多約 1074 位小數，但 4 位捨入只需知道
  // 第 nd+1 位起是否全零／是否恰為 5 後全零；30 位對本引擎的量級（≤1e-2 精度）足夠，
  // 且 toFixed 本身給的是精確截斷值（非四捨五入）之外的正確位數。
  const s = Math.abs(x).toFixed(30);
  const [int, frac] = s.split(".");
  return { neg: x < 0, int, frac };
}

/** 回傳字串形式的 half-even 捨入（不含尾零處理） */
export function pyFixed(x: number, nd: number): string {
  if (!Number.isFinite(x)) return String(x);
  const { neg, int, frac } = exactDecimal(x);
  const keep = frac.slice(0, nd);
  const rest = frac.slice(nd);
  let digits = (int + keep).split("").map(Number);
  const first = rest.charCodeAt(0) - 48;
  const tail = rest.slice(1);
  let roundUp = false;
  if (first > 5) roundUp = true;
  else if (first === 5) {
    if (/[1-9]/.test(tail)) roundUp = true;
    else roundUp = (digits[digits.length - 1] ?? 0) % 2 === 1; // 恰為一半：取偶
  }
  if (roundUp) {
    let i = digits.length - 1;
    while (i >= 0) {
      if (digits[i] === 9) { digits[i] = 0; i--; } else { digits[i]++; break; }
    }
    if (i < 0) digits = [1, ...digits];
  }
  const all = digits.join("");
  const ip = nd ? all.slice(0, all.length - nd) : all;
  const fp = nd ? all.slice(all.length - nd) : "";
  const body = nd ? `${ip || "0"}.${fp}` : ip || "0";
  const isZero = /^[0.]*$/.test(body);
  return (neg && !isZero ? "-" : "") + body;
}

/** Python round(x, nd) 的對應物（回數字） */
export function pyRound(x: number, nd = 4): number {
  return Number(pyFixed(x, nd));
}

/** star_energy._disp：f"{v:.{nd}f}" 去尾零去尾點，空則 "0" */
export function pyDisp(v: number, nd = 2): string {
  const s = pyFixed(v, nd).replace(/0+$/, "").replace(/\.$/, "");
  return s || "0";
}
