"""
宮位天干計算 — 五虎遁（本專案唯一正典實作）

口訣（五虎遁年起月訣，套用於寅宮起遁）：
    甲己之年丙作首、乙庚之歲戊為頭、
    丙辛必定尋庚起、丁壬壬位順行流、戊癸甲寅好追求。

規則：
    依生年天干定寅宮天干，順行排至丑宮；亥宮之後子、丑兩宮
    依六十甲子續排（如甲年：…乙亥、丙子、丁丑）。
    宮干為本命盤固定屬性，大限、流年疊宮時不變。

⚠ 禁止在任何下游（p_d_graph convert 層、p_e_artist、vendored 引擎）
  複製第二份五虎遁表；一律 import 本模組。
  對應測試：tests/test_palace_gz.py（10 年干 × 12 宮全數斷言）。
"""

def calculate_palace_gz(year_gz):
    heavenly_stems = "甲乙丙丁戊己庚辛壬癸"
    earthly_branches = "寅卯辰巳午未申酉戌亥子丑"

    gz_table = {
        "甲": "丙丁戊己庚辛壬癸甲乙丙丁",
        "己": "丙丁戊己庚辛壬癸甲乙丙丁",
        "乙": "戊己庚辛壬癸甲乙丙丁戊己",
        "庚": "戊己庚辛壬癸甲乙丙丁戊己",
        "丙": "庚辛壬癸甲乙丙丁戊己庚辛",
        "辛": "庚辛壬癸甲乙丙丁戊己庚辛",
        "丁": "壬癸甲乙丙丁戊己庚辛壬癸",
        "壬": "壬癸甲乙丙丁戊己庚辛壬癸",
        "戊": "甲乙丙丁戊己庚辛壬癸甲乙",
        "癸": "甲乙丙丁戊己庚辛壬癸甲乙"
    }
    
    year_stem = year_gz[0]
    palace_gz = {}
    
    for i, branch in enumerate(earthly_branches):
        stem = gz_table[year_stem][i]
        palace_gz[branch] = f"{stem}{branch}"
    
    return palace_gz

def format_palace_gz(palace_gz, twelve_palaces):
    palace_names = ["命宮", "兄弟", "夫妻", "子女", "財帛", "疾厄", "遷移", "奴僕", "官祿", "田宅", "福德", "父母"]
    return ", ".join([f"{name}：{palace_gz[palace]}" for name, palace in zip(palace_names, twelve_palaces.values())])

def get_palace_gz(year_gz, twelve_palaces):
    # 无论twelve_palaces是否为空，都直接返回所有地支的干支对应表
    return calculate_palace_gz(year_gz)  # 直接返回所有地支的干支
