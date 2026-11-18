FROM node:22-bookworm-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV SQLITE_DB_PATH=/app/data/comparativo_llms.db
ENV JSON_SNAPSHOT_PATH=/app/data/latest-snapshot.json
ENV SYNC_INTERVAL_MS=300000

COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "dist/server/server/index.js"]
