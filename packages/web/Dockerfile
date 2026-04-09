FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app/packages/web
COPY packages/web/package.json ./
RUN npm install

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/packages/web/node_modules ./packages/web/node_modules
COPY packages/web ./packages/web
WORKDIR /app/packages/web
RUN npx prisma generate
# Create an initialized database template with schema + seed data
ENV DATABASE_URL=file:/app/packages/web/init.db
RUN npx prisma db push --skip-generate
RUN npx tsx prisma/seed.ts
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    apk add --no-cache su-exec sqlite

# Copy standalone output
COPY --from=builder /app/packages/web/.next/standalone ./
COPY --from=builder /app/packages/web/.next/static ./.next/static
COPY --from=builder /app/packages/web/public ./public

# Copy Prisma runtime (needed by the app)
COPY --from=builder /app/packages/web/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/packages/web/node_modules/@prisma ./node_modules/@prisma

# Copy initialized database template
COPY --from=builder /app/packages/web/init.db ./init.db

# Create data directory
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

# Entrypoint
COPY packages/web/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3130
ENV PORT=3130
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./docker-entrypoint.sh"]
