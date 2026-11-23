"""Real localhost HTTP acceptance; no mocks. Credentials/results stay in ignored storage."""
import hashlib
import json
import os
from pathlib import Path
import secrets
import sys
import requests

SITE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SITE.parents[1]))
CREDS = SITE / '.local-private/acceptance.json'
c = json.loads(CREDS.read_text(encoding='utf-8'))
OWS = 'http://127.0.0.1:5000/api/v1'
POL = 'http://127.0.0.1:9000'
evidence = []


def check(label, r, expected=200):
    evidence.append({'check': label, 'status': r.status_code, 'expected': expected})
    (SITE / '.test-tmp/fulfilment-http-results.json').write_text(json.dumps(evidence, indent=2), encoding='utf-8')
    if r.status_code != expected:
        raise AssertionError(f'{label}: HTTP {r.status_code}; {r.text[:700]}')
    print(label, r.status_code, flush=True)
    return r.json() if 'application/json' in r.headers.get('Content-Type', '') else r.content


def login_site(username, password):
    session = requests.Session()
    check('website login', session.post(OWS + '/auth/login', json=dict(username=username, password=password), timeout=20))
    session.headers['X-CSRF-TOKEN'] = session.cookies.get('csrf_access_token', '')
    return session


admin = login_site(c['admin'], c['password'])
pol = requests.Session()
token = check('production login', pol.post(POL + '/auth/login', json=dict(username=c['admin'], password=c['password']), timeout=20))
pol.headers['Authorization'] = 'Bearer ' + token['access_token']

if 'order_no' not in c:
    body = dict(source='direct', external_order_id='ACCEPTANCE-' + c['run'], currency='TWD', amount='0',
                language='zh-TW', customer={'display_name': '系統驗收-' + c['run'], 'contact_note': '本機測試，非實際客戶'},
                order=dict(variant='digital', subject_name='系統驗收', gender='女', relation_label='self',
                    birth={'date': '2000-01-02', 'time': '12:00', 'time_type': 'clock_time'},
                    place={'manual': True, 'lat': 25.033, 'lon': 121.5654, 'tz': 'Asia/Taipei', 'city': 'Taipei', 'country': 'TW'},
                    audience={'reader': '命主本人', 'call_name': '驗收', 'dedication': '本機交接驗收'}))
    result = check('create acceptance gift order', admin.post(OWS + '/admin/proxy-orders', json=body, timeout=90), 201)
    c['order_no'] = result['order_no']
    CREDS.write_text(json.dumps(c), encoding='utf-8')

# Only fixture identity/environment setup uses the local app. All handoff,
# state transitions, registration, delivery and downloads go through real HTTP.
os.environ['FLASK_SKIP_DOTENV'] = '1'
os.environ['REPORT_JOBS_ENABLED'] = 'false'
from sites.Polaris_Parent.backend.app import app
from core.backend_engine.factory import db
from core.backend_engine.models import User
from packages.commerce.models import Order, OrderItem, OrderNotification
from sites.Polaris_Parent.backend.models import ReportFulfillment, ReportDocument
from sites.Polaris_Parent.backend.extensions.report_orders import control
with app.app_context():
    assert db.engine.url.host in ('localhost', '127.0.0.1')
    order = Order.query.filter_by(order_no=c['order_no']).one()
    assert order.amount == 0
    item = next(i for i in order.order_items if i.kind == 'purchase')
    assert item.customization['subject_name'] == '系統驗收'
    f = ReportFulfillment.query.filter_by(order_item_id=item.id).one()
    if f.handoff_status != 'sent':
        f.environment = 'test'
    assert f.environment == 'test'
    c.update(order_id=order.id, request_no=f.request_no)
    user = db.session.get(User, order.user_id)
    assert user.username.endswith('.invalid')
    if 'member_password' not in c:
        c.update(member=user.username, member_password=secrets.token_urlsafe(24) + 'Aa1!')
        user.set_password(c['member_password'])
    db.session.commit()
    CREDS.write_text(json.dumps(c), encoding='utf-8')

order_path = OWS + '/admin/report-orders/' + c['order_no']
request_path = POL + '/report-requests/' + c['request_no']
member = login_site(c['member'], c['member_password'])
check('unauthenticated artifact rejected', requests.get(order_path + '/production-artifact', timeout=20), 401)
check('member cannot import', member.post(order_path + '/production-artifact', json={}, timeout=20), 403)
check('service credential required', requests.get(POL + '/public/report-requests/' + c['request_no'] + '/artifact', timeout=20), 403)
check('real website handoff', admin.post(order_path + '/handoff', json={}, timeout=60))
check('production claim', pol.post(request_path + '/claim', json={}, timeout=30))
check('production completed', pol.patch(request_path, json={'status': 'completed'}, timeout=30))
check('real progress synchronization', admin.post(order_path + '/production-sync', json={}, timeout=30))


