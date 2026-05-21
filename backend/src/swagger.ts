import swaggerUi from "swagger-ui-express";
import { Router } from "express";

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
    { name: "Proxy", description: "Overpass & Nominatim, Redis-cached" },
    { name: "Cache", description: "Redis cache management" },
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
router.use("/", swaggerUi.serve);
router.get("/", swaggerUi.setup(spec, { customSiteTitle: "Wandrmark API Docs" }));

export default router;
