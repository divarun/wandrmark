# Wandrmark - Complete Developer Guide

## Overview

**Wandrmark** is a travel exploration app that combines POI discovery with gamification. Users can explore places near them, plan multi-stop routes, and earn rewards through the "Explorer Passport" system.

**No auth. No database. No login.** All user state lives in `localStorage`.

### Tech Stack
- **Frontend**: Next.js 14, TypeScript, Tailwind, Leaflet maps
- **Backend**: Express.js, Redis (optional — caching only), NVIDIA NIM AI
- **APIs**: Overpass (POIs), Nominatim (geocoding), OSRM (routing)

---

## Application Startup

### When App First Loads

```
1. page.tsx mounts
   ├─ Sets default center: NYC (40.7128, -74.0060)
   └─ Initializes state (mode=explorer, pois=[], plannerPois=[])

2. useEffect runs
   ├─ Checks browser geolocation
   ├─ Success: setMapCenter(user's location)
   └─ Failure: Use default NYC location

3. Call load(mapCenter)
   ├─ usePOIs hook: sets loading=true
   └─ Calls fetchPOIs(center, 1500m, categories)

4. Frontend → POST /api/proxy/overpass
   ├─ Backend checks Redis cache
   ├─ Miss: Query Overpass API
   ├─ Save to Redis (TTL: 1hr)
   └─ Return POI data

5. Frontend maps OSM elements → POI objects
   ├─ Extract name, category, coordinates
   ├─ Filter nulls
   └─ Limit to 30 POIs

6. setPois(results) → UI updates
   ├─ ExplorerSidebar shows list
   ├─ WayvMap shows markers
   └─ Loading indicator disappears

7. PassportPanel initializes
   ├─ Load from localStorage: wandrmark_user_progress
   └─ If none: Create new progress (level 1, 0 XP)
```

### Backend Cache Warmer Startup

```
index.ts calls startCacheWarmer() if Redis is healthy
  ↓
checkInsightsEmpty() — checks if "New York" has AI insights cached
  ├─ Empty → warmTopCities() fires immediately (background)
  │    Step 1/3: Nominatim geocoding for all cities
  │    Step 2/3: Overpass POI fetch for all cities
  │    Step 3/3: NVIDIA NIM AI insights for all cities
  └─ Populated → skip, next run Sunday midnight UTC

Weekly cron: 0 0 * * 0 (Sunday midnight)
  └─ warmTopCities() — refreshes all caches
       AI insights auto-skip if TTL > 1 day (7-day cache)
```

---

## User Flow: City Search

```
User types "Paris" → Presses Enter
  ↓
handleSearch()
  ├─ setSearchLoading(true)
  └─ geocodeSearch("Paris", 5)
      ↓
GET /api/proxy/nominatim/search?q=Paris&limit=5
  ├─ Backend checks Redis (TTL: 24hrs)
  ├─ Miss: Query Nominatim API
  └─ Return 5 results
      ↓
Dropdown appears with cities
  ├─ 📍 Paris, Île-de-France, France
  ├─ 📍 Paris, Texas, USA
  └─ ... (3 more)
      ↓
User clicks "Paris, France"
  ↓
onSearchResult(48.8566, 2.3522)     ← map & POIs update
setInsightCityName("Paris, France") ← triggers city insights fetch
  ↓
POST /api/ai/city-insights { cityName: "Paris, France" }
  ├─ Backend checks Redis (TTL: 7 days, pre-warmed by cron)
  ├─ Hit: Return instantly
  └─ Miss: Generate via NVIDIA NIM → cache → return
      ↓
ExplorerSidebar shows city insights card (above POI list):
  ├─ Overview paragraph
  ├─ Highlight chips (landmarks, experiences)
  ├─ 🏛️ Historical fact
  └─ 💡 Local tip
```

**Key Detail:** `load()` is called immediately when a city is selected, before the map finishes animating. City insights fetch runs in parallel.

---

## User Flow: POI Click

```
User clicks marker → onPoiClick(poi)
  ↓
setSelectedPoi(poi) → Modal opens
  ↓
gamificationService.visitPOI(poi)
  ↓
┌─ Already visited? → Return {isNew: false}
└─ First visit →
    ├─ Mark visited: visitedPOIs.add(poi.id)
    ├─ Create stamp:
    │   ├─ reverseGeocode(coordinates) → "7th arr, Paris, FR"
    │   ├─ Calculate rarity (common/rare/legendary)
    │   └─ Save stamp to passport.stamps[]
    ├─ Update stats: poisVisited++
    ├─ Award XP: +10
    ├─ Check level up: xp >= xpToNextLevel?
    ├─ Check achievements: Visit 1/50/100 POIs?
    ├─ Mystery box: Every 10 POIs
    └─ saveProgress() to localStorage
        ↓
PassportPanel updates in real-time
  ├─ Level bar increases
  ├─ New stamp appears
  └─ Statistics update
```

