FROM node:22-bookworm-slim

# Install build dependencies for node-pty (requires Python3 and g++)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    g++ \
    gcc \
    make \
    git \
    git-lfs \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@10.4.1

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Install dependencies (with build tools available for node-pty)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]
