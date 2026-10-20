"""存盤路徑的出生時間換算（2026-10-21 修正）：save-and-register、我的命盤、註冊附帶命盤都要與 /calculate 相同。

以前這三條路徑直接把輸入時間存進紫微：選真太陽時或出生在夏令時期間時，存下的盤與畫面上的不同。
紫微服務以假函式代替，檢查實際送出的時間與出生地。
"""
from unittest.mock import patch

from sites.Polaris_Parent.backend.extensions import astrology

from tests.test_report_orders import _Base

TAIPEI = {'city': '台北', 'country': '台灣'}
OSLO = {'city': '奧斯陸', 'country': '挪威', 'geonameid': 3143244, 'lat': 59.91273, 'lon': 10.74609, 'tz': 'Europe/Oslo'}


class ChartSaveBirthTests(_Base):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.app.register_blueprint(astrology.bp, url_prefix='/api/v1/astrology')

    def setUp(self):
        super().setUp()
        self.sent = []
        fake = lambda payload: (self.sent.append(payload) or ({'chart_id': '1', 'member_id': '1', 'is_existing': False}, None))  # noqa: E731
        for p in (patch.object(astrology, '_ziwei_save_and_register', side_effect=fake),
                  patch.object(astrology, '_PUBLIC_SERVICE_TOKEN', 'test-token')):
            p.start()
            self.addCleanup(p.stop)

    def save(self, path='my/charts', **over):
        body = {'year': 1980, 'month': 11, 'day': 17, 'hour': 10, 'minute': 0, 'gender': '男', 'name': '測試',
                'place': '台北, 台灣', **over}
        if path == 'save-and-register':
            body['email'] = 'buyer@example.com'
        return self.client.post(f'/api/v1/astrology/{path}', json=body, headers=self.headers())

    def saved_time(self):
        s = self.sent[-1]
        return (s['year'], s['month'], s['day'], s['hour'], s['minute']), s['place']

    def test_solar_time_is_converted_before_saving(self):
        r = self.save(time_type='solar_time', birth_place=TAIPEI)
        self.assertEqual(r.status_code, 200, r.get_json())
        self.assertEqual(self.saved_time(), ((1980, 11, 17, 10, 21), '台北, 台灣'))  # 與 /calculate 預覽同一個時間

    def test_clock_time_deducts_dst(self):
        self.save(year=1975, month=7, day=15, time_type='clock_time', birth_place=TAIPEI)
        self.assertEqual(self.saved_time()[0], (1975, 7, 15, 9, 0))

    def test_world_city(self):
        self.save(year=2010, month=7, day=15, hour=12, time_type='clock_time', birth_place=OSLO, place='')
        self.assertEqual(self.saved_time(), ((2010, 7, 15, 11, 0), '奧斯陸, 挪威'))

    def test_clock_time_without_place_unchanged(self):
        self.save(time_type='clock_time', place='')
        self.assertEqual(self.saved_time(), ((1980, 11, 17, 10, 0), ''))

    def test_legacy_payload_unchanged(self):
        # 快取中的舊頁面沒帶 time_type／birth_place：維持舊行為，不擋存盤
        self.save()
        self.assertEqual(self.saved_time(), ((1980, 11, 17, 10, 0), '台北, 台灣'))

    def test_bad_place_rejected_without_saving(self):
        r = self.save(time_type='solar_time', birth_place={'city': '不存在', 'country': '台灣'})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.sent, [])
        manual = {'manual': True, 'lat': 1, 'lon': 1, 'tz': 'UTC', 'city': 'x'}
        r = self.save(time_type='solar_time', birth_place=manual)
        self.assertEqual(r.status_code, 400)  # 公開排盤不接受手動座標（manual 旗標被濾掉後沒有可用的出生地）
        self.assertEqual(self.sent, [])

    def test_save_and_register_converts_too(self):
        # 只看送給紫微的時間（之後補 member_profiles 的步驟在測試環境沒有那張表）
        self.save('save-and-register', time_type='solar_time', birth_place=TAIPEI)
        self.assertEqual(self.saved_time()[0], (1980, 11, 17, 10, 21))

    def test_signup_hook_converts_too(self):
        chart = {'year': 1980, 'month': 11, 'day': 17, 'hour': 10, 'minute': 0, 'gender': '男',
                 'place': '台北, 台灣', 'time_type': 'solar_time', 'birth_place': TAIPEI}
        result = astrology._attach_pending_chart('new@example.com', {'chart': chart})
        self.assertIsNone(result.warning)
        self.assertEqual(self.saved_time()[0], (1980, 11, 17, 10, 21))
        bad = astrology._attach_pending_chart('new@example.com', {'chart': {**chart, 'birth_place': {'city': 'x', 'country': 'y'}}})
        self.assertIn('出生地換算失敗', bad.warning)  # 不擋註冊，只提示
