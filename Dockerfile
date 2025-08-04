# 🐳 Multi-stage build for AiCarpool - Enterprise AI Service Platform
# Optimized for Next.js 15 + React 19 + Node.js 22

# ========================================================================================
# Stage 1: Dependencies - Install all dependencies (dev + prod)
# ========================================================================================
FROM node:22-alpine AS deps

# 📋 Set labels for metadata
LABEL maintainer="aicarpool@codingauto.com"
LABEL description="AiCarpool Enterprise AI Service Carpool Management Platform"
LABEL version="0.9.0"

# 🔧 Install system dependencies
RUN apk add --no-cache \
    libc6-compat \
    curl \
    dumb-init \
    && rm -rf /var/cache/apk/*

# 📁 Set working directory
WORKDIR /app

# 📦 Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# 🔽 Install dependencies
# Use npm ci for reproducible builds
RUN npm ci --frozen-lockfile

# ========================================================================================
# Stage 2: Builder - Build the application
# ========================================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# 📦 Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 🔧 Generate Prisma client
RUN npx prisma generate

# 🏗️ Build Next.js application with standalone output
# This creates a minimal production bundle
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ========================================================================================
# Stage 3: Runner - Production runtime
# ========================================================================================
FROM node:22-alpine AS runner

# 🔧 Install runtime dependencies
RUN apk add --no-cache \
    curl \
    dumb-init \
    mysql-client \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# 👤 Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 📁 Create necessary directories
RUN mkdir -p /app/logs /app/data /app/temp && \
    chown -R nextjs:nodejs /app

# 📋 Copy built application from builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Copy the standalone build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 📦 Copy Prisma files and scripts
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# 🔧 Copy startup script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 🌐 Set environment variables
ENV NODE_ENV=production
ENV PORT=4000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# 🌐 Expose port
EXPOSE 4000

# 🏥 Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:4000/health || exit 1

# 👤 Switch to non-root user
USER nextjs

# 🚀 Start application with dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]