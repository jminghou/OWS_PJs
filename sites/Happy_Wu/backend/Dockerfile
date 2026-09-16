# =============================================================================
# Happy_Wu Backend Dockerfile
# =============================================================================
# Build: docker build -t happy-wu-backend -f sites/Happy_Wu/backend/Dockerfile .
# Run:   docker run -p 5000:5000 --env-file sites/Happy_Wu/.env happy-wu-backend

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install core requirements first (for layer caching)
COPY core/requirements.txt /app/core_requirements.txt
RUN pip install --no-cache-dir -r /app/core_requirements.txt

# Copy and install site-specific requirements (if exists)
COPY sites/Happy_Wu/backend/requirements.txt /app/site_requirements.txt
RUN if [ -f /app/site_requirements.txt ]; then \
        pip install --no-cache-dir -r /app/site_requirements.txt; \
    fi

# Copy core engine
COPY core /app/core

# Copy shared packages
COPY packages/media_lib /app/packages/media_lib
# 電商模組（COMMERCE_ENABLED=true）：factory 以字串 import packages.commerce，映像檔必須帶上
COPY packages/commerce /app/packages/commerce
# Studio 模組（STUDIO_ENABLED=true）
COPY packages/studio /app/packages/studio

# Copy site backend
COPY sites/__init__.py /app/sites/__init__.py
COPY sites/Happy_Wu/__init__.py /app/sites/Happy_Wu/__init__.py
COPY sites/Happy_Wu/backend /app/sites/Happy_Wu/backend

# Create uploads directory
RUN mkdir -p /app/uploads /app/logs

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser \
    && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE ${PORT:-5000}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-5000}/health || exit 1

# Gunicorn：Railway 會注入 PORT 環境變數；Docker 部署預設 5000
CMD ["sh", "-c", "gunicorn \
    --bind 0.0.0.0:${PORT:-5000} \
    --workers ${GUNICORN_WORKERS:-2} \
    --threads 2 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    sites.Happy_Wu.backend.app:app"]
