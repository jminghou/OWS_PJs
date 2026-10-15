"""出生地與出生時間換算（extensions/astrology/birthplace.py），用真的排盤引擎計算真太陽時。"""
import json
import unittest
from pathlib import Path

from sites.Polaris_Parent.backend.extensions.astrology import birthplace
from sites.Polaris_Parent.backend.extensions.astrology import engine as eng

ROOT = Path(__file__).resolve().parent.parent


class LookupTests(unittest.TestCase):
    def test_every_city_has_iana_zone_and_matches_hierarchy(self):
        cities = json.loads(birthplace.DATA_FILE.read_text('utf-8'))['cities']
        hierarchy = eng.geographic_hierarchy()
        keys = {f'{city}|{country}' for countries in hierarchy.values()
                for country, city_list in countries.items() for city in city_list}
        self.assertEqual(set(cities), keys)
        self.assertTrue(all(row.get('tz') for row in cities.values()))

    def test_ts_engine_table_is_generated_from_backend_data(self):
        ts = json.loads((ROOT / 'packages/ziwei-engine/src/data/geo_cities.json').read_text('utf-8'))['cities']
        for key, row in json.loads(birthplace.DATA_FILE.read_text('utf-8'))['cities'].items():
            city, country = key.split('|')
            self.assertEqual((ts[key]['tz'], ts[key]['coordinates']),
                             (row['tz'], birthplace.lookup(city, country).coordinates), key)

    def test_corrected_coordinates_and_zones(self):
        self.assertEqual(birthplace.lookup('成都', '中國').tz, 'Asia/Shanghai')
        self.assertEqual(birthplace.lookup('拜林', '柬埔寨').coordinates, '12n50, 102e36')
        self.assertEqual(birthplace.lookup('新德里', '印度').tz, 'Asia/Kolkata')

    def test_unknown_place_raises(self):
        with self.assertRaises(birthplace.BirthplaceError):
            birthplace.lookup('Taipei', 'Taiwan')


class ResolveTests(unittest.TestCase):
    def test_solar_time_uses_actual_offset_including_dst(self):
        b = birthplace.resolve(eng, (1975, 7, 15, 10, 0), 'solar_time', '台北', '台灣')
        self.assertEqual((b.utc_offset_minutes, b.dst_minutes), (540, 60))
        self.assertEqual(b.resolved, (1975, 7, 15, 9, 0))

    def test_solar_time_city_far_from_zone_meridian(self):
        # 成都在 UTC+8 但經度 104°：舊版當成 UTC+7，會晚算一小時（10:11）
        b = birthplace.resolve(eng, (1980, 11, 17, 10, 0), 'solar_time', '成都', '中國')
        self.assertEqual(b.solar_time, '17 November 1980 at 09:11')

    def test_clock_time_subtracts_dst_and_may_cross_midnight(self):
        b = birthplace.resolve(eng, (1979, 8, 1, 0, 30), 'clock_time', '台北', '台灣')
        self.assertEqual(b.dst_minutes, 60)
        self.assertEqual(b.resolved, (1979, 7, 31, 23, 30))
        self.assertIsNone(b.solar_time)

    def test_clock_time_without_dst_is_unchanged(self):
        b = birthplace.resolve(eng, (2020, 5, 1, 8, 0), 'clock_time', '台北', '台灣')
        self.assertEqual((b.resolved, b.dst_minutes, b.birthplace), ((2020, 5, 1, 8, 0), 0, '台北, 台灣'))

    def test_clock_time_without_place_keeps_input(self):
        b = birthplace.resolve(eng, (1975, 7, 15, 10, 0), 'clock_time')
        self.assertEqual((b.resolved, b.tz), ((1975, 7, 15, 10, 0), None))

    def test_solar_time_requires_place(self):
        with self.assertRaises(birthplace.BirthplaceError):
            birthplace.resolve(eng, (1980, 1, 1, 1, 0), 'solar_time')

    def test_offset_token(self):
        self.assertEqual(birthplace.offset_token(8 * 3600), 'h8e')
        self.assertEqual(birthplace.offset_token(int(5.5 * 3600)), 'h5.5e')
        self.assertEqual(birthplace.offset_token(-3 * 3600), 'h3w')


if __name__ == '__main__':
    unittest.main()
