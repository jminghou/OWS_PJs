"""Homepage settings regressions. Uses mocked storage; never writes site data."""
import inspect
import json
import unittest
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from flask import Flask
from sqlalchemy import column
from core.backend_engine.blueprints.api import settings


class HomepageSettingsTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.store = {}
        self.setting = MagicMock()
        self.setting.query.filter_by.side_effect = lambda key: SimpleNamespace(first=lambda: self.store.get(key))
        self.setting.side_effect = lambda **kwargs: SimpleNamespace(**kwargs)
        self.db = MagicMock()
        self.db.session.add.side_effect = lambda row: self.store.update({row.key: row}) if hasattr(row, 'key') else None
        self.slides = MagicMock()
        self.slides.start_date = column('start_date')
        self.slides.end_date = column('end_date')
        self.slides.is_active = column('is_active')
        self.slides.query.filter.return_value.order_by.return_value.all.return_value = []
        self.slides.query.order_by.return_value.all.return_value = [SimpleNamespace(to_dict=lambda: {'id': 'future-slide'})]
        self.slides.query.order_by.return_value.first.return_value = None
        self.home = MagicMock()
        self.home.query.first.return_value = SimpleNamespace(button_text={}, pause_on_hover=True, lazy_loading=True, updated_at=datetime.utcnow())
        for name, value in [('Setting', self.setting), ('db', self.db), ('HomepageSlide', self.slides), ('HomepageSettings', self.home), ('trigger_frontend_revalidate', MagicMock())]:
            patcher = patch.object(settings, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def save(self, payload):
        with self.app.test_request_context(json=payload):
            response, status = inspect.unwrap(settings.api_update_homepage_settings)()
            return response.get_json(), status

    def read(self, admin=False):
        with self.app.test_request_context():
            response, _ = settings._homepage_settings_response(include_all=admin)
            return response.get_json()

    def test_order_round_trip_and_partial_update_preserves_slides(self):
        self.assertEqual(self.save({'article_wall': {'mode': 'manual', 'article_ids': [9, 3, 9]}})[1], 200)
        self.assertEqual(self.read()['article_wall'], {'mode': 'manual', 'article_ids': [9, 3]})
        self.slides.query.all.assert_not_called()
        self.db.session.commit.assert_called_once()

    def test_empty_manual_wall_does_not_revert_to_latest(self):
        self.save({'article_wall': {'mode': 'manual', 'article_ids': []}})
        self.assertEqual(self.read()['article_wall'], {'mode': 'manual', 'article_ids': []})

    def test_invalid_wall_cannot_write(self):
        for value in [None, {'mode': 'bad', 'article_ids': []}, {'mode': 'manual', 'article_ids': [True]}, {'mode': 'manual', 'article_ids': ['2']}, {'mode': 'manual', 'article_ids': list(range(1, 26))}]:
            with self.subTest(value=value):
                self.assertEqual(self.save({'article_wall': value})[1], 400)
        self.db.session.commit.assert_not_called()

    def test_admin_keeps_future_slides_public_filters_them(self):
        self.assertEqual(self.read()['slides'], [])
        self.assertEqual(self.read(admin=True)['slides'], [{'id': 'future-slide'}])

    def test_about_and_button_round_trip(self):
        about = {'zh-TW': {'title': 'About', 'philosophy': 'Story', 'quote': 'Quote', 'mission_points': ['One'], 'image_url': '/photo.jpg'}}
        self.save({'about_section': about, 'button_text': {'zh-TW': 'Read'}})
        result = self.read()
        self.assertEqual(result['about_section'], about)
        self.assertEqual(result['button_text'], {'zh-TW': 'Read'})


    def test_hero_intro_round_trip_trims_and_drops_unknown_keys(self):
        self.assertEqual(self.read()['hero_intro'], {'locales': {}})
        saved = {'image_url': '/media/hero.jpg', 'junk': 1, 'locales': {
            'zh-TW': {'headline': '  看懂孩子  ', 'body': '內文', 'eyebrow': '', 'onclick': 'x'},
            'en': {'headline': 'Understand your child'},
        }}
        self.assertEqual(self.save({'hero_intro': saved})[1], 200)
        self.assertEqual(self.read()['hero_intro'], {'image_url': '/media/hero.jpg', 'locales': {
            'zh-TW': {'headline': '看懂孩子', 'body': '內文'},
            'en': {'headline': 'Understand your child'},
        }})
        self.slides.query.all.assert_not_called()

    def test_invalid_hero_intro_cannot_write(self):
        for value in [None, [], {'locales': []}, {'locales': {'../x': {}}}, {'locales': {'en': 'text'}},
                      {'locales': {'en': {'headline': 5}}}, {'locales': {'en': {'headline': 'x' * 201}}},
                      {'locales': {}, 'image_url': 'javascript:alert(1)'}, {'locales': {}, 'image_url': 7}]:
            with self.subTest(value=value):
                self.assertEqual(self.save({'hero_intro': value})[1], 400)
        self.db.session.commit.assert_not_called()


if __name__ == '__main__':
    unittest.main()
