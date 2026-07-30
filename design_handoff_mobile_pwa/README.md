# Handoff: HotLine Mobile PWA Panel

## Overview
A mobile-native-feeling PWA prototype of the HotLine web admin panel (`apps/web`), covering login, dashboard, appeal registry, notifications, profile, and a full appeal-detail screen (status transitions, confidentiality/author-reveal, correspondence with the author, internal staff notes, attachments, and assignment).

## About the Design Files
The file in this bundle (`HotLine Mobile Prototype.dc.html`) is a **design reference built in HTML** — a clickable prototype showing intended layout, states, and interactions. It is not production code to copy verbatim. The task is to **recreate this design inside `apps/web`**, using the existing React + Vite + TypeScript + Tailwind stack and its established patterns (React Query hooks in `src/hooks/api.ts`, the shadcn-style components in `src/components/ui/`, the RBAC/permission checks already used in `AppealDetailPage.tsx`, etc.) rather than introducing a new stack. This should be implemented as a responsive/mobile layout mode of the existing panel (or a dedicated mobile route), reusing existing API calls and business logic — not a rebuild of the backend contract.

## Fidelity
**High-fidelity.** Colors, spacing, and typography follow the project's actual Tailwind tokens (`apps/web/tailwind.config.ts`) and Inter font. Treat hex values and measurements below as final; recreate pixel-accurately where feasible within the target component library.

## Screens / Views

