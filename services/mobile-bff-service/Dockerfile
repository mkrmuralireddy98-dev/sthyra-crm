FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY services/ ./services/
COPY services/mobile-bff-service/ ./services/mobile-bff-service/
WORKDIR /app/services/mobile-bff-service
RUN pnpm install --frozen-lockfile=false --filter @sthyra-crm/mobile-bff-service...
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
COPY --from=builder /app/pnpm-workspace.yaml /app/package.json /app/tsconfig.base.json ./
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/services/mobile-bff-service/node_modules /app/services/mobile-bff-service/node_modules
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/services/mobile-bff-service/ ./services/mobile-bff-service/
WORKDIR /app/services/mobile-bff-service
ENV PORT=9094
EXPOSE 9094
CMD ["node", "dist/cli.js"]