"""
依 01_basic_count 算法，統計相異本命盤數。

界定（v2）：
  主星：14 顆
  副星：六吉(左右昌曲魁鉞) + 天馬 + 祿存 + 四煞(羊陀火鈴) + 空劫
  四化：生年四化（計入指紋）
  宮位：十二宮地支 + 身宮（不含宮干；五行局僅用於推主星，不寫入宮位指紋）
  雜曜、亮度、性別：不計
"""
from __future__ import annotations

import sys
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]  # P_Union
sys.path.insert(0, str(ROOT))

bc = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(bc.parent))

from importlib.machinery import SourceFileLoader


def _load(name, rel):
    return SourceFileLoader(name, str(bc / rel)).load_module()


ming_shen = _load("ming_shen", "palace/ming_shen.py")
subject = _load("subject", "palace/subject.py")
gz = _load("gz", "palace/gz.py")
bureau_mod = _load("bureau", "palace/bureau.py")
ziwei = _load("ziwei", "stars/ziwei.py")
major = _load("major", "stars/major.py")
moon = _load("moon", "stars/moon.py")
hour_mod = _load("hour", "stars/hour.py")
year_g = _load("year_g", "stars/year_g.py")
fire_ring = _load("fire_ring", "stars/fire_ring.py")
four_trans = _load("four_trans", "stars/four_trans.py")

HOURS = list("子丑寅卯辰巳午未申酉戌亥")
STEMS = list("甲乙丙丁戊己庚辛壬癸")
BRANCHES = list("子丑寅卯辰巳午未申酉戌亥")
JIAZI = [STEMS[i % 10] + BRANCHES[i % 12] for i in range(60)]

# 副星清單（依使用者界定）
AUX_STARS = (
    "左輔", "右弼", "文昌", "文曲", "天魁", "天鉞",  # 六吉
    "天馬", "祿存",
    "擎羊", "陀羅", "火星", "鈴星",  # 四煞
    "地空", "地劫",  # 空劫
)


def fingerprint(year_stem: str, year_branch: str, lunar_month: int, lunar_day: int, hour_branch: str):
    """主星 + 副星 + 四化 + 宮位(無宮干)。"""
    year_gz = year_stem + year_branch
    ming = ming_shen.calculate_ming_palace(lunar_month, hour_branch)
    shen = ming_shen.calculate_shen_palace(lunar_month, hour_branch)
    twelve = subject.calculate_twelve_palaces(ming)
    # 宮干／五行局仍要算（主星依賴局數），但不寫入「宮位」指紋
    palace_gz_map = gz.get_palace_gz(year_gz, twelve)
    ming_gz = palace_gz_map[ming]
    bureau = bureau_mod.get_bureau(ming_gz)

    zw = ziwei.get_ziwei_position(bureau, lunar_day)
    majors = {**major.get_major_stars(zw), "紫微": zw}

    moon_s = moon.get_moon_stars(lunar_month)
    hour_s = hour_mod.get_hour_stars(hour_branch)
    yg = year_g.get_year_g_stars(year_stem)
    fr = fire_ring.get_fire_ring_stars(year_branch, hour_branch)

    pooled = {
        "左輔": moon_s["左輔"],
        "右弼": moon_s["右弼"],
        "天馬": moon_s["天馬"],
        "文昌": hour_s["文昌"],
        "文曲": hour_s["文曲"],
        "地空": hour_s["地空"],
        "地劫": hour_s["地劫"],
        "天鉞": yg["天鉞"],
        "天魁": yg["天魁"],
        "祿存": yg["祿存"],
        "擎羊": yg["擎羊"],
        "陀羅": yg["陀羅"],
        "火星": fr["火星"],
        "鈴星": fr["鈴星"],
    }
    aux = {k: pooled[k] for k in AUX_STARS}
    sihua = four_trans.calculate_four_transformations(year_stem)

    # 宮位：僅十二宮地支 + 身宮（不含宮干、不含五行局字串）
    palace_names = list(twelve.keys())
    palace_part = (
        tuple((name, twelve[name]) for name in palace_names),
        shen,
    )
    return (
        tuple(sorted(majors.items())),
        tuple(sorted(aux.items())),
        tuple(sorted(sihua.items())),
        palace_part,
    )


def count_one_day_fixed(year_stem, year_branch, lunar_month, lunar_day):
    return len({fingerprint(year_stem, year_branch, lunar_month, lunar_day, h) for h in HOURS})


def theoretical_space():
    fps = set()
    for ygz in JIAZI:
        ys, yb = ygz[0], ygz[1]
        for month in range(1, 13):
            for day in range(1, 31):
                for h in HOURS:
                    fps.add(fingerprint(ys, yb, month, day, h))
    return len(fps), 60 * 12 * 30 * 12


def year_unique_via_sxtwl(year: int):
    import sxtwl
    from importlib.util import module_from_spec, spec_from_file_location

    su_spec = spec_from_file_location("sxtwl_utils", bc / "core" / "sxtwl_utils.py")
    su = module_from_spec(su_spec)
    su_spec.loader.exec_module(su)

    fps = set()
    day_counts = []
    cur = date(year, 1, 1)
    end = date(year, 12, 31)
    while cur <= end:
        day_fps = set()
        for hi, h in enumerate(HOURS):
            hour = (hi * 2) % 24
            lunar = sxtwl.fromSolar(cur.year, cur.month, cur.day)
            lm = abs(lunar.getLunarMonth())
            ld = lunar.getLunarDay()
            ygz = su.get_correct_year_gz(cur.year, cur.month, cur.day, hour, 30)
            fp = fingerprint(ygz[0], ygz[1], lm, ld, h)
            fps.add(fp)
            day_fps.add(fp)
        day_counts.append(len(day_fps))
        cur += timedelta(days=1)
    return len(fps), day_counts


