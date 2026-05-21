# Wandrmark — Smart Local Explorer & Travel Planner

## Quick Start (with Docker)

Docker runs Redis for you. AI is powered by NVIDIA NIM (cloud API — no local model needed).

```bash
# 1. Clone & install
git clone https://github.com/divarun/wandrmark.git
cd wandrmark
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set NVIDIA_API_KEY (required for AI features)
# Get a free key at https://build.nvidia.com/

# 3. Copy .env into backend
cp .env backend/.env

# 4. Start infrastructure (Redis)
docker compose up -d

# 5. Start everything
npm run dev
# → Frontend: http://localhost:3000
# → Backend:  http://localhost:3001
```

## Quick Start (without Docker)

You need Redis running locally (or use a cloud Redis service). Redis is optional — the app works without it, just without caching.

```bash
# 1. Clone & install
git clone https://github.com/divarun/wandrmark.git
cd wandrmark
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your Redis connection string and NVIDIA_API_KEY

# 3. Copy .env into backend
cp .env backend/.env

# 4. Start everything
npm run dev
# → Frontend: http://localhost:3000
# → Backend:  http://localhost:3001
```

> **Note:** Redis is optional. The app works without it — caching and cache warming are simply disabled.

## Environment Variables

Copy `.env.example` to `.env` and `backend/.env`. Key variables:

| Variable | Required | Description |
|---|---|---|
| `NVIDIA_API_KEY` | Yes (for AI) | NIM API key from [build.nvidia.com](https://build.nvidia.com/) |
| `REDIS_URL` | No | Redis URL — defaults to `redis://localhost:6379` |
| `NIM_MODEL` | No | Model name — defaults to `meta/llama-3.1-8b-instruct` |

## Optional

### Pre-warm the cache

The backend auto-warms on startup if Redis is empty. You can also trigger it manually:

```bash
# Warm everything (geocoding + POI data + AI city insights)
cd backend
npm run warm-cache

# Or just geocoding
npm run warm-geocoding
```

Cache warming pre-generates AI insights for all major cities so users see instant results on first load. Insights are cached for 7 days; the cache refreshes automatically every Sunday at midnight.

### Redis Insights

1. Open browser: http://localhost:5540 (requires Docker)
2. Add a Standalone Redis database:

   | Field | Value |
   |---|---|
   | Host | wandrmark-redis |
   | Port | 6379 |
   | Password | (leave blank) |
   | Database | 0 |

3. Test connection → should succeed ✅
4. Browse keys and view data immediately.

**See [Full Developer Guide](Developer_Guide.md) for more details**
