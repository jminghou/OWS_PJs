# 社群帳號註冊／登入（Google＋LINE）— 工程規劃

> 2026-11-18 起草，同日依決策改版。狀態：**階段 1 本機完成（未 commit、未上正式庫）**，見 §15。
> 命名：模組叫 `social_auth`（core 已有 `MEMBER_AUTH_ENABLED`，管的是 core 的 Email 註冊端點，避免撞名）。
> 相關：membership-v2-architecture.md §5（Email 驗證碼）、docs/MIGRATIONS.md（選用模組鏈）。

## 0. 已定案的決策（2026-11-18）

| # | 決策 |
|---|---|
| 1 | 註冊以 **Google／LINE 為主**，兩個都沒有的人才用 Email。目前沒有任何會員，不必遷移舊帳號 |
| 2 | 先認社群帳號本身（provider＋sub），信箱只在第一次連結時用來找人；非 Gmail 信箱撞到既有會員採**保守做法**（不自動連結） |
| 3 | **帶入大頭貼** |
| 4 | **LINE 登入排入本次工程**。中國大陸市場（微信等）之後另行研究，架構先預留 |
| 5 | 做成**通用選用模組**，Happy_Wu、Claire 之後要會員功能時打開開關、設環境變數即可接上 |
| 6 | 「有沒有設過密碼」採**方案 A**（`User.attributes.password_set`），見 §6 |

## 1. 目標

`/login` 的「登入」與「註冊」兩個分頁，最上面放兩顆大按鈕：

```
┌──────────────────────────────┐
│   [G]  使用 Google 繼續        │
│   [L]  使用 LINE 繼續          │
│  ────────── 或用 Email ──────── │
│   （現有 Email 驗證碼流程）      │
└──────────────────────────────┘
```

- 第一次按 = 註冊（建立會員並登入）；之後按 = 登入。不需要寄驗證碼。
- Email 流程保留，作為沒有 Google／LINE 帳號的人的備案。

## 2. 為什麼做成通用模組，以及各站台現況

`User` 模型由 core 提供、三個站台共用，而且**每個站台都有 `avatar` 與 `attributes`（JSONB）欄位**：

| 站台 | 會員存在哪 | 需要注意 |
|---|---|---|
| Polaris | `blog.users` view → `account.app_users`＋`blog.member_profiles`（INSTEAD OF trigger） | `account` 是紫微系統的 schema，不改它；`avatar`、`attributes` 存在 `member_profiles`，可以寫 |
| Happy_Wu | 自己庫的 `users` 表（`OWS_IDENTITY_MODE=local`） | 目前沒有公眾會員，只有 `/admin/login` |
| Claire | Neon 的 `public.users` | 凍結站台（FROZEN_CONTRACT），模組預設關閉 → 一行都不會變 |

所以社群登入只要透過 `User` 模型建立／讀取會員，就能在三個站台通用。站台各自不同的部分（Polaris 要寫「信箱已驗證」紀錄、要把訪客暫存的命盤歸戶）用**掛勾（hook）**交給站台處理。

## 3. 模組結構：`packages/social_auth`

照 newsletter／studio 的選用模組慣例：

```
packages/social_auth/
  __init__.py            register_social_auth(app, db)；說明文件字串
  blueprint.py           /api/v1/social-auth/*
  models.py              MemberAuthIdentity（social_auth_identities）
  migrations_manifest.py SOCIAL_AUTH_TABLES
  migrations/            自己的鏈，版本表 alembic_version_social_auth
  providers/
    base.py              Provider 介面：verify(...) → ProviderProfile(sub, email, email_verified, name, picture)
    google.py            驗 ID token
    line.py              轉址流程：授權網址、code 換 token、驗 ID token
  service.py             帳號對應規則（§5）、建會員、連結、大頭貼
  hooks.py               站台掛勾登記
  src/                   前端（TypeScript／React）
    api.ts
    SocialSignInButtons.tsx   依後端回的 provider 清單決定顯示哪幾顆
    InAppBrowserNotice.tsx    LINE／IG／FB 內建瀏覽器提示
    LoginMethodsPanel.tsx     會員中心「登入方式」區塊
```

開關與設定（站台 config／環境變數）：

