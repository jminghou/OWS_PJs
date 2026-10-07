"""Column profile (專欄頁頁頭) settings. Uses mocked storage; never writes site data."""
import inspect
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from flask import Flask
from core.backend_engine.blueprints.api import settings


class ColumnProfileTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.store = {}
        self.setting = MagicMock()
        self.setting.query.filter_by.side_effect = lambda key: SimpleNamespace(first=lambda: self.store.get(key))
        self.setting.side_effect = lambda **kwargs: SimpleNamespace(**kwargs)
        self.db = MagicMock()
        self.db.session.add.side_effect = lambda row: self.store.update({row.key: row})
        self.tags = {
            3: SimpleNamespace(id=3, code='parenting', get_slug=lambda lang: '教養' if lang == 'zh-TW' else 'Parenting'),
            5: SimpleNamespace(id=5, code='talent', get_slug=lambda lang: '天賦'),
        }
        self.tag = MagicMock()
        self.tag.query.filter.side_effect = lambda *_: SimpleNamespace(all=lambda: list(self.tags.values()))
        for name, value in [('Setting', self.setting), ('db', self.db), ('Tag', self.tag),
                            ('trigger_frontend_revalidate', MagicMock()),
                            ('get_i18n_setting', lambda key, default: default)]:
            patcher = patch.object(settings, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def save(self, payload):
        with self.app.test_request_context(json=payload):
            response, status = inspect.unwrap(settings.api_update_column_profile)()
            return response.get_json(), status

    def read(self, query=''):
        with self.app.test_request_context(f'/?{query}'):
            response, _ = settings.api_get_column_profile()
            return response.get_json()

    def test_empty_profile_has_stable_shape(self):
        self.assertEqual(self.read(), {'avatar_url': '', 'links': [], 'actions': [], 'highlights': [], 'locales': {}})

    def test_round_trip_trims_dedupes_and_resolves_tags(self):
        status = self.save({
            'avatar_url': '/media/me.jpg', 'junk': 1,
            'links': [{'label': ' IG ', 'url': 'https://instagram.com/x'}, {'label': '', 'url': '/x'}],
            'actions': [{'label': '購買報告', 'url': '/report'}],
            'highlights': [{'tag_id': 5, 'image_url': ''}, {'tag_id': 3, 'image_url': '/media/a.jpg'},
                           {'tag_id': 5}, {'tag_id': 99}],
            'locales': {'zh-TW': {'name': ' 親紫 ', 'bio': '', 'onclick': 'x'}},
        })[1]
        self.assertEqual(status, 200)
        result = self.read()
        self.assertEqual(result['links'], [{'label': 'IG', 'url': 'https://instagram.com/x'}])
        self.assertEqual(result['locales'], {'zh-TW': {'name': '親紫'}})
        # 順序依後台設定；重複的略過；不存在的標籤（99）在公開端略過
        self.assertEqual(result['highlights'], [
            {'tag_id': 5, 'image_url': '', 'code': 'talent', 'name': '天賦'},
            {'tag_id': 3, 'image_url': '/media/a.jpg', 'code': 'parenting', 'name': '教養'},
        ])
        self.assertEqual(self.read('language=en')['highlights'][1]['name'], 'Parenting')

    def test_invalid_profile_cannot_write(self):
        for value in [None, [], {'locales': []}, {'locales': {'../x': {}}}, {'locales': {'en': {'name': 'x' * 61}}},
                      {'avatar_url': 'javascript:alert(1)'}, {'avatar_url': '//evil.com/a.png'},
                      {'links': [{'label': 'x', 'url': 'javascript:1'}]}, {'links': [{}] * 4},
                      {'highlights': [{'tag_id': '3'}]}, {'highlights': [{'tag_id': True}]},
                      {'highlights': [{'tag_id': 1, 'image_url': 'data:x'}]}]:
            with self.subTest(value=value):
                self.assertEqual(self.save(value)[1], 400)
        self.db.session.commit.assert_not_called()


if __name__ == '__main__':
    unittest.main()
