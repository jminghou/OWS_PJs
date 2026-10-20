"""全球出生地（GeoNames，2026-10-20）：搜尋、geonameid／手動經緯度換算、驗證、/places API。"""
import unittest

from flask import Flask

from sites.Polaris_Parent.backend.extensions import astrology
from sites.Polaris_Parent.backend.extensions.astrology import birthplace
from sites.Polaris_Parent.backend.extensions.astrology import engine as eng
from sites.Polaris_Parent.backend.extensions.report_orders.validation import validate_order

OSLO, TROMSO, TAIPEI = 3143244, 3133895, 1668341


class SearchTests(unittest.TestCase):
    def test_finds_by_local_english_and_chinese_names(self):
        for q in ('tromso', 'Tromsø', 'TROMSØ', '特罗姆瑟'):
            self.assertEqual(birthplace.search(q, 3)[0]['geonameid'], TROMSO, q)
        oslo = birthplace.search('奧斯陸', 1)[0]
        self.assertEqual((oslo['geonameid'], oslo['label'], oslo['tz']), (OSLO, '奧斯陸, 挪威', 'Europe/Oslo'))
        self.assertEqual(birthplace.search('gothenburg', 1)[0]['tz'], 'Europe/Stockholm')

    def test_curated_chinese_names_are_kept(self):
        # 現有選單的城市在全球資料裡用同一個中文名，下拉與搜尋看到的名字一致
        self.assertEqual(birthplace.search('Taipei', 1)[0]['label'], '台北, 台灣')
        self.assertEqual(birthplace.search('keelung', 1)[0]['label'], '基隆, 台灣')

    def test_ranking_and_limits(self):
        hits = birthplace.search('bergen', 5)
        self.assertEqual(hits[0]['country_code'], 'NO')  # 完全相同的名字裡人口最多的在前
        self.assertLessEqual(len(birthplace.search('a', 99)), 30)
        self.assertEqual(birthplace.search('   '), [])
        self.assertEqual(birthplace.search('zzzzqqq'), [])


class ResolveTests(unittest.TestCase):
    def test_world_place_dst_and_solar_time(self):
        # 挪威 2010-07-15 是夏令時（UTC+2）：一般時間扣 1 小時
        t = birthplace.resolve(eng, (2010, 7, 15, 12, 0), 'clock_time', place={'geonameid': OSLO})
        self.assertEqual((t.resolved, t.tz, t.dst_minutes, t.utc_offset_minutes, t.birthplace),
                         ((2010, 7, 15, 11, 0), 'Europe/Oslo', 60, 120, '奧斯陸, 挪威'))
        s = birthplace.resolve(eng, (2010, 7, 15, 12, 0), 'solar_time', place={'geonameid': TROMSO})
        self.assertIsNotNone(s.solar_time)
        self.assertEqual(s.tz, 'Europe/Oslo')

    def test_geonameid_matches_curated_city_result(self):
        # 同一個城市不論從下拉或搜尋選，換算結果要一樣（座標差在 1 分以內）
        a = birthplace.resolve(eng, (1980, 11, 17, 10, 0), 'solar_time', '台北', '台灣')
        b = birthplace.resolve(eng, (1980, 11, 17, 10, 0), 'solar_time', place={'geonameid': TAIPEI})
        diff = abs((a.resolved[3] * 60 + a.resolved[4]) - (b.resolved[3] * 60 + b.resolved[4]))
        self.assertLessEqual(diff, 1)

    def test_manual_place(self):
        place = {'manual': True, 'lat': 69.65, 'lon': 18.96, 'tz': 'Europe/Oslo', 'city': 'Tromsø', 'country': '挪威'}
        with self.assertRaises(birthplace.BirthplaceError):
            birthplace.resolve(eng, (2010, 7, 15, 12, 0), 'clock_time', place=place)  # 預設不允許手動
        t = birthplace.resolve(eng, (2010, 7, 15, 12, 0), 'clock_time', place=place, allow_manual=True)
        self.assertEqual((t.resolved, t.birthplace), ((2010, 7, 15, 11, 0), 'Tromsø, 挪威'))
        for bad in ({'tz': 'Mars/Olympus'}, {'lat': 95}, {'lon': 'x'}, {'city': ''}):
            with self.assertRaises(birthplace.BirthplaceError, msg=bad):
                birthplace.resolve(eng, (2010, 7, 15, 12, 0), 'clock_time', place={**place, **bad}, allow_manual=True)

    def test_unknown_geonameid(self):
        with self.assertRaises(birthplace.BirthplaceError):
            birthplace.resolve(eng, (2010, 7, 15, 12, 0), 'clock_time', place={'geonameid': 999999999})

    def test_legacy_city_arguments_still_work(self):
        t = birthplace.resolve(eng, (1975, 7, 15, 10, 0), 'clock_time', '台北', '台灣')
        self.assertEqual(t.resolved, (1975, 7, 15, 9, 0))


def _order(place):
    return {'subject_name': '王小明', 'gender': '男', 'variant': 'digital', 'relation_label': 'son',
            'birth': {'date': '2010-07-15', 'time': '12:00', 'time_type': 'clock_time'}, 'place': place,
            'audience': {'reader': '父母', 'call_name': '小明', 'dedication': ''}}


class ValidationTests(unittest.TestCase):
    def test_server_fills_world_place_names(self):
        clean, errors = validate_order(_order({'geonameid': OSLO, 'city': '亂填', 'country': '亂填'}))
        self.assertNotIn('place', errors)
        self.assertEqual(clean['place'], {'continent': '', 'country': '挪威', 'city': '奧斯陸', 'geonameid': OSLO})

    def test_manual_only_when_allowed(self):
        place = {'manual': True, 'lat': 69.65, 'lon': 18.96, 'tz': 'Europe/Oslo', 'city': 'Tromsø', 'country': '挪威'}
        _, errors = validate_order(_order(place))
        self.assertIn('place', errors)
        clean, errors = validate_order(_order(place), allow_manual_place=True)
        self.assertNotIn('place', errors)
        self.assertEqual((clean['place']['manual'], clean['place']['tz'], clean['place']['lat']), (True, 'Europe/Oslo', 69.65))

    def test_bad_geonameid(self):
        _, errors = validate_order(_order({'geonameid': 'abc'}))
        self.assertIn('place', errors)


class PlacesApiTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.config.update(TESTING=True, RATELIMIT_ENABLED=False)
        app.register_blueprint(astrology.bp, url_prefix='/api/v1/astrology')
        self.client = app.test_client()

    def test_search_endpoint(self):
        r = self.client.get('/api/v1/astrology/places', query_string={'q': 'tromso', 'limit': 2}).get_json()
        self.assertEqual(r['places'][0]['geonameid'], TROMSO)
        self.assertIn('GeoNames', r['source'])
        self.assertEqual(self.client.get('/api/v1/astrology/places').get_json()['places'], [])
