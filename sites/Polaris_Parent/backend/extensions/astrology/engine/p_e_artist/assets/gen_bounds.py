"""量出每顆星曜圖示的「實際圖形範圍」，寫成 assets/stars/_bounds.json。

    python -m p_e_artist.assets.gen_bounds

為什麼需要：圖示畫框（viewBox 289×288）內部有大量留白，圖形只佔中間一塊，
且每顆星佔的範圍不同。版面若以畫框為準，四化徽章會離星曜很遠。writer 讀這份
對照表，就能把徽章貼著「圖形」下緣放。

換圖示後要重跑一次（需安裝 Inkscape；找不到對照表時 writer 退回以畫框為準）。
值為相對畫框的比例：{code: {"l","t","r","b"}}，0–1。
"""

import glob
import json
import os
import re
import shutil
import subprocess

_STARS = os.path.join(os.path.dirname(__file__), "stars")
_OUT = os.path.join(_STARS, "_bounds.json")
_INKSCAPE_FALLBACKS = (
    r"C:\Program Files\Inkscape\bin\inkscape.exe",
    "/Applications/Inkscape.app/Contents/MacOS/inkscape",
)


def _inkscape() -> str:
    exe = shutil.which("inkscape") or next(
        (p for p in _INKSCAPE_FALLBACKS if os.path.exists(p)), None)
    if not exe:
        raise SystemExit("找不到 Inkscape，無法量測圖形範圍。")
    return exe


def main():
    exe = _inkscape()
    bounds = {}
    for path in sorted(glob.glob(os.path.join(_STARS, "*.svg"))):
        code = os.path.splitext(os.path.basename(path))[0]
        with open(path, encoding="utf-8-sig") as f:
            vb = re.search(r'viewBox="([^"]+)"', f.read())
        _, _, vw, vh = (float(v) for v in vb.group(1).split())
        # --query-all 第一列＝根節點的視覺外框（含描邊）：id,x,y,w,h
        out = subprocess.run([exe, "--query-all", path], capture_output=True).stdout
        x, y, w, h = (float(v) for v in
                      out.decode("utf-8", "replace").splitlines()[0].split(",")[1:5])
        bounds[code] = {
            "l": round(x / vw, 4), "t": round(y / vh, 4),
            "r": round((x + w) / vw, 4), "b": round((y + h) / vh, 4),
        }
        print(f"{code:4s} {bounds[code]}")
    with open(_OUT, "w", encoding="utf-8") as f:
        json.dump(bounds, f, ensure_ascii=False, indent=1, sort_keys=True)
    print(f"\n寫入 {_OUT}（{len(bounds)} 顆）")


if __name__ == "__main__":
    main()
