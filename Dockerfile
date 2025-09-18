# ──────────────
# Base Image
# ──────────────
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies (only production)
RUN npm install --omit=dev

# Copy application code
COPY . .

# Expose port (from server.js -> defaults to 5000)
EXPOSE 5000

# Run app
CMD ["npm", "start"]
