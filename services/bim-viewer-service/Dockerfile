FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY services/ ./services/
COPY services/bim-viewer-service/ ./services/bim-viewer-service/
WORKDIR /app/services/bim-viewer-service
RUN pnpm install --frozen-lockfile=false --filter @sthyra-crm/bim-viewer-service...
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
COPY --from=builder /app/pnpm-workspace.yaml /app/package.json /app/tsconfig.base.json ./
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/services/bim-viewer-service/ ./services/bim-viewer-service/
WORKDIR /app/services/bim-viewer-service
ENV PORT=9092
EXPOSE 9092
CMD ["node", "dist/cli.js"]
