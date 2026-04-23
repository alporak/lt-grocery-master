# LT Grocery

Self-hosted Lithuanian grocery price tracker. Scrapes IKI, Barbora, Rimi, and PROMO Cash&Carry, enriches products with AI, and lets you build a grocery list with live price comparisons across stores.

## Features

- Price scraping from 4 Lithuanian grocery e-shops (runs on a configurable cron)
- Grocery list with per-item and total cost comparison across stores
- Deals browser and historical price charts
- Semantic product search (multilingual sentence-transformer embeddings)
- AI product enrichment — brand extraction, category normalization via Gemini, Ollama, or Groq
- Nearest store finder with store size info
- Lithuanian / English UI
- Dark / Light / Šaltibarščiai themes

## Quick Start

```bash
cp .env.example .env
# Add at least one GEMINI_API_KEY for product enrichment (free at aistudio.google.com)
docker compose up --build
```

Open http://localhost:3130

## Services

| Service  | Description                                          | Port |
|----------|------------------------------------------------------|------|
| web      | Next.js app — UI, API routes, Prisma/SQLite          | 3130 |
| scraper  | Playwright scraper, runs every `SCRAPE_INTERVAL_HOURS` | —  |
| embedder | Python/FastAPI — embeddings, semantic search, AI enrichment | — |

All services share a single SQLite database via a Docker volume (`grocery-data`).

## Configuration

Key variables in `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | — | Gemini API key for product enrichment (up to 3 keys supported) |
| `GEMINI_MODEL` | `gemini-2.5-flash-preview-04-17` | Model used for enrichment |
| `SCRAPE_INTERVAL_HOURS` | `24` | How often the scraper runs |
| `SCRAPE_HEADLESS` | `true` | Run Playwright headlessly |
| `OLLAMA_URL` | — | Optional: use a local Ollama instance instead of Gemini |

## Development

```bash
npm install

# Web (Next.js)
cd packages/web && npm run dev

# Scraper
cd packages/scraper && npm run dev
```

The embedder requires Python 3.11+ and the packages in `packages/embedder/requirements.txt`.

## Data Management

```bash
# Export product intelligence snapshot
npm run export-data

# Import from a previous snapshot
npm run import-data

# Re-run the full embed → enrich → group → export pipeline
npm run process-embeddings
```

## Architecture

```
packages/
  web/       — Next.js 14, Prisma, Radix UI, next-intl, Tailwind
  scraper/   — Playwright, stores IKI / Barbora / Rimi / PROMO
  embedder/  — FastAPI, sentence-transformers, Gemini/Ollama/Groq enrichment
data/        — SQLite DB + embeddings (git-submodule, also Docker volume)
```
