# ── Base image ──
FROM node:18-alpine

# ── Set working directory ──
WORKDIR /usr/src/app

# ── Copy package.json and package-lock.json ──
COPY package*.json ./

# ── Install dependencies ──
RUN npm install --production

# ── Copy the rest of the application ──
COPY . .

# ── Expose Cloud Run port (must be 8080 internally) ──
EXPOSE 8080

# ── Start server ──
CMD ["node", "server.js"]
