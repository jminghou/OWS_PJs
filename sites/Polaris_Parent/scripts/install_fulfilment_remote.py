"""Apply the reviewed receiver change to the adjacent Polaris checkout only.
Does not run migrations, start services or access a database.
"""
from pathlib import Path

ROOT = Path('D:/P_Polaris_Parent/1_run')
route = ROOT / 'PolarisUI/backend/routes/report_requests.py'
source = route.read_text(encoding='utf-8')
assert 'class FulfilmentControl' not in source, 'Receiver already installed'

source = source.replace('SELECT id, status, assigned_to FROM {T.REPORT_REQUESTS} WHERE request_no = :n FOR UPDATE',
'''SELECT r.id, r.status, r.assigned_to FROM {T.REPORT_REQUESTS} r
            JOIN account.report_request_controls c ON c.request_no = r.request_no
            WHERE r.request_no = :n AND c.desired = 'active' FOR UPDATE OF r, c''')
needle = '    out["status_label"] = STATUS_LABELS.get(out.get("status"), out.get("status"))'
assert needle in source
source = source.replace(needle, needle + '''
    controls = _query("SELECT revision, desired, reason FROM account.report_request_controls WHERE request_no = :n",
                      {"n": row["request_no"]}).data
    out["control"] = controls[0] if controls else {"revision": 0, "desired": "paused", "reason": "缺少履約控制資料"}
    if out["control"]["desired"] == "paused":
        out["status_label"] = "履約暫停"
''')
source = source.replace('    return out\n\n\n# ── 異動', '''    if out["control"]["desired"] == "paused":
        out["can_edit"] = out["can_claim"] = False
    return out


# ── 異動''')
needle = '    row = _get(req.request_no)'
assert needle in source
# Seed before inserting the work order so every visible work order has a control row.
start = '    res = _write(\n        f"""\n        INSERT INTO {T.REPORT_REQUESTS}'
assert start in source
source = source.replace(start, '''    _write("INSERT INTO account.report_request_controls (request_no, order_no, revision, desired, reason) "
           "VALUES (:n, :o, 0, 'active', '') ON CONFLICT (request_no) DO NOTHING",
           {"n": req.request_no, "o": req.order_no})
''' + start)
source += '''


class FulfilmentControl(BaseModel):
    revision: int = Field(..., ge=1)
    desired: Literal["paused", "active"]
    reason: str = Field(..., min_length=1, max_length=1000)
    order_no: str = Field(..., min_length=1, max_length=40)


@router.post("/{request_no}/control")
def set_fulfilment_control(request_no: str, body: FulfilmentControl):
    if not 1 <= len(request_no) <= 32:
        raise HTTPException(status_code=400, detail="工作單編號格式錯誤")
    # A tombstone may precede the create request. Older retries cannot erase it.
    _write("""
        WITH changed AS (
            INSERT INTO account.report_request_controls (request_no, order_no, revision, desired, reason)
            VALUES (:n, :o, :v, :d, :r)
            ON CONFLICT (request_no) DO UPDATE SET revision = EXCLUDED.revision,
                desired = EXCLUDED.desired, reason = EXCLUDED.reason, updated_at = now()
            WHERE report_request_controls.revision < EXCLUDED.revision
              AND report_request_controls.order_no = EXCLUDED.order_no
            RETURNING *
        )
        INSERT INTO account.report_request_control_events (request_no, revision, desired, reason)
        SELECT request_no, revision, desired, reason FROM changed
        """, {"n": request_no, "o": body.order_no, "v": body.revision, "d": body.desired, "r": body.reason})
    row = _query("SELECT revision, desired, order_no FROM account.report_request_controls WHERE request_no = :n",
                 {"n": request_no}).data[0]
    if row["order_no"] != body.order_no or row["revision"] != body.revision or row["desired"] != body.desired:
        raise HTTPException(status_code=409, detail="履約控制版本或訂單不符")
    return {"control": {"revision": row["revision"], "desired": row["desired"]}}
'''
compile(source, str(route), 'exec')
migration = ROOT / 'P_Union/p12_sql/migrations/versions/20261029_0100_fulfilment_controls_0030.py'
assert not migration.exists()
migration.write_text('''"""Versioned order controls, including controls received before work creation."""
from alembic import op
import sqlalchemy as sa
revision = '0030_fulfilment_controls'
down_revision = '0029_ziwei_terms'
branch_labels = None
depends_on = None

def upgrade():
    op.execute("""CREATE TABLE account.report_request_controls (
        request_no varchar(32) PRIMARY KEY, order_no varchar(40) NOT NULL,
        revision integer NOT NULL CHECK (revision >= 0),
        desired varchar(10) NOT NULL CHECK (desired IN ('active','paused')),
        reason text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())""")
    op.execute("""CREATE TABLE account.report_request_control_events (
        request_no varchar(32) NOT NULL, revision integer NOT NULL,
        desired varchar(10) NOT NULL, reason text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (request_no, revision))""")
    op.execute("""INSERT INTO account.report_request_controls (request_no, order_no, revision, desired, reason)
        SELECT request_no, COALESCE(order_no, ''), 0, 'active', '' FROM account.report_requests""")

def downgrade():
    if op.get_bind().execute(sa.text('SELECT EXISTS (SELECT 1 FROM account.report_request_control_events)')).scalar():
        raise RuntimeError('Cannot discard recorded fulfilment controls')
    op.drop_table('report_request_control_events', schema='account')
    op.drop_table('report_request_controls', schema='account')
''', encoding='utf-8')
route.write_text(source, encoding='utf-8')
print('Updated receiver and added unapplied migration 0030; no database accessed.')
