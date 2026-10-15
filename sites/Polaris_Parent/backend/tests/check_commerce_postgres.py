"""Disposable PostgreSQL migration/concurrency check; never reads .env or a database URL.

Run as a separate Python process. Uses local PostgreSQL binaries (PG_BIN override),
a randomly allocated loopback port, and a new cluster under this site's .test-tmp.
"""
import importlib.util
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event
from unittest.mock import patch

SITE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(SITE.parents[1]))
os.environ.update(OWS_BLOG_SCHEMA='blog', OWS_SHOP_SCHEMA='shop', OWS_IDENTITY_MODE='external')


def verify(url):
    from flask import Flask
    from sqlalchemy import inspect, text
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from core.backend_engine.factory import db
    from packages.commerce.models import Order, OrderItem, PaymentAttempt
    from sites.Polaris_Parent.backend.models import AppUser, ReportFulfillment, ReportPrintJob
    from sites.Polaris_Parent.backend.commerce_models import (
        CommerceSource, CommerceLine, CommerceEntitlement, CommerceTask, CommerceEvent, CommerceActivation,
        CommerceChannel, CommerceExternalReceipt, CommerceIntakeEvent,
        CommerceProductMapping, CommerceReceiptBinding,
    )
    from sites.Polaris_Parent.backend.extensions.report_orders import commerce, payment, activation
    from sites.Polaris_Parent.backend.extensions.report_orders.service import OrderError

    app = Flask(__name__)
    app.config.update(SQLALCHEMY_DATABASE_URI=url, TESTING=True,
                      REPORT_PAYMENT_MODE='manual', COMMERCE_FOUNDATION_ENABLED=True, COMMERCE_ACTIVATION_ENABLED=True)
    db.init_app(app)
    spec = importlib.util.spec_from_file_location('commerce_migration',
        SITE / 'backend/migrations/versions/0010_commerce_foundation.py')
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    spec_activation = importlib.util.spec_from_file_location('activation_migration',
        SITE / 'backend/migrations/versions/0011_commerce_activations.py')
    migration_activation = importlib.util.module_from_spec(spec_activation)
    spec_activation.loader.exec_module(migration_activation)
    spec_intake = importlib.util.spec_from_file_location('intake_migration',
        SITE / 'backend/migrations/versions/0012_commerce_intake.py')
    migration_intake = importlib.util.module_from_spec(spec_intake)
    spec_intake.loader.exec_module(migration_intake)
    spec_binding = importlib.util.spec_from_file_location('binding_migration',
        SITE / 'backend/migrations/versions/0013_commerce_contract_binding.py')
    migration_binding = importlib.util.module_from_spec(spec_binding)
    spec_binding.loader.exec_module(migration_binding)
    models = (CommerceSource, CommerceLine, CommerceEntitlement, CommerceTask, CommerceEvent, CommerceActivation,
              CommerceChannel, CommerceExternalReceipt, CommerceIntakeEvent, CommerceProductMapping, CommerceReceiptBinding)
    new_tables = {m.__table__ for m in models}
    with app.app_context():
        with db.engine.begin() as conn:
            for schema in ('account', 'blog', 'shop'):
                conn.execute(text(f'CREATE SCHEMA {schema}'))
            db.metadata.create_all(conn, tables=[t for t in db.metadata.sorted_tables if t not in new_tables])
            with Operations.context(MigrationContext.configure(conn)):
                migration.upgrade()
                migration_activation.upgrade()
                migration_intake.upgrade()
                migration_binding.upgrade()
                migration_binding.downgrade()
                migration_intake.downgrade()
                migration_activation.downgrade()
                migration.downgrade()  # Empty migration can safely roll back.
                migration.upgrade()
                migration_activation.upgrade()
                migration_intake.upgrade()
                migration_binding.upgrade()
            inspector = inspect(conn)
            for model in models:
                assert {c['name'] for c in inspector.get_columns(model.__tablename__, schema='shop')} == set(model.__table__.columns.keys())
        db.session.add(AppUser(id=1, username='test-only', password_hash='unused', role='member',
                               is_active=True, permissions=[], allowed_collectors=[]))
        db.session.commit()
        order = Order(order_no='isolated-pg-check', user_id=1, amount=3180,
                      status='pending', currency='TWD', payment_method='manual')
        db.session.add(order)
        db.session.flush()
        item = OrderItem(order_id=order.id, item_no='isolated-pg-item', product_code='test',
                         name='test', variant='physical', kind='purchase', unit_price=3180,
                         quantity=1, currency='TWD')
        db.session.add(item)
        db.session.flush()
        db.session.add(ReportFulfillment(order_item_id=item.id, request_no='isolated-pg-item', member_id=1))
        db.session.add(ReportPrintJob(order_item_id=item.id, status='awaiting_payment',
                                      spec={'key': 'test'}, custom={'options': [], 'spreads': 0},
                                      pricing={'quantity': 1, 'line_total': 1200,
                                               'breakdown': [{'label': 'test book', 'amount': 1200}]}))
        commerce.finalize_order(order)
        db.session.commit()
        order_id = order.id
        db.session.remove()

    barrier = Barrier(2)

    def confirm():
        with app.app_context():
            order = db.session.get(Order, order_id)
            barrier.wait(timeout=15)  # Both requests see pending before acquiring the lock.
            try:
                payment.confirm_manual_payment(order, 1, 3180)
                return 'paid'
            except OrderError as exc:
                db.session.rollback()
                return exc.code
            finally:
                db.session.remove()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: confirm(), range(2)))
    assert sorted(results) == ['not_pending', 'paid'], results
    with app.app_context():
        assert PaymentAttempt.query.filter_by(status='succeeded').count() == 1
        assert CommerceEntitlement.query.count() == 2
        assert CommerceTask.query.count() == 1
        assert CommerceEvent.query.filter_by(event_type='payment_confirmed').count() == 1
        assert ReportFulfillment.query.one().handoff_status == 'pending'
        book_id = CommerceEntitlement.query.filter_by(kind='book').one().id
        db.session.remove()

    issue_barrier = Barrier(2)

    def issue_code():
        with app.app_context():
            issue_barrier.wait(timeout=15)
            try:
                row, code = activation.issue(book_id, 1)
                db.session.commit()
                return 'issued', code
            except OrderError as exc:
                db.session.rollback()
                return exc.code, None
            finally:
                db.session.remove()

    with ThreadPoolExecutor(max_workers=2) as pool:
        issued = list(pool.map(lambda _: issue_code(), range(2)))
    assert sorted(r[0] for r in issued) == ['activation_exists', 'issued']
    raw_code = next(r[1] for r in issued if r[0] == 'issued')
    redeem_barrier = Barrier(2)

    def redeem_code():
        with app.app_context():
            redeem_barrier.wait(timeout=15)
            try:
                _, changed = activation.redeem(raw_code, 1)
                db.session.commit()
                return changed
            finally:
                db.session.remove()

    with ThreadPoolExecutor(max_workers=2) as pool:
        redeemed = list(pool.map(lambda _: redeem_code(), range(2)))
    assert sorted(redeemed) == [False, True]
    with app.app_context():
        assert CommerceActivation.query.count() == 1
        assert CommerceActivation.query.one().status == 'redeemed'
        assert CommerceEntitlement.query.count() == 2
        assert CommerceTask.query.count() == 1
        assert CommerceEvent.query.filter_by(event_type='activation_redeemed').count() == 1
        assert PaymentAttempt.query.count() == 1
        assert commerce.require(Order.query.one().order_items[0], 'book', 1)
        db.session.remove()
        try:
            with db.engine.begin() as conn:
                with Operations.context(MigrationContext.configure(conn)):
                    migration_activation.downgrade()
        except RuntimeError as exc:
            assert 'Activation records exist' in str(exc)
        else:
            raise AssertionError('Populated activation table must not be dropped')
        try:
            with db.engine.begin() as conn:
                with Operations.context(MigrationContext.configure(conn)):
                    migration.downgrade()
        except RuntimeError as exc:
            assert 'Commerce records exist' in str(exc)
        else:
            raise AssertionError('Populated tables must not be dropped')
        db.engine.dispose()
    verify_backfill(app)
    verify_intake(app, migration_intake)
    verify_binding(app, migration_binding)
    print('PASS: migrations 0010-0013, concurrent payment/issuance/redemption/backfill/intake/review/binding, manual-vs-external race, stale evidence refresh, unique records, downgrade protection')


