# syntax=docker/dockerfile:1

FROM node:20-slim AS build
WORKDIR /app

# Install dependencies (monorepo-aware)
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm ci

# Copy source
COPY tsconfig.base.json ./
COPY apps/backend ./apps/backend
COPY packages/shared ./packages/shared

# Build shared + backend
RUN npm run build -w @arkivia/shared
RUN npm run build -w @arkivia/app-backend


FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Only prod deps
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm ci --omit=dev

# Bring built artifacts
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/packages/shared/dist ./packages/shared/dist

ENV PORT=8080
EXPOSE 8080

CMD ["node", "apps/backend/dist/index.js"]