def find_min_recurrence(start_year=1924, span_years=180):
    import sxtwl
    from importlib.util import module_from_spec, spec_from_file_location

    su_spec = spec_from_file_location("sxtwl_utils", bc / "core" / "sxtwl_utils.py")
    su = module_from_spec(su_spec)
    su_spec.loader.exec_module(su)

    first_seen = {}
    min_delta_days = None
    min_example = None
    param_first = {}
    min_param_delta = None
    recurrence_count = 0

    cur = date(start_year, 1, 1)
    end = date(start_year + span_years - 1, 12, 31)
    checked = 0
    while cur <= end:
        for hi, h in enumerate(HOURS):
            hour = (hi * 2) % 24
            lunar = sxtwl.fromSolar(cur.year, cur.month, cur.day)
            lm = abs(lunar.getLunarMonth())
            ld = lunar.getLunarDay()
            ygz = su.get_correct_year_gz(cur.year, cur.month, cur.day, hour, 30)
            params = (ygz, lm, ld, h)
            fp = fingerprint(ygz[0], ygz[1], lm, ld, h)
            key_time = (cur.toordinal(), hi)

            if params in param_first:
                delta = cur.toordinal() - param_first[params][0]
                if min_param_delta is None or delta < min_param_delta:
                    min_param_delta = delta
            else:
                param_first[params] = key_time

            if fp in first_seen:
                prev = first_seen[fp]
                delta_hours = (cur.toordinal() - prev[0]) * 12 + (hi - prev[1])
                delta_days = delta_hours / 12.0
                if delta_days > 0:
                    recurrence_count += 1
                    if min_delta_days is None or delta_days < min_delta_days:
                        min_delta_days = delta_days
                        min_example = {
                            "prev_ordinal_hour": prev,
                            "cur_ordinal_hour": key_time,
                            "delta_days": delta_days,
                            "cur_params": params,
                        }
            else:
                first_seen[fp] = key_time
            checked += 1
        cur += timedelta(days=1)

    return {
        "unique_fps": len(first_seen),
        "min_recurrence_days": min_delta_days,
        "min_example": min_example,
        "min_same_params_days": min_param_delta,
        "moments_checked": checked,
        "recurrence_sightings": recurrence_count,
    }


def component_cardinalities():
    maj, aux, sihua, pal = set(), set(), set(), set()
    all_fp = set()
    for ygz in JIAZI:
        for month in range(1, 13):
            for day in range(1, 31):
                for h in HOURS:
                    fp = fingerprint(ygz[0], ygz[1], month, day, h)
                    all_fp.add(fp)
                    maj.add(fp[0])
                    aux.add(fp[1])
                    sihua.add(fp[2])
                    pal.add(fp[3])
    return {
        "主星型": len(maj),
        "副星型": len(aux),
        "四化型": len(sihua),
        "宮位型": len(pal),
        "總指紋": len(all_fp),
    }


def main():
    print("=== 界定 v2 ===")
    print("主星: 14")
    print("副星: 六吉+天馬+祿存+四煞+空劫 =", ",".join(AUX_STARS))
    print("四化: 生年四化（計入）")
    print("宮位: 十二宮地支+身宮（不含宮干）")
    print()

    samples = []
    for ygz in ["甲子", "乙丑", "丁卯", "戊辰", "己巳", "庚午"]:
        for month in [1, 6, 12]:
            for day in [1, 15, 30]:
                samples.append(count_one_day_fixed(ygz[0], ygz[1], month, day))
    print("=== Q1 一天（固定年干支+農曆月日，變 12 時辰）===")
    print(
        f"樣本={len(samples)}, min={min(samples)}, max={max(samples)}, "
        f"平均={sum(samples)/len(samples):.3f}, 全為12比例={samples.count(12)/len(samples):.1%}"
    )
    print()

    print("=== 理論參數空間（60甲子×12月×30日×12時）===")
    n_unique, n_total = theoretical_space()
    print(f"參數組合總數: {n_total}")
    print(f"相異命盤指紋: {n_unique}")
    print(f"碰撞率: {1 - n_unique / n_total:.4%}")
    print("元件基數:", component_cardinalities())
    print()

    for y in [1987, 2024, 2025]:
        n, day_counts = year_unique_via_sxtwl(y)
        print(f"=== Q3 西曆 {y} 年 ===")
        print(f"全年相異命盤: {n}")
        print(
            f"單日相異: min={min(day_counts)}, max={max(day_counts)}, "
            f"平均={sum(day_counts)/len(day_counts):.3f}"
        )
        print(f"時辰時刻總數: {len(day_counts) * 12}")
        print()

    print("=== Q4 最短完全一樣重現（1924 起 180 年）===")
    rec = find_min_recurrence(1924, 180)
    print(f"掃描時刻數: {rec['moments_checked']}")
    print(f"期間內相異指紋數: {rec['unique_fps']}")
    print(f"最短指紋重現間隔(天): {rec['min_recurrence_days']}")
    print(f"相同五參數最短重現(天): {rec['min_same_params_days']}")
    print(f"重現觀測次數: {rec['recurrence_sightings']}")
    print(f"最短重現例子: {rec['min_example']}")


if __name__ == "__main__":
    main()