def verify_binding(app, migration):
    from datetime import datetime, timedelta, timezone
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from core.backend_engine.factory import db
    from packages.commerce.models import Order, OrderItem, OrderCheckout, PaymentAttempt
    from sites.Polaris_Parent.backend.models import ReportFulfillment
    from sites.Polaris_Parent.backend.commerce_models import (
        CommerceChannel, CommerceExternalReceipt, CommerceProductMapping, CommerceReceiptBinding, CommerceEntitlement, CommerceTask,
    )
    from sites.Polaris_Parent.backend.extensions.report_orders import binding, commerce, intake, payment
    from sites.Polaris_Parent.backend.extensions.report_orders.service import OrderError

    app.config['COMMERCE_BINDING_ENABLED'] = True
    def seed(no):
        with app.app_context():
            order = Order(order_no=no, user_id=1, amount=1980, status='pending', currency='TWD', payment_method='manual')
            db.session.add(order)
            db.session.flush()
            db.session.add(OrderCheckout(order_id=order.id, submission_key=no, policy_version='test-policy',
                                         policy_consented_at=datetime.now(timezone.utc).replace(tzinfo=None)))
            item = OrderItem(order_id=order.id, item_no=no, product_code='natal-report-digital', name='test',
                             variant='digital', kind='purchase', unit_price=1980, currency='TWD', quantity=1)
            db.session.add(item)
            db.session.flush()
            db.session.add(ReportFulfillment(order_item_id=item.id, request_no=no, member_id=1, chart_id=1, person_user_id=1,
                                             handoff_status='not_ready'))
            commerce.finalize_order(order)
            channel = CommerceChannel.query.one()
            if CommerceProductMapping.query.first() is None:
                binding.save_mapping(dict(channel_id=channel.id, channel_revision=1, external_sku='digital', active=True,
                    template_item_no=no, policy_reference='test:fulfilment', review_note='isolated',
                    valid_until=(datetime.now(timezone.utc) + timedelta(days=1)).isoformat()), 1)
            receipt, _ = intake.import_receipt(dict(channel_id=channel.id, channel_revision=1, external_order_id=no,
                member_id=1, amount=1980, currency='TWD', lines=[dict(external_sku='digital', quantity=1, unit_amount=1980)]), 1)
            review_data = dict(channel_revision=1, fingerprint=receipt.fingerprint, decision='verified', note='test',
                               evidence_reference='test:proof', payment_confirmed=True, ownership_confirmed=True)
            intake.review(receipt.id, review_data, 1)
            db.session.commit()
            plan = binding.preview(receipt.id, order.order_no, 1)
            db.session.commit()
            return order.id, item.id, receipt.id, dict(review_token=plan['review_token'], confirmed=True, note='isolated'), review_data

    oid, iid, rid, payload, review_data = seed('external-parallel')
    barrier = Barrier(2)
    def bind():
        with app.app_context():
            barrier.wait(timeout=15)
            _, changed = binding.apply(rid, payload, 1)
            db.session.commit()
            return changed
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(lambda _: bind(), range(2))) == [False, True]
    with app.app_context():
        assert CommerceReceiptBinding.query.filter_by(receipt_id=rid).count() == 1
        ent = CommerceEntitlement.query.filter_by(order_item_id=iid).one()
        assert CommerceTask.query.filter_by(entitlement_id=ent.id).count() == 1
        assert PaymentAttempt.query.filter_by(order_id=oid).count() == 0

    loaded, voided = Event(), Event()
    def use_stale_evidence():
        with app.app_context():
            cached = db.session.get(CommerceExternalReceipt, rid)
            assert cached.status == 'verified'
            item = db.session.get(OrderItem, iid)
            loaded.set()
            assert voided.wait(timeout=15)
            try:
                commerce.require(item, 'report')
            except OrderError as exc:
                db.session.rollback()
                return exc.code
            raise AssertionError('Stale verified evidence allowed fulfilment')
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(use_stale_evidence)
        assert loaded.wait(timeout=15)
        with app.app_context():
            intake.review(rid, review_data | {'decision': 'voided'}, 1)
            db.session.commit()
        voided.set()
        assert future.result(timeout=15) == 'external_evidence_unavailable'

    oid, iid, rid, payload, _ = seed('external-manual-race')
    barrier = Barrier(2)
    def race(kind):
        with app.app_context():
            order = db.session.get(Order, oid)
            barrier.wait(timeout=15)
            try:
                if kind == 'manual':
                    payment.confirm_manual_payment(order, 1, 1980)
                else:
                    binding.apply(rid, payload, 1)
                    db.session.commit()
                return kind
            except OrderError:
                db.session.rollback()
                return 'blocked'
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(race, ('manual', 'external')))
    assert results.count('blocked') == 1, results
    with app.app_context():
        assert CommerceEntitlement.query.filter_by(order_item_id=iid).count() == 1
        attempts = PaymentAttempt.query.filter_by(order_id=oid).count()
        bindings = CommerceReceiptBinding.query.filter_by(order_id=oid).count()
        assert attempts + bindings == 1
        try:
            with db.engine.begin() as conn:
                with Operations.context(MigrationContext.configure(conn)):
                    migration.downgrade()
        except RuntimeError as exc:
            assert 'External contract history exists' in str(exc)
        else:
            raise AssertionError('Populated external binding tables must not be dropped')


