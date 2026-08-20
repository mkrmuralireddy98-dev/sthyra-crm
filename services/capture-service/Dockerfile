FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY services/capture-service/package.json ./services/capture-service/
COPY packages/observability/package.json ./packages/observability/
COPY packages/auth/package.json ./packages/auth/
COPY packages/tokens/package.json ./packages/tokens/
RUN pnpm install --frozen-lockfile
COPY packages/ ./packages/
COPY services/ ./services/
COPY services/capture-service/ ./services/capture-service/
RUN pnpm --filter @sthyra-crm/capture-service build

FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
COPY --from=builder /app/services/capture-service/package.json ./services/capture-service/
COPY --from=builder /app/services/capture-service/dist ./services/capture-service/dist
COPY --from=builder /app/packages/observability/dist ./packages/observability/dist
COPY --from=builder /app/packages/observability/package.json ./packages/observability/
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.base.json ./
COPY packages/ ./packages/
COPY services/ ./services/
RUN pnpm install --frozen-lockfile --filter @sthyra-crm/capture-service --prod
RUN mkdir -p /var/lib/sthyra-crm/storage
ENV PORT=9090
ENV HOST=0.0.0.0
EXPOSE 9090
CMD ["node", "services/capture-service/dist/cli.js"]
