"""studio 發布請求 —— Facebook 粉專發文的資料表（還不連 Meta）

Revision ID: 0005_studio_publish_requests
Revises: 0004_studio_derivation

studio_document_media / studio_publish_requests / studio_publish_events。
表在 BLOG schema，名稱維持 studio_ 前綴。發布請求有自己的狀態，不改文件 stage。
"""
import os

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from packages.studio.social.state import EXTERNAL_ID_SQL, OPEN_STATE_SQL

revision = '0005_studio_publish_requests'
down_revision = '0004_studio_derivation'
branch_labels = None
depends_on = None

BLOG = os.environ.get('OWS_BLOG_SCHEMA') or None
MEDIA = 'media_lib'
_IDENTITY_MODE = (os.environ.get('OWS_IDENTITY_MODE') or 'local').strip().lower()
_EXTERNAL_USER_TABLE = os.environ.get('OWS_EXTERNAL_USER_TABLE') or 'account.app_users'

if _IDENTITY_MODE == 'external':
    USER_ID_TYPE = sa.BigInteger()
    USER_FK = f'{_EXTERNAL_USER_TABLE}.id'
else:
    USER_ID_TYPE = sa.Integer()
    USER_FK = None


def q(schema, rest):
    return f'{schema}.{rest}' if schema else rest


def ix(schema, rest):
    return f'ix_{schema}_{rest}' if schema else f'ix_{rest}'


def _user_fk():
    return USER_FK if USER_FK else q(BLOG, 'users.id')


def _can_reference_media(bind) -> bool:
    """空庫或沒有 media_lib REFERENCES 權限時，file_id 只留整數欄、不建外鍵。"""
    if bind.dialect.name != 'postgresql':
        return False
    try:
        ok = bind.execute(
            sa.text("SELECT has_schema_privilege(current_user, :s, 'USAGE')"), {'s': MEDIA},
        ).scalar()
        if not ok:
            return False
        exists = bind.execute(sa.text("SELECT to_regclass(:t)"), {'t': f'{MEDIA}.files'}).scalar()
        if not exists:
            return False
        return bool(bind.execute(
            sa.text("SELECT has_table_privilege(current_user, :t, 'REFERENCES')"),
            {'t': f'{MEDIA}.files'},
        ).scalar())
    except Exception:
        return False


def upgrade():
    bind = op.get_bind()
    JSONB = postgresql.JSONB(astext_type=sa.Text())
    media_fk = _can_reference_media(bind)
    user_fk = _user_fk()

    op.create_table(
        'studio_document_media',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('file_id', sa.Integer(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('alt_text', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ['document_id'], [q(BLOG, 'studio_documents.id')],
            ondelete='CASCADE', name='fk_studio_document_media_document_id',
        ),
        *([sa.ForeignKeyConstraint(
            ['file_id'], [f'{MEDIA}.files.id'],
            ondelete='RESTRICT', name='fk_studio_document_media_file_id',
        )] if media_fk else []),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('document_id', 'position', name='uq_studio_document_media_position'),
        schema=BLOG,
    )

    op.create_table(
        'studio_publish_requests',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('target', sa.String(length=30), nullable=False),
        sa.Column('target_ref', sa.String(length=64), nullable=True),
        sa.Column('state', sa.String(length=20), nullable=False),
        sa.Column('payload', JSONB, nullable=False),
        sa.Column('content_hash', sa.String(length=64), nullable=False),
        sa.Column('check_report', JSONB, nullable=True),
        sa.Column('checked_at', sa.DateTime(), nullable=True),
        sa.Column('submitted_by', USER_ID_TYPE, nullable=True),
        sa.Column('submitted_via', sa.String(length=10), nullable=False),
        sa.Column('external_id', sa.String(length=100), nullable=True),
        sa.Column('approved_by', USER_ID_TYPE, nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('approved_hash', sa.String(length=64), nullable=True),
        sa.Column('rejected_by', USER_ID_TYPE, nullable=True),
        sa.Column('rejected_reason', sa.Text(), nullable=True),
        sa.Column('mode', sa.String(length=10), nullable=False),
        sa.Column('attempt_started_at', sa.DateTime(), nullable=True),
        sa.Column('attempt_finished_at', sa.DateTime(), nullable=True),
        sa.Column('external_post_id', sa.String(length=100), nullable=True),
        sa.Column('external_url', sa.String(length=500), nullable=True),
        sa.Column('published_at', sa.DateTime(), nullable=True),
        sa.Column('scheduled_publish_time', sa.DateTime(), nullable=True),
        sa.Column('error_code', sa.String(length=40), nullable=True),
        sa.Column('error_subcode', sa.String(length=40), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('fbtrace_id', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ['document_id'], [q(BLOG, 'studio_documents.id')],
            ondelete='RESTRICT', name='fk_studio_publish_requests_document_id',
        ),
        sa.ForeignKeyConstraint(['submitted_by'], [user_fk], name='fk_studio_publish_requests_submitted_by'),
        sa.ForeignKeyConstraint(['approved_by'], [user_fk], name='fk_studio_publish_requests_approved_by'),
        sa.ForeignKeyConstraint(['rejected_by'], [user_fk], name='fk_studio_publish_requests_rejected_by'),
        sa.PrimaryKeyConstraint('id'),
        schema=BLOG,
    )
    op.create_index(ix(BLOG, 'studio_publish_requests_state'), 'studio_publish_requests', ['state'], schema=BLOG)
    op.create_index(
        ix(BLOG, 'studio_publish_requests_document_state'), 'studio_publish_requests',
        ['document_id', 'state'], schema=BLOG,
    )
    op.create_index(
        'uq_studio_publish_requests_open_document', 'studio_publish_requests', ['document_id'],
        unique=True, schema=BLOG,
        postgresql_where=sa.text(OPEN_STATE_SQL), sqlite_where=sa.text(OPEN_STATE_SQL),
    )
    op.create_index(
        'uq_studio_publish_requests_target_external', 'studio_publish_requests', ['target', 'external_id'],
        unique=True, schema=BLOG,
        postgresql_where=sa.text(EXTERNAL_ID_SQL), sqlite_where=sa.text(EXTERNAL_ID_SQL),
    )

    op.create_table(
        'studio_publish_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('request_id', sa.BigInteger(), nullable=False),
        sa.Column('event', sa.String(length=30), nullable=False),
        sa.Column('actor_id', USER_ID_TYPE, nullable=True),
        sa.Column('actor_via', sa.String(length=10), nullable=True),
        sa.Column('detail', JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ['request_id'], [q(BLOG, 'studio_publish_requests.id')],
            ondelete='CASCADE', name='fk_studio_publish_events_request_id',
        ),
        sa.ForeignKeyConstraint(['actor_id'], [user_fk], name='fk_studio_publish_events_actor_id'),
        sa.PrimaryKeyConstraint('id'),
        schema=BLOG,
    )
    op.create_index(
        ix(BLOG, 'studio_publish_events_request_id'), 'studio_publish_events', ['request_id'], schema=BLOG,
    )


def downgrade():
    op.drop_table('studio_publish_events', schema=BLOG)
    op.drop_table('studio_publish_requests', schema=BLOG)
    op.drop_table('studio_document_media', schema=BLOG)
