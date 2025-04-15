FROM node:22.12-alpine AS builder

COPY . /app

WORKDIR /app

RUN npm install

FROM node:22-alpine AS release

WORKDIR /app

COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/package-lock.json /app/package-lock.json

ENV NODE_ENV=production

RUN npm ci --ignore-scripts --omit-dev
EXPOSE 8080
ENTRYPOINT ["npx", "mcp-proxy-auth", "node", "/app/dist/index.js"]
