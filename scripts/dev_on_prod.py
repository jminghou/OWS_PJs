#!/usr/bin/env python3
"""
本機後端直接連 Railway 正式資料庫（做法一：只有一份資料，不做同步）。

用法（在 repo 根目錄、已 `railway link` 到 graceful-dream / polaris-backend）：

    railway run -- python scripts/dev_on_prod.py            # 起本機後端（port 5000）
    railway run -- python scripts/dev_on_prod.py --check    # 只印連到哪、不啟動
    railway run -- python scripts/dev_on_prod.py --upgrade packages/studio/migrations   # 對正式庫跑某條鏈

`railway run` 會把正式服務的環境變數（DATABASE_URL、JWT_SECRET_KEY、REDIS_URL…）注入這個行程，
**密碼不落地**，也不需要在本機 .env 放正式庫連線字串。

這支腳本只做三件事，其餘照正式設定：
  1. FLASK_CONFIG 改 development —— 本機是 http://localhost，production 設定會強制 Secure cookie，登不進去
  2. CORS_ORIGINS 改成本機前端 —— 正式值是 polaris-parent.com，瀏覽器在 localhost 會被擋
  3. OWS_IDENTITY_MODE=external —— 正式庫的 blog.users 是指向 account.app_users 的 view，
     建表／FK 必須指向 account.app_users（與 scripts/check_schema_drift.py 的 Polaris 設定一致）

注意：這樣跑的後台寫入的**就是正式資料**。文章「儲存到文章／發布」會立刻反映在正式站。
"""
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(REPO)
sys.path.insert(0, REPO)

if not os.environ.get('DATABASE_URL'):
    print('沒有 DATABASE_URL —— 請透過 `railway run -- python scripts/dev_on_prod.py` 執行，'
          '並確認已 `railway link -p graceful-dream -e production -s polaris-backend`。')
    sys.exit(1)

os.environ['FLASK_CONFIG'] = 'development'
os.environ['CORS_ORIGINS'] = os.environ.get('LOCAL_CORS_ORIGINS', 'http://localhost:3000,http://localhost:3001')
os.environ.setdefault('OWS_IDENTITY_MODE', 'external')
os.environ.setdefault('OWS_CORE_UNMANAGED_TABLES', 'users,roles,permissions,role_permissions,user_roles,member_profiles')
os.environ.setdefault('JWT_COOKIE_SECURE', 'false')
os.environ.setdefault('SESSION_COOKIE_SECURE', 'false')
os.environ.pop('DB_URL_OVERRIDE', None)   # 本機 shell 若殘留本機庫的覆蓋值，這裡一律以 railway 注入的為準

from sites.Polaris_Parent.backend.app import app  # noqa: E402

host = app.config['SQLALCHEMY_DATABASE_URI'].split('@')[-1]
print(f'[dev_on_prod] 資料庫：{host}（正式庫，寫入即生效）')
print(f"[dev_on_prod] schema：blog={os.environ.get('OWS_BLOG_SCHEMA')} shop={os.environ.get('OWS_SHOP_SCHEMA')} "
      f"identity={os.environ.get('OWS_IDENTITY_MODE')} studio={app.config.get('STUDIO_ENABLED')}")

args = sys.argv[1:]
if args[:1] == ['--check']:
    sys.exit(0)

if args[:1] == ['--upgrade']:
    directory = args[1] if len(args) > 1 else 'core/migrations'
    from flask_migrate import Migrate, upgrade, current as show_current
    Migrate(app, app.extensions['sqlalchemy'], directory=os.path.join(REPO, directory))
    with app.app_context():
        print(f'[dev_on_prod] 對正式庫跑 migration 鏈：{directory}')
        upgrade()
        show_current()
    sys.exit(0)

port = int(os.environ.get('LOCAL_PORT', '5000'))
print(f'[dev_on_prod] 後端啟動於 http://127.0.0.1:{port}（Ctrl+C 結束）')
app.run(host='127.0.0.1', port=port, debug=False, use_reloader=False)
