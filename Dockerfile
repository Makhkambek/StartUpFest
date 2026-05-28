# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
# Node 22 ships with npm 10.x, which mis-handles optional peer deps in lockfiles
# (https://github.com/npm/cli/issues/7411). Force npm 11, which respects
# peerDependenciesMeta.optional and resolves the @swc/helpers conflict between
# `next` (pins 0.5.15) and `next-intl`'s @swc/core (wants >=0.5.17, optional).
RUN npm install -g npm@11
WORKDIR /app
COPY package.json package-lock.json* ./
# --ignore-scripts blocks postinstall hooks from running, closing the supply-chain
# code-execution vector at image build time. We don't need any package's
# postinstall step in this Next.js + Supabase build.
RUN npm ci --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