| 鍵 | 預設 | 說明 |
|---|---|---|
| `SOCIAL_AUTH_ENABLED` | `False` | 加進 core factory 的 `OPTIONAL_MODULES`；Polaris config 明確打開 |
| `GOOGLE_CLIENT_ID` | 空 | 沒設 → Google 按鈕不出現 |
| `LINE_CHANNEL_ID`／`LINE_CHANNEL_SECRET` | 空 | 沒設 → LINE 按鈕不出現。Secret 是機密 |
| `SOCIAL_AUTH_DEFAULT_ROLE` | `member` | 社群註冊的會員角色 |
| `FRONTEND_URL` | 既有 | LINE 登入完導回前端用 |

前端的公開資訊（顯示哪些按鈕、Google Client ID）由 `GET /api/v1/social-auth/providers` 回傳，**前端不必另設環境變數**，Vercel 不用動，新站台接上時也少一處要對齊。

站台掛勾（Polaris 在自己的 extension 裡登記）：

```python
social_auth.hooks.on_member_created(fn)   # Polaris：mark_verified(user.id, email)
social_auth.hooks.on_signed_in(fn)        # 每次社群登入；Polaris：同上，補寫驗證紀錄
social_auth.hooks.email_code_verifier(fn) # 「用驗證碼連結」時驗碼；Polaris 用 member_account.service.consume_code
```

沒登記 `email_code_verifier` 的站台，遇到 `needs_link` 只提示「請先用密碼登入，再到會員中心連結」。

## 4. 兩個 provider 的流程

### 4.1 Google：GIS 按鈕＋ID token（不轉址）

```
瀏覽器 ── 按鈕 ──► Google 選帳號 ──► 前端拿到 ID token
前端 POST /api/v1/social-auth/google {credential, nonce}
後端驗：簽章、aud==GOOGLE_CLIENT_ID、iss、exp、email_verified、nonce
     → 帳號對應（§5）→ Set-Cookie（本站 JWT，沿用現有寫法）
```

不需要 client secret、不需要 callback 網址。

### 4.2 LINE：LINE Login v2.1（OAuth 轉址＋PKCE）

LINE 沒有 Google 那種按鈕套件，必須轉址：

```
前端按鈕 → GET /api/v1/social-auth/line/start?next=/report/checkout
  後端產生 state、nonce、PKCE verifier，放進短效（10 分鐘）簽章 cookie，302 到 access.line.me
使用者在 LINE 同意 →
  302 回 /api/v1/social-auth/line/callback?code&state
  後端：比對 state → 用 code＋verifier＋channel secret 換 token → 驗 ID token（aud=channel id、nonce）
       → 帳號對應（§5）→ Set-Cookie → 302 到 FRONTEND_URL + next
```

- callback 網址要跟前端呼叫 API 的網域一致，cookie 才會落在對的地方（Polaris 走 Next rewrite 的 `/api/v1/*`，或 `api.polaris-parent.com` 加 `JWT_COOKIE_DOMAIN`，實作時用正式環境實測，不靠推論）。
- `next` 只接受站內相對路徑，防止被拿來轉址到外站。
- 手機上若裝了 LINE App，會直接跳 App 同意，體驗很好；**在 LINE 內建瀏覽器裡也能用**，這是 LINE 登入的一大優點。

### 4.3 LINE 的信箱問題（重要）

- LINE 要在 LINE Developers 後台**另外申請「取得 Email」權限**（上傳同意畫面截圖，通常幾天內核准）。
- 就算核准，使用者在同意畫面也可以**取消勾選 Email**，所以一定會有「沒有信箱的 LINE 會員」。
- 但 Polaris 寄報告、寄訂單通知都需要信箱，而且 `User.email` 不能是空的。

處理方式：

1. LINE 有給信箱 → 照 §5 的規則走。LINE 給的信箱視為「已驗證」（LINE 有驗過才會回），但**不拿來自動連結既有會員**（LINE 沒有 Gmail 那種由自己掌管信箱的保證）。
2. LINE 沒給信箱 → 先建會員，`email` 存佔位值 `line-<sub 雜湊前 16 碼>@users.invalid`（`.invalid` 是保留網域，保證寄不出去），`attributes.email_missing = true`。
3. 會員中心與結帳前檢查 `email_missing`，提示「補填 Email」→ 走驗證碼流程 → 寫入真信箱。結帳本來就要求信箱已驗證，所以不會有人沒信箱就下單。

`username` 欄位只有 50 字元：一律用信箱（現有做法），佔位信箱長度約 45 字元，放得下。

### 4.4 之後的 provider

