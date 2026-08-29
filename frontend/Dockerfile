# syntax=docker/dockerfile:1

# --- Stage 1: build the Vite bundle ---
FROM node:20-alpine AS build
WORKDIR /app

# Empty default: the built app calls the relative /api path (nginx proxies it).
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
# Use `npm ci` when a lockfile is present, else fall back to `npm install`
# (the lockfile is generated on first install; local Node is too old to create it).
RUN if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi

COPY . .
RUN npm run build

# --- Stage 2: serve static files with nginx ---
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
