# Multi-stage build: Vite app → nginx (the /api/fa proxy adds the key server-side)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

RUN npm run build

# Production stage
FROM nginx:alpine

# nginx config; the image runs envsubst on templates at start (fills FA_API_KEY)
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]