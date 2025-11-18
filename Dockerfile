FROM node:20-slim

# Set environment
ENV NODE_ENV=production

# Create app directory
WORKDIR /app

# Install system dependencies needed for phantomjs and general build tools
RUN apt-get update && \
        apt-get install -y --no-install-recommends \
            bzip2 \
            curl \
            ca-certificates \
            libfontconfig1 \
            libfreetype6 \
            libx11-6 \
            libxext6 \
            libxrender1 \
            libxcb1 \
            fonts-liberation \
            fonts-dejavu-core \
            fonts-noto-core \
            chromium \
            chromium-sandbox && \
        rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy source code
COPY . .

# Create a non-root user
RUN useradd -m appuser
USER appuser

EXPOSE 5000
CMD ["node", "server.js"]
