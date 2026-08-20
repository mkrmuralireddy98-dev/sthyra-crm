# Admin service Dockerfile (multi-stage, node:22-alpine)
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY services/admin-service/package.json ./services/admin-service/
COPY packages/observability/package.json ./packages/observability/
RUN pnpm install --frozen-lockfile
COPY packages/ ./packages/
COPY services/admin-service/ ./services/admin-service/
RUN pnpm --filter @sthyra-crm/admin-service build

FROM node:22-alpine
ENV PORT=9100
ENV HOST=0.0.0.0
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/services/admin-service/package.json /app/services/admin-service/package.json
COPY --from=builder /app/services/admin-service/dist /app/services/admin-service/dist
COPY --from=builder /app/packages/observability/dist /app/packages/observability/dist
COPY --from=builder /app/packages/observability/package.json /app/packages/observability/package.json
COPY --from=builder /app/pnpm-workspace.yaml /app/package.json /app/tsconfig.base.json /app/
COPY --from=builder /app/services/admin-service/node_modules /app/services/admin-service/node_modules
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/node_modules/.pnpm /app/node_modules/.pnpm
WORKDIR /app/services/admin-service
CMD ["node", "dist/cli.js"]
