FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY services/ ./services/
COPY services/dashboard-service/ ./services/dashboard-service/
WORKDIR /app/services/dashboard-service
RUN pnpm install --frozen-lockfile=false --filter @sthyra-crm/dashboard-service...
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
COPY --from=builder /app/pnpm-workspace.yaml /app/package.json /app/tsconfig.json ./
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/services/dashboard-service/ ./services/dashboard-service/
WORKDIR /app/services/dashboard-service
ENV PORT=9099
EXPOSE 9099
CMD ["node", "dist/cli.js"]
