# Use the official Deno image
FROM denoland/deno:alpine-2.4.5

# Install curl
RUN apk add --no-cache curl

# Create app directory
RUN mkdir -p /app

# Set working directory
WORKDIR /app

# Copy your project files
COPY . .

CMD ["deno", "run", "--allow-read", "--allow-net", "--allow-env", "--no-prompt", "src/server.ts"]
