# One image: the NestJS API, serving the built PWA from the same origin.
FROM node:24-alpine AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/engine/package.json packages/engine/
COPY packages/contracts/package.json packages/contracts/

FROM manifests AS build
RUN npm ci
COPY . .
RUN npm run build -w @coinfidant/web && npm run build -w @coinfidant/api

FROM manifests AS deps
RUN npm ci --omit=dev -w @coinfidant/api && npm cache clean --force

FROM node:24-alpine
ENV NODE_ENV=production PORT=8080 WEB_DIST=/app/apps/web/dist
COPY --from=deps /app /app
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY --from=build /app/apps/api/drizzle /app/apps/api/drizzle
COPY --from=build /app/apps/web/dist /app/apps/web/dist
WORKDIR /app/apps/api
USER node
EXPOSE 8080
CMD ["node", "--enable-source-maps", "dist/main.js"]
