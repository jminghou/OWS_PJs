"""Produce scoped deployment trees without changing either working tree."""
from pathlib import Path
import io, json, shutil, subprocess, zipfile
SITE = Path(__file__).resolve().parents[1]
OWS = SITE.parents[1]
REMOTE = Path('D:/P_Polaris_Parent/1_run')
OUT = SITE / '.test-tmp/cloud-release-20261029'

def snapshot(repo, revision, name):
    target = OUT / name
    assert not target.exists(), 'Refusing to overwrite existing release'
    data = subprocess.check_output(['git', '-C', str(repo), 'archive', '--format=zip', revision])
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        archive.extractall(target)
    return target

def copy(repo, target, path):
    dest = target / path
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(repo / path, dest)

OUT.mkdir(parents=True, exist_ok=True)
web = snapshot(OWS, '21135b37045af45bfb23f2ae423e8d9fdcae5118', 'ows')
remote = snapshot(REMOTE, '105571002c59b98b316124e6ce77b668f9a3a7a8', 'polaris')
base = 'sites/Polaris_Parent/'
files = [base+'backend/extensions/report_orders/'+f+'.py' for f in (
    '__init__','audit','commerce','delivery','handoff','intake','jobs','notify','overview','proofs','proxy','service',
    'artifacts','control','notification_gate','progress')]
files += [base+'frontend/src/'+p for p in (
    'app/(public)/report/orders/[order_no]/page.tsx','app/admin/report-deliveries/page.tsx',
    'app/admin/report-orders/[orderNo]/page.tsx','lib/api/reportOrders.ts','components/admin/FulfilmentControlPanel.tsx')]
for f in files:
    copy(OWS, web, f)
remote_files = ['PolarisUI/backend/routes/report_requests.py', 'PolarisUI/frontend/src/app/orders/page.tsx',
    'P_Union/p12_sql/migrations/versions/20261029_0100_fulfilment_controls_0030.py',
    'P_Union/p12_sql/migrations/versions/20261029_0200_report_artifacts_0031.py']
for f in remote_files:
    copy(REMOTE, remote, f)
# api.ts also contains unrelated book changes. Include only the artifact contract.
api_path = 'PolarisUI/frontend/src/lib/api.ts'
api = (remote / api_path).read_text(encoding='utf-8')
assert 'artifact_revision: number;' not in api
api = api.replace('export interface ReportRequest {', 'export interface ReportRequest {\n  artifact_revision: number;')
working = (REMOTE / api_path).read_text(encoding='utf-8')
api += '\n\n' + working[working.index('export async function uploadReportArtifact('):]
(remote / api_path).write_text(api, encoding='utf-8')
record = {'ows_base': '21135b37045af45bfb23f2ae423e8d9fdcae5118',
    'polaris_base': '105571002c59b98b316124e6ce77b668f9a3a7a8', 'ows_files': files,
    'polaris_files': remote_files+[api_path]}
(OUT / 'scope.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
print(json.dumps({'prepared': str(OUT), 'website_files':len(files),'production_files':len(remote_files)+1}))
