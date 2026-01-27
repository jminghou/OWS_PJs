# Git Submodule 詳細操作指南

本文件旨在詳細說明本專案（OWS_PJs）如何使用 Git Submodule 管理 `core` 核心引擎，以及開發者在日常工作中如何進行環境設定、上傳與更新。

---

## 0. 目前倉庫配置 (Repository Configuration)

本專案由以下兩個 GitHub 倉庫組成：

1.  **主專案倉庫 (Main Project)**
    *   **名稱**：`Ows-PJs`
    *   **遠端地址**：`https://github.com/jminghou/Ows-PJs.git`
    *   **內容**：包含所有站點 (`sites/`)、部署配置 (`docker-compose.yml`) 以及子模組引用資訊。

2.  **核心引擎倉庫 (Core Submodule)**
    *   **名稱**：`Ows_Core`
    *   **遠端地址**：`https://github.com/jminghou/Ows_Core.git`
    *   **內容**：存放共用的後端核心代碼 (`core/`)，作為主專案的子模組。

---

## 1. 基本概念：什麼是 Git Submodule？

Git Submodule 允許你將一個 Git 倉庫（例如 `core`）嵌入到另一個 Git 倉庫（主專案 `OWS_PJs`）中。

*   **主專案**：只紀錄 Submodule 的**遠端 URL** 以及一個**特定的 Commit ID**。
*   **Submodule**：是一個獨立的 Git 倉庫，有自己的提交歷史和分支。

**關鍵點**：主專案並不會儲存 Submodule 的程式碼文件，而是紀錄「現在應該指向 Submodule 的哪一個版本」。

---

## 2. 環境設定 (Environment Setup)

### A. 對於新加入的開發者 (克隆專案)

如果你是第一次下載這個專案，有兩種方式可以確保 Submodule 被正確拉取：

**方式 1：克隆時一併初始化 (推薦)**
```bash
git clone --recurse-submodules [主專案_URL]
```

**方式 2：先克隆，後初始化**
如果你已經執行了 `git clone` 但發現 `core` 資料夾是空的：
```bash
# 進入專案目錄
cd OWS_PJs

# 初始化並更新 Submodule
git submodule update --init --recursive
```

### B. 檢查 Submodule 狀態
執行以下指令可以查看目前 Submodule 指向的版本：
```bash
git submodule status
```
*   如果前面有 `-`，代表 Submodule 尚未初始化。
*   如果前面有 `+`，代表 Submodule 當前的 Commit 與主專案紀錄的不一致。

---

## 3. 修改與上傳 (Upload / Commit)

在開發過程中，你可能會同時修改「站點特有代碼」與「核心引擎代碼 (`core`)」。

### 流程 A：只修改主專案 (sites, docker-compose 等)
這與一般 Git 操作完全相同：
```bash
git add sites/Polaris_Parent/...
git commit -m "Update site feature"
git push origin main
```

### 流程 B：修改 Core 核心引擎 (重要！)
**切記：必須遵守「先子後主」的順序，否則會導致其他開發者無法拉取代碼。**

1.  **進入 core 目錄並切換分支**：
    ```bash
    cd core
    git checkout main  # 確保你在主分支上進行修改
    ```
2.  **在 Core 倉庫進行修改、提交並 Push (先子)**：
    ```bash
    git add .
    git commit -m "Fix core engine bug"
    git push origin main  # 務必先將子模組推送到遠端
    ```
3.  **回到主專案更新引用並 Push (後主)**：
    核心代碼推送到遠端後，主專案需要更新它指向的 Commit ID。
    ```bash
    cd ..
    git add .             # 這會同時加入 sites 的修改與 core 的版本更新
    git commit -m "Update site and core submodule reference"
    git push origin main  # 最後推送主專案
    ```

---

## 4. 更新與同步 (Sync / Update)

當團隊中其他成員更新了 `core` 並推送到主專案後，你需要同步這些變更。

### A. 拉取主專案與 Submodule 的更新
如果你執行 `git pull` 發現 `core` 的 Commit ID 變了，你需要手動更新子模組：
```bash
git pull origin main
git submodule update --init --recursive
```
*提示：你可以設定 `git config --global submodule.recurse true`，讓 `git pull` 自動更新子模組。*

### B. 強制將 Core 更新到遠端最新版
如果你想放棄本地的 `core` 偏移，直接同步到遠端 `core` 的最新提交：
```bash
git submodule update --remote --merge core
```

---

## 5. 常見問題排除 (Troubleshooting)

### Q: 為什麼 `core` 資料夾是空的？
**A**: 執行 `git submodule update --init --recursive` 即可。

### Q: 出現 "Detached HEAD" 警告怎麼辦？
**A**: 這是子模組的正常現象。如果你要進行修改，請務必先在 `core` 目錄下執行 `git checkout main`。

### Q: 如果我不小心在 Submodule 裡面改了東西，但沒有 Push 就更新了？
**A**: `git submodule update` 可能會覆蓋你的修改。在更新前，請確保子模組內的變更已提交 (Commit) 或儲存 (Stash)。

### Q: 提交主專案時，看到 `core` 有變更 (modified content, untracked content)？
**A**: 這通常是因為你在 `core` 內部做了修改但還沒在 `core` 倉庫提交，或是 `core` 的版本與主專案紀錄的不同。請按照 **3. 流程 B** 處理。

---

## 常用指令清單

| 功能 | 指令 |
| :--- | :--- |
| 初始化與更新 | `git submodule update --init --recursive` |
| 查看狀態 | `git submodule status` |
| 更新 core 到遠端最新 | `git submodule update --remote core` |
| 進入 core 開發 | `cd core && git checkout main` |
| 同步 URL 變更 | `git submodule sync` |
