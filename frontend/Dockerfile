# Bluebonnet storefront — Next.js standalone server.
FROM node:24-alpine AS build
WORKDIR /app
# Rewrites (/api → API) and robots/sitemap host are fixed at build time. Neither is a secret.
ARG INTERNAL_API_URL=http://bluebonnet-api:4000
ARG PUBLIC_SITE_URL=https://bluebonnetmaroc.com
ARG IMAGE_HOST=
ENV INTERNAL_API_URL=$INTERNAL_API_URL PUBLIC_SITE_URL=$PUBLIC_SITE_URL IMAGE_HOST=$IMAGE_HOST NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/robots.txt >/dev/null || exit 1
CMD ["node", "server.js"]
