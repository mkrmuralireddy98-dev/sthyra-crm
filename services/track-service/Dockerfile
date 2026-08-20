FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY services/ ./services/
COPY services/track-service/ ./services/track-service/
WORKDIR /app/services/track-service
RUN pnpm install --frozen-lockfile=false --filter @sthyra-crm/track-service...
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
COPY --from=builder /app/pnpm-workspace.yaml /app/package.json /app/tsconfig.base.json ./
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/services/track-service/node_modules /app/services/track-service/node_modules
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/services/track-service/ ./services/track-service/
WORKDIR /app/services/track-service
ENV PORT=9095
EXPOSE 9095
CMD ["node", "dist/cli.js"]
