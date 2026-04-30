FROM node:20

# Install git (for data repo sync) and Playwright dependencies
RUN apt-get update && apt-get install -y git curl --no-install-recommends && rm -rf /var/lib/apt/lists/*
RUN npx playwright install-deps chromium

# Install Playwright browsers to shared location (not root's home)
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/pw
RUN npx playwright install chromium

WORKDIR /app/packages/scraper

# Install dependencies
COPY packages/scraper/package.json ./
RUN npm install

# Copy source
COPY packages/scraper ./

# Generate Prisma client
RUN npx prisma generate

# Create data directory
RUN mkdir -p /app/data

# Copy entrypoint
COPY packages/scraper/docker-entrypoint.sh /app/packages/scraper/docker-entrypoint.sh
RUN chmod +x /app/packages/scraper/docker-entrypoint.sh

# Remove stock node user (UID 1000), create nextjs matching host UID/GID (1000:1000)
RUN userdel -r node 2>/dev/null; groupdel node 2>/dev/null; \
    groupadd --gid 1000 nextjs && \
    useradd --uid 1000 --gid 1000 -m nextjs && \
    chown -R nextjs:nextjs /app /opt/pw

USER nextjs

ENTRYPOINT ["/app/packages/scraper/docker-entrypoint.sh"]
