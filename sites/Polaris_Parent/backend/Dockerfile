# =============================================================================
# Polaris Parent Backend Dockerfile
# =============================================================================
# Build: docker build -t polaris-backend -f sites/Polaris_Parent/backend/Dockerfile .
# Run:   docker run -p 5000:5000 --env-file sites/Polaris_Parent/.env polaris-backend

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
COPY sites/Polaris_Parent/backend/requirements.txt /app/site_requirements.txt
RUN if [ -f /app/site_requirements.txt ]; then \
        pip install --no-cache-dir -r /app/site_requirements.txt; \
    fi

# Copy core engine
COPY core /app/core

# Copy site backend
COPY sites/Polaris_Parent/backend /app/sites/Polaris_Parent/backend

# Create uploads directory
RUN mkdir -p /app/uploads /app/logs

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser \
    && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/v1/health || exit 1

# Run with gunicorn
CMD ["gunicorn", \
     "--bind", "0.0.0.0:5000", \
     "--workers", "4", \
     "--threads", "2", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "sites.Polaris_Parent.backend.app:app"]
