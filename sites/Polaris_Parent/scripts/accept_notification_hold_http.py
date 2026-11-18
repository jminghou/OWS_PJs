"""Real HTTP resend refusal for a dedicated local fixture; never sends mail."""
import json
import os
from pathlib import Path
import sys
import requests
from datetime import datetime, timedelta
SITE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SITE.parents[1]))
c = json.loads((SITE / '.local-private/acceptance.json').read_text())
os.environ['REPORT_JOBS_ENABLED'] = 'false'
os.environ['FLASK_SKIP_DOTENV'] = '1'
from sites.Polaris_Parent.backend.app import app
from core.backend_engine.factory import db
from packages.commerce.models import Order, OrderNotification
from sites.Polaris_Parent.backend.models import ReportMailOutbox
from sites.Polaris_Parent.backend.extensions.report_orders import control

s = requests.Session()
base = 'http://127.0.0.1:5000/api/v1'
r = s.post(base + '/auth/login', json={'username':c['admin'], 'password':c['password']}, timeout=20)
assert r.status_code == 200
s.headers['X-CSRF-TOKEN'] = s.cookies.get('csrf_access_token', '')
order_url = base + '/admin/report-orders/' + c['order_no']
with app.app_context():
    assert db.engine.url.host in ('localhost', '127.0.0.1')
    order = db.session.get(Order, c['order_id'])
    revision = control.view(order)['revision']
r = s.post(order_url + '/fulfilment-control', json={'desired':'paused','reason':'通知出站驗收','revision':revision}, timeout=20)
assert r.status_code == 200
with app.app_context():
    order = db.session.get(Order, c['order_id'])
    note = OrderNotification(order_id=order.id, event='report_ready', dedupe_key='acceptance-hold:' + c['run'],
        recipient=c['member'], status='pending', attempts=0)
    db.session.add(note)
    db.session.flush()
    box = ReportMailOutbox(notification_id=note.id, subject='Local acceptance only', body='Never send this fixture',
                           next_attempt_at=datetime.utcnow() + timedelta(days=365))
    db.session.add(box)
    db.session.commit()
    nid = note.id
try:
    r = s.post(base + f'/admin/report-notifications/{nid}/resend', timeout=20)
    assert r.status_code == 409, (r.status_code, r.text[:200])
    assert r.json()['code'] == 'notification_held'
    with app.app_context():
        note = db.session.get(OrderNotification, nid)
        assert note.status == 'pending' and note.attempts == 0 and note.sent_at is None
    print('PASS: real resend API 409, notification deferred, zero SMTP attempts')
finally:
    # This synthetic outbox row must never become eligible for a later send.
    with app.app_context():
        note = db.session.get(OrderNotification, nid)
        note.status, note.error = 'skipped', '本機驗收已結束，不寄送'
        box = ReportMailOutbox.query.filter_by(notification_id=nid).one()
        box.body, box.next_attempt_at = None, None
        db.session.commit()
    r = s.post(order_url + '/fulfilment-control', json={'desired':'active','reason':'通知驗收結束','revision':revision+1}, timeout=20)
    assert r.status_code == 200
    with app.app_context():
        assert control.sync_one(c['order_id'])
