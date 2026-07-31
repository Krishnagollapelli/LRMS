# Stage 1: Build the application assets
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependency configs
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
COPY shared/package*.json ./shared/
COPY prisma ./prisma

# Install all workspace dependencies
RUN npm ci

# Copy codebase
COPY . .

# Generate Prisma PostgreSQL client bindings
RUN npm run db:generate

# Build React client and Express server
RUN npm run build:client -w client
RUN npm run build:server -w server

# Stage 2: Production runner container
FROM node:20-alpine AS runner
WORKDIR /app

# Set env to production
ENV NODE_ENV=production
ENV PORT=5000

# Copy workspace dependencies configuration
COPY package*.json ./
COPY server/package*.json ./server/
COPY shared/package*.json ./shared/
COPY prisma ./prisma

# Install production-only dependencies
RUN npm ci --only=production

# Copy compiled assets from builder stage
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/shared/src ./shared/src
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Expose port and declare startup CMD
EXPOSE 5000
CMD ["node", "server/dist/index.js"]
