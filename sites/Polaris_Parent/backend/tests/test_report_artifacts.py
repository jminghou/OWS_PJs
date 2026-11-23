"""Isolated final-PDF reception, fake transport and private temporary storage."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
import hashlib
import tempfile
from unittest.mock import patch
from core.backend_engine.factory import db
from packages.commerce.models import OrderItem
from sites.Polaris_Parent.backend.models import ReportFulfillment, ReportDocument
from sites.Polaris_Parent.backend.extensions.report_orders import artifacts, control, delivery, handoff
from sites.Polaris_Parent.backend.extensions.report_orders.service import OrderError
from tests.test_report_proxy import _ProxyBase

PDF = b'%PDF-1.4\nfixture\n%%EOF'


class ArtifactTests(_ProxyBase):
    def setUp(self):
        super().setUp()
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.app.config['PRIVATE_UPLOAD_DIR'] = self.tmp.name
        self.order = self.created_order()
        self.f = ReportFulfillment.query.one()
        self.f.handoff_status = 'sent'
        self.item = db.session.get(OrderItem, self.f.order_item_id)
        db.session.commit()
        self.m = dict(artifacts.identity(self.item, self.f), version=1, filename='final.pdf',
                      kind='book_pdf', bytes=len(PDF), sha256=hashlib.sha256(PDF).hexdigest())
        self.remote = patch.object(handoff, '_ziwei_call', side_effect=lambda *a: ({'artifact': dict(self.m)}, None))
        self.remote.start()
        self.addCleanup(self.remote.stop)
        fetch_patch = patch.object(artifacts, 'fetch_file', return_value=PDF)
        self.fetch = fetch_patch.start()
        self.addCleanup(fetch_patch.stop)

    def receive(self, current=None):
        return artifacts.receive(self.item, self.admin.id, self.m['version'], self.m['sha256'], current)

    def test_import_is_private_and_idempotent(self):
        doc, first, duplicate = self.receive()
        self.assertTrue(first)
        self.assertFalse(duplicate)
        self.assertEqual(delivery.private_storage.read(doc.file_key), PDF)
        again, first, duplicate = self.receive()
        self.assertEqual(again.id, doc.id)
        self.assertTrue(duplicate)
        self.assertFalse(first)
        self.assertEqual(ReportDocument.query.count(), 1)
        self.assertEqual(self.order.attributes['report_artifact_import']['document_id'], doc.id)

    def test_corrupt_file_never_becomes_ready(self):
        self.fetch.return_value = PDF + b'corrupt'
        with self.assertRaises(OrderError):
            self.receive()
        self.assertEqual(ReportDocument.query.count(), 0)
        self.assertIsNone(self.f.deliverable_ready_at)

    def test_wrong_owner_or_environment_rejected(self):
        for key, value in [('member_id', 'other'), ('env', 'other'), ('language', 'other'), ('chart_id', 'other')]:
            old = self.m[key]
            self.m[key] = value
            with self.assertRaises(OrderError):
                self.receive()
            self.m[key] = old
        self.fetch.assert_not_called()

    def test_remote_change_during_download_rejected(self):
        def fetch(*args):
            self.m['version'] = 2
            return PDF
        self.fetch.side_effect = fetch
        with self.assertRaises(OrderError):
            self.receive()
        self.assertEqual(ReportDocument.query.count(), 0)

    def test_pause_during_download_rejected(self):
        def fetch(*args):
            control.change(self.order, 'paused', '檢查中', self.admin.id, 0)
            db.session.commit()
            return PDF
        self.fetch.side_effect = fetch
        with self.assertRaises(OrderError):
            self.receive()
        self.assertEqual(ReportDocument.query.count(), 0)

    def test_manual_upload_during_download_is_preserved(self):
        def fetch(*args):
            delivery.upload_report_pdf(self.item, self.admin.id, 'manual.pdf', PDF + b'manual')
            return PDF
        self.fetch.side_effect = fetch
        with self.assertRaises(OrderError):
            self.receive()
        self.assertEqual(delivery.current_document(self.item).filename, 'manual.pdf')
        self.assertEqual(ReportDocument.query.count(), 1)

    def test_owner_change_during_download_is_rejected(self):
        def fetch(*args):
            self.f.member_id = self.user.id
            db.session.commit()
            return PDF
        self.fetch.side_effect = fetch
        with self.assertRaises(OrderError):
            self.receive()
        self.assertEqual(ReportDocument.query.count(), 0)

    def test_storage_failure_does_not_publish(self):
        with patch.object(delivery.private_storage, 'save', side_effect=delivery.private_storage.StorageError('offline')):
            with self.assertRaises(delivery.private_storage.StorageError):
                self.receive()
        db.session.rollback()
        self.assertEqual(ReportDocument.query.count(), 0)
        self.assertIsNone(self.f.deliverable_ready_at)

    def test_manual_replacement_cannot_be_reverted_by_duplicate_import(self):
        self.receive()
        doc, _ = delivery.upload_report_pdf(self.item, self.admin.id, 'manual.pdf', PDF + b'manual')
        with self.assertRaises(OrderError):
            self.receive(doc.id)
        self.assertEqual(delivery.current_document(self.item).id, doc.id)

    def test_new_revision_replaces_only_expected_document(self):
        doc, _, _ = self.receive()
        self.m['version'] = 2
        with self.assertRaises(OrderError):
            self.receive()
        newer, first, duplicate = self.receive(doc.id)
        self.assertNotEqual(newer.id, doc.id)
        self.assertFalse(first or duplicate)
        self.assertEqual(ReportDocument.query.filter_by(is_current=True).count(), 1)

    def test_admin_endpoint_requires_permission_and_manifest(self):
        url = f'/api/v1/admin/report-orders/{self.order.order_no}/production-artifact'
        self.assertEqual(self.client.get(url, headers=self.headers()).status_code, 403)
        result = self.client.get(url, headers=self.headers(self.admin))
        self.assertEqual(result.status_code, 200)
        body = dict(version=1, sha256=self.m['sha256'], current_document_id=None)
        result = self.client.post(url, json=body, headers=self.headers(self.admin))
        self.assertEqual(result.status_code, 200, result.get_json())
        result = self.client.post(url, json=body, headers=self.headers(self.admin))
        self.assertTrue(result.get_json()['duplicate'])