def pdf(version):
    # Minimal valid one-page PDF with deterministic bytes and visible acceptance text.
    stream = f'BT /F1 18 Tf 50 750 Td (Local acceptance version {version}) Tj ET'.encode()
    objects = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        b'<< /Length ' + str(len(stream)).encode() + b' >>\nstream\n' + stream + b'\nendstream']
    data = b'%PDF-1.4\n'; offsets = []
    for i, obj in enumerate(objects, 1):
        offsets.append(len(data)); data += f'{i} 0 obj\n'.encode() + obj + b'\nendobj\n'
    xref = len(data)
    data += b'xref\n0 6\n0000000000 65535 f \n' + b''.join(f'{n:010} 00000 n \n'.encode() for n in offsets)
    return data + f'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()


def register(version):
    listing = check('read production work request', pol.get(POL + '/report-requests', params={'status':'all','env':'test','language':'all'}, timeout=30))
    row = next(r for r in listing['requests'] if r['request_no'] == c['request_no'])
    data = pdf(version)
    result = check('register PDF ' + str(version), pol.post(request_path + '/artifact',
        data={'expected_revision': row['artifact_revision'], 'source_updated_at': row['updated_at']},
        files={'file': (f'acceptance-v{version}.pdf', data, 'application/pdf')}, timeout=30))
    return data, result['artifact']


def offer():
    result = check('website queries manifest', admin.get(order_path + '/production-artifact', timeout=30))
    return {k: result['artifact'][k] for k in ('version','sha256')} | {'current_document_id': result['current_document_id']}


data1, m1 = register(1)
selected = offer()
check('wrong version refused', admin.post(order_path + '/production-artifact', json={**selected,'version':999}, timeout=30), 409)
first = check('receive and deliver PDF', admin.post(order_path + '/production-artifact', json=selected, timeout=30))
assert first['first_time'] and not first['duplicate']
repeat = check('duplicate delivery', admin.post(order_path + '/production-artifact', json=selected, timeout=30))
assert repeat['duplicate'] and repeat['document']['id'] == first['document']['id']
member_path = OWS + '/report-orders/' + c['order_no']
link = check('member download link', member.post(member_path + '/report-pdf/link', json={}, timeout=20))['url']
download = check('member PDF download', member.get(link, timeout=30))
assert hashlib.sha256(download).hexdigest() == m1['sha256']
print('download SHA-256 verified', flush=True)

check('pause order', admin.post(order_path + '/fulfilment-control', json={'desired':'paused','reason':'本機驗收暫停','revision':0}, timeout=20))
with app.app_context():
    assert control.sync_one(c['order_id'])  # exact worker implementation, real HTTP, only this fixture
check('paused receive blocked', admin.post(order_path + '/production-artifact', json=selected, timeout=30), 409)
check('paused editor transition blocked', pol.patch(request_path, json={'status':'in_progress'}, timeout=30), 409)
check('resume order', admin.post(order_path + '/fulfilment-control', json={'desired':'active','reason':'本機驗收恢復','revision':1}, timeout=20))
with app.app_context():
    assert control.sync_one(c['order_id'])
data2, m2 = register(2)
check('old selection rejected', admin.post(order_path + '/production-artifact', json=selected, timeout=30), 409)
second = check('receive correction', admin.post(order_path + '/production-artifact', json=offer(), timeout=30))
assert not second['first_time'] and second['document']['id'] != first['document']['id']
check('old download revoked', member.get(link, timeout=20), 404)
link2 = check('new member download link', member.post(member_path + '/report-pdf/link', json={}, timeout=20))['url']
assert hashlib.sha256(check('new PDF download', member.get(link2, timeout=20))).hexdigest() == m2['sha256']
with app.app_context():
    docs = ReportDocument.query.join(OrderItem).filter(OrderItem.order_id == c['order_id']).all()
    assert len(docs) == 2 and sum(bool(d.is_current) for d in docs) == 1
    notices = OrderNotification.query.filter_by(order_id=c['order_id'], event='report_ready').all()
    assert len(notices) == 1 and notices[0].status == 'skipped'
print('PASS: real local two-service acceptance; order', c['order_no'], flush=True)
