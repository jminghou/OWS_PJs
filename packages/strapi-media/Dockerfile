# =============================================================================
# Strapi Media Hub - Multi-Environment Dockerfile
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

# Install ALL dependencies
RUN npm ci

# Copy source files
COPY . .

# Ensure no local .env files are present
RUN rm -f .env .env.* 2>/dev/null || true

# Build Strapi admin panel (required for both dev and prod in some cases)
ENV NODE_ENV=production
RUN npm run build

# Copy config files to dist/config (they should not be processed by TypeScript)
RUN mkdir -p dist/config && cp -r config/* dist/config/

# =============================================================================
# Runner Stage
# =============================================================================
FROM base AS runner

WORKDIR /app

# Default to production, but can be overridden
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 strapi

# Copy everything from builder
COPY --from=builder --chown=strapi:nodejs /app ./

# Create required directories with proper permissions
RUN mkdir -p /app/public/uploads /app/database/migrations /app/.tmp && \
    chown -R strapi:nodejs /app/public/uploads /app/database /app/.tmp

USER strapi

EXPOSE 1337

# Use a shell script to determine which command to run based on NODE_ENV
CMD ["sh", "-c", "if [ \"$NODE_ENV\" = \"development\" ]; then npm run develop; else npm run start; fi"]