---

## User Flow: Route Planning

```
User adds POIs to planner (clicks "+" or "Add to Planner")
  ↓
addToPlanner(poi)
  ├─ setPlannerPois([...prev, poi])
  └─ Triggers:
      ├─ Map: Numbered markers (1,2,3...)
      ├─ Planner badge: "3 stops → View Route"
      └─ Clear route (segments=[])
          ↓
User switches to Planner mode
  ↓
PlannerSidebar shows:
  ├─ Drag-to-reorder list
  ├─ Transport mode selector (🚶🚴🚗🚌)
  └─ "Compute Route" button
      ↓
User selects transport mode & clicks "Compute Route"
  ↓
computeTheRoute()
  ├─ Validate: 2+ POIs with real coordinates
  ├─ setRouteLoading(true)
  └─ For each POI pair (A→B, B→C, C→D):
      └─ GET /route/v1/foot/{lon1},{lat1};{lon2},{lat2}
          ↓
OSRM returns:
{
  distance: 1234.5 (meters)
  duration: 987.6 (seconds)
  geometry: [[lng,lat], [lng,lat], ...]
}
  ↓
Convert to RouteSegment:
{
  from: POI_A,
  to: POI_B,
  distance: 1234.5,
  duration: 987.6,
  geometry: [{lat,lng}, ...]
}
  ↓
Aggregate all segments → setRouteSegments()
  ↓
Map renders:
  ├─ Blue polylines connecting POIs
  └─ Auto-fit bounds to show full route
      ↓
Sidebar shows summary:
  ├─ Total: 3.2 km, 45 min
  └─ Each segment with details
```

---

## Explorer Passport System

### Components

**1. Levels & XP**
- Start at level 1 (Tourist)
- Earn 10 XP per new POI
- Formula: `xpToNextLevel = 100 * 1.5^(level-1)`
- Titles: Tourist → Traveler → Explorer → Local Guide → City Expert → Legend

**2. Stamps**
- Earned when visiting new neighborhood
- Contains: neighborhood, city, country, coordinates, rarity
- Rarity: common (major city + hotspot), rare (major city), legendary (small town)

**3. Achievements**
- Predefined goals (visit 1/50/100 POIs, walk 26 miles, etc.)
- Tiers: bronze, silver, gold, platinum
- Auto-unlock when requirements met

**4. Quests**
- Daily challenges (e.g., visit 3 POIs today)
- Progress tracking (0-100%)
- Rewards: XP + mystery box

**5. Mystery Boxes**
- Earned every 10 POIs or quest completion
- Can be opened for AI-generated rewards

### Storage

