"""newsletter baseline —— 電子報訂閱者資料表（選用模組）

Revision ID: 0001_newsletter_baseline
Revises:

管理範圍：newsletter_subscribers（BLOG schema，表名 newsletter_ 前綴）。沒有任何外鍵，
與其他鏈的先後只是慣例：core 鏈 → commerce 鏈 → studio 鏈 → **newsletter 鏈** → 站台鏈。

冪等：偵測到表已存在就跳過、只記錄版本（版本表 alembic_version_newsletter）。
"""
import os

from alembic import op
import sqlalchemy as sa

revision = '0001_newsletter_baseline'
down_revision = None
branch_labels = None
depends_on = None

BLOG = os.environ.get('OWS_BLOG_SCHEMA') or None
TABLE = 'newsletter_subscribers'


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
    sa.Column('email', sa.String(length=254), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('token', sa.String(length=64), nullable=False),
    sa.Column('locale', sa.String(length=10), nullable=True),
    sa.Column('source', sa.String(length=50), nullable=True),
    sa.Column('consent_at', sa.DateTime(), nullable=True),
    sa.Column('consent_ip', sa.String(length=45), nullable=True),
    sa.Column('consent_user_agent', sa.String(length=255), nullable=True),
    sa.Column('confirm_sent_at', sa.DateTime(), nullable=True),
    sa.Column('confirmed_at', sa.DateTime(), nullable=True),
    sa.Column('confirmed_ip', sa.String(length=45), nullable=True),
    sa.Column('unsubscribed_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    schema=BLOG
    )
    with op.batch_alter_table(TABLE, schema=BLOG) as batch_op:
        batch_op.create_index(ix(BLOG, 'newsletter_subscribers_email'), ['email'], unique=True)
        batch_op.create_index(ix(BLOG, 'newsletter_subscribers_token'), ['token'], unique=True)
        batch_op.create_index(ix(BLOG, 'newsletter_subscribers_status'), ['status'], unique=False)


def downgrade():
    if TABLE in sa.inspect(op.get_bind()).get_table_names(schema=BLOG):
        op.drop_table(TABLE, schema=BLOG)
