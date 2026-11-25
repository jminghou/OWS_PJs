"""運限宮位方向。

讀 packages/ziwei-engine/test/fixtures/fortune_direction_test_vectors.json
（上游合成盤，sha256 含 CRLF），核對大限宮位映射與流曜宮位。
`--dump-parity` 把同一份合成輸入的完整運限編碼印成 JSON，給 TS 測試比對。
"""
from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import sys
import types
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VECTORS = ROOT / "packages/ziwei-engine/test/fixtures/fortune_direction_test_vectors.json"
PARITY = ROOT / "packages/ziwei-engine/test/fixtures/fortune_encoding_parity_input.json"
BASIC = ROOT / "sites/Polaris_Parent/backend/extensions/astrology/engine/p01_count/01_basic_count"

PALACE_NAMES = ["命宮", "兄弟", "夫妻", "子女", "財帛", "疾厄", "遷移", "交友", "官祿", "田宅", "福德", "父母"]
PALACE_CODES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C"]
BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]
STEMS = "甲乙丙丁戊己庚辛壬癸"
PALACE_NAME_TO_CODE = dict(zip(PALACE_NAMES, PALACE_CODES))
CODE_TO_NAME = dict(zip(PALACE_CODES, PALACE_NAMES))
# 合成盤用的十二星，只為了讓編碼裡看得到宮位碼被換掉
NATAL_STARS = [
    ("紫微", "POL"), ("天機", "HPI"), ("太陽", "SUN"), ("武曲", "MAR"),
    ("天同", "HAR"), ("廉貞", "MAG"), ("天府", "TRE"), ("太陰", "MOO"),
    ("貪狼", "AWO"), ("巨門", "GGA"), ("天相", "MIN"), ("天梁", "BLE"),
]
FORWARD = ["命宮", "父母", "福德", "田宅", "官祿", "交友", "遷移", "疾厄", "財帛", "子女", "夫妻", "兄弟"]