All data in **localStorage**:
```javascript
wandrmark_user_progress: {
  passport: {
    stamps: [],
    badges: [],
    statistics: { poisVisited, citiesVisited, ... },
    level: { level: 1, xp: 0, title: "Tourist" }
  },
  activeQuests: [],
  achievements: [],
  mysteryBoxes: []
}
wandrmark_visited_pois: ["poi-id-1", "poi-id-2", ...]
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   FRONTEND                          │
│  ┌────────────────────────────────────────────┐    │
│  │ page.tsx (Main orchestrator)               │    │
│  │ • State: mode, mapCenter, selectedPoi,     │    │
│  │   plannerPois, routeSegments               │    │
│  └────────────────────────────────────────────┘    │
│           │                                          │
│  ┌────────┴──────────┬──────────┬──────────┐       │
│  │                   │          │          │       │
│  ▼                   ▼          ▼          ▼       │
│ ┌────────┐  ┌──────────┐  ┌──────┐  ┌──────────┐  │
│ │Explorer│  │ WayvMap  │  │Plan  │  │Passport  │  │
│ │Sidebar │  │(Leaflet) │  │Sidebar│ │Panel     │  │
│ │+Insights│ └──────────┘  └──────┘  └──────────┘  │
│ └────────┘                                          │
│                                                     │
│  ┌──────────────────── Services ─────────────────┐ │
│  │ • overpass.ts  - Fetch POIs                  │ │
│  │ • nominatim.ts - Geocoding                   │ │
│  │ • routing.ts   - OSRM routes                 │ │
│  │ • gamification - Passport system             │ │
│  │ • api.ts       - Backend AI calls            │ │
│  └──────────────────────────────────────────────┘ │
└─────────────┬───────────────────────────────────────┘
              │
              ▼ HTTP Requests
┌─────────────────────────────────────────────────────┐
│                   BACKEND                           │
│  ┌──────────────────── Routes ──────────────────┐  │
│  │ • /api/proxy/overpass      - POI proxy       │  │
│  │ • /api/proxy/nominatim     - Geocoding proxy │  │
│  │ • /api/proxy/osrm          - Routing proxy   │  │
│  │ • /api/ai/recommendations  - AI suggestions  │  │
│  │ • /api/ai/travel-tips      - POI tips        │  │
│  │ • /api/ai/city-insights    - City facts/hist │  │
│  │ • /api/ai/neighborhood-fact - Stamp facts    │  │
│  │ • /api/ai/historical-context - POI history   │  │
│  │ • /api/ai/city-summary     - Trip summary    │  │
│  │ • /api/ai/usage            - NIM usage stats │  │
│  │ • /api/cache/*             - Cache mgmt      │  │
│  │ • /api/feedback/*          - Bug reports/stars│  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────────── Services ────────────────────┐  │
│  │ • cache.ts - Redis caching                   │  │
│  │ • nim.ts   - NVIDIA NIM AI integration       │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────────── Scheduler ───────────────────┐  │
│  │ • Startup: warm cache if empty               │  │
│  │ • Weekly: Sunday midnight UTC (cron)         │  │
│  └──────────────────────────────────────────────┘  │
└──────┬──────────────────────────────────────────────┘
       │          │
       ▼          ▼
   ┌─────┐   ┌──────────────┐
   │Redis│   │NVIDIA NIM    │
   │     │   │(cloud API)   │
   └─────┘   └──────────────┘
```

---

## Key Components

### page.tsx (Main)
**State:**
- `mode`: explorer | planner
- `mapCenter`: { lat, lng }
- `selectedPoi`: POI | null
- `plannerPois`: POI[]
- `routeSegments`: RouteSegment[]

**Key Callbacks:**
- `handlePoiClick`: Show modal + gamification
- `handleMapMoved`: Load POIs for new center
- `handleSearchResult`: Jump to city + load POIs
- `addToPlanner`: Add POI to route
- `computeTheRoute`: Calculate route

### WayvMap (Leaflet)
**Features:**
- OpenStreetMap tiles
- POI markers (category-specific)
- Planner markers (numbered 1,2,3)
- Route polylines (blue lines)
- Auto-pan to selected POI
- Auto-fit bounds for routes

**Important:**
- `moveEndHandlerRef` prevents duplicate POI loads during programmatic pans
- Disabled for 500ms when center changes from search

### ExplorerSidebar
**Features:**
- City search with geocoding dropdown
- **City insights card** (shown after city search): overview, highlights, historical fact, local tip — collapsible, shown above POI list
- POI list (filtered by categories)
- Favorite button (♥)
- Add to planner (+)

**City insights flow:**
- Triggered when user selects a geocode result
- Calls `POST /api/ai/city-insights` with the city name
- Shows skeleton while loading, collapses via toggle
- Served from Redis cache (7-day TTL, pre-warmed by cron)

### PlannerSidebar
**Features:**
- Transport mode selector
- Drag-to-reorder POI list
- Remove POI (×)
- Compute route button
- Route summary (distance, duration, segments)

### PassportPanel
**Features:**
- Level badge with XP progress bar
- 5 tabs: Overview, Stamps, Quests, Achievements, Mystery Boxes
- Real-time updates when POI visited

---

## API Reference

> Full interactive docs: **`GET /api/docs`** (Swagger UI, protected by `x-cache-secret` in production).

### AI Endpoints (`/api/ai/*`)

Rate limit: 15 req / 15 min per IP.

| Endpoint | Input | Cache TTL | Description |
|---|---|---|---|
| `POST /recommendations` | `selectedPois[]`, `userPreferences?`, `mood?` | 30 min | 3-5 nearby place suggestions |
| `POST /travel-tips` | `poi` | 1 hr | Description, tips, local insights for a POI |
| `POST /city-insights` | `cityName` | **7 days** | Overview, highlights, history, local tip for a city |
| `POST /neighborhood-fact` | `neighborhood`, `city` | 7 days | Engaging fact for stamp collection |
| `POST /historical-context` | `name`, `category`, `address` | 7 days | 2-3 sentence historical background for a POI |
| `POST /city-summary` | `cityName`, `neighborhoodsVisited[]`, `poisVisited` | 1 hr | Personalized trip summary |
| `GET /usage` | — | — | NIM call counts & estimated token usage (per-endpoint + daily) |

