#!/bin/bash
# =============================================================================
#  OWS 全專案備份腳本
#  涵蓋：Polaris Parent + Claire Project + 兩個 Outline 知識庫
#  用法：sudo bash /volume1/docker/OWS_PJs/deploy/backup_all.sh
#  建議：在 Synology 任務排程中設定每日或每週自動執行
# =============================================================================

set -euo pipefail

# --- 設定 ---
BACKUP_ROOT="/volume1/docker/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_ROOT/$DATE"
KEEP_DAYS=30  # 保留最近 30 天的備份

# 專案路徑
POLARIS_DEPLOY="/volume1/docker/OWS_PJs/deploy"
CLAIRE_DEPLOY="/volume1/docker/OWS_PJs/deploy_claire"
POLARIS_OUTLINE_DEPLOY="/volume1/docker/OWS_PJs/Duc/km-outline"
CLAIRE_OUTLINE_DEPLOY="/volume1/docker/OWS_PJs/Duc/km-outline-claire"
POLARIS_OUTLINE_DATA="/volume1/docker/outline/data"
CLAIRE_OUTLINE_DATA="/volume1/docker/outline-claire/data"

# 顏色輸出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
log_err()  { echo -e "${RED}[ERROR]${NC} $1"; }
log_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

# --- 建立備份目錄 ---
mkdir -p "$BACKUP_DIR"/{polaris,claire,outline-polaris,outline-claire,env}
log_info "備份目錄: $BACKUP_DIR"

# =============================================================================
# 1. 環境變數備份（最重要！）
# =============================================================================
log_info "=== 備份環境變數 ==="

for src in \
  "$POLARIS_DEPLOY/.env.production:env/polaris.env.production" \
  "$CLAIRE_DEPLOY/.env.production:env/claire.env.production" \
  "$POLARIS_OUTLINE_DEPLOY/.env:env/outline-polaris.env" \
  "$CLAIRE_OUTLINE_DEPLOY/.env:env/outline-claire.env"; do
  file="${src%%:*}"
  dest="${src##*:}"
  if [ -f "$file" ]; then
    cp "$file" "$BACKUP_DIR/$dest"
    log_ok "環境變數: $file"
  else
    log_err "找不到: $file"
  fi
done

# =============================================================================
# 2. Polaris Parent 資料庫
# =============================================================================
log_info "=== 備份 Polaris Parent 資料庫 ==="

if docker ps --format '{{.Names}}' | grep -q '^polaris_db$'; then
  docker exec polaris_db pg_dump -U polaris polaris_db \
    > "$BACKUP_DIR/polaris/db.sql" 2>/dev/null
  log_ok "Polaris DB ($(du -h "$BACKUP_DIR/polaris/db.sql" | cut -f1))"
else
  log_err "polaris_db 容器未運行，跳過"
fi

# =============================================================================
# 3. Polaris Parent 上傳檔案
# =============================================================================
log_info "=== 備份 Polaris Parent 上傳檔案 ==="

if [ -d "$POLARIS_DEPLOY/uploads" ]; then
  cp -r "$POLARIS_DEPLOY/uploads" "$BACKUP_DIR/polaris/uploads"
  log_ok "Polaris 上傳檔案"
else
  log_info "Polaris 無上傳目錄，跳過"
fi

# =============================================================================
# 4. Claire Project 資料庫
# =============================================================================
log_info "=== 備份 Claire Project 資料庫 ==="

if docker ps --format '{{.Names}}' | grep -q '^claire_db$'; then
  docker exec claire_db pg_dump -U claire claire_db \
    > "$BACKUP_DIR/claire/db.sql" 2>/dev/null
  log_ok "Claire DB ($(du -h "$BACKUP_DIR/claire/db.sql" | cut -f1))"
else
  # 嘗試用 ows_postgres（舊容器名稱）
  if docker ps --format '{{.Names}}' | grep -q '^ows_postgres$'; then
    docker exec ows_postgres pg_dump -U claire claire_db \
      > "$BACKUP_DIR/claire/db.sql" 2>/dev/null
    log_ok "Claire DB via ows_postgres ($(du -h "$BACKUP_DIR/claire/db.sql" | cut -f1))"
  else
    log_err "claire_db 容器未運行，跳過"
  fi
fi

# =============================================================================
# 5. Claire Project 上傳檔案
# =============================================================================
log_info "=== 備份 Claire Project 上傳檔案 ==="

if [ -d "$CLAIRE_DEPLOY/uploads" ]; then
  cp -r "$CLAIRE_DEPLOY/uploads" "$BACKUP_DIR/claire/uploads"
  log_ok "Claire 上傳檔案"
