"""Install the reviewed receiver addition; never runs migrations or starts services."""
from pathlib import Path
here = Path(__file__).resolve().parent
root = Path('D:/P_Polaris_Parent/1_run')
route = root / 'PolarisUI/backend/routes/report_requests.py'
text = route.read_text(encoding='utf-8')
assert 'def _register_artifact(' not in text, 'already installed'
assert 'r.paid_at, r.created_at, r.updated_at, r.completed_at' in text
text = text.replace('r.paid_at, r.created_at, r.updated_at, r.completed_at',
                    'r.paid_at, r.created_at, r.updated_at, r.completed_at, r.artifact_revision')
text = text.replace('PDF 回傳官網是下一階段；目前編輯完成後仍由管理者在官網後台上傳 PDF，這裡只標記「已完成」。',
                    '完成後可登錄版本化最終 PDF，由官網管理者核對接收；保留官網人工上傳。')
text += (here / 'report_artifacts_remote.py.txt').read_text(encoding='utf-8')
compile(text, str(route), 'exec')
migration = root / 'P_Union/p12_sql/migrations/versions/20261029_0200_report_artifacts_0031.py'
assert not migration.exists()
migration.write_text((here / 'report_artifacts_migration.py.txt').read_text(encoding='utf-8'), encoding='utf-8')
route.write_text(text, encoding='utf-8')
print('Installed receiver routes and migration source; no database changes.')
