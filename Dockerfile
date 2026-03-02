# Stage 1: Install dependencies
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Stage 2: Build the SvelteKit app
FROM oven/bun:1 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# Stage 3: Production dependencies only
FROM oven/bun:1 AS prod-deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Stage 4: Production image
FROM node:22-slim AS runtime
WORKDIR /app

COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "build"]
