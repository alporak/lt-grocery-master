# LT Grocery Price Checker

Self-hosted Lithuanian grocery price comparison app. Scrapes prices from IKI, PROMO Cash&Carry, Barbora, and Rimi, then helps you find where to shop cheapest.

## Features

- Price scraping from 4 Lithuanian grocery e-shops
- Grocery list with price comparison across stores
- Historical price charts
- Nearest store calculator with store size info
- Lithuanian / English language support (LibreTranslate)
- Dark / Light / Šaltibarščiai (pink) themes
- Mobile-friendly responsive UI

## Quick Start

```bash
cp .env.example .env
docker compose up --build
```

Open http://localhost:3000

## Architecture

| Service | Description | Port |
|---------|-------------|------|
| web | Next.js app (UI + API) | 3000 |
| scraper | Playwright-based price scraper (cron) | — |
| libretranslate | Self-hosted translation API | 5000 |

## Development

```bash
npm install
cd packages/web && npm run dev
cd packages/scraper && npm run dev
```