def verify_intake(app, migration):
    from datetime import datetime, timedelta, timezone
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from core.backend_engine.factory import db
    from packages.commerce.models import Order, PaymentAttempt
    from sites.Polaris_Parent.backend.commerce_models import CommerceExternalReceipt, CommerceIntakeEvent, CommerceEntitlement
    from sites.Polaris_Parent.backend.extensions.report_orders import intake

    app.config['COMMERCE_INTAKE_ENABLED'] = True
    with app.app_context():
        before = (Order.query.count(), PaymentAttempt.query.count(), CommerceEntitlement.query.count())
        channel = intake.save_channel(dict(channel='test-market', store_key='isolated', manual_import=True,
            policy_reference='test:policy', review_note='isolated test',
            valid_until=(datetime.now(timezone.utc) + timedelta(days=1)).isoformat()), 1)
        db.session.commit()
        data = dict(channel_id=channel.id, channel_revision=1, external_order_id='EXT-1', member_id=1,
                    amount=200, currency='TWD', lines=[dict(external_sku='test', quantity=2, unit_amount=100)])

    barrier = Barrier(2)
    def import_one():
        with app.app_context():
            barrier.wait(timeout=15)
            row, created = intake.import_receipt(data, 1)
            db.session.commit()
            return row.id, created
    with ThreadPoolExecutor(max_workers=2) as pool:
        imported = list(pool.map(lambda _: import_one(), range(2)))
    assert sorted(r[1] for r in imported) == [False, True], imported
    assert imported[0][0] == imported[1][0]
    with app.app_context():
        row = CommerceExternalReceipt.query.one()
        receipt_id = row.id
        review_data = dict(fingerprint=row.fingerprint, channel_revision=1, decision='verified',
                          note='test only', evidence_reference='test:receipt', payment_confirmed=True, ownership_confirmed=True)
    barrier = Barrier(2)
    def review_one():
        with app.app_context():
            # Both load pending before any channel/receipt lock.
            db.session.get(CommerceExternalReceipt, receipt_id)
            barrier.wait(timeout=15)
            _, changed = intake.review(receipt_id, review_data, 1)
            db.session.commit()
            return changed
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: review_one(), range(2)))
    assert sorted(results) == [False, True], results
    with app.app_context():
        assert CommerceExternalReceipt.query.count() == 1
        assert CommerceIntakeEvent.query.filter_by(event_type='receipt_verified').count() == 1
        assert (Order.query.count(), PaymentAttempt.query.count(), CommerceEntitlement.query.count()) == before
        try:
            with db.engine.begin() as conn:
                with Operations.context(MigrationContext.configure(conn)):
                    migration.downgrade()
        except RuntimeError as exc:
            assert 'External commerce evidence exists' in str(exc)
        else:
            raise AssertionError('Populated intake tables must not be dropped')


