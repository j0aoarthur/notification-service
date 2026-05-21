# =============================================================================
# Estágio 1: Dependências base
# =============================================================================
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# =============================================================================
# Estágio 2: Desenvolvimento (com hot-reload via nest start --watch)
# =============================================================================
FROM base AS development
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# =============================================================================
# Estágio 3: Build de produção
# =============================================================================
FROM base AS builder
RUN npm ci --only=production
COPY . .
RUN npm run build

# =============================================================================
# Estágio 4: Produção (imagem final enxuta)
# =============================================================================
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

USER node

CMD ["node", "dist/main"]
