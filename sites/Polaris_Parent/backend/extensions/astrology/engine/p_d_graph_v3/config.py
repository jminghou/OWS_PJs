"""
v3 配置 — 星場取樣架構
Star-Field Sampling Architecture Configuration

規格書：Duc/V3-260711-v1_星場取樣架構規格書.md

五條鐵則：
  1. 測量與解讀分離
  2. 同類等值（基值恆為 1.0）
  3. 強度與性質分離（四化=通道，不是倍率）
  4. 狀態才佔維度（宮位讀數=具現化視圖，不進向量）
  5. 先鞏固再擴維（小星/流曜=選用層，開關不改變維度數）
"""

import csv
import json
import os
from dataclasses import dataclass, field

V3_ROOT = os.path.dirname(__file__)
V3_DATA_DIR = os.path.join(V3_ROOT, "data")

VECTOR_VERSION = "3.6"     # 2026-07-18 輔星整併：22E＋64通道=86 維（四煞合一＋全維改名去「勢」）
ENGINE_VERSION = "3.8.0"   # 寫入 graph_analysis.engine_version（與 vector_version 分開演進）
                           # 3.3.0 = 2026-07-14 取樣類別權重；3.4.0 = 同日四化場
                           # （S化欄＋忌欠k退役；讀數語意變更、向量形狀不變故 vv 曾留 3.2）
                           # 3.5.0 = 2026-07-15 運限層接線（運限四化 T-token layer 疊加 ＋ 8 運限流曜維，vv→3.3）
                           # 3.6.0 = 2026-07-16 流曜合流（8 flow 維退役、併入本命同源維；同組疊加＝突波偵測，vv→3.4）
                           # 3.7.0 = 2026-07-16 二修（鸞喜八星共用一維，vv→3.5）
                           # 3.8.0 = 2026-07-18 輔星整併（「勢」退場：輔佐→左右/提攜→魁鉞/表述→昌曲/
                           #         儲備→祿存/機動→天馬/消散→空劫/桃花勢→桃花；
                           #         銳進+迂迴+爆發+城府四維合併為「煞星」共用維；統稱＝輔星、
                           #         讀數欄 S勢→S輔；89→86 維，vv→3.6）

# 四化通道順序（維度排列與 facts 的固定順序）
SIHUA_CODES = ["FO", "PW", "HO", "BI"]

# 宮位環序（與 v2 一致：1 命 → C 父母）；lens 取樣與空劫三方四正皆以此環計偏移
PALACE_CODES = ["1", "2", "3", "4", "5", "6",
                "7", "8", "9", "A", "B", "C"]


# =====================================================================
# 維度定義（唯一真源：dimension_definitions_v3.csv）
# =====================================================================

@dataclass
class V3DimDef:
    """單一維度定義"""
    index: int
    name: str
    name_zh: str
    kind: str            # major | pair | solo | void | channel
    stars: list          # 個別星曜代碼列表（對星維含兩顆）
    can_sihua: bool
    description: str = ""


