# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository status

MVP implemented per `PLAN.md` (approved plan, kept up to date — read it for the full phase breakdown and the rationale behind architectural decisions). Source docs: `Lemark_HotLineBot_SRS_v1.0.md` is the SRS and remains the source of truth for requirements/behavior; `PLAN.md` is the source of truth for *how* those requirements map to this codebase's architecture. If a requirement is ambiguous, check SRS §42 first, then `PLAN.md` §9 (assumptions already made); don't re-litigate a decision recorded there without new information from the user.

## Commands

Monorepo: pnpm workspaces (`pnpm@10.28.2`). Run from repo root unless noted.

```bash
pnpm install                 # install all workspace deps
docker compose up -d         # postgres (5434), redis (6380), minio (9000/9001) — see docker-compose.yml for the non-default ports
pnpm run db:migrate          # prisma migrate dev (apps/api)
pnpm run db:seed             # seeds roles/permissions, default epics, bootstrap admin+HRD accounts (prints their temp passwords)
pnpm run dev                 # runs dev in all apps/* in parallel (api, bot-employee, web)
pnpm run typecheck           # tsc --noEmit across every workspace
pnpm run test                # vitest (currently only apps/api has real tests)
pnpm run build               # build all workspaces
```

Per-app (via `pnpm --filter @hotline/<name> run <script>`, or `cd apps/<name> && pnpm run <script>`):
- `@hotline/api` — additionally has `db:generate`, `db:migrate`, `db:deploy`, `db:seed`, `db:studio`.
- `@hotline/web` — `dev` (vite, fixed port 5183 — see gotcha below), `build`, `preview`.
- `@hotline/bot-employee` — `dev` (tsx watch, long-polling; needs a real `TELEGRAM_BOT_TOKEN` in `apps/bot-employee`'s env to actually connect to Telegram).

Single test file: `cd apps/api && pnpm exec vitest run src/tests/authz.test.ts`.

### Versioning / releases

Version is derived from git via [Conventional Commits](https://www.conventionalcommits.org/) + `commit-and-tag-version` (config: `.versionrc.json` — Russian changelog section labels, bumps `version` in every workspace `package.json` in lockstep, not just root). Commit messages must use `feat:`/`fix:`/`refactor:`/`perf:`/`docs:` (visible in CHANGELOG) or `chore:`/`test:`/`build:`/`ci:`/`style:` (hidden) prefixes — this is what the tool reads to decide the next version and what goes in the changelog, so an un-prefixed or wrongly-prefixed commit either gets silently dropped from the changelog or bumps the wrong version segment.

```bash
pnpm run release:dry   # preview the version bump + changelog without touching files
pnpm run release       # bump version(s), update CHANGELOG.md, create a git commit + tag
git push --follow-tags # push the release commit and its tag
```

`feat:` → minor bump, `fix:`/`perf:` → patch bump, a `BREAKING CHANGE:` footer (or `!` after the type) → major bump.

### Local dev gotchas (hit these once already — don't rediscover)

- **`.env` must exist inside `apps/api/`** (copy of root `.env`), not just at repo root — Prisma CLI and `dotenv/config` both resolve `.env` relative to `process.cwd()`, which is `apps/api` when its scripts run. The root `.env`/`.env.example` are the canonical template; keep `apps/api/.env` in sync manually when you change it.
- **Ports are intentionally non-default** because this machine already runs other projects on 5432/5173/6379: Postgres → `5434`, Redis → `6380`, web dev server → fixed `5183` (`strictPort: true` in `vite.config.ts`, so it fails loudly instead of silently switching ports — if it silently switched before, CORS would break because `CORS_ORIGINS` in `apps/api/.env` is hardcoded to `http://localhost:5183`).
- **MinIO bucket** is auto-created on API startup (`ensureBucketExists()` in `server.ts`/`lib/storage.ts`) — no manual `mc mb` step needed anymore.
- **Bootstrap HRD/Administrator accounts** (from `db:seed`) have `totpEnabled: false` and **cannot log in** until they complete `POST /auth/2fa/setup` → `POST /auth/2fa/confirm` (2FA is mandatory for these roles per SRS §21). The web `LoginPage` handles this automatically inline (detects the `TWO_FACTOR_SETUP_REQUIRED` error code and walks the user through setup) — don't try to bypass it by disabling `totpEnabled` checks.

## What the system is

**Lemark HotLineBot** — internal Telegram-based feedback system for a company with up to 200 employees (scaling to 2,000 / 100k appeals). Employees submit "обращения" (5 types: complaint/suggestion/violation/question/gratitude) via a Telegram bot, either **openly** (identity visible to HRD/assigned manager) or **confidentially** (identity hidden from managers, visible only to HRD, every view audit-logged). HRD triages, classifies, assigns to managers, and closes appeals through a web panel; managers work assigned appeals via kanban.

**The single most safety-critical invariant**: confidentiality is enforced in the backend response-serialization layer, never only in the UI. The entire rule lives in one pure, unit-tested function — `canSeeAuthor()` in `apps/api/src/utils/authz.ts` — used by `appealService`'s serializers. If you touch author-visibility logic, start by reading that function and `apps/api/src/tests/authz.test.ts`, and don't duplicate the logic elsewhere.

## Monorepo structure

```
apps/
  api/            Express + TypeScript + Prisma + PostgreSQL — routes → controllers → services → repositories
  bot-employee/    grammy + @grammyjs/conversations Telegram bot for employees (Phase 3 of PLAN.md)
  web/            React + Vite + TS + Tailwind + shadcn-style components — HRD/manager/admin panel
packages/
  shared/         Enums, RBAC permission constants, Zod schemas shared by all three apps
  bot-core/       ApiClient, Redis session storage, notification poller — reused by bot-employee now,
                  and by the future bot-customer (Phase 7, not built yet)
```

Backend follows `routes → controllers (extend BaseController) → services → repositories` strictly (no layer skipping); all external input is Zod-validated (`validators/*.schema.ts`); all env access goes through `config/unifiedConfig.ts`, never raw `process.env` elsewhere.

## Scaling to a second channel (customer feedback) — designed in, not yet built

`PLAN.md` §6 covers this in full; the short version for anyone touching the schema or RBAC: every `Appeal` already has a `channel: EMPLOYEE | CUSTOMER` column, and permissions are additionally gated by `UserChannelAccess(userId, channel)` — a permission alone (e.g. `appeal.read_all`) grants nothing without an explicit channel grant. This is why `hasChannelPermission()` (not a bare permission-array check) is the only correct way to test access anywhere in the codebase. The `CUSTOMER` channel itself (its own bot, `ExternalContact` model, consent flow) is Phase 7 — not implemented — but the schema and RBAC shape already assume it will exist, so don't "simplify" `channel`/`UserChannelAccess` away.

## Data model (Prisma — `apps/api/prisma/schema.prisma`)

Entities: `User`, `Role`/`RolePermission`, `UserChannelAccess`, `AccessRequest`, `ExternalContact` (reserved for Phase 7), `Epic`, `Appeal`, `AppealAssignment`, `AppealComment`, `AppealMessage`, `AppealAttachment`, `AppealStatusHistory`, `Rating`, `Notification`, `AuditLog`, `SystemSetting`, `NumberSequence`.

Notable choices, in case they look like bugs:
- `Appeal.type` is a plain `String`, not a Postgres enum — validated by a channel-scoped Zod enum (`EMPLOYEE_APPEAL_TYPES` in `packages/shared`) instead, because the `CUSTOMER` channel will need its own type vocabulary without a schema migration.
- `Appeal.publicNumber` is generated via `NumberSequence` (atomic upsert-increment, `apps/api/src/repositories/AppealRepository.ts`), not `COUNT(*)` — counting rows races under concurrent writes and breaks once soft-deleted rows exist.
- `AppealAttachment.appealId` is nullable: attachments upload as drafts (bot uploads before the appeal exists) with `uploadedByUserId` + `draftExpiresAt` (24h TTL, FR-DRF-002/006), and get linked to the real appeal at submit time.
- `Appeal.originalText` vs `workingEdit`: original is immutable after submission (FR-APP-008); `workingEdit` is HRD's optional de-identified rewrite (SRS §7.3) — never overwrite one with the other.

## RBAC

Permission strings live in `packages/shared/src/permissions.ts` (`PERMISSIONS` + `DEFAULT_ROLE_PERMISSIONS` seed matrix, matches SRS §4.5 exactly — Administrator intentionally gets **no** `appeal.*` permissions by default). Every permission check must go through `hasChannelPermission(user, permission, channel)` (`apps/api/src/utils/authz.ts`) — checking `user.permissions.includes(...)` alone is a bug (see channel-scaling note above). On the frontend, the equivalent is `useAuthStore().hasPermission(permission, channel?)`.

Two enforcement layers exist and both matter:
- **Route-level** (`middleware/rbac.ts`'s `requirePermission`) — coarse gate, defaults to channel `EMPLOYEE`.
- **Service-level** (inside `appealService`, `userService`, `epicService`) — the actual authority, re-checks against the specific resource's real channel/mode/assignment. Never trust the route-level gate alone when adding a new mutation.

One deliberate exception to permission-based gating: `epicService`'s dictionary CRUD checks `user.roleNames.includes("ADMINISTRATOR")` directly, because SRS §21's permission list has no dedicated "manage dictionaries" permission and inventing one wasn't worth it for a pure admin-CRUD screen.

There's also a "who can this appeal be assigned to" endpoint (`GET /appeals/assignable-users`, gated by `appeal.assign`) that's deliberately separate from `GET /users` (gated by `user.manage`) — HRD holds `appeal.assign` but not `user.manage`, and originally reused `GET /users` for the assignee dropdown, which 403'd for HRD. Don't collapse these back into one endpoint.

## Auth

- **Web** (`apps/api/src/services/authService.ts`): email+Argon2id password, JWT access+refresh, mandatory TOTP for HRD/Administrator. First login for a 2FA-required account without `totpEnabled` returns `403` with `code: "TWO_FACTOR_SETUP_REQUIRED"` — the frontend's `LoginPage` handles this by calling `/auth/2fa/setup` then `/auth/2fa/confirm` inline. `mustChangePassword` (set on admin-created accounts) is a separate soft-gate: login succeeds, frontend redirects to `/change-password`, nothing server-side blocks other routes if skipped.
- **Bot ↔ API**: static `x-bot-service-token` header (not per-user) plus an explicit `channel` argument baked into `requireBotService(channel)` at the route — the bot cannot call an endpoint for a channel other than the one the route was registered for. The bot always passes the end-user's `telegramId` in the request body/query so the API can resolve which `User` the request is acting on behalf of.

## Appeal lifecycle

`OPEN → UNDER_REVIEW → IN_PROGRESS → CLOSED`, with `CLOSED → IN_PROGRESS` as the only reopen transition. Source of truth for allowed transitions: `APPEAL_STATUS_TRANSITIONS` in `packages/shared/src/enums.ts`, enforced server-side in `appealService.changeStatus` (never trust a client-sent transition). Closing requires a non-empty `finalAnswer` (FR-WF-005); reopening requires a non-empty `reason` (FR-WF-006). `AppealStatusHistory` rows are append-only — there is no update/delete path, by design.

## Notifications

Not pushed directly — written as `Notification` rows (`status: PENDING`) and *pulled*: the bot polls `GET /notifications/pending` (TELEGRAM channel) and acks per-item after successful Telegram delivery (`packages/bot-core/notificationPoller.ts`); the web panel polls `GET /notifications` (WEB channel) every 15s. This keeps retry semantics simple (`attempts`/`lastError` columns) and matches the architecture diagram (bot → API, never the reverse). If you add a new notification type, decide its channel (TELEGRAM → employee-facing via bot, WEB → staff-facing via panel) and add a case to `notificationHandler.ts` (bot) or the relevant web page's payload-type switch.

## Testing

`apps/api/src/tests/` has unit tests only so far (no DB): `authz.test.ts` (the confidentiality invariant — treat this as the one test file that must never be weakened), `appealNumber.test.ts`, `statusTransitions.test.ts`. There is no integration/e2e test suite yet against a real Postgres — the full create→assign→confidentiality→close→rate lifecycle and the RBAC-per-role screens have been manually verified end-to-end (curl + a real Chromium session) but not automated. Adding a supertest-based integration suite against the docker-compose Postgres is the natural next step before this goes further than MVP.

## Reference: mapping SRS sections to code when extending a feature

- Bot conversation flow → SRS §35 + `apps/bot-employee/src/conversations/*.ts`, `guidedQuestions.ts`.
- Confidentiality/author-visibility → SRS §7, §33.4, §4.5 + `utils/authz.ts`, `appealService`'s two serializers (`serializeForStaff` vs `serializeForAuthor`).
- Dashboard/report metrics → SRS §36 (exact metric definitions — e.g. "time to close" measured from creation to *first* close) + `reportService.ts`.
- Audit subsystem → SRS §37 (required fields, append-only, high-risk event list) + `auditService.ts`/`AuditRepository` (no update/delete methods exist on purpose).
- Data retention → SRS §38 — explicitly provisional pending management sign-off; don't hardcode as final.
- Requirement IDs (`FR-AUTH-###`, `FR-CONF-###`, etc., cataloged in SRS §33) — reference them in commit messages per SRS §33's own instruction.
