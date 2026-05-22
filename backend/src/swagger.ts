import { Router, Request, Response } from "express";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "Wandrmark API",
    version: "1.0.0",
    description:
      "Backend API for Wandrmark — travel exploration with gamification. Proxies Overpass/Nominatim, serves NVIDIA NIM AI features, and manages Redis caching.",
  },
  servers: [{ url: "/api", description: "Local dev (port 3001)" }],

  tags: [
    { name: "Health", description: "Server status" },
    { name: "AI", description: "NVIDIA NIM — recommendations, tips, contextual facts" },
    { name: "Proxy", description: "Overpass, Nominatim & OSRM, Redis-cached" },
    { name: "Cache", description: "Redis cache management" },
    { name: "Feedback", description: "Bug reports and star ratings" },
    { name: "Analytics", description: "Usage analytics — top cities, search trends, POI categories, transport modes" },
  ],

  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Server health",
        description: "Returns Redis connection status and NIM configuration.",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                example: {
                  status: "ok",
                  timestamp: "2025-05-20T12:00:00.000Z",
                  environment: "development",
                  services: {
                    redis: "connected",
                    nim: {
                      baseUrl: "https://integrate.api.nvidia.com/v1",
                      model: "meta/llama-3.1-8b-instruct",
                      configured: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ── AI ────────────────────────────────────────────────────────────────────

    "/ai/recommendations": {
      post: {
        tags: ["AI"],
        summary: "Route recommendations",
        description:
          "Returns AI-generated place recommendations based on an existing set of selected POIs. Results cached in Redis (1 h).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["selectedPois"],
                properties: {
                  selectedPois: {
                    type: "array",
                    items: { $ref: "#/components/schemas/POI" },
                    minItems: 1,
                  },
                  userPreferences: { type: "string", example: "I love street food and hidden gems" },
                  mood: { type: "string", example: "adventurous", description: "Current travel mood (optional)" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "List of recommendations",
            content: {
              "application/json": {
                example: {
                  recommendations: [
                    { name: "Ramen Nagi", category: "restaurant", reason: "Highly rated local ramen" },
                  ],
                  cached: false,
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "503": { $ref: "#/components/responses/AIUnavailable" },
        },
      },
    },

    "/ai/travel-tips": {
      post: {
        tags: ["AI"],
        summary: "Travel tips for a POI",
        description:
          "Generates a description, local insights, and visit tips for a specific place. Cached by name + category + address (1 h).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["poi"],
                properties: {
                  poi: {
                    type: "object",
                    required: ["name"],
                    properties: {
                      name: { type: "string", example: "Eiffel Tower" },
                      category: { type: "string", example: "attraction" },
                      address: { type: "string", example: "Champ de Mars, 75007 Paris" },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Tips object",
            content: {
              "application/json": {
                example: {
                  description: "An iconic iron lattice tower on the Champ de Mars.",
                  tips: ["Buy tickets online to skip queues.", "Best views from Trocadéro."],
                  localInsights: "Locals often picnic on the nearby lawn at sunset.",
                  cached: false,
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "503": { $ref: "#/components/responses/AIUnavailable" },
        },
      },
    },

    "/ai/neighborhood-fact": {
      post: {
        tags: ["AI"],
        summary: "Neighborhood fact (for stamps)",
        description:
          "Returns a short interesting fact about a neighborhood. Used when a gamification stamp is earned. Cached for 7 days.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["neighborhood", "city"],
                properties: {
                  neighborhood: { type: "string", example: "Le Marais" },
                  city: { type: "string", example: "Paris" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Fact string",
            content: {
              "application/json": {
                example: {
                  fact: "Le Marais was a swamp drained in the 13th century and is now Paris's oldest aristocratic quarter.",
                  neighborhood: "Le Marais",
                  city: "Paris",
                  generatedAt: "2025-05-20T12:00:00.000Z",
                  cached: false,
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/ai/city-summary": {
      post: {
        tags: ["AI"],
        summary: "City exploration summary",
        description: "Generates a personalised summary of a user's exploration of a city. Cached per city + neighborhoods list.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["cityName", "neighborhoodsVisited", "poisVisited"],
                properties: {
                  cityName: { type: "string", example: "Tokyo" },
                  neighborhoodsVisited: {
                    type: "array",
                    items: { type: "string" },
                    example: ["Shibuya", "Shinjuku"],
                  },
                  poisVisited: { type: "integer", example: 12 },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Summary string",
            content: {
              "application/json": {
                example: {
                  summary: "You've uncovered 2 neighbourhoods and 12 places in Tokyo — a seasoned explorer!",
                  cityName: "Tokyo",
                  neighborhoodsVisited: 2,
                  poisVisited: 12,
                  generatedAt: "2025-05-20T12:00:00.000Z",
                  cached: false,
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/ai/historical-context": {
      post: {
        tags: ["AI"],
        summary: "Historical context for a POI",
        description: "Provides historical background for a place. Cached by name + category + address (1 h).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "category", "address"],
                properties: {
                  name: { type: "string", example: "Colosseum" },
                  category: { type: "string", example: "attraction" },
                  address: { type: "string", example: "Piazza del Colosseo, 1, 00184 Roma RM" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Context string",
            content: {
              "application/json": {
                example: {
                  context: "Built between 70–80 AD under emperors Vespasian and Titus, the Colosseum could hold 50,000–80,000 spectators.",
                  poi: { name: "Colosseum", category: "attraction", address: "Piazza del Colosseo…" },
                  generatedAt: "2025-05-20T12:00:00.000Z",
                  cached: false,
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/ai/city-insights": {
      post: {
        tags: ["AI"],
        summary: "City insights",
        description:
          "Returns an overview, highlights, historical fact, and local tip for a city. Cache key normalises to the city part only (before the first comma), cached 7 days. Pre-warmed by the weekly cron for ~200 major cities.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["cityName"],
                properties: {
                  cityName: { type: "string", example: "Paris, France" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "City insights",
            content: {
              "application/json": {
                example: {
                  overview: "Paris is the capital and most populous city of France…",
                  highlights: ["Eiffel Tower", "Louvre Museum", "Seine River"],
                  historicalFact: "Paris was founded around 250 BC by the Celtic Parisii tribe.",
                  localTip: "Avoid tourist traps on the Champs-Élysées — head to Le Marais instead.",
                  cached: true,
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "503": { $ref: "#/components/responses/AIUnavailable" },
        },
      },
    },

    "/ai/usage": {
      get: {
        tags: ["AI"],
        summary: "NIM usage statistics",
        description:
          "Returns total NVIDIA NIM API call counts and estimated token usage, broken down by endpoint and by day. Requires Redis — returns zeros when Redis is unavailable.",
        responses: {
          "200": {
            description: "Usage stats",
            content: {
              "application/json": {
                example: {
                  totalCalls: 1240,
                  estimatedTokens: 248000,
                  byEndpoint: {
                    "city-insights": { calls: 400, estimatedTokens: 80000 },
                    "travel-tips": { calls: 300, estimatedTokens: 60000 },
                  },
                  daily: [
                    { date: "2025-05-20", calls: { "city-insights": 12 }, total: 12 },
                  ],
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    // ── Proxy ─────────────────────────────────────────────────────────────────

    "/proxy/overpass": {
      post: {
        tags: ["Proxy"],
        summary: "Overpass API (POI query)",
        description:
          "Forwards an Overpass QL query to the Overpass API. Results cached in Redis using a grid-snapped key (1 h TTL). Rate limited to 30 req/min.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["query"],
                properties: {
                  query: {
                    type: "string",
                    example: '[out:json][timeout:25];\n(\n  node["amenity"="restaurant"](around:1000,48.8566,2.3522);\n);\nout body;',
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Raw Overpass JSON response",
            content: {
              "application/json": {
                example: { version: 0.6, elements: [{ type: "node", id: 123, lat: 48.856, lon: 2.352, tags: {} }] },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "503": { $ref: "#/components/responses/ProxyUnavailable" },
        },
      },
    },

    "/proxy/nominatim/search": {
      get: {
        tags: ["Proxy"],
        summary: "Geocoding search (Nominatim)",
        description:
          "Forwards query parameters to Nominatim /search. All standard Nominatim search params are accepted. Cached 24 h.",
        parameters: [
          { name: "q", in: "query", required: true, schema: { type: "string" }, example: "Paris, France" },
          { name: "format", in: "query", schema: { type: "string", default: "json" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 5 } },
          { name: "addressdetails", in: "query", schema: { type: "integer", enum: [0, 1] } },
        ],
        responses: {
          "200": {
            description: "Array of Nominatim search results",
            content: {
              "application/json": {
                example: [{ place_id: 1, display_name: "Paris, Île-de-France, France", lat: "48.8566", lon: "2.3522" }],
              },
            },
          },
          "503": { $ref: "#/components/responses/ProxyUnavailable" },
        },
      },
    },

    "/proxy/nominatim/reverse": {
      get: {
        tags: ["Proxy"],
        summary: "Reverse geocoding (Nominatim)",
        description: "Forwards query parameters to Nominatim /reverse. Cached 24 h.",
        parameters: [
          { name: "lat", in: "query", required: true, schema: { type: "number" }, example: 48.8566 },
          { name: "lon", in: "query", required: true, schema: { type: "number" }, example: 2.3522 },
          { name: "format", in: "query", schema: { type: "string", default: "json" } },
          { name: "zoom", in: "query", schema: { type: "integer", default: 18 } },
        ],
        responses: {
          "200": {
            description: "Nominatim reverse geocoding result",
            content: {
              "application/json": {
                example: { display_name: "Eiffel Tower, Paris", address: { city: "Paris", country: "France" } },
              },
            },
          },
          "503": { $ref: "#/components/responses/ProxyUnavailable" },
        },
      },
    },

    "/proxy/osrm/route": {
      get: {
        tags: ["Proxy"],
        summary: "Route calculation (OSRM)",
        description:
          "Proxies a route request to OSRM. Returns a route with full GeoJSON geometry. Cached in Redis (1 h). Allowed profiles: foot, bike, car. Coordinates must be two or more `lng,lat` pairs separated by semicolons.",
        parameters: [
          {
            name: "profile",
            in: "query",
            required: true,
            schema: { type: "string", enum: ["foot", "bike", "car"] },
            example: "foot",
          },
          {
            name: "coordinates",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Semicolon-separated `lng,lat` pairs",
            example: "2.3522,48.8566;2.2945,48.8584",
          },
        ],
        responses: {
          "200": {
            description: "OSRM route response",
            content: {
              "application/json": {
                example: {
                  code: "Ok",
                  routes: [
                    {
                      distance: 5432.1,
                      duration: 3912.4,
                      geometry: { type: "LineString", coordinates: [[2.3522, 48.8566]] },
                    },
                  ],
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "503": { $ref: "#/components/responses/ProxyUnavailable" },
        },
      },
    },

    // ── Cache ─────────────────────────────────────────────────────────────────

    "/cache/health": {
      get: {
        tags: ["Cache"],
        summary: "Redis health",
        responses: {
          "200": {
            description: "Redis is reachable",
            content: { "application/json": { example: { status: "healthy" } } },
          },
          "503": {
            description: "Redis unavailable",
            content: { "application/json": { example: { status: "unhealthy" } } },
          },
        },
      },
    },

    "/cache/warm": {
      post: {
        tags: ["Cache"],
        summary: "Trigger cache warming",
        description:
          "Kicks off a background cache-warming job. Returns immediately; check server logs for progress. `mode=top` warms the top 15 cities. `mode=all` warms all 173 cities. `mode=geocoding` warms Nominatim search results.",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  mode: {
                    type: "string",
                    enum: ["top", "all", "geocoding"],
                    default: "top",
                  },
                  cities: {
                    type: "array",
                    items: { type: "string" },
                    description: "Optional — warm only these cities",
                    example: ["Paris", "Tokyo"],
                  },
                  skipExisting: {
                    type: "boolean",
                    default: false,
                    description: "Skip cells that already have a cache entry",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Job accepted",
            content: {
              "application/json": {
                example: { status: "started", mode: "top", message: "Cache warming started — check server logs." },
              },
            },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/cache/clear": {
      delete: {
        tags: ["Cache"],
        summary: "Clear cache keys",
        description: "Deletes all Redis keys matching `wandrmark:<pattern>:*`. Omit `pattern` to nuke everything.",
        parameters: [
          {
            name: "pattern",
            in: "query",
            schema: { type: "string", enum: ["overpass", "nominatim", "ai"] },
            description: "Key prefix to target (omit = clear all wandrmark:* keys)",
          },
        ],
        responses: {
          "200": {
            description: "Deleted count",
            content: { "application/json": { example: { success: true, deletedCount: 42 } } },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/cache/stats": {
      get: {
        tags: ["Cache"],
        summary: "Cache key counts",
        description: "Returns the number of cached keys per namespace.",
        responses: {
          "200": {
            description: "Key counts by namespace",
            content: {
              "application/json": {
                example: { total: 310, breakdown: { overpass: 250, nominatim: 45, ai: 15 } },
              },
            },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/cache/usage": {
      get: {
        tags: ["Cache"],
        summary: "All-IP request usage",
        description: "Returns request counts per IP, per day. Requires `x-cache-secret` header.",
        parameters: [
          { name: "x-cache-secret", in: "header", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Usage data for all tracked IPs",
            content: {
              "application/json": {
                example: {
                  count: 2,
                  ips: [
                    {
                      ip: "1.2.3.4",
                      totalCalls: 42,
                      days: [{ date: "2025-05-20", calls: { "GET:/api/proxy/nominatim/search": 10 }, total: 10 }],
                    },
                  ],
                },
              },
            },
          },
          "401": { description: "Missing or invalid secret", content: { "application/json": { example: { error: "Invalid or missing x-cache-secret header" } } } },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/cache/usage/{ip}": {
      get: {
        tags: ["Cache"],
        summary: "Single-IP request usage",
        description: "Returns request counts for one IP address, per day. Requires `x-cache-secret` header.",
        parameters: [
          { name: "ip", in: "path", required: true, schema: { type: "string" }, example: "1.2.3.4" },
          { name: "x-cache-secret", in: "header", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Usage data for the specified IP",
            content: {
              "application/json": {
                example: {
                  ip: "1.2.3.4",
                  totalCalls: 42,
                  days: [{ date: "2025-05-20", calls: { "GET:/api/proxy/nominatim/search": 10 }, total: 10 }],
                },
              },
            },
          },
          "401": { description: "Missing or invalid secret", content: { "application/json": { example: { error: "Invalid or missing x-cache-secret header" } } } },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    // ── Feedback ──────────────────────────────────────────────────────────────

    "/feedback/bug": {
      post: {
        tags: ["Feedback"],
        summary: "Submit a bug report",
        description: "Stores a bug report message tied to the caller's IP. Rate limited to 5 requests per hour per IP.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message"],
                properties: {
                  message: { type: "string", minLength: 10, maxLength: 1000, example: "The map doesn't load on mobile Safari." },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Report submitted",
            content: { "application/json": { example: { success: true, id: "1716220800000-abc12" } } },
          },
          "400": { description: "Message too short or too long", content: { "application/json": { example: { error: "Message must be 10–1000 characters." } } } },
          "429": { description: "Rate limit reached", content: { "application/json": { example: { error: "Too many bug reports. Please wait before submitting again." } } } },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/feedback/bugs": {
      get: {
        tags: ["Feedback"],
        summary: "List all bug reports (admin)",
        description: "Returns all stored bug reports. Requires `x-cache-secret` header.",
        parameters: [
          { name: "x-cache-secret", in: "header", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Bug reports",
            content: {
              "application/json": {
                example: {
                  count: 1,
                  reports: [{ id: "1716220800000-abc12", ip: "1.2.3.4", message: "Map doesn't load.", ts: "2025-05-20T12:00:00.000Z" }],
                },
              },
            },
          },
          "401": { description: "Missing or invalid secret", content: { "application/json": { example: { error: "Invalid or missing x-cache-secret header" } } } },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/analytics/stats": {
      get: {
        tags: ["Analytics"],
        summary: "Usage analytics",
        description: "Returns top searched cities (city-insights requests), top geocode queries, POI category breakdown, transport mode breakdown, and daily activity counts. All counters are permanent (no TTL).",
        responses: {
          "200": {
            description: "Analytics snapshot",
            content: {
              "application/json": {
                example: {
                  topCities: [
                    { name: "Paris", count: 145 },
                    { name: "Tokyo", count: 98 },
                  ],
                  topSearches: [
                    { name: "paris", count: 200 },
                    { name: "new york", count: 160 },
                  ],
                  categories: { restaurant: 1200, cafe: 800, attraction: 650, park: 400, museum: 300 },
                  transport: { foot: 450, bike: 120, car: 85 },
                  daily: [
                    { date: "2025-05-20", cityInsights: 12, geocodeSearches: 45, overpassQueries: 30, routes: 8 },
                  ],
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/feedback/stats": {
      get: {
        tags: ["Feedback"],
        summary: "Aggregate feedback stats",
        description: "Returns total star count and total bug report count. Uses O(1) Redis commands — does not fetch full report data.",
        responses: {
          "200": {
            description: "Feedback stats",
            content: { "application/json": { example: { stars: 47, bugReports: 12 } } },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/feedback/star": {
      get: {
        tags: ["Feedback"],
        summary: "Get star count",
        description: "Returns total star count and whether the caller's IP has starred the app.",
        responses: {
          "200": {
            description: "Star status",
            content: { "application/json": { example: { total: 47, starred: false } } },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
      post: {
        tags: ["Feedback"],
        summary: "Toggle star",
        description: "Toggles the star for the caller's IP (adds if not starred, removes if already starred). Returns the new state.",
        responses: {
          "200": {
            description: "Updated star status",
            content: { "application/json": { example: { total: 48, starred: true } } },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
  },

  components: {
    schemas: {
      POI: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          category: { type: "string", enum: ["restaurant", "cafe", "attraction", "park", "museum"] },
          address: { type: "string" },
          coordinates: {
            type: "object",
            properties: { lat: { type: "number" }, lng: { type: "number" } },
          },
          rating: { type: "number" },
          tags: { type: "array", items: { type: "string" } },
        },
      },
    },
    responses: {
      BadRequest: {
        description: "Invalid request body",
        content: { "application/json": { example: { error: "selectedPois array with at least one item is required." } } },
      },
      AIUnavailable: {
        description: "NIM AI service error (missing API key or upstream failure)",
        content: { "application/json": { example: { error: "AI service unavailable: Check your NVIDIA_API_KEY." } } },
      },
      ProxyUnavailable: {
        description: "Upstream API (Overpass / Nominatim) unavailable",
        content: { "application/json": { example: { error: "Overpass API unavailable" } } },
      },
      InternalError: {
        description: "Internal server error",
        content: { "application/json": { example: { error: "Internal server error" } } },
      },
    },
  },
};

const router = Router();

router.get("/spec", (_req: Request, res: Response) => {
  res.json(spec);
});

router.get("/", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Wandrmark API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      spec: ${JSON.stringify(spec)},
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
    });
  </script>
</body>
</html>`);
});

export default router;
