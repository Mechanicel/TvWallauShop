FROM node:20-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY contracts/package.json contracts/package.json
COPY backend/package.json backend/package.json

RUN npm ci

COPY contracts contracts
COPY backend backend

RUN npm run build --workspace backend

FROM node:20-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY contracts/package.json contracts/package.json
COPY backend/package.json backend/package.json

RUN npm ci --omit=dev

COPY --from=build /app/contracts /app/contracts
COPY --from=build /app/backend/dist /app/backend/dist
COPY --from=build /app/backend/dist/knexfile.js /app/backend/dist/knexfile.js
COPY --from=build /app/backend/dist/migrations /app/backend/dist/migrations
COPY --from=build /app/backend/dist/seeds /app/backend/dist/seeds

CMD ["node", "backend/dist/index.js"]
