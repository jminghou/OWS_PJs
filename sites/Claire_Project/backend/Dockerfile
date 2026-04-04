# =============================================================================
# Claire Project Backend - Production Dockerfile
# =============================================================================
# Build context: 專案根目錄 (OWS_PJs/)
# Build: docker build -f sites/Claire_Project/backend/Dockerfile -t claire-backend .
# =============================================================================

# ---- Stage 1: Builder (編譯 C 擴展) ----
FROM python:3.11-alpine AS builder

RUN apk add --no-cache \
    build-base \
    postgresql-dev \
    libffi-dev

WORKDIR /app

# 安裝 Python 依賴（利用 Docker layer cache）
COPY core/requirements.txt /app/core_requirements.txt
COPY sites/Claire_Project/backend/requirements.txt /app/site_requirements.txt

RUN pip install --no-cache-dir --prefix=/install \
    -r /app/core_requirements.txt && \
    if [ -s /app/site_requirements.txt ]; then \
        pip install --no-cache-dir --prefix=/install -r /app/site_requirements.txt; \
    fi

# ---- Stage 2: Runtime ----
FROM python:3.11-alpine

RUN apk add --no-cache libpq curl

WORKDIR /app

# 從 builder 複製已編譯的 Python 套件
COPY --from=builder /install /usr/local

# 複製應用程式碼
COPY core /app/core
COPY packages/media_lib /app/packages/media_lib
COPY sites/__init__.py /app/sites/__init__.py
COPY sites/Claire_Project/__init__.py /app/sites/Claire_Project/__init__.py
COPY sites/Claire_Project/backend /app/sites/Claire_Project/backend

# 建立必要目錄
RUN mkdir -p /app/uploads /app/logs

# 非 root 使用者
RUN addgroup -S appuser && adduser -S appuser -G appuser \
    && chown -R appuser:appuser /app
USER appuser

# 環境變數
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

EXPOSE ${PORT:-5000}

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT:-5000}/health || exit 1

# Gunicorn：Railway 會注入 PORT 環境變數；Docker 部署預設 5000
CMD ["sh", "-c", "gunicorn \
    --bind 0.0.0.0:${PORT:-5000} \
    --workers ${GUNICORN_WORKERS:-2} \
    --threads 2 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    sites.Claire_Project.backend.app:app"]
