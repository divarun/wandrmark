/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001/api",
NEXT_PUBLIC_OSRM_URL: process.env.NEXT_PUBLIC_OSRM_URL || "http://router.project-osrm.org",
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.openstreetmap.org" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
    ],
  },
};

module.exports = nextConfig;