`Provider` 介面只要能交出 `(sub, email?, email_verified, name, picture)` 就能接。之後可評估：**Apple**（iPhone 使用者、App 上架必備）、**微信**（大陸市場；需要大陸主體的開放平台帳號，另行研究）。新增時只多一個 `providers/xxx.py`，資料表不用改。

## 5. 帳號對應規則

鑰匙是 `(provider, sub)`。

| 情況 | 處理 |
|---|---|
| `(provider, sub)` 已連結某會員 | 直接登入（對方在 Google／LINE 改信箱也不影響） |
| 沒見過、信箱不是會員（或沒有信箱） | **註冊**：建會員、建連結、帶大頭貼、觸發 `on_member_created`、登入 |
| 沒見過、信箱已是會員、**Google** 且信箱是 `@gmail.com` 或帶 `hd` | **自動連結**後登入 |
| 沒見過、信箱已是會員，其他情況（非 Gmail 的 Google、所有 LINE） | 回 `409 needs_link`：「這個 Email 已是會員，請用密碼登入，或收一次驗證碼來連結」 |
| Google 回 `email_verified=false` | 拒絕 |
| 會員已停用 | 拒絕，訊息與密碼登入相同 |

- 一個會員**每個 provider 只能連一個帳號**；同一個會員可以同時連 Google 和 LINE。
- 信箱比對一律經 core 的 `normalise_email()`。

## 6. 「有沒有設過密碼」——三個方案（請選一個）

為什麼需要知道：「解除 Google／LINE 連結」時，如果這是他唯一的登入方式，解除後就再也登不進來。會員中心也要依此顯示「設定密碼」或「變更密碼」。

前提：`password_hash` 不能是空的。社群註冊的會員一律存一組**隨機、沒人知道的 bcrypt 雜湊**，所以用密碼登入必定失敗，這點三個方案都一樣。

| | A. 記在 `User.attributes` | B. 模組自己的表加欄位 | C. 認得出來的假雜湊 |
|---|---|---|---|
| 做法 | 社群註冊時寫 `attributes.password_set = false`；設定／重設密碼時改成 `true`。**沒有這個鍵 = 有密碼**（Email 註冊的會員不用回填） | 新表 `social_auth_credentials(app_user_id, password_set)` | `password_hash` 存固定字串如 `!social-only`，看前綴判斷 |
| 動到哪 | 不加欄位；只有 core `User.set_password()` 要多寫一行設 `true` | 多一張表；core 的重設密碼路徑要記得更新它 | core `check_password()` 要特別處理 |
| 三站通用 | ✅ 三站都有 `attributes`（Polaris 經 view 寫進 `member_profiles`） | ✅ | ⚠️ 紫微系統（Polaris_run）也讀 `account.app_users`，如果它自己驗 bcrypt，遇到假字串會報錯 |
| 會不會漏 | 任何設密碼的路徑都經過 `set_password()`，寫在那裡就不會漏 | 每條設密碼的路徑都要記得同步，容易漏 | 不會漏，但有上面的跨系統風險 |

**建議 A**：不加表、不碰紫微的 schema，而且寫在 `set_password()` 這個唯一入口，之後任何站台、任何改密碼的路徑都自動正確。

## 7. 大頭貼

- 註冊時把 provider 的大頭貼網址存進 `User.avatar`，並記 `attributes.avatar_source = 'google' | 'line'`。
- **之後每次社群登入都更新網址**，因為 LINE 的大頭貼網址在對方換照片後會失效，Google 的也可能變。
- 會員自己上傳過頭像（`avatar_source = 'upload'`）就不再覆蓋。
- 前端顯示用一般 `<img>`，載入失敗時退回姓名首字圓圈（不用 `next/image`，免得每個站台都要設遠端圖片白名單）。
- 不複製到本站的儲存空間：那樣會讓模組依賴 media_lib／GCS，新站台接上就多一個前置條件。真的需要時（例如要印在實體書上）再由站台自己處理。
- 顯示名稱：註冊時從 provider 帶入當預設值，Polaris 寫進 `display_name`；會員之後可以改。

## 8. 資料層：`social_auth_identities`

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | bigserial PK | |
| user_id | int, index | 對 `User.id`；**不建外鍵**（Polaris 的 User 是 view，與既有 `member_email_verifications` 同做法） |
| provider | varchar(20) | `google`／`line` |
| subject | varchar(255) | provider 的使用者 ID（`sub`） |
| email | varchar(255) null | 連結當下 provider 給的信箱，只作紀錄 |
| display_name / picture_url | varchar null | 最後一次登入時 provider 給的資料 |
| created_at / last_login_at | timestamptz | |

