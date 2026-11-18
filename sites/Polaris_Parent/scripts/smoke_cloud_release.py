"""Read-only checks of production URLs and authorization boundaries."""
import json, requests
from pathlib import Path
checks = [
    ('website', 'https://www.polaris-parent.com', 200),
    ('website API health','https://api.polaris-parent.com/health',200),
    ('production API health','https://polarisrun-production.up.railway.app/health',200),
    ('artifact authentication','https://api.polaris-parent.com/api/v1/admin/report-orders/DEPLOY-PROBE/production-artifact',401),
    ('production service authentication','https://polarisrun-production.up.railway.app/public/report-requests/DEPLOY-PROBE/artifact',403),
]
results = []
for label, url, expected in checks:
    try:
        r = requests.get(url, timeout=30)
        results.append({'check':label,'url':url,'expected':expected,'actual':r.status_code,'pass':r.status_code==expected})
    except requests.RequestException:
        results.append({'check':label,'url':url,'pass':False,'error':'connection failed'})
out = Path(__file__).resolve().parents[1]/'.test-tmp/cloud-release-20261029/smoke.json'
out.write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results,indent=2))
raise SystemExit(0 if all(r['pass'] for r in results) else 1)
