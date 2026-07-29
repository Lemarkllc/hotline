# Единый multi-stage Dockerfile для всего монорепо — на маленьком VPS (1.7GB RAM,
# 2 CPU) проще и надёжнее собирать всё в одном контексте, чем гнаться за
# идеально минимальными образами и рисковать сломанными pnpm-симлинками между
# отдельными Dockerfile'ами на этапе copy.
#
# Таргеты: build (общий) -> api / bot-employee (Node) / web (статика за Caddy).

FROM node:20-bookworm-slim AS base
# Явно ставим openssl — иначе Prisma не может определить версию libssl в этом
# образе и молча предполагает openssl-1.1.x, что на bookworm (openssl3) может
# привести к падению query-engine в рантайме, а не только к warning на сборке.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/api/package.json apps/api/tsconfig.json apps/api/vitest.config.ts ./apps/api/
COPY apps/bot-employee/package.json apps/bot-employee/tsconfig.json ./apps/bot-employee/
COPY apps/web/package.json apps/web/tsconfig.json apps/web/vite.config.ts apps/web/tailwind.config.ts apps/web/postcss.config.js ./apps/web/
RUN pnpm install --frozen-lockfile

COPY apps/api/src ./apps/api/src
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh
RUN chmod +x ./apps/api/docker-entrypoint.sh
COPY apps/bot-employee/src ./apps/bot-employee/src
COPY apps/web/index.html ./apps/web/index.html
COPY apps/web/src ./apps/web/src
COPY apps/web/public ./apps/web/public

# Vite инлайнит VITE_* в бандл на этапе сборки — не runtime-переменная, поэтому
# фиксируется здесь, а не в docker-compose environment. Same-origin путь /api/v1
# за Caddy (см. Caddyfile) — не нужен даже CORS между web и api.
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN pnpm --filter @hotline/shared run build && \
    pnpm --filter @hotline/bot-core run build && \
    pnpm --filter @hotline/api exec prisma generate && \
    pnpm --filter @hotline/api run build && \
    pnpm --filter @hotline/bot-employee run build && \
    pnpm --filter @hotline/web run build

# "build" (выше) специально остаётся С devDependencies (tsx и т.п.) — это
# таргет для одноразовых админских задач (seed, prisma studio): docker build
# --target build -t hotline-build . && docker run ... hotline-build sh -c
# "cd apps/api && pnpm exec tsx prisma/seed.ts"

FROM build AS build-prod
# pnpm prune --prod (без -r) в воркспейсе трогает только корневой package.json,
# из-за чего node_modules отдельных apps/* остаются пустыми — вместо этого
# просто переустанавливаем всё заново с --prod (сам bin-симлинок для prisma
# и остальных прод-зависимостей каждого workspace-пакета восстанавливается верно).
RUN CI=true pnpm install --prod --frozen-lockfile

FROM base AS api
ENV NODE_ENV=production
COPY --from=build-prod /app /app
WORKDIR /app/apps/api
EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]

FROM base AS bot-employee
ENV NODE_ENV=production
COPY --from=build-prod /app /app
WORKDIR /app/apps/bot-employee
CMD ["node", "dist/index.js"]

FROM caddy:2-alpine AS web
COPY --from=build /app/apps/web/dist /usr/share/caddy
COPY Caddyfile /etc/caddy/Caddyfile
