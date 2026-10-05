-- =============================================================================
-- blog.member_profiles — 部落格/會員側身分擴充表（1:1 對 account.app_users）
-- 統一資料庫架構 §11（見 ARCHITECTURE_UNIFIED_DB.md，Option B）
--
-- account.app_users = 身分核心（紫微擁有寫入）；本表存部落格/會員特有資料：
--   email（登入/會員）、avatar、attributes（作者 E-E-A-T 檔案）、meta_data、last_login。
-- blog_app 直接寫本表，不寫 account。
--
-- 使用：以具備 account + blog 權限的帳號（如 postgres）執行；冪等。
-- =============================================================================

CREATE TABLE IF NOT EXISTS blog.member_profiles (
    app_user_id  BIGINT PRIMARY KEY REFERENCES account.app_users(id) ON DELETE CASCADE,
    email        VARCHAR(100) UNIQUE,
    avatar       VARCHAR(500),
    attributes   JSONB NOT NULL DEFAULT '{}',   -- 作者檔案 (display_name/slug/title/bio/expertise/social_links/credentials)
    meta_data    JSONB NOT NULL DEFAULT '{}',
    last_login   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'utc'),
    updated_at   TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS ix_member_profiles_email
    ON blog.member_profiles (email);

-- blog_app 授權：讀 account 身分、可建 FK、完整操作 member_profiles
GRANT USAGE ON SCHEMA account TO blog_app;
GRANT SELECT, REFERENCES ON account.app_users TO blog_app;
GRANT ALL ON blog.member_profiles TO blog_app;
