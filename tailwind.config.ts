import type { Config } from "tailwindcss";

/**
 * Hodos brand system.
 * This is the single source of truth for brand tokens. Mirror this file in the
 * future Expo/React Native app (extract to `@hodos/tokens`). No hex codes should
 * live in components — only the semantic names below.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: {
          DEFAULT: "var(--parchment)",
          2: "var(--parchment-2)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          soft: "var(--ink-soft)",
          muted: "var(--ink-muted)",
        },
        gold: {
          DEFAULT: "var(--gold)",
          soft: "var(--gold-soft)",
        },
        rule: "var(--rule)",
      },
      fontFamily: {
        // Display serif — wordmark, section H1s, pull-quote
        serif: ["var(--font-fraunces)", "Cormorant Garamond", "Georgia", "serif"],
        // UI sans — body, eyebrows, buttons
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Type scale (rem): 0.75 / 0.875 / 1 / 1.125 / 1.5 / 2 / 3 / 4.5 / 6
        "2xs": ["0.75rem", { lineHeight: "1.4" }],
        xs: ["0.875rem", { lineHeight: "1.5" }],
        base: ["1rem", { lineHeight: "1.6" }],
        md: ["1.125rem", { lineHeight: "1.6" }],
        lg: ["1.5rem", { lineHeight: "1.4" }],
        xl: ["2rem", { lineHeight: "1.2" }],
        "2xl": ["3rem", { lineHeight: "1.1" }],
        "3xl": ["4.5rem", { lineHeight: "1.05" }],
        "4xl": ["6rem", { lineHeight: "1" }],
      },
      letterSpacing: {
        eyebrow: "0.22em",
        greek: "0.5em",
      },
      maxWidth: {
        content: "1120px",
      },
      spacing: {
        gutter: "24px",
        "gutter-lg": "48px",
        rhythm: "96px",
        "rhythm-lg": "160px",
      },
      backgroundImage: {
        // 24x24 dotted grid behind every section
        "dot-grid":
          "radial-gradient(var(--rule) 1px, transparent 1px)",
      },
      backgroundSize: {
        "dot-grid": "24px 24px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
