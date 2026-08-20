FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY services/ ./services/
COPY services/report-service/ ./services/report-service/
WORKDIR /app/services/report-service
RUN pnpm install --frozen-lockfile=false --filter @sthyra-crm/report-service...
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
COPY --from=builder /app/pnpm-workspace.yaml /app/package.json /app/tsconfig.base.json ./
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/services/report-service/ ./services/report-service/
WORKDIR /app/services/report-service
COPY --from=builder /app/services/report-service/node_modules ./node_modules
COPY --from=builder /app/node_modules /node_modules
ENV PORT=9096
EXPOSE 9096
CMD ["node", "dist/cli.js"]
