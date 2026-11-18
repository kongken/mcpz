# syntax=docker/dockerfile:1

# Build stage: type-check, test and bundle the Node entry into a single file.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY test ./test
COPY wrangler.jsonc ./
RUN npm run typecheck && npm test && npm run build

# Runtime stage: only the bundled server, no dependencies or source.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Multica API origin for the default (cloud) deployment. Point this at a
# self-hosted Multica root URL at runtime; credentials come from request headers.
ENV MULTICA_SERVER_URL=https://api.multica.ai
ENV PORT=8787
COPY --from=build /app/dist/server.mjs ./server.mjs
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1 || exit 1
CMD ["node", "server.mjs"]
