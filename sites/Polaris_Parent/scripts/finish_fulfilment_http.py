"""Resume real HTTP acceptance after the intentional burst hit the existing limiter."""
import hashlib
import json
from pathlib import Path
import requests

SITE = Path(__file__).resolve().parents[1]
c = json.loads((SITE / '.local-private/acceptance.json').read_text())
OWS = 'http://127.0.0.1:5000/api/v1'
POL = 'http://127.0.0.1:9000'
results_path = SITE / '.test-tmp/fulfilment-http-results.json'
results = json.loads(results_path.read_text())


def check(label, r, status=200):
    results.append(dict(check=label, status=r.status_code, expected=status))
    results_path.write_text(json.dumps(results, indent=2), encoding='utf-8')
    assert r.status_code == status, f'{label}: {r.status_code}: {r.text[:500]}'
    print(label, r.status_code, flush=True)
    return r.json() if 'application/json' in r.headers.get('Content-Type', '') else r.content


def login(username, password):
    s = requests.Session()
    check('resume website login', s.post(OWS + '/auth/login', json=dict(username=username, password=password), timeout=20))
    s.headers['X-CSRF-TOKEN'] = s.cookies.get('csrf_access_token', '')
    return s


admin = login(c['admin'], c['password'])
member = login(c['member'], c['member_password'])
pol = requests.Session()
r = check('resume production login', pol.post(POL + '/auth/login', json=dict(username=c['admin'], password=c['password']), timeout=20))
pol.headers['Authorization'] = 'Bearer ' + r['access_token']
base = OWS + '/admin/report-orders/' + c['order_no']
member_base = OWS + '/report-orders/' + c['order_no']
old_link = check('current member link', member.post(member_base + '/report-pdf/link', json={}, timeout=20))['url']
offered = check('query correction after limiter window', admin.get(base + '/production-artifact', timeout=30))
m = offered['artifact']
assert m['version'] == 2
selection = {'version':m['version'], 'sha256':m['sha256'], 'current_document_id':offered['current_document_id']}
second = check('receive corrected PDF', admin.post(base + '/production-artifact', json=selection, timeout=30))
assert not second['first_time'] and not second['duplicate']
check('previous download revoked', member.get(old_link, timeout=20), 404)
new_link = check('corrected member link', member.post(member_base + '/report-pdf/link', json={}, timeout=20))['url']
data = check('corrected member PDF', member.get(new_link, timeout=20))
assert hashlib.sha256(data).hexdigest() == m['sha256']
manual = check('manual fallback upload', admin.post(base + '/report-pdf', files={'file':('manual-acceptance.pdf',data+b'\n% manual correction', 'application/pdf')}, timeout=30))
check('remote duplicate cannot undo manual correction', admin.post(base + '/production-artifact', json={**selection,'current_document_id':manual['document']['id']}, timeout=30), 409)
req = POL + '/report-requests/' + c['request_no']
check('reopen production request', pol.patch(req, json={'status':'in_progress'}, timeout=20))
check('reopened artifact unavailable', admin.get(base + '/production-artifact', timeout=30), 502)
check('complete production again', pol.patch(req, json={'status':'completed'}, timeout=20))
check('old source remains unavailable until re-registration', admin.get(base + '/production-artifact', timeout=30), 502)
print('PASS real HTTP correction, member bytes, manual fallback and reopen boundaries:', c['order_no'])