- 唯一鍵 `(provider, subject)`、`(user_id, provider)`。
- 不存 access token／refresh token（我們不呼叫 Google／LINE 的其他 API）。
- 落在 BLOG schema，`social_auth_` 前綴，與 newsletter 相同。
- 部署順序：core → commerce → studio → newsletter → **social_auth** → 站台鏈（無外鍵，順序只是慣例）。docs/MIGRATIONS.md 要加一列。
- 依「本機優先」流程：本機庫驗證 → 正式庫演練 → migrate → 再 push。Polaris 的 `blog_app` 權限只寫 blog／shop，這張表落在 blog，沒問題。

## 9. API

```
GET    /api/v1/social-auth/providers          公開：{google: {client_id}, line: true}
POST   /api/v1/social-auth/google             {credential, nonce} → 200 登入／201 註冊／409 needs_link
GET    /api/v1/social-auth/line/start         ?next= → 302 到 LINE
GET    /api/v1/social-auth/line/callback      → 302 回前端（失敗時帶 ?auth_error=…）
POST   /api/v1/social-auth/link               （needs_link 後）{provider_ticket, code} 驗證碼通過才連結
GET    /api/v1/social-auth/me/identities      （登入）已連結清單＋password_set
POST   /api/v1/social-auth/me/link/google     （登入）在會員中心加連 Google
GET    /api/v1/social-auth/me/link/line/start （登入）在會員中心加連 LINE
DELETE /api/v1/social-auth/me/identities/<provider>  （登入）解除；最後一種登入方式不能解除
```

- `provider_ticket`：`needs_link` 時後端回一張短效（10 分鐘）簽章票，裡面是已驗證過的 provider 身分；前端不必再走一次 Google／LINE。
- 限流沿用 `10 per minute`；社群登入不需要 Turnstile（Google／LINE 已做過真人驗證）。
- 稽核日誌：`social_auth.register` / `login` / `link` / `unlink`，帶 provider。

## 10. 前端（Polaris）

- `/login`：兩個分頁都放 `<SocialSignInButtons>`，下方「或用 Email」接現有表單。
- 把現有 `handleLogin` 的「登入成功後」段落（pending chart 歸戶、導向 `?next=` 或 `/account`）抽成共用函式，密碼、Email 註冊、Google、LINE 四條路都走它。LINE 是整頁轉址，pending chart 已經在 sessionStorage，回來後照樣讀得到。
- **內建瀏覽器**：偵測 LINE／Instagram／Facebook 的 App 內瀏覽器 → Google 按鈕換成「請用 Safari／Chrome 開啟才能使用 Google」，**LINE 按鈕照常可用**。
- `needs_link`：顯示「這個 Email 已是會員」小步驟 → 用密碼登入／收驗證碼連結。
- LINE 沒給信箱：登入後在 `/account` 頂端提示「補填 Email，才能收報告與訂單通知」。
- 會員中心加 `<LoginMethodsPanel>`：Google、LINE、密碼三列，各自顯示已連結／連結／解除，密碼列顯示「設定密碼」或「變更密碼」。
- 隱私權政策 `/privacy` 補一段：使用 Google／LINE 登入時取得姓名、Email、大頭貼網址，只用於建立與識別會員帳號。

其他站台接上時：後端打開 `SOCIAL_AUTH_ENABLED`、設 provider 環境變數、跑 social_auth 鏈；前端在自己的登入頁放 `<SocialSignInButtons onSignedIn={...}>`。這份清單會寫進模組的 README。

## 11. 需要你在網頁上做的設定（Claude 做不了）

**Google Cloud Console**（Google Auth Platform）
1. 品牌（同意畫面）：名稱「親紫之間」、支援信箱、Logo、首頁、**隱私權政策網址**、服務條款網址、已授權網域 `polaris-parent.com`。範圍只用 `openid email profile`（非敏感）。放 Logo 要做品牌驗證，約數天。
2. 發布狀態改「正式版」（否則只有測試名單上的人能登入）。
3. 建「OAuth 用戶端 ID（網頁應用程式）」，已授權 JavaScript 來源：`https://www.polaris-parent.com`、`https://polaris-parent.com`、`http://localhost:3000`。
4. Client ID 設到 Railway polaris-backend 的 `GOOGLE_CLIENT_ID`（不是機密）。