### 1. Login
- Full-screen, centered column, `padding: 0 32px`, gap `28px`.
- Logo: 76×76px, `border-radius:20px`, background `#D97706` (warning/amber, the app's accent), white flame glyph centered.
- Wordmark: "Hot" in `#0F172A` + "Line" in `#D97706`, 24px/800 Inter, subtitle 13px `#64748B`.
- Inputs: 50px tall, `border-radius:14px`, border `#E2E8F0`, background white, 15px text.
- Primary button: full width, 50px, `border-radius:14px`, background `#2563EB` (primary), white 16px/600 text.
- Helper text below: "Забыли пароль?" in primary blue; footer note "Требуется двухфакторная аутентификация" (matches the app's mandatory-TOTP-for-HRD/Admin rule — see `authService.ts`).

### 2. Dashboard (tab: Главная)
- Header row: "Добрый день, {имя}" (20px/800) + date (13px `#64748B`), avatar circle (40px, primary bg, white initials) right-aligned.
- Stat cards: 2×2 grid, gap 12px, each card `border-radius:16px`, border `#E2E8F0`, padding 16px; big number 26px/800 colored by meaning (Открыто `#2563EB`, В работе `#1E40AF`, Закрыто сегодня `#16A34A`, Просрочено `#DC2626`), label 13px `#64748B` below.
- "Последние обращения": list of the 3 most recent appeal cards (see card spec under Registry) — tapping opens Appeal Detail.

### 3. Registry (tab: Реестр)
- Header "Обращения" (20px/800), search input (42px, `border-radius:12px`), filter chip row (pill chips, active = primary bg/white text, inactive = `#F1F5F9` bg/`#475569` text): Все / Открыто / В работе / Закрыто.
- Appeal card: white, `border-radius:14px`, border `#E2E8F0`, padding 14px. Left: 32px type-letter avatar (`#F1F5F9` bg, `#475569` text, first letter of appeal type). Title 14px/600, meta line "№ · тип · дата" 12px `#64748B`. Confidential appeals show a small lock glyph (`#7C3AED`) top-right of the card. Status pill bottom-left: white text on colored background (Открыто `#2563EB`, На рассмотрении `#D97706`, В работе `#1E40AF`, Закрыто `#16A34A`).

### 4. Notifications (tab: Уведомления)
- List of cards, each: unread dot (8px, primary if unread / `#E2E8F0` if read) + text (13px, 600 weight if unread else 400) + relative time (12px `#94A3B8`).
- Mirrors the existing web `GET /notifications` polling pattern (WEB channel, 15s poll) — see CLAUDE.md "Notifications" section.

### 5. Profile (tab: Профиль)
- Avatar (72px), name (17px/700), role + email (13px `#64748B`).
- Settings list card: Сменить пароль / Двухфакторная аутентификация / Push-уведомления / О приложении.
- Destructive "Выйти" (logout) button, red text `#DC2626`, own card below.

### 6. Appeal Detail (opens from Registry/Dashboard tap)
Full-screen overlay that slides in from the right (`transform: translateX(0/100%)`, `transition: transform 0.32s cubic-bezier(.32,.72,0,1)`).
- **Header**: back chevron, appeal number (16px/700), status pill + type label below it, and a "→ {следующий статус}" pill button (primary-tinted, `#EFF6FF` bg / `#2563EB` text) that advances the status. Status flow: Открыто → На рассмотрении → В работе → Закрыто, with Закрыто → В работе as the only reopen transition (matches `APPEAL_STATUS_TRANSITIONS` server-side truth — never trust a client-only transition in the real implementation).
- **Author card**: tappable row. Confidential + not revealed: purple (`#7C3AED`) lock icon + "Автор скрыт (конфиденциально)" + hint "Нажмите, чтобы раскрыть — потребует пароль, действие в аудите". In the real app this reveal requires a password re-entry dialog and is audit-logged (`useRevealAuthor`, `AppealDetailPage.tsx`) — the prototype simplifies this to a tap-toggle; **the real implementation must keep the password confirmation + audit log**, per the confidentiality invariant in `utils/authz.ts`.
- **Tabs**: a 4-way **segmented control** (not a scrolling pill row — that overflowed on mobile widths and was corrected), full width, `background:#F1F5F9`, `padding:3px`, `border-radius:10px`, active segment = white bg + subtle shadow (`0 1px 2px rgba(15,23,42,.12)`) + `#0F172A` text, inactive = transparent + `#64748B` text. Tabs: Обращение / Переписка / Внутр. работа / Вложения. Unread dot (red, 5px) supported on Переписка/Внутр. работа tabs (currently unused in sample data but wired).
  - **Обращение**: "Оригинальный текст" card (immutable — `Appeal.originalText` never overwritten), optional "Рабочая редакция" card (HRD's de-identified rewrite, `workingEdit` field — only shown/editable for users with `appeal.read_author`), and an **"Ответственный" (assignee) card**: avatar + name or "Не назначен" (gray), with a "Назначить"/"Изменить" button. Tapping opens a **bottom sheet** (slide-up, dim scrim `rgba(15,23,42,.4)`, sheet `border-radius:20px 20px 0 0`) listing assignable users (avatar + name rows) to tap-select. This maps to `useAssignableUsers` + `useAssignAppeal` in the real app — note the real assignable-users endpoint is deliberately separate from `GET /users` (see CLAUDE.md RBAC section) and gated by `appeal.assign`.
  - **Переписка** ("messages" tab — chat with the appeal's author): chat bubbles, HRD messages right-aligned (`#DBEAFE` bg), author messages left-aligned (white bg, bordered look via card context), each with sender label + timestamp. Fixed input bar at the bottom (text input + circular send button, primary bg). Empty state: "Переписки пока нет." Maps to `appeal.messages` / `useAddComment(..., visibility: "PUBLIC")`.
  - **Внутренняя работа** ("internal" tab — staff-only notes): single-style notes (`#F1F5F9` bg, no bubble sides), author + timestamp. Input bar with a placeholder hinting `@upominanie` mentions (real app uses `MentionTextarea` + `useMentionableUsers`). Empty state: "Внутренних заметок пока нет." Maps to `comments.filter(visibility === "INTERNAL")` / `useAddComment(..., visibility: "INTERNAL")`.
  - **Вложения**: file rows (paperclip icon, filename, size). Empty state: "Вложений нет." Maps to `appeal.attachments` + `useAttachmentUrl` download flow.
- The prototype **omits** the История (status history) and Аудит (audit log) tabs from the desktop version to keep the mobile tab bar to 4 items — decide whether these should be reachable via a secondary "more" affordance or a separate screen before implementation.

## Interactions & Behavior
- Bottom tab bar (Главная / Реестр / Уведомления / Профиль) persists across all main screens; switching tabs is instant (no transition needed).
- Appeal Detail is a slide-in overlay over the whole screen (covers the tab bar), dismissed via the back chevron.
- Status "→ next" pill advances status by one step in the prototype; the real implementation must gate the CLOSED transition behind a required `finalAnswer` (see `changeStatus` mutation / close dialog in `AppealDetailPage.tsx`) and gate reopening behind a required reason — do not let it be a single unconditional tap in production.
- Author reveal is a simple tap-toggle in the prototype; production must require password re-entry and log to audit (SRS-mandated).
- Assign bottom sheet: tap a name to assign and auto-close the sheet; tapping the scrim also closes it without changing selection.

## State Management
Screens needed: `loggedIn`, `activeTab` (dashboard/registry/notifications/profile), `openAppealId` (or null), `detailTab` (appeal/messages/internal/attachments), `revealedAuthorIds` (per-appeal, session-only until real reveal flow is built), `assigneeByAppeal`, message/note drafts. In the real app these map onto existing React Query hooks (`useAppeal`, `useAssignAppeal`, `useAddComment`, `useChangeStatus`, `useRevealAuthor`) rather than new client state — the prototype's local state stands in for what will be server-driven data.

## Design Tokens
Sourced from `apps/web/tailwind.config.ts` — reuse these, don't invent new ones:
- Primary: `#2563EB` (white foreground)
- Background: `#F8FAFC` / Surface: `#FFFFFF`
- Foreground: `#0F172A` / Muted: `#64748B` (muted-foreground `#94A3B8`)
- Border: `#E2E8F0`
- Success: `#16A34A` / Warning: `#D97706` / Destructive: `#DC2626`
- Confidential accent (single deliberate color accent in the whole system): `#7C3AED`
- Font: Inter (400/500/600/700/800)
- Radii used: 10–20px on mobile cards/sheets (larger than the 6–8px desktop scale in tailwind config — intentional for a native mobile feel; confirm with design before finalizing whether mobile should adopt its own radius scale or stay at 6/8px)
- Status color mapping (derive consistently, don't hardcode per-screen): Открыто `#2563EB`, На рассмотрении `#D97706`, В работе `#1E40AF`, Закрыто `#16A34A`

## Assets
- Flame glyph (brand mark): a single SVG path, used at multiple sizes (login logo, PWA icons). No external image assets.
- No stock photography or icon fonts — all icons are hand-drawn inline SVG (simple line/glyph icons for nav, lock, attachment, send).

## Files
- `HotLine Mobile Prototype.dc.html` — the full clickable prototype (open in a browser; it's self-contained aside from a Google Fonts link for Inter).

## Reference material in the existing codebase
When implementing, cross-check against:
- `apps/web/src/pages/AppealDetailPage.tsx` — the real desktop appeal-detail logic this mobile screen must stay behaviorally consistent with (tabs, reveal-author flow, assign, status transitions, close dialog).
- `apps/web/src/components/appeals/badges.tsx` — status/mode/type label source of truth.
- `apps/web/tailwind.config.ts` — design tokens.
- `CLAUDE.md` (repo root) — RBAC, confidentiality invariant, appeal lifecycle, and notifications architecture that any real mobile implementation must respect.
