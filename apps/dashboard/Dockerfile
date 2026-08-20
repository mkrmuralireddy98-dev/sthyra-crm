# Next.js 14 dashboard Dockerfile
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY apps/dashboard/package.json ./apps/dashboard/
COPY packages/observability/package.json ./packages/observability/
COPY packages/tokens/package.json ./packages/tokens/
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
WORKDIR /app
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/apps/dashboard/node_modules /app/apps/dashboard/node_modules
COPY apps/dashboard ./apps/dashboard
COPY packages ./packages
WORKDIR /app/apps/dashboard
RUN pnpm run build

FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
COPY --from=builder /app/apps/dashboard/.next ./apps/dashboard/.next
COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public
COPY --from=builder /app/apps/dashboard/package.json ./apps/dashboard/package.json
COPY --from=builder /app/apps/dashboard/node_modules ./apps/dashboard/node_modules
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/pnpm-workspace.yaml /app/package.json ./
WORKDIR /app/apps/dashboard
EXPOSE 3000
CMD ["pnpm", "run", "start"]
