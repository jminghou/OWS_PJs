"""social auth baseline —— 社群帳號連結表（選用模組）

Revision ID: 0001_social_auth_baseline
Revises:

管理範圍：social_auth_identities（BLOG schema，表名 social_auth_ 前綴）。沒有任何外鍵，
與其他鏈的先後只是慣例：core 鏈 → commerce 鏈 → studio 鏈 → newsletter 鏈 → **social_auth 鏈** → 站台鏈。

冪等：偵測到表已存在就跳過、只記錄版本（版本表 alembic_version_social_auth）。
"""
import os

from alembic import op
import sqlalchemy as sa

revision = '0001_social_auth_baseline'
down_revision = None
branch_labels = None
depends_on = None

BLOG = os.environ.get('OWS_BLOG_SCHEMA') or None
TABLE = 'social_auth_identities'


def ix(schema, rest):
    return f'ix_{schema}_{rest}' if schema else f'ix_{rest}'


def upgrade():
    bind = op.get_bind()
    # 正式庫用的是受限帳號（blog_app）：即使 schema 已存在，CREATE SCHEMA IF NOT EXISTS 仍需要
    # 資料庫層級的 CREATE 權限而失敗。所以先查 pg_namespace，真的不存在才建。
    if BLOG and not bind.execute(sa.text('SELECT 1 FROM pg_namespace WHERE nspname = :n'), {'n': BLOG}).scalar():
        op.execute(f'CREATE SCHEMA {BLOG}')
    if TABLE in sa.inspect(bind).get_table_names(schema=BLOG):
        return

    op.create_table(TABLE,
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('provider', sa.String(length=20), nullable=False),
    sa.Column('subject', sa.String(length=255), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=True),
    sa.Column('display_name', sa.String(length=255), nullable=True),
    sa.Column('picture_url', sa.String(length=1000), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('last_login_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('provider', 'subject', name='uq_social_auth_identities_provider_subject'),
    sa.UniqueConstraint('user_id', 'provider', name='uq_social_auth_identities_user_provider'),
    schema=BLOG
    )
    with op.batch_alter_table(TABLE, schema=BLOG) as batch_op:
        batch_op.create_index(ix(BLOG, 'social_auth_identities_user_id'), ['user_id'], unique=False)


def downgrade():
    if TABLE in sa.inspect(op.get_bind()).get_table_names(schema=BLOG):
        op.drop_table(TABLE, schema=BLOG)
