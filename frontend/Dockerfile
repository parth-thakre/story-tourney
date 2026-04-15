FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NODE_ENV=production
ARG API_PROXY_URL=http://backend:9966
ENV API_PROXY_URL=$API_PROXY_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=9965
ENV API_PROXY_URL=http://backend:9966
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
RUN chown -R node:node /app
USER node
EXPOSE 9965
CMD ["node", "server.js"]