### Proxy Endpoints (`/api/proxy/*`)

Rate limit: 30 req / min per IP.

| Endpoint | Cache TTL | Description |
|---|---|---|
| `POST /overpass` | 1 hr | POI data via grid-based spatial cache keys |
| `GET /nominatim/search` | 24 hrs | Forward geocoding |
| `GET /nominatim/reverse` | 24 hrs | Reverse geocoding |
| `GET /osrm/route?profile=&coordinates=` | 1 hr | Route calculation; profiles: `foot`, `bike`, `car` |

### Cache Management (`/api/cache/*`)

| Endpoint | Auth | Description |
|---|---|---|
| `GET /health` | — | Redis health check |
| `POST /warm` | `x-cache-secret` | Trigger manual cache warm (`mode`: top / all / geocoding) |
| `DELETE /clear` | `x-cache-secret` | Flush cache keys matching pattern |
| `GET /stats` | — | Key counts by namespace (overpass / nominatim / ai) |
| `GET /usage` | `x-cache-secret` | Request counts per IP per day |
| `GET /usage/:ip` | `x-cache-secret` | Request counts for a single IP |

### Feedback (`/api/feedback/*`)

| Endpoint | Auth | Description |
|---|---|---|
| `GET /stats` | — | Aggregate counts: `{ stars, bugReports }` (O(1), no data fetch) |
| `POST /bug` | — | Submit a bug report (5 req/hr rate limit) |
| `GET /bugs` | `x-cache-secret` | List all bug reports |
| `GET /star` | — | Get total star count + whether caller IP has starred |
| `POST /star` | — | Toggle star for caller IP |

### Top-level

| Endpoint | Description |
|---|---|
| `GET /api/health` | Server health: Redis status, NIM config |
| `GET /api/docs` | Swagger UI (protected in production) |

---

## Cache Warming

The cache warmer runs in 3 steps for all cities in `backend/src/data/cities.ts` (~200 cities):

```
Step 1/3: Nominatim geocoding
  • Rate: 1 req/sec (Nominatim limit)
  • TTL: 24 hours
  • Skip if TTL > 12 hours

Step 2/3: Overpass POI fetch
  • Rate: 1 req/5 sec
  • TTL: ~2 weeks (OVERPASS_TTL × 14)
  • Sorted by cache miss count (most-missed first)

Step 3/3: NVIDIA NIM AI city insights
  • Rate: 1 req/500ms
  • TTL: 7 days
  • Skip automatically if TTL > 1 day
```

**Scheduling:**
- **On startup**: runs immediately if AI insights cache is empty (Redis key for "New York" not found)
- **Weekly cron**: every Sunday at 00:00 UTC — refreshes expired entries

---

## API Flows

### POI Loading
```
Frontend → POST /api/proxy/overpass
  ↓
Backend checks Redis: overpass:grid:{lat}:{lng}:{radius}:{categories}
  ├─ Hit: Return cached
  └─ Miss:
      ↓
  POST https://overpass-api.de/api/interpreter
  query: [out:json]...(node["amenity"="restaurant"]...)...
      ↓
  Overpass returns OSM elements
      ↓
  Save to Redis (TTL: ~2 weeks for pre-warmed, 1hr for live)
      ↓
  Return to frontend
      ↓
Frontend maps elements to POI objects
```

### City Insights
```
User selects city from geocode dropdown
  ↓
Frontend → POST /api/ai/city-insights { cityName: "Paris, France" }
  ↓
Backend normalizes: "Paris, France" → "paris" (cache key)
  ↓
Check Redis: wandrmark:ai:city-insights:paris
  ├─ Hit: Return { overview, highlights, historicalFact, localTip, cached: true }
  └─ Miss:
      ↓
  NVIDIA NIM prompt: "Provide travel insights for: Paris..."
  JSON response parsed → fallback on parse error
      ↓
  Save to Redis (TTL: 7 days)
      ↓
  Return { ...insights, cached: false }
```

### Geocoding
```
Frontend → GET /api/proxy/nominatim/search?q=Paris
  ↓
Backend checks Redis
  ├─ Hit: Return cached
  └─ Miss:
      ↓
  GET https://nominatim.openstreetmap.org/search
      ↓
  Save to Redis (TTL: 24hrs)
      ↓
  Return to frontend
```

