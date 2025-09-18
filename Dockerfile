# ──────────────
# Base Image
# ──────────────
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies (production only)
RUN npm install --omit=dev

# Copy application code
COPY . .

# Cloud Run listens on 8080
EXPOSE 8080

# Default CMD
CMD ["npm", "start"]
