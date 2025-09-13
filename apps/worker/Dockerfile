# Use Node.js 18 Alpine as base
FROM node:18-alpine

# Install FFmpeg and other dependencies
RUN apk add --no-cache ffmpeg

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package.json and pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the app
RUN pnpm run build

# Expose port (if needed, but Cloud Run may use 8080)
EXPOSE 8080

# Set FFmpeg path environment variable
ENV FFMPEG_PATH=/usr/bin/ffmpeg

# Start the worker
CMD ["pnpm", "run", "start"]
