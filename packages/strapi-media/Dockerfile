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

# Copy source files
COPY . .

# Build Strapi admin panel
ENV NODE_ENV=production
RUN npm run build

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

# Copy built application
COPY --from=builder --chown=strapi:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=strapi:nodejs /app/dist ./dist
COPY --from=builder --chown=strapi:nodejs /app/public ./public
COPY --from=builder --chown=strapi:nodejs /app/config ./config
COPY --from=builder --chown=strapi:nodejs /app/src ./src
COPY --from=builder --chown=strapi:nodejs /app/database ./database
COPY --from=builder --chown=strapi:nodejs /app/package.json ./package.json
COPY --from=builder --chown=strapi:nodejs /app/favicon.png ./favicon.png

# Create required directories with proper permissions
RUN mkdir -p /app/public/uploads /app/database/migrations /app/.tmp && \
    chown -R strapi:nodejs /app/public/uploads /app/database /app/.tmp

USER strapi

EXPOSE 1337

CMD ["npm", "run", "start"]
