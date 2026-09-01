import type { Config } from "tailwindcss";

/**
 * Lemark One — конфигурация Tailwind (design_rework/UI_REWORK_BRIEF.md, hendoff
 * design_handoff_lemark_one/README.md). Все цвета ссылаются на CSS-переменные из
 * src/styles/globals.css. Формат `rgb(var(--x) / <alpha-value>)` оставляет рабочими
 * модификаторы прозрачности: bg-status-open/10, text-brand/60 и т.п.
 *
 * Старые семантические имена (background/foreground/primary/muted/border/destructive/
 * success/warning/surface/confidential) НАМЕРЕННО сохранены и указывают на те же
 * --lm-* переменные — это даёт мгновенный reskin всего приложения без ручной правки
 * каждого файла. Новый/переписываемый код использует лемарковскую номенклатуру
 * (ground/rule/text/action/status/brand) напрямую.
 *
 * Правило красного: `brand` — только знак, экран входа и сплэш. В рабочих экранах
 * красный означает `status-overdue` и необратимые действия. Цвет первичного
 * действия — `action`/`primary` (те же токены).
 */
const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- лемарковская номенклатура ---
        ground: rgb("--lm-ground"),
        rule: { DEFAULT: rgb("--lm-rule"), strong: rgb("--lm-rule-strong") },
        text: { 1: rgb("--lm-text-1"), 2: rgb("--lm-text-2"), 3: rgb("--lm-text-3") },
        brand: rgb("--lm-brand"),
        action: { DEFAULT: rgb("--lm-action"), fg: rgb("--lm-action-fg") },
        status: {
          open: rgb("--lm-open"),
          "open-tint": rgb("--lm-open-tint"),
          review: rgb("--lm-review"),
          "review-tint": rgb("--lm-review-tint"),
          progress: rgb("--lm-progress"),
          "progress-tint": rgb("--lm-progress-tint"),
          closed: rgb("--lm-closed"),
          "closed-tint": rgb("--lm-closed-tint"),
          overdue: rgb("--lm-overdue"),
          "overdue-tint": rgb("--lm-overdue-tint"),
        },

        // --- старые семантические имена → те же токены (совместимость на время миграции) ---
        background: rgb("--lm-ground"),
        foreground: rgb("--lm-text-1"),
        surface: { DEFAULT: rgb("--lm-surface"), sunk: rgb("--lm-surface-sunk") },
        border: rgb("--lm-rule"),
        muted: { DEFAULT: rgb("--lm-surface-sunk"), foreground: rgb("--lm-text-2") },
        primary: { DEFAULT: rgb("--lm-action"), foreground: rgb("--lm-action-fg") },
        destructive: { DEFAULT: rgb("--lm-overdue"), foreground: "#FFFFFF" },
        success: rgb("--lm-closed"),
        warning: rgb("--lm-review"),
        confidential: { DEFAULT: rgb("--lm-confidential"), tint: rgb("--lm-confidential-tint") },
      },
      fontFamily: {
        sans: ["Golos Text", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        // семь ступеней — произвольных px в компонентах быть не должно
        label: ["10px", { lineHeight: "1.2", letterSpacing: "0.14em" }],
        meta: ["13px", { lineHeight: "1.45" }],
        ui: ["14px", { lineHeight: "1.45" }],
        body: ["15px", { lineHeight: "1.55" }],
        head: ["18px", { lineHeight: "1.35" }],
        title: ["24px", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        display: ["32px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
      },
      borderRadius: {
        sm: "var(--lm-radius-sm)",
        md: "var(--lm-radius-md)",
        lg: "var(--lm-radius-lg)",
        xl: "var(--lm-radius-xl)",
      },
      boxShadow: {
        1: "var(--lm-shadow-1)",
        2: "var(--lm-shadow-2)",
        3: "var(--lm-shadow-3)",
      },
      transitionTimingFunction: {
        lm: "var(--lm-ease)",
        nav: "var(--lm-ease-nav)",
      },
      transitionDuration: { 1: "120ms", 2: "200ms", 3: "320ms" },
      height: { control: "var(--lm-control)", touch: "var(--lm-touch)", row: "var(--lm-row)" },
      // width/size — тач-цели (size-touch) должны быть квадратными 48px, не только
      // высота: без этого size-* не резолвится (Tailwind size-* читает theme.size,
      // не theme.height), верстка тихо теряла и ширину, и высоту одновременно.
      width: { control: "var(--lm-control)", touch: "var(--lm-touch)" },
      size: { control: "var(--lm-control)", touch: "var(--lm-touch)" },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
