"""
生成 14 主星佔位 SVG 圖示
每顆星用不同幾何圖形 + 專屬色彩，方便視覺區分。
執行: python gen_placeholders.py
"""

import os

STARS = [
    # (code, name, shape, color)
    ("POL", "紫微", "circle",   "#7B1FA2"),  # 紫 — 帝王紫
    ("HPI", "天機", "diamond",  "#0288D1"),  # 藍 — 智慧
    ("SUN", "太陽", "circle",   "#E65100"),  # 橙 — 陽光
    ("MAR", "武曲", "square",   "#1565C0"),  # 鋼藍 — 剛毅
    ("HAR", "天同", "circle",   "#2E7D32"),  # 綠 — 和諧
    ("MIN", "天相", "hexagon",  "#00838F"),  # 青 — 輔佐
    ("BLE", "天梁", "shield",   "#4E342E"),  # 棕 — 厚重
    ("MAG", "廉貞", "triangle", "#C62828"),  # 紅 — 烈焰
    ("AWO", "貪狼", "star5",    "#F9A825"),  # 金 — 慾望
    ("GGA", "巨門", "square",   "#37474F"),  # 暗灰 — 口舌
    ("TRE", "天府", "hexagon",  "#1B5E20"),  # 深綠 — 庫藏
    ("MOO", "太陰", "circle",   "#283593"),  # 靛 — 月華
    ("VAN", "七殺", "triangle", "#B71C1C"),  # 深紅 — 將星
    ("BRE", "破軍", "star5",    "#4A148C"),  # 紫黑 — 破壞
]

SIZE = 48
CX, CY = SIZE / 2, SIZE / 2
R = 18

def shape_svg(shape: str, color: str) -> str:
    """回傳幾何圖形的 SVG path/element。"""
    if shape == "circle":
        return f'<circle cx="{CX}" cy="{CY}" r="{R}" fill="{color}" opacity="0.85"/>'

    elif shape == "square":
        s = R * 1.5
        return f'<rect x="{CX - s/2}" y="{CY - s/2}" width="{s}" height="{s}" rx="3" fill="{color}" opacity="0.85"/>'

    elif shape == "diamond":
        pts = f"{CX},{CY - R} {CX + R},{CY} {CX},{CY + R} {CX - R},{CY}"
        return f'<polygon points="{pts}" fill="{color}" opacity="0.85"/>'

    elif shape == "triangle":
        import math
        pts = []
        for i in range(3):
            angle = math.radians(-90 + i * 120)
            pts.append(f"{CX + R * math.cos(angle):.1f},{CY + R * math.sin(angle):.1f}")
        return f'<polygon points="{" ".join(pts)}" fill="{color}" opacity="0.85"/>'

    elif shape == "hexagon":
        import math
        pts = []
        for i in range(6):
            angle = math.radians(-90 + i * 60)
            pts.append(f"{CX + R * math.cos(angle):.1f},{CY + R * math.sin(angle):.1f}")
        return f'<polygon points="{" ".join(pts)}" fill="{color}" opacity="0.85"/>'

    elif shape == "star5":
        import math
        pts = []
        for i in range(10):
            angle = math.radians(-90 + i * 36)
            r = R if i % 2 == 0 else R * 0.45
            pts.append(f"{CX + r * math.cos(angle):.1f},{CY + r * math.sin(angle):.1f}")
        return f'<polygon points="{" ".join(pts)}" fill="{color}" opacity="0.85"/>'

    elif shape == "shield":
        # 盾形
        d = (f"M{CX - R},{CY - R * 0.6} "
             f"L{CX + R},{CY - R * 0.6} "
             f"L{CX + R},{CY + R * 0.2} "
             f"Q{CX + R},{CY + R} {CX},{CY + R} "
             f"Q{CX - R},{CY + R} {CX - R},{CY + R * 0.2} Z")
        return f'<path d="{d}" fill="{color}" opacity="0.85"/>'

    return ""


def gen_icon(code: str, name: str, shape: str, color: str) -> str:
    body = shape_svg(shape, color)
    # 白色文字疊在圖形上
    text = (f'<text x="{CX}" y="{CY + 1}" '
            f'font-size="11" fill="#FFFFFF" text-anchor="middle" '
            f'dominant-baseline="central" '
            f'font-family="Microsoft JhengHei, PingFang TC, sans-serif" '
            f'font-weight="bold">{name}</text>')
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {SIZE} {SIZE}" width="{SIZE}" height="{SIZE}">\n'
        f'  {body}\n'
        f'  {text}\n'
        f'</svg>\n'
    )


def main():
    out_dir = os.path.join(os.path.dirname(__file__), "stars")
    os.makedirs(out_dir, exist_ok=True)
    for code, name, shape, color in STARS:
        svg = gen_icon(code, name, shape, color)
        path = os.path.join(out_dir, f"{code}.svg")
        with open(path, "w", encoding="utf-8") as f:
            f.write(svg)
        print(f"  {code}.svg -> {name} ({shape})")
    print(f"\n已生成 {len(STARS)} 個佔位圖示於 {out_dir}")


if __name__ == "__main__":
    main()
