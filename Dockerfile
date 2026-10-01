# syntax=docker/dockerfile:1

# ---- Build stage: install all deps, type-check and build the frontend ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- Runtime stage: production deps only, non-root user ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY server ./server
COPY src ./src
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
CMD ["npx", "tsx", "server/index.ts"]