**LINE Developers Console**
1. 建 Provider「親紫之間」→ 建 **LINE Login channel**（類型 Web app）。
2. Callback URL：正式站與 `http://localhost:5000/api/v1/social-auth/line/callback`（實際網域待 §4.2 實測後確定）。
3. **申請 OpenID Connect「Email address permission」**：上傳同意畫面截圖、勾同意條款。要先做，等核准期間就可以開發。
4. Channel 改成 **Published**（Developing 狀態只有 channel 管理員能登入）。
5. Channel ID 與 Channel Secret 設到 Railway（Secret 由你貼進 Raw Editor，Claude 的權限會擋複製機密）。

## 12. 測試

後端 pytest（mock provider 的驗證）：

- Google 新信箱 → 註冊、連結、大頭貼、`password_set=false`、hook 被呼叫、帶 cookie
- 同 sub 再登入 → 不重複建、大頭貼更新；`avatar_source='upload'` 時不覆蓋
- Gmail 撞既有會員 → 自動連結；非 Gmail、LINE 撞既有會員 → 409；ticket＋驗證碼 → 連結成功；ticket 過期 → 拒絕
- LINE：state 不符、nonce 不符、`next` 是外站網址 → 拒絕；沒信箱 → 佔位信箱＋`email_missing`
- `email_verified=false`、`aud` 錯、過期、停用帳號 → 拒絕
- 社群會員用任何密碼登入 → 失敗；重設密碼後 → 可以、`password_set=true`
- 只剩一種登入方式時解除 → 拒絕
- 模組關閉時 → 路由 404、`/providers` 不存在（Claire 回歸測試）

手動驗收（本機＋正式各一次）：桌機 Chrome／Safari、iPhone Safari、Android Chrome、**LINE 內建瀏覽器**（Google 顯示提示、LINE 可用）、有 pending chart 的註冊、`?next=/report/checkout` 結帳途中登入、LINE 取消勾選 Email。

## 13. 分階段

| 階段 | 內容 | 估計 |
|---|---|---|
| 0（你） | Google 同意畫面＋Client ID；LINE channel＋**送出 Email 權限申請** | 設定半小時，審核等數天 |
| 1 | `packages/social_auth` 骨架、模組開關、migration 鏈、`set_password` 記錄（§6）、帳號對應規則、**Google** 端點、Polaris 掛勾、登入頁按鈕、內建瀏覽器提示、隱私權文字、測試 | 1.5–2 天 |
| 2 | **LINE** 轉址流程、無信箱的佔位與補填 Email、正式環境 cookie 網域實測 | 1–1.5 天 |
| 3 | `needs_link` 驗證碼連結、會員中心「登入方式」（加連／解除／設定密碼） | 1 天 |
| 4 | 模組 README（新站台接入清單）、docs/MIGRATIONS.md 更新、用 Happy_Wu 本機打開開關試接一次確認真的通用 | 0.5 天 |
| 之後 | Apple、微信等其他 provider 研究 | — |

上線順序：1 可以單獨上線（只有 Google 按鈕）；2 等 LINE Email 權限核准後上線。

## 14. 待你決定

（目前沒有。）

## 15. 實作紀錄

### 階段 1（2026-11-18，本機完成）

後端
- `core/backend_engine/models.py`：`User.set_unusable_password()`、`User.has_usable_password`；`set_password()` 在 `password_set` 為 False 時改回 True（其他會員的 attributes 不動）。
- `packages/social_auth/`：模組、`social_auth_identities` 表與 migration 鏈、Google provider、帳號對應規則（`service.py`）、hooks、API（`/providers`、`/google`、`/me/identities`）。
- 掛載：core factory `OPTIONAL_MODULES`、`BaseSiteConfig`（預設關）、Polaris config（開）、Polaris Dockerfile `COPY`、Polaris／Happy_Wu 站台鏈 env.py 排除清單、`scripts/check_schema_drift.py`、docs/MIGRATIONS.md、core requirements 明列 `google-auth`、`requests`。
- Polaris 掛勾（`extensions/member_account`）：社群登入時，provider 信箱與會員信箱相同就寫入「信箱已驗證」。
- 順手修正：代客建單（`report_orders/proxy.py`）建立的客人帳號改用 `set_unusable_password()`，語意一致（原本也是一組沒人知道的密碼）。

