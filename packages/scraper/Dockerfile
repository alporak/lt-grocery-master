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

CMD ["npm", "start"]