def load_encoder():
    """載入 encoder_flow，不經過 chart_calculator，也不佔用 p01_count 套件名。"""
    prefix = "_fortune_encoder_loader"
    name = f"{prefix}._01_basic_count.core.encoder_flow"
    cached = sys.modules.get(name)
    if cached is not None:
        return cached

    def ensure_pkg(mod_name: str, path: Path):
        if mod_name in sys.modules:
            return
        module = types.ModuleType(mod_name)
        module.__path__ = [str(path)]  # type: ignore[attr-defined]
        module.__package__ = mod_name
        sys.modules[mod_name] = module

    ensure_pkg(prefix, BASIC.parent)
    ensure_pkg(f"{prefix}._01_basic_count", BASIC)
    ensure_pkg(f"{prefix}._01_basic_count.core", BASIC / "core")
    ensure_pkg(f"{prefix}._01_basic_count.stars", BASIC / "stars")
    spec = importlib.util.spec_from_file_location(name, BASIC / "core" / "encoder_flow.py")
    if spec is None or spec.loader is None:
        raise RuntimeError(f"無法載入 {BASIC / 'core' / 'encoder_flow.py'}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def decade_data_from_vector(vector: dict) -> dict:
    natal = vector["input"]["natal_palace_branches"]
    branch_to_name = {branch: name for name, branch in natal.items()}
    data = {}
    for decade in vector["decades"]:
        name = branch_to_name[decade["decade_ming_branch"]]
        data[name] = {
            "大限順序": str(decade["decade_order"]),
            "宮位": decade["decade_ming_branch"],
        }
    return data


def palace_branches_from_mapping(mapping: dict, natal_branches: dict) -> dict:
    """由「本命宮位碼 → 運限宮位碼」還原運限宮名 → 地支。"""
    got = {}
    for name, branch in natal_branches.items():
        decade_code = mapping[PALACE_NAME_TO_CODE[name]]
        got[CODE_TO_NAME[decade_code]] = branch
    return got


def build_parity_payload() -> dict:
    """合成一張陽男順行盤的運限輸入。沒有生日，歲數與干支只是編號。"""
    ming_index = BRANCHES.index("戌")
    natal_branches = {name: BRANCHES[(ming_index - i) % 12] for i, name in enumerate(PALACE_NAMES)}
    natal = []
    for i, (_star, code) in enumerate(NATAL_STARS):
        branch_index = (ming_index - i) % 12
        natal.append(f"{PALACE_CODES[i]}{code}{branch_index + 1:02d}")
    natal.append("6MAGHO06")
    natal.append("IPOLP3")

    decade = {}
    for name in PALACE_NAMES:
        order = FORWARD.index(name) + 1
        branch = natal_branches[name]
        stem = STEMS[(order - 1) % 10]
        start = 2 + (order - 1) * 10
        end = start + 9
        decade[name] = {
            "大限順序": str(order),
            "大限名稱": f"{stem}{branch}限",
            "大限歲數": f"{start}-{end}",
            "大限西元區間": f"{3000 + start}-{3000 + end}",
            "宮位": branch,
            "年干": stem,
            "地支": branch,
            "大限星曜": {"大羊": "丑", "大馬": branch},
        }

    def layer(kind: str, age_to_index) -> dict:
        buckets = {name: {"ages": [], "lunar": [], "western": [], "sheep": [], "horse": []} for name in PALACE_NAMES}
        for age in range(1, 121):
            name = PALACE_NAMES[age_to_index(age)]
            gz = STEMS[(age - 1) % 10] + BRANCHES[(age - 1) % 12]
            year_branch = BRANCHES[(age - 1) % 12]
            buckets[name]["ages"].append(str(age))
            buckets[name]["lunar"].append(gz)
            buckets[name]["western"].append(str(3000 + age))
            buckets[name]["sheep"].append(year_branch)
            buckets[name]["horse"].append(BRANCHES[(BRANCHES.index(year_branch) + 6) % 12])
        lunar_key = "小限農曆年" if kind == "small" else "流年農曆年"
        western_key = "小限西元年" if kind == "small" else "流年西元年"
        star_key = "小限星曜" if kind == "small" else "流年星曜"
        sheep = "小羊" if kind == "small" else "年羊"
        horse = "小馬" if kind == "small" else "年馬"
        out = {}
        for name in PALACE_NAMES:
            row = buckets[name]
            out[name] = {
                "歲數": ",".join(row["ages"]),
                lunar_key: ",".join(row["lunar"]),
                western_key: ",".join(row["western"]),
                "宮位": natal_branches[name],
                star_key: [{
                    sheep: ",".join(row["sheep"]),
                    horse: ",".join(row["horse"]),
                }],
            }
        return out

    return {
        "note": "合成陽男順行盤，命宮在戌。歲數、干支、西元年都是編號，不是出生資料。",
        "natal_encoded_array": natal,
        "大限資料": decade,
        "小限資料": layer("small", lambda age: (age - 1) % 12),
        "流年資料": layer("year", lambda age: age % 12),
    }


def parity_chart(payload: dict) -> dict:
    return {
        "快速條件編碼": {
            "natal_chart_encoding": [{
                "chart_type": "natal",
                "encoded_array": payload["natal_encoded_array"],
            }],
        },
        "大限資料": payload["大限資料"],
        "小限資料": payload["小限資料"],
        "流年資料": payload["流年資料"],
    }


def run_parity(payload: dict | None = None) -> dict:
    if payload is None:
        payload = json.loads(PARITY.read_text(encoding="utf-8"))
    enc = load_encoder()
    chart = parity_chart(payload)
    with contextlib.redirect_stdout(io.StringIO()):
        return {
            "decade_chart_encoding": enc.calculate_decade_chart_encoding(chart),
            "small_limit_encoding": enc.calculate_small_limit_encoding(chart),
            "year_flow_encoding": enc.calculate_year_flow_encoding(chart),
        }


class FortuneDirectionVectorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = json.loads(VECTORS.read_bytes().decode("utf-8"))
        cls.enc = load_encoder()

    def test_vectors_match_encoder(self):
        vectors = self.doc["vectors"]
        self.assertEqual(len(vectors), 8)
        self.assertEqual(sum(1 for v in vectors if v["input"]["yin_yang"] == "陽"), 4)
        self.assertEqual(sum(1 for v in vectors if v["input"]["yin_yang"] == "陰"), 4)
        self.assertEqual(sum(1 for v in vectors if v["input"]["gender"] == "男"), 8)

        mappings = branches = stars = 0
        for vector in vectors:
            decade_data = decade_data_from_vector(vector)
            natal = vector["input"]["natal_palace_branches"]
            for decade in vector["decades"]:
                label = f"{vector['id']} decade {decade['decade_order']}"
                got = self.enc.build_decade_palace_mapping(decade_data, decade["decade_order"])
                self.assertEqual(got, decade["natal_to_decade_code"], label)
                mappings += 1
                self.assertEqual(palace_branches_from_mapping(got, natal), decade["palace_branches"], label)
                branches += 1
            for start, by_star in vector["flow_star_palace"].items():
                for star, code in by_star.items():
                    got_code = self.enc.calculate_palace_in_decade(star, start)
                    self.assertEqual(got_code, code, f"{vector['id']} {start}->{star}")
                    stars += 1
        self.assertEqual((mappings, branches, stars), (96, 96, 1152))

    def test_negative_branch_offset_matches_python_modulo(self):
        """申(8) 到 亥(11)：(8-11)%12 = 9 → 田宅 A。負數餘數必須是 9 不是 -3。"""
        self.assertEqual(self.enc.calculate_palace_in_decade("亥", "申"), "A")


def main(argv: list[str]) -> int:
    if "--write-parity-fixture" in argv:
        PARITY.write_text(
            json.dumps(build_parity_payload(), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(PARITY)
        return 0
    if "--dump-parity" in argv:
        json.dump(run_parity(), sys.stdout, ensure_ascii=False, separators=(",", ":"))
        sys.stdout.write("\n")
        return 0
    unittest.main(argv=argv)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
