/** @type {import('tailwindcss').Config} */
const config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        body: ["'Manrope'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        slate: {
          950: "#080c18",
          900: "#0f172a",
          850: "#131d30",
          800: "#1e293b",
          700: "#334155",
          600: "#475569",
          500: "#64748b",
          400: "#94a3b8",
          300: "#cbd5e1",
          200: "#e2e8f0",
          100: "#f1f5f9",
          50:  "#f8fafc",
        },
        ocean: {
          50:  "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
          800: "#155e75",
          900: "#164e63",
        },
        coral: {
          300: "#fca5a5",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
        },
        emerald: {
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
        amber: {
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
        purple: {
          400: "#c084fc",
          500: "#a855f7",
          600: "#9333ea",
        },
      },
      backgroundImage: {
        "gradient-mesh":
          "radial-gradient(ellipse at 15% 50%, rgba(6,182,212,0.12) 0%, transparent 55%)," +
          "radial-gradient(ellipse at 85% 15%, rgba(249,115,22,0.09) 0%, transparent 55%)," +
          "radial-gradient(ellipse at 50% 90%, rgba(16,185,129,0.07) 0%, transparent 55%)",
        "card-glass":
          "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)",
        "shine":
          "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%)",
      },
      boxShadow: {
        glass:      "0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)",
        "glass-sm": "0 4px 16px rgba(0,0,0,0.18)",
        glow:       "0 0 20px rgba(6,182,212,0.28)",
        "glow-coral": "0 0 20px rgba(249,115,22,0.28)",
        "glow-emerald": "0 0 20px rgba(16,185,129,0.25)",
        panel:      "4px 0 24px rgba(0,0,0,0.3)",
        "panel-r":  "-4px 0 24px rgba(0,0,0,0.3)",
        modal:      "0 24px 64px rgba(0,0,0,0.5)",
      },
      animation: {
        "fade-in":       "fadeIn 0.4s ease-out forwards",
        "slide-up":      "slideUp 0.35s ease-out forwards",
        "slide-in-right":"slideInRight 0.3s ease-out forwards",
        "slide-in-left": "slideInLeft 0.3s ease-out forwards",
        shimmer:         "shimmer 1.8s infinite linear",
        float:           "float 6s ease-in-out infinite",
        "spin-slow":     "spin 3s linear infinite",
        "scale-in":      "scaleIn 0.2s ease-out forwards",
        "ping-slow":     "ping 2s cubic-bezier(0,0,0.2,1) infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(18px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          from: { opacity: "0", transform: "translateX(24px)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
        slideInLeft: {
          from: { opacity: "0", transform: "translateX(-24px)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-8px)" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.94)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
    },
  },
  plugins: [],
};

module.exports = config;
