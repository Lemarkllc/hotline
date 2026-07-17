import type { Config } from "tailwindcss";

/**
 * Дизайн-система HotLineBot Admin (PLAN.md §5) — светлая доверительная схема по
 * умолчанию, с отдельным фиолетовым акцентом ТОЛЬКО для маркера конфиденциальности.
 */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
    },
    extend: {
      colors: {
        primary: { DEFAULT: "#2563EB", foreground: "#FFFFFF" },
        background: "#F8FAFC",
        surface: "#FFFFFF",
        foreground: "#0F172A",
        muted: { DEFAULT: "#64748B", foreground: "#94A3B8" },
        border: "#E2E8F0",
        success: "#16A34A",
        warning: "#D97706",
        destructive: { DEFAULT: "#DC2626", foreground: "#FFFFFF" },
        confidential: "#7C3AED",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "8px",
        md: "6px",
      },
    },
  },
  plugins: [],
} satisfies Config;