else
  log_info "Claire 無上傳目錄，跳過"
fi

# =============================================================================
# 6. Polaris Outline 知識庫
# =============================================================================
log_info "=== 備份 Polaris Outline 知識庫 ==="

if docker ps --format '{{.Names}}' | grep -q '^postgres-outline$'; then
  docker exec postgres-outline pg_dump -U outline outline \
    > "$BACKUP_DIR/outline-polaris/db.sql" 2>/dev/null
  log_ok "Polaris Outline DB ($(du -h "$BACKUP_DIR/outline-polaris/db.sql" | cut -f1))"
else
  log_err "postgres-outline 容器未運行，跳過"
fi

if [ -d "$POLARIS_OUTLINE_DATA/minio" ]; then
  cp -r "$POLARIS_OUTLINE_DATA/minio" "$BACKUP_DIR/outline-polaris/minio"
  log_ok "Polaris Outline MinIO 檔案"
fi

# =============================================================================
# 7. Claire Outline 知識庫
# =============================================================================
log_info "=== 備份 Claire Outline 知識庫 ==="

if docker ps --format '{{.Names}}' | grep -q '^postgres-outline-claire$'; then
  docker exec postgres-outline-claire pg_dump -U outline_claire outline_claire \
    > "$BACKUP_DIR/outline-claire/db.sql" 2>/dev/null
  log_ok "Claire Outline DB ($(du -h "$BACKUP_DIR/outline-claire/db.sql" | cut -f1))"
else
  log_err "postgres-outline-claire 容器未運行，跳過"
fi

if [ -d "$CLAIRE_OUTLINE_DATA/minio" ]; then
  cp -r "$CLAIRE_OUTLINE_DATA/minio" "$BACKUP_DIR/outline-claire/minio"
  log_ok "Claire Outline MinIO 檔案"
fi

# =============================================================================
# 8. Docker Compose 設定檔備份
# =============================================================================
log_info "=== 備份 Docker Compose 設定檔 ==="

mkdir -p "$BACKUP_DIR/compose"
for f in \
  "$POLARIS_DEPLOY/docker-compose.yml" \
  "$CLAIRE_DEPLOY/docker-compose.yml" \
  "$POLARIS_OUTLINE_DEPLOY/outline-docker-compose.yml" \
  "$CLAIRE_OUTLINE_DEPLOY/docker-compose.yml"; do
  if [ -f "$f" ]; then
    cp "$f" "$BACKUP_DIR/compose/$(echo "$f" | sed 's|/volume1/docker/OWS_PJs/||;s|/|_|g')"
    log_ok "Compose: $f"
  fi
done

# =============================================================================
# 9. Cloudflare Tunnel 設定備份
# =============================================================================
log_info "=== 備份 Cloudflare Tunnel 設定 ==="

TUNNEL_CONFIG=$(find /volume1/docker -name "config.yml" -path "*cloudflare*" 2>/dev/null | head -1)
if [ -n "$TUNNEL_CONFIG" ]; then
  cp "$TUNNEL_CONFIG" "$BACKUP_DIR/compose/cloudflare_tunnel_config.yml"
  log_ok "Cloudflare Tunnel config"
else
  log_info "未找到 Tunnel 設定檔，跳過"
fi

# =============================================================================
# 10. 清理舊備份
# =============================================================================
log_info "=== 清理 ${KEEP_DAYS} 天前的舊備份 ==="

OLD_COUNT=$(find "$BACKUP_ROOT" -maxdepth 1 -mindepth 1 -type d -mtime +$KEEP_DAYS 2>/dev/null | wc -l)
if [ "$OLD_COUNT" -gt 0 ]; then
  find "$BACKUP_ROOT" -maxdepth 1 -mindepth 1 -type d -mtime +$KEEP_DAYS -exec rm -rf {} \;
  log_ok "已清理 $OLD_COUNT 個舊備份"
else
  log_info "無需清理"
fi

# =============================================================================
# 完成
# =============================================================================
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo ""
echo "============================================="
echo -e "${GREEN}備份完成！${NC}"
echo "---------------------------------------------"
echo "備份位置: $BACKUP_DIR"
echo "備份大小: $TOTAL_SIZE"
echo "備份內容:"
echo "  - Polaris Parent:  DB + 上傳檔案 + .env"
echo "  - Claire Project:  DB + 上傳檔案 + .env"
echo "  - Polaris Outline: DB + MinIO + .env"
echo "  - Claire Outline:  DB + MinIO + .env"
echo "  - Docker Compose 設定檔"
echo "  - Cloudflare Tunnel 設定"
echo "============================================="