def verify_backfill(app):
    from core.backend_engine.factory import db
    from core.backend_engine.models import User
    from packages.commerce.models import Order, OrderItem
    from sites.Polaris_Parent.backend.models import ReportFulfillment
    from sites.Polaris_Parent.backend.commerce_models import CommerceEntitlement, CommerceTask, CommerceEvent
    from sites.Polaris_Parent.backend.extensions.report_orders import backfill, payment, delivery

    app.config.update(SECRET_KEY='isolated-backfill-test-only', COMMERCE_BACKFILL_ENABLED=True)
    with app.app_context():
        # Production User is a view over AppUser; the disposable schema uses a
        # regular table, so seed its matching identity explicitly for this check.
        db.session.add(User(id=1, username='test-only', email='test@example.test', password_hash='unused', role='admin'))
        db.session.commit()

    def seed(no):
        with app.app_context():
            order = Order(order_no=no, user_id=1, amount=1980, currency='TWD', status='pending', payment_method='manual')
            db.session.add(order)
            db.session.flush()
            item = OrderItem(order_id=order.id, item_no=no, product_code='natal-report-digital',
                             name='test', variant='digital', kind='purchase', unit_price=1980, quantity=1, currency='TWD')
            db.session.add(item)
            db.session.flush()
            db.session.add(ReportFulfillment(order_item_id=item.id, request_no=no, member_id=1))
            db.session.commit()
            payment.confirm_manual_payment(order, 1, 1980)  # Deliberately no finalize_order: legacy data.
            plan = backfill.review(order, 1)
            assert plan['decision'] == 'review_required', plan
            return order.id, item.id, plan['review_token']

    order_id, item_id, token = seed('legacy-parallel-backfill')
    barrier = Barrier(2)

    def convert():
        with app.app_context():
            order = db.session.get(Order, order_id)
            barrier.wait(timeout=15)
            try:
                changed = backfill.apply(order, 1, token, 'reviewed fixture', True)
                db.session.commit()
                return changed
            finally:
                db.session.remove()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: convert(), range(2)))
    assert sorted(results) == [False, True]
    with app.app_context():
        ent = CommerceEntitlement.query.filter_by(order_item_id=item_id).one()
        assert ent.status == 'in_use'
        assert CommerceTask.query.filter_by(entitlement_id=ent.id).count() == 1
        assert CommerceEvent.query.filter_by(order_id=order_id, event_type='order_backfilled').count() == 1

    order_id, item_id, token = seed('legacy-stale-fulfilment')
    loaded, converted = Event(), Event()

    def deliver_after_conversion():
        with app.app_context():
            item = db.session.get(OrderItem, item_id)
            assert not (item.order.attributes or {}).get('commerce_contract_version')
            loaded.set()
            assert converted.wait(timeout=15)
            with patch.object(delivery.private_storage, 'save', return_value=(20, 'test-only')):
                delivery.upload_report_pdf(item, 1, 'test.pdf', b'%PDF-test')

    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(deliver_after_conversion)
        assert loaded.wait(timeout=15)
        try:
            with app.app_context():
                assert backfill.apply(db.session.get(Order, order_id), 1, token, 'reviewed fixture', True)
                db.session.commit()
        finally:
            converted.set()
        future.result(timeout=15)
    with app.app_context():
        ent = CommerceEntitlement.query.filter_by(order_item_id=item_id).one()
        assert ent.status == 'completed'
        assert CommerceTask.query.filter_by(entitlement_id=ent.id).one().status == 'completed'
        db.session.remove()
        db.engine.dispose()


