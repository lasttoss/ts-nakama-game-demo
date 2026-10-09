# syntax=docker/dockerfile:1

FROM node:20-alpine AS plugin-builder
# nakama-runtime is a git dependency (github:heroiclabs/nakama-common), so the alpine
# image needs git before `npm install` can run.
RUN apk add --no-cache git
WORKDIR /plugin
COPY package.json ./
RUN npm install
COPY tsconfig.json main.ts ./
COPY games/ ./games/
RUN npx tsc

FROM heroiclabs/nakama:3.32.0
COPY --from=plugin-builder /plugin/build/index.js /nakama/data/modules/build/index.js
COPY local.yml /nakama/data/
