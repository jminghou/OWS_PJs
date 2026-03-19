# OWS 全專案備份與還原指南

> 適用範圍：Polaris Parent 官網、Claire Project 官網、兩個 Outline 知識庫
> 最後更新：2026-03-19

---

## 目錄

1. [備份涵蓋範圍](#1-備份涵蓋範圍)
2. [手動執行備份](#2-手動執行備份)
3. [設定自動排程備份](#3-設定自動排程備份)
4. [備份檔案結構](#4-備份檔案結構)
5. [還原操作](#5-還原操作)
6. [異地備份建議](#6-異地備份建議)
7. [常見問題](#7-常見問題)

---

## 1. 備份涵蓋範圍

| 項目 | 備份內容 | 備份方式 |
|------|---------|---------|
| Polaris Parent 官網 | 資料庫、上傳檔案、.env | 本腳本 |
| Claire Project 官網 | 資料庫、上傳檔案、.env | 本腳本 |
| Polaris Outline 知識庫 | 資料庫、MinIO 檔案、.env | 本腳本 |
| Claire Outline 知識庫 | 資料庫、MinIO 檔案、.env | 本腳本 |
| Docker Compose 設定檔 | 所有 docker-compose.yml | 本腳本 |
| Cloudflare Tunnel 設定 | config.yml | 本腳本 |
| 程式碼 | 原始碼 | Git（不在本腳本範圍） |

**重點：Git 管程式碼，本腳本管資料和設定，兩者互補。**

---

## 2. 手動執行備份

### 前置條件

- SSH 登入 NAS
- 確認所有容器正在運行（`sudo docker ps`）

### 執行步驟

```bash
# 1. SSH 進入 NAS
ssh Jermaine@Synology_Jming

# 2. 確保腳本是最新版
cd /volume1/docker/OWS_PJs && git pull

# 3. 執行備份
sudo bash /volume1/docker/OWS_PJs/deploy/backup_all.sh
```

### 預期輸出

腳本會逐項顯示備份進度，最後會顯示：

```
=============================================
備份完成！
---------------------------------------------
備份位置: /volume1/docker/backups/20260319_030000
備份大小: XXM
備份內容:
  - Polaris Parent:  DB + 上傳檔案 + .env
  - Claire Project:  DB + 上傳檔案 + .env
  - Polaris Outline: DB + MinIO + .env
  - Claire Outline:  DB + MinIO + .env
  - Docker Compose 設定檔
  - Cloudflare Tunnel 設定
=============================================
```

---

## 3. 設定自動排程備份

### 透過 Synology DSM 設定

1. 登入 DSM 網頁介面
2. 進入 **控制面板 → 任務排程**
3. 點選 **新增 → 排程的任務 → 使用者定義的指令碼**
4. 填入以下設定：

| 欄位 | 值 |
|------|-----|
| 任務名稱 | OWS 全專案備份 |
| 使用者 | root |
| 排程 | 每週日 03:00（建議在離峰時段） |
| 指令碼 | `bash /volume1/docker/OWS_PJs/deploy/backup_all.sh` |

5. （選填）在「任務設定 → 傳送執行詳情」中設定 email 通知

### 備份保留策略

- 腳本預設保留最近 **30 天** 的備份
- 如需調整，修改 `backup_all.sh` 中的 `KEEP_DAYS=30`

---

## 4. 備份檔案結構

每次備份產生一個時間戳目錄：

```
/volume1/docker/backups/
└── 20260319_030000/              ← 備份時間
    ├── env/                      ← 環境變數（最重要！）
    │   ├── polaris.env.production
    │   ├── claire.env.production
    │   ├── outline-polaris.env
    │   └── outline-claire.env
    ├── polaris/                   ← Polaris Parent 官網
    │   ├── db.sql                    資料庫完整匯出
    │   └── uploads/                  上傳的圖片等檔案
    ├── claire/                    ← Claire Project 官網
    │   ├── db.sql
    │   └── uploads/
    ├── outline-polaris/           ← Polaris Outline 知識庫
    │   ├── db.sql
    │   └── minio/                    知識庫附件檔案
    ├── outline-claire/            ← Claire Outline 知識庫
    │   ├── db.sql
    │   └── minio/
    └── compose/                   ← Docker 設定檔
        ├── deploy_docker-compose.yml
        ├── deploy_claire_docker-compose.yml
        ├── Duc_km-outline_outline-docker-compose.yml
        ├── Duc_km-outline-claire_docker-compose.yml
        └── cloudflare_tunnel_config.yml
```

---

## 5. 還原操作

> **重要：還原前請先確認目標容器正在運行。**
> 以下範例使用 `20260319_030000` 作為備份時間戳，請替換為你要還原的實際時間戳。

### 5.1 查看可用的備份

```bash
ls -lt /volume1/docker/backups/
```

### 5.2 還原環境變數（.env）

遺失 `.env` 時使用（就像這次遇到的狀況）。

```bash
# Polaris Parent
cp /volume1/docker/backups/20260319_030000/env/polaris.env.production \
   /volume1/docker/OWS_PJs/deploy/.env.production

# Claire Project
cp /volume1/docker/backups/20260319_030000/env/claire.env.production \
   /volume1/docker/OWS_PJs/deploy_claire/.env.production

# Polaris Outline
cp /volume1/docker/backups/20260319_030000/env/outline-polaris.env \
   /volume1/docker/OWS_PJs/Duc/km-outline/.env

# Claire Outline
cp /volume1/docker/backups/20260319_030000/env/outline-claire.env \
   /volume1/docker/OWS_PJs/Duc/km-outline-claire/.env
```

還原後重啟對應的容器：

```bash
# 例：重啟 Polaris Outline
cd /volume1/docker/OWS_PJs/Duc/km-outline
sudo docker-compose -f outline-docker-compose.yml down
sudo docker-compose -f outline-docker-compose.yml up -d
```

### 5.3 還原 Polaris Parent 資料庫

```bash
# 先清空再匯入（會覆蓋現有資料）
sudo docker exec -i polaris_db psql -U polaris -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" polaris_db
sudo docker exec -i polaris_db psql -U polaris polaris_db < /volume1/docker/backups/20260319_030000/polaris/db.sql
```

### 5.4 還原 Claire Project 資料庫

```bash
sudo docker exec -i claire_db psql -U claire -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" claire_db
sudo docker exec -i claire_db psql -U claire claire_db < /volume1/docker/backups/20260319_030000/claire/db.sql
```

### 5.5 還原 Polaris Outline 資料庫

```bash
# 先停止 Outline 應用（避免寫入衝突）
sudo docker stop outline

# 清空並匯入
sudo docker exec -i postgres-outline psql -U outline -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" outline
sudo docker exec -i postgres-outline psql -U outline outline < /volume1/docker/backups/20260319_030000/outline-polaris/db.sql

# 重新啟動
sudo docker start outline
```

### 5.6 還原 Claire Outline 資料庫

```bash
sudo docker stop outline-claire

sudo docker exec -i postgres-outline-claire psql -U outline_claire -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" outline_claire
sudo docker exec -i postgres-outline-claire psql -U outline_claire outline_claire < /volume1/docker/backups/20260319_030000/outline-claire/db.sql

sudo docker start outline-claire
```

### 5.7 還原上傳檔案

```bash
# Polaris Parent 上傳檔案
cp -r /volume1/docker/backups/20260319_030000/polaris/uploads/* \
      /volume1/docker/OWS_PJs/deploy/uploads/

# Claire Project 上傳檔案
cp -r /volume1/docker/backups/20260319_030000/claire/uploads/* \
      /volume1/docker/OWS_PJs/deploy_claire/uploads/
```

### 5.8 還原 Outline MinIO 檔案

```bash
# Polaris Outline
cp -r /volume1/docker/backups/20260319_030000/outline-polaris/minio/* \
      /volume1/docker/outline/data/minio/

# Claire Outline
cp -r /volume1/docker/backups/20260319_030000/outline-claire/minio/* \
      /volume1/docker/outline-claire/data/minio/
```

### 5.9 全專案完整還原（災難恢復）

如果需要從零開始重建整個環境：

```bash
BACKUP="/volume1/docker/backups/20260319_030000"

# 1. 還原所有 .env
cp "$BACKUP/env/polaris.env.production"  /volume1/docker/OWS_PJs/deploy/.env.production
cp "$BACKUP/env/claire.env.production"   /volume1/docker/OWS_PJs/deploy_claire/.env.production
cp "$BACKUP/env/outline-polaris.env"     /volume1/docker/OWS_PJs/Duc/km-outline/.env
cp "$BACKUP/env/outline-claire.env"      /volume1/docker/OWS_PJs/Duc/km-outline-claire/.env

# 2. 啟動所有容器
cd /volume1/docker/OWS_PJs/deploy && sudo docker-compose up -d
cd /volume1/docker/OWS_PJs/deploy_claire && sudo docker-compose up -d
cd /volume1/docker/OWS_PJs/Duc/km-outline && sudo docker-compose -f outline-docker-compose.yml up -d
cd /volume1/docker/OWS_PJs/Duc/km-outline-claire && sudo docker-compose up -d

# 3. 等待所有資料庫 healthy（約 30 秒）
sleep 30

# 4. 匯入所有資料庫
sudo docker exec -i polaris_db psql -U polaris polaris_db < "$BACKUP/polaris/db.sql"
sudo docker exec -i claire_db psql -U claire claire_db < "$BACKUP/claire/db.sql"
sudo docker exec -i postgres-outline psql -U outline outline < "$BACKUP/outline-polaris/db.sql"
sudo docker exec -i postgres-outline-claire psql -U outline_claire outline_claire < "$BACKUP/outline-claire/db.sql"

# 5. 還原上傳檔案
cp -r "$BACKUP/polaris/uploads/"* /volume1/docker/OWS_PJs/deploy/uploads/ 2>/dev/null
cp -r "$BACKUP/claire/uploads/"* /volume1/docker/OWS_PJs/deploy_claire/uploads/ 2>/dev/null
cp -r "$BACKUP/outline-polaris/minio/"* /volume1/docker/outline/data/minio/ 2>/dev/null
cp -r "$BACKUP/outline-claire/minio/"* /volume1/docker/outline-claire/data/minio/ 2>/dev/null

# 6. 重啟所有服務確保生效
sudo docker restart polaris_frontend polaris_backend
sudo docker restart claire_frontend claire_backend
sudo docker restart outline outline-claire
```

---

## 6. 異地備份建議

本腳本的備份存放在同一台 NAS 上。如果硬碟損壞，備份也會一起遺失。
建議加上至少一種異地備份：

| 方案 | 設定方式 | 適合情境 |
|------|---------|---------|
| **Synology Hyper Backup** | DSM → 套件中心安裝 → 設定備份 `/volume1/docker/backups/` 到外接硬碟或雲端 | 最簡單，推薦 |
| **USB 外接硬碟** | 插上 USB 硬碟，Hyper Backup 選擇本機 USB 目的地 | 低成本 |
| **Google Drive / OneDrive** | Hyper Backup 支援直接備份到雲端硬碟 | 異地安全 |
| **rsync 到另一台機器** | 腳本最後加 `rsync -avz $BACKUP_DIR user@remote:/backups/` | 進階用戶 |

---

## 7. 常見問題

### Q: 備份時某個容器沒在運行怎麼辦？

腳本會跳過未運行的容器並顯示 `[ERROR]`，不會中斷整體備份。其他項目仍會正常備份。

### Q: 還原資料庫會覆蓋現有資料嗎？

會。還原操作會先清空再匯入，**現有資料會被完全取代**。請確認你要還原的備份版本是正確的。

### Q: 我只是 .env 不見了，資料庫還在，需要還原資料庫嗎？

不需要。只要還原 `.env` 然後重啟容器即可（參考 5.2 節），這次的事件就是這種情況。

### Q: 備份佔用太多空間怎麼辦？

調整 `backup_all.sh` 中的 `KEEP_DAYS` 數值（預設 30 天），或手動刪除舊備份：

```bash
# 查看各備份大小
du -sh /volume1/docker/backups/*/

# 手動刪除特定備份
rm -rf /volume1/docker/backups/20260301_030000
```

### Q: 如何驗證備份是否正常？

```bash
# 檢查 SQL 檔案不為空
ls -lh /volume1/docker/backups/最新時間戳/polaris/db.sql
ls -lh /volume1/docker/backups/最新時間戳/claire/db.sql
ls -lh /volume1/docker/backups/最新時間戳/outline-polaris/db.sql
ls -lh /volume1/docker/backups/最新時間戳/outline-claire/db.sql

# 檢查 .env 備份存在
ls -la /volume1/docker/backups/最新時間戳/env/
```
