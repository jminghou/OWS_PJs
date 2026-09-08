# 資料庫 Migration 架構

## 一句話

平台的表走**一條共用鏈**（`core/migrations`），站台自己的表走**站台鏈**。
core 改一次，所有掛載共用鏈的站台吃到同一份 migration。

---

## 為什麼要分兩條

在 P5-C 之前，core 的 20 張表由「各站自己的 migration」建立。後果：

- core 模型改一個欄位 → 要手寫兩份 migration，沒有任何機制保證兩份一致
- 兩站的鏈根本不是同一條（revision id 不同、都 `down_revision=None`），
  不存在「誰追上誰」的問題
- 第三個站台沒有任何一條鏈可以直接用

也就是說，「改一次後端、所有站台一起改」在資料庫層是不成立的。分鏈就是為了讓它成立。

---

## 現在的樣子

| 鏈 | 位置 | 版本表 | 管什麼 |
|---|---|---|---|
| 共用平台鏈 | `core/migrations` | `alembic_version_core` | `core/backend_engine/models.py` 的 22 張表 + `packages/media_lib` 的 6 張 |
| 站台鏈 | `sites/<站>/backend/migrations` | `alembic_version` | 該站 extension 的表 |

兩個版本表名稱不同，所以兩條鏈可以各自演進、互不干擾。

**Claire_Project 不在此架構內。** 它在模組化期間凍結（見 [FROZEN_CONTRACT.md](FROZEN_CONTRACT.md)），
維持原本「一條鏈建全部」的做法。等它解凍再遷移。

---

## 部署：順序不能反

```bash
# 1. 共用平台鏈（先）—— 站台的 FK 指向平台表，順序反了會失敗
flask --app "sites.<站>.backend.app:app" db upgrade -d core/migrations

# 2. 站台鏈（後）
flask --app "sites.<站>.backend.app:app" db upgrade -d sites/<站>/backend/migrations
```

兩條鏈的 baseline 都有**冪等保護**：偵測到表已存在就整條跳過、只記錄版本。
所以既有資料庫直接跑 upgrade 即可，**不需要人工 stamp**。

---

## 站台設定

平台鏈的行為由環境變數決定，同一份 migration 通用於不同佈局：

| 變數 | 預設 | 說明 |
|---|---|---|
| `OWS_BLOG_SCHEMA` | 未設 → `public` | 內容類表的 schema |
| `OWS_SHOP_SCHEMA` | 未設 → `public` | 商務類表的 schema |
| `OWS_IDENTITY_MODE` | `local` | `local` = 站台自己的 `users` 表（Integer）<br>`external` = 外部身分系統（BigInteger） |
| `OWS_EXTERNAL_USER_TABLE` | `account.app_users` | `external` 模式的目標表 |
| `OWS_CORE_UNMANAGED_TABLES` | 空 | 由站台 SQL 自管、不歸 alembic 的表（逗號分隔） |

`OWS_IDENTITY_MODE` 是 P5-C 從 `OWS_BLOG_SCHEMA` 拆出來的。原本一個變數同時決定
「表放哪個 schema」和「用哪種身分模型」，導致第三個站台無法「用 schema 分流表、
但保留自己的 users 表」—— 而那是完全合理的組合。

### 兩個現行站台

```bash
# Polaris：blog/shop 分流 + 身分集中在紫微側
OWS_BLOG_SCHEMA=blog
OWS_SHOP_SCHEMA=shop
OWS_IDENTITY_MODE=external
OWS_CORE_UNMANAGED_TABLES=users,roles,permissions,role_permissions,user_roles,member_profiles

# 全新站台：什麼都不用設（全部落在 public、用自己的 users 表）
```

---

## Polaris 的資料庫前置條件

Polaris 的站台鏈**不會**自己建下列東西，從零建置時必須先準備：

```sql
CREATE SCHEMA IF NOT EXISTS account;   -- 紫微系統擁有
CREATE TABLE account.app_users (...);  -- 身分核心，由紫微系統建立
```

平台鏈會自己 `CREATE SCHEMA IF NOT EXISTS` blog / shop / media_lib，這部分不用手動。

`blog.users`（view）、RBAC 四表、`blog.member_profiles` 由站台的 SQL 腳本建立，
不歸任何一條 alembic 鏈 —— 所以它們列在 `OWS_CORE_UNMANAGED_TABLES`。

---

## 改了 core 模型之後

1. 在**共用鏈**產生 migration：

   ```bash
   flask --app "sites.Polaris_Parent.backend.app:app" db migrate -m "說明" -d core/migrations
   ```

   站台鏈的 autogenerate 已經把平台表排除（見站台 `env.py` 的 `_CORE_TABLES`），
   所以不會誤產在錯的鏈裡。

2. 把新表名加進 `core/backend_engine/migrations_manifest.py` 的 `PLATFORM_TABLES`。
   CI 會檢查這份清單沒有過期 —— 對不上就失敗，那正是提醒你「這張表歸 core 鏈」的時機。

3. 跑漂移偵測驗證：

   ```bash
   python scripts/check_schema_drift.py
   ```

---

## 驗證

`scripts/check_schema_drift.py` 建一個乾淨的暫時 Postgres 庫、依序跑完該站的所有鏈、
用 alembic 的 `compare_metadata()` 跟 models 對比。**不碰任何線上資料庫。**

這是「從零重建」唯一可靠的驗證方式。P5-B 就是靠它發現 Polaris 的鏈其實從來沒有被
執行過（線上的表是早期 `db.create_all()` 建的，之後 stamp 上去），
以及整個 `media_lib` schema 從未進過 migration 鏈。
