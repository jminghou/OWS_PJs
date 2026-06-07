-- =============================================================================
-- blog.users — 可讀寫 VIEW（統一資料庫架構 §11，Option B）
-- =============================================================================
-- 讓共用的 `User` ORM 模型透明運作於 account.app_users（身分核心）+
-- blog.member_profiles（部落格/會員擴充）之上。讀取直接 JOIN；寫入由 INSTEAD OF
-- triggers 路由到底層表（SECURITY DEFINER → 由本檔擁有者執行，可寫 account）。
--
-- 欄位對齊 core/backend_engine/models.py 的 User（id/username/email/password_hash/
-- role/is_active/avatar/attributes/meta_data/created_at/updated_at/last_login）。
--
-- 使用：以 postgres（具 account + blog 權限）執行；冪等。
-- =============================================================================

CREATE OR REPLACE VIEW blog.users AS
SELECT
    a.id,
    a.username,
    mp.email,
    a.password_hash,
    a.role,
    a.is_active,
    mp.avatar,
    COALESCE(mp.attributes, '{}'::jsonb) AS attributes,
    COALESCE(mp.meta_data,  '{}'::jsonb) AS meta_data,
    a.created_at,
    a.updated_at,
    mp.last_login
FROM account.app_users a
LEFT JOIN blog.member_profiles mp ON mp.app_user_id = a.id;

GRANT SELECT, INSERT, UPDATE, DELETE ON blog.users TO blog_app;

-- ── INSTEAD OF INSERT：建 app_users（身分）+ member_profiles（擴充）────────────
CREATE OR REPLACE FUNCTION blog._users_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE new_id bigint;
BEGIN
    INSERT INTO account.app_users(
        username, password_hash, role, is_active, display_name,
        permissions, allowed_collectors, created_at, updated_at)
    VALUES (
        NEW.username, NEW.password_hash, COALESCE(NEW.role, 'user'),
        COALESCE(NEW.is_active, TRUE), NEW.username,
        '[]'::jsonb, '[]'::jsonb,
        COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now()))
    RETURNING id INTO new_id;

    INSERT INTO blog.member_profiles(
        app_user_id, email, avatar, attributes, meta_data, last_login)
    VALUES (
        new_id, NEW.email, NEW.avatar,
        COALESCE(NEW.attributes, '{}'::jsonb),
        COALESCE(NEW.meta_data, '{}'::jsonb),
        NEW.last_login);

    NEW.id := new_id;
    RETURN NEW;
END;
$$;

-- ── INSTEAD OF UPDATE：身分欄位寫 app_users；擴充欄位 upsert member_profiles ────
CREATE OR REPLACE FUNCTION blog._users_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE account.app_users
       SET username      = NEW.username,
           password_hash = NEW.password_hash,
           role          = NEW.role,
           is_active     = NEW.is_active,
           updated_at    = now()
     WHERE id = OLD.id;

    INSERT INTO blog.member_profiles(
        app_user_id, email, avatar, attributes, meta_data, last_login)
    VALUES (
        OLD.id, NEW.email, NEW.avatar,
        COALESCE(NEW.attributes, '{}'::jsonb),
        COALESCE(NEW.meta_data, '{}'::jsonb),
        NEW.last_login)
    ON CONFLICT (app_user_id) DO UPDATE SET
        email      = EXCLUDED.email,
        avatar     = EXCLUDED.avatar,
        attributes = EXCLUDED.attributes,
        meta_data  = EXCLUDED.meta_data,
        last_login = EXCLUDED.last_login,
        updated_at = now();

    RETURN NEW;
END;
$$;

-- ── INSTEAD OF DELETE：刪 app_users（member_profiles 由 FK ON DELETE CASCADE）──
CREATE OR REPLACE FUNCTION blog._users_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    DELETE FROM account.app_users WHERE id = OLD.id;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS users_insert ON blog.users;
DROP TRIGGER IF EXISTS users_update ON blog.users;
DROP TRIGGER IF EXISTS users_delete ON blog.users;
CREATE TRIGGER users_insert INSTEAD OF INSERT ON blog.users FOR EACH ROW EXECUTE FUNCTION blog._users_insert();
CREATE TRIGGER users_update INSTEAD OF UPDATE ON blog.users FOR EACH ROW EXECUTE FUNCTION blog._users_update();
CREATE TRIGGER users_delete INSTEAD OF DELETE ON blog.users FOR EACH ROW EXECUTE FUNCTION blog._users_delete();
