# syntax=docker/dockerfile:1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e

# ---- build: static Astro site -> dist/ (D4) ----
FROM node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Explicit build inputs only (never `COPY . .`): keeps local credentials out of the layers.
COPY astro.config.mjs tsconfig.json ./
COPY src ./src
COPY public ./public
# The committed content snapshot; the image never needs the INSTANTS folder.
COPY content ./content
RUN npm run build

# CSP include for nginx: inline-script hashes are computed from the built HTML (same code path as the Vercel output).
COPY scripts/vercel-output.ts ./scripts/vercel-output.ts
RUN node scripts/vercel-output.ts --nginx-csp dist /tmp/csp.conf

# ---- runtime: nginx (non-root) serving dist/ on :8080 ----
FROM nginxinc/nginx-unprivileged:1-alpine@sha256:b5047b9b76845eac124358373c6852377c52e4b05834a47647e955dd91cb8f1e AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /tmp/csp.conf /etc/nginx/csp.conf

USER 101
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