def main():
    binaries = Path(os.environ.get('PG_BIN', r'C:\Program Files\PostgreSQL\18\bin'))
    root = (SITE / '.test-tmp').resolve()
    root.mkdir(exist_ok=True)
    cluster = Path(tempfile.mkdtemp(prefix='commerce-pg-', dir=root)).resolve()
    assert cluster.parent == root
    data = cluster / 'data'
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0

    def run(binary, *args):
        print(f'Running {binary} ({args[-1]})', flush=True)
        # Windows postgres inherits handles; PIPE can stay open after pg_ctl exits.
        output = cluster / 'command.log'
        with output.open('w') as log:
            result = subprocess.run([str(binaries / binary), *map(str, args)],
                                    stdin=subprocess.DEVNULL, stdout=log, stderr=log,
                                    creationflags=flags, timeout=60)
        if result.returncode:
            raise RuntimeError(output.read_text(errors='replace'))

    started = False
    try:
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        run('initdb', '-D', data, '-U', 'commerce_test', '-A', 'trust', '--encoding=UTF8', '--locale=C')
        run('pg_ctl', '-D', data, '-l', cluster / 'server.log', '-o',
            f'-h 127.0.0.1 -p {port}', '-w', 'start')
        started = True
        verify(f'postgresql+psycopg://commerce_test@127.0.0.1:{port}/postgres')
    finally:
        if started or (data / 'postmaster.pid').exists():
            run('pg_ctl', '-D', data, '-m', 'immediate', '-w', 'stop')
        assert cluster.parent == root and cluster.name.startswith('commerce-pg-')
        shutil.rmtree(cluster)


if __name__ == '__main__':
    main()