class V3Registry:
    """
    v3 維度註冊表。

    用法:
        reg = V3Registry()                 # 預設資料目錄
        reg.total_dims                     # 86（22 E ＋ 64 通道；流曜與本命同源星共用維）
        reg.get("major_pol")               # → 0
        reg.star_to_dim["POL"]             # → 0（星曜 → E 維索引；含空劫維）
        reg.channel_index[(0, "BI")]       # → 排序力·化忌 的通道維索引
    """

    def __init__(self, data_dir: str = None):
        self._data_dir = data_dir or V3_DATA_DIR
        self.dims: list = []            # [V3DimDef]（按 index 排序）
        self.by_name: dict = {}         # name → V3DimDef
        self.star_to_dim: dict = {}     # 個別星碼 → E 維 index
        self.channel_index: dict = {}   # (E維index, sihua碼) → 通道維 index
        self.e_dims: list = []          # E 維（kind != channel）
        self._load()

    def _load(self):
        path = os.path.join(self._data_dir, "dimension_definitions_v3.csv")
        with open(path, "r", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                d = V3DimDef(
                    index=int(row["dim"]),
                    name=row["name"].strip(),
                    name_zh=row["name_zh"].strip(),
                    kind=row["kind"].strip(),
                    stars=[s for s in row["stars"].split("|") if s],
                    can_sihua=row["can_sihua"].strip() == "1",
                    description=row.get("description", "").strip(),
                )
                self.dims.append(d)
                self.by_name[d.name] = d

        self.dims.sort(key=lambda d: d.index)

        for d in self.dims:
            if d.kind == "channel":
                # 通道維名稱格式: {E維name}_{fo|pw|ho|bi}
                base_name, sihua = d.name.rsplit("_", 1)
                base = self.by_name.get(base_name)
                if base is not None:
                    self.channel_index[(base.index, sihua.upper())] = d.index
            else:
                self.e_dims.append(d)
                for star in d.stars:
                    self.star_to_dim[star] = d.index

    @property
    def total_dims(self) -> int:
        return len(self.dims)

    def get(self, name: str) -> int:
        d = self.by_name.get(name)
        if d is None:
            raise ValueError(f"v3 維度名稱 '{name}' 不存在！")
        return d.index


# =====================================================================
# 係數與取樣窗（唯一真源：coefficients.json / sampling_window.json）
# =====================================================================

def load_coefficients(data_dir: str = None) -> dict:
    """載入 k 係數檔（sihua_k / chong_k / void_k / void_stars…）"""
    path = os.path.join(data_dir or V3_DATA_DIR, "coefficients.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_sampling_window(data_dir: str = None) -> dict:
    """載入取樣窗 w 表（weights / offsets / priority）"""
    path = os.path.join(data_dir or V3_DATA_DIR, "sampling_window.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_influence_matrix(data_dir: str = None) -> dict:
    """
    載入輔助星影響矩陣 M。

    Returns:
        {aux_star_code: {major_star_code: coeff}}
    """
    path = os.path.join(data_dir or V3_DATA_DIR, "influence_matrix.csv")
    matrix = {}
    with open(path, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            aux = row.pop("aux_star").strip()
            matrix[aux] = {k: float(v) for k, v in row.items()}
    return matrix


# =====================================================================
# 視圖層：人格投影（規格書 §14）——純衍生，不進向量、不落 DB
# =====================================================================

@dataclass
class FacetDef:
    """單一 facet 定義（一個 facet ＝ 若干天格屬性維的線性組合）"""
    name: str
    name_zh: str
    axis: str                          # EI / NS / TF / JP
    pole: str                          # E/I、N/S、T/F、J/P
    coeffs: dict = field(default_factory=dict)   # {dim_name: coeff}


def load_view_config(data_dir: str = None) -> dict:
    """載入視圖層調參檯面（observers／kind_view_weights／sihua_view_polarity…）。"""
    path = os.path.join(data_dir or V3_DATA_DIR, "view_config.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_facet_definitions(data_dir: str = None) -> list:
    """
    載入 facet 係數表（唯一真源：facet_definitions_v3.csv）。

    Returns:
        [FacetDef]（依檔案首見順序）
    """
    path = os.path.join(data_dir or V3_DATA_DIR, "facet_definitions_v3.csv")
    facets: dict = {}
    order: list = []
    with open(path, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            name = row["facet"].strip()
            if name not in facets:
                facets[name] = FacetDef(
                    name=name,
                    name_zh=row["facet_zh"].strip(),
                    axis=row["axis"].strip(),
                    pole=row["pole"].strip(),
                )
                order.append(name)
            facets[name].coeffs[row["dim_name"].strip()] = float(row["coeff"])
    return [facets[n] for n in order]


#: E 出廠層的係數檔——兩個視圖層共用
#: （dark_harmony_pairs.json 已隨暗合移除退出清單，2026-07-18）
BASE_TUNING_FILES = (
    "dimension_definitions_v3.csv",
    "coefficients.json",
    "sampling_window.json",
    "influence_matrix.csv",
)

#: 決定 facet 分數的所有資料檔——任一改動都會讓 facet 母體百分位過期
TUNING_FILES = BASE_TUNING_FILES + (
    "view_config.json",
    "facet_definitions_v3.csv",
    "facet_sihua_exceptions.csv",
)

#: 決定氣質分數的所有資料檔（規格書 §15.5）
#: ⚠️ 與 TUNING_FILES 分家是刻意的：加氣質層不該讓 facet_population 過期。
#: view_config 共用（類權_view 與四化極性＝視圖層的共同語意），
#: 但氣質層的觀測點在 temperament_config.json（命宮＋疾厄，與人格層不同）。
TEMPERAMENT_TUNING_FILES = BASE_TUNING_FILES + (
    "view_config.json",
    "temperament_config.json",
    "temperament_map.csv",
)


def _fingerprint(files, data_dir: str = None) -> str:
    import hashlib
    d = data_dir or V3_DATA_DIR
    h = hashlib.sha256()
    for fn in files:
        path = os.path.join(d, fn)
        h.update(fn.encode("utf-8"))
        if os.path.exists(path):
            with open(path, "rb") as f:
                h.update(f.read())
    return h.hexdigest()[:16]


def tuning_fingerprint(data_dir: str = None) -> str:
    """
    調參指紋：所有影響 facet 分數的資料檔內容雜湊（前 16 碼）。

    母體基準檔存下產生當時的指紋；投影時比對，不符即代表「調參已變動、
    百分位已過期」——報告要明講，不能靜默給出錯的定位。
    """
    return _fingerprint(TUNING_FILES, data_dir)


def temperament_fingerprint(data_dir: str = None) -> str:
    """氣質層的調參指紋（守 temperament_population.json）。"""
    return _fingerprint(TEMPERAMENT_TUNING_FILES, data_dir)


def load_facet_population(data_dir: str = None) -> dict:
    """
    載入 facet 母體基準（百分位切點）。檔案不存在則回 {}（報告會標示「無母體」）。

    重建：python -m p_d_graph_v3.tools.build_facet_population --limit 1000
    """
    path = os.path.join(data_dir or V3_DATA_DIR, "facet_population.json")
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_facet_sihua_exceptions(data_dir: str = None) -> dict:
    """
    載入四化例外清單（覆寫全域極性；檔案可只有表頭）。

    Returns:
        {(star, sihua, facet): pol}
    """
    path = os.path.join(data_dir or V3_DATA_DIR, "facet_sihua_exceptions.csv")
    if not os.path.exists(path):
        return {}
    out = {}
    with open(path, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            star = (row.get("star") or "").strip()
            sihua = (row.get("sihua") or "").strip().upper()
            facet = (row.get("facet") or "").strip()
            if not (star and sihua and facet):
                continue
            out[(star, sihua, facet)] = float(row["pol"])
    return out


# =====================================================================
# 氣質層（規格書 §15）
# =====================================================================

@dataclass
class TemperamentDef:
    """單一氣質定義（＝ 24 維標準化後的線性組合，係數可正可負）"""
    name: str
    name_zh: str
    high_zh: str                                  # 高分端語意
    low_zh: str                                   # 低分端語意
    coeffs: dict = field(default_factory=dict)    # {dim_name: coeff}


def load_temperament_config(data_dir: str = None) -> dict:
    """載入氣質層調參檯面（觀測點、五級落點門檻、三型判定門檻）。"""
    path = os.path.join(data_dir or V3_DATA_DIR, "temperament_config.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_temperament_map(data_dir: str = None) -> list:
    """
    載入氣質係數表（唯一真源：temperament_map.csv）。

    Returns:
        [TemperamentDef]（依檔案首見順序）
    """
    path = os.path.join(data_dir or V3_DATA_DIR, "temperament_map.csv")
    temps: dict = {}
    order: list = []
    with open(path, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            name = row["temperament"].strip()
            if name not in temps:
                temps[name] = TemperamentDef(
                    name=name,
                    name_zh=row["temperament_zh"].strip(),
                    high_zh=row.get("high_zh", "").strip(),
                    low_zh=row.get("low_zh", "").strip(),
                )
                order.append(name)
            temps[name].coeffs[row["dim_name"].strip()] = float(row["coeff"])
    return [temps[n] for n in order]


def load_temperament_population(data_dir: str = None) -> dict:
    """
    載入氣質母體基準（每維 μ/σ ＋ 九氣質百分位切點 ＋ 三門檻診斷）。
    檔案不存在則回 {}（報告會標示「無母體」）。

    重建：python -m p_d_graph_v3.tools.build_temperament_population --limit 1200
    """
    path = os.path.join(data_dir or V3_DATA_DIR, "temperament_population.json")
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
