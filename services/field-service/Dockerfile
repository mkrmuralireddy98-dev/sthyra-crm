FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
COPY pnpm-workspace.yaml package.json tsconfig.base.json .npmrc ./
COPY packages/ ./packages/
COPY services/ ./services/
COPY services/field-service/ ./services/field-service/
WORKDIR /app/services/field-service
RUN pnpm install --frozen-lockfile=false --filter @sthyra-crm/field-service...
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
COPY --from=builder /app/pnpm-workspace.yaml /app/package.json /app/tsconfig.base.json /app/.npmrc ./
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/services/field-service/ ./services/field-service/
WORKDIR /app/services/field-service
COPY --from=builder /app/services/field-service/node_modules ./node_modules
COPY --from=builder /app/node_modules /node_modules
ENV PORT=9091
EXPOSE 9091
CMD ["node", "dist/cli.js"]
