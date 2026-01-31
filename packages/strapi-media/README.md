# Strapi Media Hub

媒體管理系統，用於管理相片、影片等媒體檔案的元資料。本專案已優化為 **Strapi 5 + PostgreSQL + Google Cloud Storage (GCS)** 架構。

## 快速開始

### 開發模式 (Hybrid Mode A)
適用於需要修改 Content Types 結構時。
```bash
# 確保 .env 中 DATABASE_CLIENT=postgres
npm run dev:strapi
```

### 生產模式 (Docker Mode B)
適用於日常開發或部署。
```bash
docker-compose up -d strapi
```

**首次啟動**：請訪問 `http://localhost:1337/admin` 建立管理員帳號。

---

## 核心架構說明

### 1. 資料庫 (PostgreSQL)
本專案已捨棄 SQLite，統一使用 PostgreSQL。
- **本機開發**：連接至 `localhost:5433` (Docker 映射)。
- **生產環境 (Railway)**：連接至 Railway 內建 PostgreSQL。
- **Schema 隔離**：Strapi 資料表存放於 `strapi` schema 中。

### 2. 媒體儲存 (GCS)
所有媒體檔案均儲存於 Google Cloud Storage，不再佔用伺服器空間。
- **自動裁剪**：上傳時會自動產生 `large`, `medium`, `small`, `thumbnail` 四種尺寸。
- **尺寸定義**：可在 `config/plugins.js` 的 `upload.config.breakpoints` 中調整。
- **同步刪除**：在 Strapi 媒體庫刪除檔案時，GCS 上的所有版本會同步清理。

---

## 資料同步與管理

### 1. 環境間資料同步 (Railway -> 本機)
若要將 Railway 的媒體記錄同步回本機，請使用 Strapi Data Transfer：
1. 在 Railway Admin -> Settings -> Transfer Tokens 建立一個 **Pull** Token。
2. 在本機執行：
   ```bash
   npx strapi transfer --from https://你的-railway-網址.app/admin
   ```
3. 輸入 Token 即可同步「帳本」資訊。

### 2. 撥亂反正：重置資料庫
若資料庫結構混亂（例如出現 `relation "xxx" does not exist` 或欄位衝突），請執行以下「打掉重練」流程：
1. **清空資料庫**：
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   DROP SCHEMA IF EXISTS strapi CASCADE;
   ```
2. **重啟 Strapi**：Strapi 啟動時偵測到空資料庫，會根據 `schema.json` 自動建立所有「原生」資料表。**不再需要手動執行初始化腳本。**

---

## 現有 Collection Types

| Collection | 說明 | 關聯類型 |
|------------|------|----------|
| Tag | 標籤系統 | - |
| Category | 分類系統 | - |
| MediaMeta | 媒體元資料 | tags (manyToMany), category (manyToMany) |

### MediaMeta 結構參考
- `chartid`: 18 字元字串
- `place`: 拍攝地點
- `copyright`: 版權資訊
- `isPublic`: 是否公開
- `file`: 關聯至 Strapi Media Library

---

## 常見問題 (FAQ)

**Q: 為什麼我在網頁端上傳了圖片，本機媒體庫卻是空的？**
A: 因為圖片記錄存在 Railway 的資料庫中。請參考 [資料同步](#1-環境間資料同步-railway---本機) 章節進行同步。

**Q: 為什麼啟動時報錯 Port 1337 already used？**
A: 通常是因為 Docker 容器已佔用該埠口。請執行 `docker-compose stop strapi` 後再試。

**Q: 如何修改圖片裁剪的尺寸？**
A: 編輯 `config/plugins.js`，在 `upload.config.breakpoints` 中定義像素寬度。

---

## 相關資源
- [Strapi 官方文件](https://docs.strapi.io)
- [GCS 插件文件](https://github.com/strapi-community/strapi-provider-upload-google-cloud-storage)