### Routing
```
Frontend → GET /api/proxy/osrm/route?profile=foot&coordinates=2.3522,48.8566;2.2945,48.8584
  ↓
Backend checks Redis (TTL: 1 hr)
  ├─ Hit: Return cached
  └─ Miss:
      ↓
  GET http://router.project-osrm.org/route/v1/foot/{coordinates}
      ?overview=full&geometries=geojson
      ↓
  OSRM returns route with geometry
      ↓
  Save to Redis (TTL: 1 hr)
      ↓
  Return to frontend
      ↓
Frontend converts GeoJSON [lng,lat] → LatLng {lat,lng}
```

---

## Adding Features

### Example: Add "Hotels" Category

**1. Add type:**
```typescript
// types/index.ts
export type POICategory = "restaurant" | "cafe" | "attraction" |
                          "park" | "museum" | "hotel";
```

**2. Add config:**
```typescript
// utils/constants.ts
hotel: {
  emoji: "🏨",
  markerColor: "#EC4899",
  bgColor: "bg-pink-500/[0.15]",
  borderColor: "border-pink-500/[0.3]",
  textColor: "text-pink-300",
}
```

**3. Update Overpass query:**
```typescript
// services/overpass.ts
case "hotel":
  queries.push(`node["tourism"="hotel"](around:${radius},...);`);
  queries.push(`way["tourism"="hotel"](around:${radius},...);`);
  break;
```

**4. Update mapping:**
```typescript
// services/overpass.ts
else if (tags.tourism === "hotel") category = "hotel";
```

**5. Add to defaults:**
```typescript
// hooks/usePOIs.ts
const [activeCategories] = useState([
  "restaurant", "cafe", "attraction", "park", "museum", "hotel"
]);
```

Done! Hotels now appear everywhere.

---

## Debugging

### POIs Not Loading
**Check:**
1. Console for errors
2. Network tab: `/api/proxy/overpass` request
3. Redis connection: `docker compose ps`
4. Overpass query format in logs

**Common fixes:**
- Reduce radius (1000 instead of 1500)
- Restart Redis: `docker compose restart redis`
- Clear cache: `docker exec -it wandrmark-redis redis-cli FLUSHALL`

### City Insights Not Showing
**Check:**
1. Only appears after searching and selecting a city from the geocode dropdown
2. Requires `NVIDIA_API_KEY` to be set (otherwise silently fails)
3. Network tab: `POST /api/ai/city-insights`
4. Backend logs: `[CACHE HIT]` or `[CACHE MISS]` for city insights

### Map Not Appearing
**Check:**
1. Leaflet CSS imported: `import "leaflet/dist/leaflet.css"`
2. Container has height: `height: 100vh`
3. Ref is set: `<div ref={containerRef} />`

### Passport Not Saving
**Check:**
1. localStorage available: `localStorage.getItem('wandrmark_user_progress')`
2. Quota not exceeded
3. saveProgress() is called (add console.log)

### Route Fails
**Check:**
1. POI coordinates valid (not 0,0)
2. OSRM endpoint accessible
3. Transport mode supported

---

## Performance Tips

**1. Memoize expensive components:**
```typescript
export default React.memo(POICard);
```

**2. Debounce map movements:**
```typescript
const handleMapMoved = debounce((center) => load(center), 500);
```

**3. Virtualize long lists:**
```bash
npm install react-window
```

**4. Cache markers instead of recreating:**
```typescript
const markerCache = useRef(new Map());
// Reuse existing markers, only create new ones
```

---

## Project Structure

