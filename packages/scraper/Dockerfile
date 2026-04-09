FROM node:20

# Install Playwright dependencies
RUN npx playwright install-deps chromium
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

ENTRYPOINT ["/app/packages/scraper/docker-entrypoint.sh"]
