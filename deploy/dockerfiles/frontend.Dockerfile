# =============================================================================
# Polaris Parent Frontend - Production Dockerfile
# =============================================================================
# Build context: 專案根目錄 (OWS_PJs/)
# Build: docker build -f deploy/dockerfiles/frontend.Dockerfile -t polaris-frontend .
# =============================================================================

# ---- Stage 1: Install + Build ----
FROM node:18-alpine AS builder
WORKDIR /app

# 複製完整的 monorepo 結構（包含 workspace 套件原始碼）
COPY package.json package-lock.json* ./
COPY packages/ui/ ./packages/ui/
COPY sites/Polaris_Parent/frontend/ ./sites/Polaris_Parent/frontend/

# 安裝依賴（workspace-aware，會正確建立 @ows/ui symlink）
RUN npm install

# Build arguments（會 bake 進 Next.js 靜態輸出）
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SITE_NAME="Polaris Parent"
ARG GCS_BUCKET_NAME

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SITE_NAME=$NEXT_PUBLIC_SITE_NAME \
    GCS_BUCKET_NAME=$GCS_BUCKET_NAME \
    NEXT_TELEMETRY_DISABLED=1

# 在前端目錄執行 build
WORKDIR /app/sites/Polaris_Parent/frontend
RUN npm run build

# ---- Stage 2: Runner（輕量化執行環境）----
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 複製 standalone 輸出
COPY --from=builder --chown=nextjs:nodejs /app/sites/Polaris_Parent/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/sites/Polaris_Parent/frontend/.next/static ./sites/Polaris_Parent/frontend/.next/static

# 使用 RUN 指令來安全地複製 public 資料夾，避免因為資料夾不存在而導致建置失敗
RUN if [ -d /app/sites/Polaris_Parent/frontend/public ]; then \
    cp -r /app/sites/Polaris_Parent/frontend/public ./sites/Polaris_Parent/frontend/public; \
    fi

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "sites/Polaris_Parent/frontend/server.js"]
