"""media_lib tables（內容已移交 core 鏈）

Revision ID: 0003_media_lib
Revises: 0002_member_commerce_loop

**本 migration 的內容已移交 core/migrations（共用平台鏈）。**

原本這裡建立 media_lib schema 的 6 張媒體庫表。P5-C 把平台資料表抽成一條所有站台共用的鏈
（core/migrations，版本表 alembic_version_core），core 改一次就寫一份 migration，
不再每個站台各手寫一份、各自漂移。

這個 revision 保留為空操作，不刪除 —— 正式資料庫已經 stamp 在這條鏈上，
刪掉會讓它的版本歷史斷掉。從零建置時平台表由 core 鏈建立，這裡不做事。

部署順序（見 docs/MIGRATIONS.md）：先跑 core 鏈，再跑站台鏈。
"""
from alembic import op  # noqa: F401
import sqlalchemy as sa  # noqa: F401

revision = '0003_media_lib'
down_revision = '0002_member_commerce_loop'
branch_labels = None
depends_on = None


def upgrade():
    """平台表由 core/migrations 建立，這裡不做事。"""


def downgrade():
    """同上。"""