```
wandrmark/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # Main app component
│   │   │   └── layout.tsx            # Root layout
│   │   ├── components/
│   │   │   ├── Navbar.tsx
│   │   │   ├── ExplorerSidebar.tsx   # POI list + city search + insights
│   │   │   ├── PlannerSidebar.tsx
│   │   │   ├── WayvMap.tsx           # Leaflet map
│   │   │   ├── PassportPanel.tsx     # Gamification UI
│   │   │   ├── POIDetailCard.tsx
│   │   │   ├── AIRecommendPanel.tsx
│   │   │   └── CategoryFilter.tsx
│   │   ├── hooks/
│   │   │   ├── usePOIs.ts            # POI state management
│   │   │   └── useFavorites.ts       # Favorites localStorage
│   │   ├── services/
│   │   │   ├── overpass.ts           # POI fetching
│   │   │   ├── nominatim.ts          # Geocoding
│   │   │   ├── routing.ts            # OSRM routing
│   │   │   ├── gamification.ts       # Passport system
│   │   │   └── api.ts                # Backend AI calls (incl. city insights)
│   │   ├── types/
│   │   │   ├── index.ts              # Main types
│   │   │   └── gamification.ts       # Passport types
│   │   └── utils/
│   │       └── constants.ts          # Category configs
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── proxy.ts              # API proxies (Overpass + Nominatim + OSRM)
│   │   │   ├── ai.ts                 # All AI endpoints incl. city-insights + usage
│   │   │   ├── cache.ts              # Cache management endpoints
│   │   │   └── feedback.ts           # Bug reports and star ratings
│   │   ├── services/
│   │   │   ├── cache.ts              # Redis wrapper + CacheKeys + TTLs
│   │   │   ├── nim.ts                # NVIDIA NIM AI integration
│   │   │   ├── nimUsage.ts           # NIM call tracking (Redis counters)
│   │   │   ├── usage.ts              # Per-IP request tracking
│   │   │   └── feedback.ts           # Bug report + star storage
│   │   ├── scripts/
│   │   │   ├── warmCache.ts          # Cache warming orchestrator (3 steps)
│   │   │   └── warmGeocoding.ts      # Nominatim geocoding warmer
│   │   ├── data/
│   │   │   └── cities.ts             # ~200 major cities list
│   │   ├── scheduler.ts              # Cron (weekly) + startup empty-check
│   │   └── index.ts                  # Express server
│   └── package.json
└── docker-compose.yml                # Redis + RedisInsight
```

---

## Environment Variables

```bash
# Backend (.env)
NVIDIA_API_KEY=nvapi-your-key-here   # Required for AI features
NIM_MODEL=meta/llama-3.1-8b-instruct
NIM_BASE_URL=https://integrate.api.nvidia.com/v1
NIM_TIMEOUT_MS=30000

PORT=3001
REDIS_URL=redis://localhost:6379     # Optional

# Frontend (.env.local)
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
NEXT_PUBLIC_OSRM_URL=http://router.project-osrm.org
```

---

## Quick Start Commands

```bash
# Install
npm install

# Configure (set NVIDIA_API_KEY in .env)
cp .env.example .env
cp .env backend/.env

# Start infrastructure (Redis)
docker compose up -d

# Start app
npm run dev
# → Frontend: http://localhost:3000
# → Backend: http://localhost:3001

# Optional: manually trigger cache warm (geocoding + POIs + AI insights)
cd backend && npm run warm-cache

# View Redis data
# Open http://localhost:5540 (RedisInsight)
```

---

## Summary

**What happens when app loads:**
1. Get user location → Load nearby POIs → Show on map
2. POIs fetched from Overpass API (cached in Redis)
3. Backend checks if AI insights cache is empty — warms all cities if so
4. Passport system loads from localStorage

**What happens when user searches city:**
1. Geocode query → Get coordinates → Jump to location
2. Immediately fetch POIs for new location
3. Fetch AI city insights (overview, highlights, history, local tip)
4. Insights served from Redis cache (7-day TTL, pre-warmed by cron)

**What happens when user clicks POI:**
1. Show detail modal
2. Check if first visit → Create stamp → Award XP
3. Check level up → Check achievements → Check mystery box
4. Save progress to localStorage
5. Update Passport UI in real-time

**What happens when user computes route:**
1. Validate 2+ POIs with real coordinates
2. For each pair: Query OSRM for route segment
3. Aggregate segments → Calculate totals
4. Draw polylines on map → Fit bounds
5. Show summary in sidebar

**Key files to understand:**
- `frontend/src/app/page.tsx` — Main state & logic
- `frontend/src/hooks/usePOIs.ts` — POI loading & filtering
- `frontend/src/services/gamification.ts` — Passport system
- `frontend/src/components/ExplorerSidebar.tsx` — POI list + city insights
- `frontend/src/components/WayvMap.tsx` — Map rendering
- `backend/src/routes/proxy.ts` — API proxy with caching
- `backend/src/routes/ai.ts` — All AI endpoints
- `backend/src/services/nim.ts` — NVIDIA NIM wrapper
- `backend/src/scripts/warmCache.ts` — Cache warming (3 steps)
- `backend/src/scheduler.ts` — Startup check + weekly cron

With this guide, you should be able to navigate the codebase, understand data flows, add features, and debug issues effectively.
