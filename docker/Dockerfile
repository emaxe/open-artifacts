# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# --- deps: install with only manifests copied, for cache-friendly rebuilds ---
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/cli/package.json packages/cli/package.json
RUN pnpm install --frozen-lockfile

# --- build: compile shared -> api/web/cli, in dependency order ---
FROM deps AS build
COPY . .
RUN pnpm --filter @open-artifacts/shared build \
 && pnpm --filter @open-artifacts/api build \
 && pnpm --filter @open-artifacts/web build

# --- prune dev dependencies out of node_modules for the runtime image ---
FROM build AS prune
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# --- runtime: minimal image with just what's needed to run the API + serve the SPA ---
FROM node:22-alpine AS runtime
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
# pnpm's default (non-hoisted) node-linker keeps each workspace package's own dependencies as
# symlinks under that package's own node_modules, pointing back into the root .pnpm store — so
# both the root store AND each consuming package's node_modules folder must be copied.
COPY --from=prune /app/node_modules ./node_modules
COPY --from=prune /app/package.json ./package.json
COPY --from=prune /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=prune /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=prune /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/web/dist ./apps/web/dist

EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app/apps/api
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
