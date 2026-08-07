FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
# Build-time DB so ISR pages (/, /themes, /ideas) can prerender with catalog data.
ENV DATABASE_URL=file:/tmp/build.db
ENV NEXT_PUBLIC_APP_URL=https://party-plan.jonayed.me
RUN npx prisma db push --skip-generate && npx tsx prisma/seed.ts
COPY . .
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/app.db
ENV NEXT_PUBLIC_APP_URL=https://party-plan.jonayed.me
ENV PORT=3000
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/tsconfig.json ./
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
VOLUME ["/data"]
EXPOSE 3000
CMD ["/docker-entrypoint.sh"]