前端
- `packages/social_auth/src`（`@ows/social-auth`）：`SocialSignInButtons`、`GoogleSignInButton`（官方 GIS 按鈕）、`InAppBrowserNotice`（LINE 給「用瀏覽器開啟」按鈕＝`openExternalBrowser=1`；其他 App 給說明＋複製連結）、API client。
- Polaris `/login`：登入／註冊兩個分頁的表單上方放按鈕＋「或用 Email」分隔線；`needs_link` 時切到登入分頁並提示用密碼登入。
- 隱私權政策四語補 Google 登入段落，更新日期 2026-11-18。
- workspace、next.config 別名、tsconfig paths、CI 各套件 tsc 清單。

驗證
- `tests/test_social_auth.py` 20 項＋全部 268 項通過；`@ows/social-auth` 與 Polaris 前端 tsc 通過；共用層隔離檢查通過。
- 本機庫已跑 social_auth 鏈（`0001_social_auth_baseline`）；實際走一次 Polaris `blog.users` view 建會員（交易回滾，不留資料）確認 attributes／大頭貼／驗證紀錄都寫得進去。
- **尚未**：真的 Google Client ID 下的瀏覽器實測（等 §11 設定完成）。

上線前待辦
1. 正式庫跑 social_auth 鏈（依演練法；表落 blog schema，`blog_app` 可建）。
2. Railway polaris-backend 設 `GOOGLE_CLIENT_ID`。
3. 再 push（push main 會自動部署）。

### 階段 2＋3（2026-11-18，本機完成；LINE 尚未拿到 Channel，未實測真 LINE）

決策：一個會員可同時連 Google 與 LINE。原本「LINE 不自動連結既有會員」會讓已用 Google 註冊的人按 LINE 時卡住、
LINE 沒給信箱時還會多開一個帳號 → 改成「凡是要證明信箱，一律寄驗證碼」：輸入正確代表擁有該信箱，
信箱已是會員就連過去，不是就用它建新會員。

後端（packages/social_auth）
- `providers/line.py`：LINE Login v2.1＋PKCE；token 交換後用 LINE 的 verify 端點驗 ID token（含 nonce）。
- API：`/line/start`（mode=login|link）、`/line/callback` → 302 回 `{FRONTEND_URL}/login/social?status=ok|linked|pending|error`。
- 待完成票：簽章 httponly cookie（`sa_ticket`，30 分鐘，path `/api/v1/social-auth`），信箱不進網址。
  `/ticket`、`/ticket/email-code`、`/ticket/complete`。needs_link 時驗證碼只寄到既有會員的信箱（填別的也一樣）。
  Google 非 Gmail 撞既有會員也改走這條（原本只能叫人用密碼登入）。
- 會員中心：`/me/link/google`、`DELETE /me/identities/<provider>`（最後一種登入方式不能解）。
- hooks 新增 `set_email_codes(send, verify)`；Polaris 用既有驗證碼（purpose=verify，免改 DB 限制）。
- 設定：`LINE_CHANNEL_ID`、`LINE_CHANNEL_SECRET`（機密）、`LINE_REDIRECT_URI`、`FRONTEND_URL`。
- 會員管理的「登入方式」篩選加 LINE。

前端
- `@ows/social-auth`：`LineSignInButton`（整頁導向；LINE App 內瀏覽器也能用）、按鈕組同時列 LINE 與 Google。
- Polaris：`/login/social` 回跳頁（登入完成補存暫存命盤、驗證碼補信箱／連結、錯誤說明）；
  會員中心新分頁「登入方式」（連結／解除 Google、LINE，設定密碼）；`/login?mode=reset` 直達重設密碼。
- 隱私權政策四語改為 Google 或 LINE。

驗證：`tests/test_social_auth_line.py` 16 項＋全部 300 項通過；tsc、隔離、API 契約檢查通過。
「登入方式」分頁未在瀏覽器實測（本機瀏覽器是 admin 身分）。

上線前（LINE）
1. LINE Developers 建 LINE Login channel、申請 Email 權限、Callback URL 填
   `http://localhost:5000/api/v1/social-auth/line/callback` 與 `https://api.polaris-parent.com/api/v1/social-auth/line/callback`、改 Published。
2. Railway：`LINE_CHANNEL_ID`、`LINE_CHANNEL_SECRET`、`LINE_REDIRECT_URI`、`FRONTEND_URL`（若未設）。
