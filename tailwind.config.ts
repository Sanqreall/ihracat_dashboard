import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F8F5EE",
        ink: "#0F1A2E",
        navy: { DEFAULT: "#1E3A5F", dark: "#0F1A2E" },
        gold: { DEFAULT: "#C9A961", dark: "#A88947" },
        copper: "#B87333",
        cream: "#F4EFE3",
        line: "#E6DFCE",
        muted: "#7A736A",
        forest: "#3E7D5A",
        oxblood: "#A6383D",
      },
      fontFamily: {
        sans: ["Calibri", "Carlito", "Segoe UI", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
