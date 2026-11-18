"""
Social Auth 模組（選用）—— 用 Google／LINE 等社群帳號註冊與登入會員。

掛載由 core factory 的 OPTIONAL_MODULES 依 SOCIAL_AUTH_ENABLED 決定，預設**關閉**。
Polaris 的 config 明確開啟；Happy_Wu、Claire 要用時打開開關、設 provider 環境變數即可。
（core 另有一個 MEMBER_AUTH_ENABLED，管的是 core 的 Email 註冊端點，與本模組無關。）

規則（規劃：sites/Polaris_Parent/docs/google-sign-in-plan.md）：
- 鑰匙是 (provider, sub)，信箱只在第一次連結時用來找既有會員。
- 只有 Google＋@gmail.com 或帶 hd（Workspace）的信箱會自動連結既有會員；其他情況回 409
  needs_link，請對方先用密碼登入。
- 社群註冊的會員沒有可用密碼（User.set_unusable_password），之後可走重設密碼補設。
- 大頭貼存 provider 的網址到 User.avatar，每次登入更新；會員自己上傳過（avatar_source=upload）就不覆蓋。

站台差異用 hooks（packages/social_auth/hooks.py），例如 Polaris 要寫「信箱已驗證」紀錄。

provider 設定（站台 config 或環境變數）：
    GOOGLE_CLIENT_ID          沒設 → Google 不出現在 /providers、端點回 404
    SOCIAL_AUTH_DEFAULT_ROLE  社群註冊的會員角色，預設 member

資料表由 packages/social_auth/migrations 管（版本表 alembic_version_social_auth），
表名 `social_auth_` 前綴、落在 BLOG schema、沒有外鍵：
core 鏈 → commerce 鏈 → studio 鏈 → newsletter 鏈 → **social_auth 鏈** → 站台鏈。
"""
from packages.social_auth.blueprint import social_auth_bp


def register_social_auth(app, db):
    """將 Social Auth 模組註冊到 Flask app（由 core factory 依 SOCIAL_AUTH_ENABLED 自動呼叫）。"""
    import packages.social_auth.models  # noqa: F401  進 metadata
    import packages.social_auth.api  # noqa: F401  註冊路由
    from packages.social_auth import members

    members.register()  # 後台「會員管理」的登入方式欄位與篩選
    app.register_blueprint(social_auth_bp, url_prefix='/api/v1/social-auth')
    app.logger.info('Registered social auth blueprint at /api/v1/social-auth')


__all__ = ['register_social_auth', 'social_auth_bp']
