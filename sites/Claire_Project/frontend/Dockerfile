# =============================================================================
# Claire Project Frontend - Production Dockerfile
# =============================================================================
# Build context: 專案根目錄 (OWS_PJs/)
# Build: docker build -f sites/Claire_Project/frontend/Dockerfile -t claire-frontend .
# =============================================================================

# ---- Stage 1: Install + Build ----
FROM node:18-alpine AS builder
WORKDIR /app

# 複製完整的 monorepo 結構（包含 workspace 套件原始碼）
COPY package.json package-lock.json* ./
COPY packages/ui/ ./packages/ui/
COPY sites/Claire_Project/frontend/ ./sites/Claire_Project/frontend/

# 安裝依賴（workspace-aware，會正確建立 @ows/ui symlink）
RUN npm install

# Build arguments（會 bake 進 Next.js 靜態輸出）
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SITE_NAME="Claire Project"

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SITE_NAME=$NEXT_PUBLIC_SITE_NAME \
    NEXT_TELEMETRY_DISABLED=1

# 在前端目錄執行 build
WORKDIR /app/sites/Claire_Project/frontend
RUN npm run build

# ---- Stage 2: Runner（輕量化執行環境）----
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 複製 standalone 輸出
COPY --from=builder --chown=nextjs:nodejs /app/sites/Claire_Project/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/sites/Claire_Project/frontend/.next/static ./sites/Claire_Project/frontend/.next/static

# 安全地複製 public 資料夾（避免因資料夾不存在而建置失敗）
RUN if [ -d /app/sites/Claire_Project/frontend/public ]; then \
    cp -r /app/sites/Claire_Project/frontend/public ./sites/Claire_Project/frontend/public; \
    fi

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "sites/Claire_Project/frontend/server.js"]
