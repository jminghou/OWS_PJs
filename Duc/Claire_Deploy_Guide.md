# Claire Project — NAS 部署更新指南

> 適用場景：在本機完成前端程式修改後，部署到 Synology NAS。
> 最後更新：2026-03-18

---

## 架構速覽

```
本機 (Windows)
  └─ d:\PJ_Projects\OWS_PJs\          ← Git repo
       └─ sites/Claire_Project/
            ├─ frontend/               ← Next.js 15 (standalone)
            └─ backend/                ← Flask + SQLAlchemy

NAS (Synology 192.168.30.65)
  └─ /volume1/docker/OWS_PJs/         ← 同一個 Git repo
       └─ docker-compose.yml          ← 管理所有容器

外部存取（Cloudflare Tunnel）
  clairelab.tw       → NAS:3002 (前端)
  api.clairelab.tw   → NAS:5056 (後端)
```

---

## 標準更新流程（前端修改）

只有 3 步，正常情況 5 分鐘內完成：

### Step 1：本機 — 推送到 GitHub

```bash
cd d:/PJ_Projects/OWS_PJs
git add <修改的檔案>
git commit -m "描述修改內容"
git push
```

### Step 2：NAS — 拉取並重建前端

```bash
ssh Jermaine@192.168.30.65
cd /volume1/docker/OWS_PJs
git pull
sudo docker-compose up -d --build claire_frontend
```

> `--build` 會重新 build Docker image，`-d` 在背景執行。
> 只指定 `claire_frontend` 不會影響後端和資料庫。

### Step 3：驗證

打開 https://clairelab.tw 確認修改生效。

**就這樣，結束。**

---

## 重要注意事項

### NEXT_PUBLIC_* 環境變數是 build time 寫死的

Next.js 的 `NEXT_PUBLIC_*` 變數在 `docker build` 時就寫入 JS bundle。
如果只是 `docker restart`，新的環境變數**不會生效**，必須 `--build` 重建。

```bash
# ✗ 錯誤：restart 不會更新 NEXT_PUBLIC_* 變數
sudo docker restart claire_frontend

# ✓ 正確：重建才會更新
sudo docker-compose up -d --build claire_frontend
```

### docker-compose 需要 sudo

NAS 上 Docker socket 需要 root 權限：

```bash
# ✗ 會報 permission denied
docker-compose up -d --build claire_frontend

# ✓ 加 sudo
sudo docker-compose up -d --build claire_frontend
```

### 靜態頁面快取

Next.js 首頁使用 ISR（每 10 分鐘重新驗證）。如果剛 build 完首頁內容是空的，
是因為 build 時資料庫還沒連上。重啟一次前端即可：

```bash
sudo docker restart claire_frontend
```

---

## 如果改了後端程式

```bash
# 只重建後端
sudo docker-compose up -d --build claire_backend

# 如果改了資料庫 model，進容器跑 migration
sudo docker exec -it claire_backend flask db upgrade
```

---

## 如果前後端都改了

```bash
sudo docker-compose up -d --build claire_frontend claire_backend
```

---

## 常用排錯指令

```bash
# 查看容器狀態
sudo docker-compose ps

# 查看前端 log
sudo docker-compose logs -f claire_frontend

# 查看後端 log
sudo docker-compose logs -f claire_backend

# 進入後端容器
sudo docker exec -it claire_backend bash

# 進入前端容器
sudo docker exec -it claire_frontend sh
```

---

## 這次為什麼搞這麼久？（踩坑紀錄）

這次部署花了大量時間，根本原因是 **把「首次完整部署」當成「簡單更新」來做**。
以下是遇到的所有問題及其類別：

### 一次性設定問題（下次不會再遇到）

| 問題 | 原因 | 狀態 |
|------|------|------|
| NAS 上沒有 `.env` 檔 | 首次部署，從未建立過 | ✅ 已建立 |
| docker-compose build context 錯誤 | Dockerfile 路徑需要 monorepo 根目錄 | ✅ 已修正 |
| PostgreSQL port 衝突 | NAS 上已有其他 PG 使用 5432 | ✅ 改用 5433 |
| 資料庫不存在 | 首次部署需手動建庫 | ✅ 已建立 |
| 舊容器佔用 port 3002 | 之前手動部署的殘留容器 | ✅ 已清除 |
| CORS 設定錯誤 | 從內網 IP 改為 Cloudflare 域名 | ✅ 已修正 |
| JWT Cookie 跨域失敗 | 需設定 `.clairelab.tw` domain + `SameSite=None` | ✅ 已修正 |
| uploads 目錄權限不足 | Docker image 內目錄為 read-only | ✅ 已用 volume 解決 |

### 程式碼層級問題（已修正，不會復發）

| 問題 | 原因 | 狀態 |
|------|------|------|
| 圖片縮圖 404 | `getImageUrl` 變體格式從 suffix 改為 prefix | ✅ 已修正 |
| Swiper 幻燈片不切換 | Swiper v12 ESM 需加入 `transpilePackages` | ✅ 已修正 |
| `contactApi` export 缺失 | re-export 檔漏了 contactApi | ✅ 已修正 |

### 結論

上面 11 個問題中，有 8 個是「首次部署」才會遇到的一次性設定。
**下次只做前端修改，照著上面 3 步走就好。**
