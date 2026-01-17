FROM node:20-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY contracts/package.json contracts/package.json
COPY frontend/package.json frontend/package.json

RUN npm ci

COPY contracts contracts
COPY frontend frontend

RUN npm run build --workspace frontend

FROM nginx:1.27-alpine

COPY --from=build /app/frontend/dist /usr/share/nginx/html
