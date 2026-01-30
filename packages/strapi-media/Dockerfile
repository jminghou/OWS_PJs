# =============================================================================
# Strapi Media Hub - Production Dockerfile
# =============================================================================

FROM node:20-alpine AS base

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat

WORKDIR /app

# =============================================================================
# Builder Stage
# =============================================================================
FROM base AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source files (excluding .env via .dockerignore)
COPY . .

# Ensure no local .env files are present
RUN rm -f .env .env.* 2>/dev/null || true

# Build Strapi admin panel
ENV NODE_ENV=production
RUN npm run build

# Remove dist/config to ensure runtime uses config/ directory with our JS files
RUN rm -rf dist/config 2>/dev/null || true

# Note: Don't run npm prune --production as it removes admin panel build files

# =============================================================================
# Production Stage
# =============================================================================
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 strapi

# Copy entire app from builder (simpler approach to ensure all build artifacts are included)
COPY --from=builder --chown=strapi:nodejs /app ./

# Create required directories with proper permissions
RUN mkdir -p /app/public/uploads /app/database/migrations /app/.tmp && \
    chown -R strapi:nodejs /app/public/uploads /app/database /app/.tmp

USER strapi

EXPOSE 1337

CMD ["npm", "run", "start"]
