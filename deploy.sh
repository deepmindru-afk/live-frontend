#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "Current directory: $(pwd)"
echo "Starting deployment..."

# Install dependencies
echo "Installing dependencies..."
npm install --legacy-peer-deps

if [ $? -ne 0 ]; then
    echo "Error: npm install failed!"
    exit 1
fi

# Build the application
echo "Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "Error: Build failed!"
    exit 1
fi

# Check if .next directory exists
if [ ! -d ".next" ]; then
    echo "Error: .next directory not found after build!"
    exit 1
fi

echo "Build successful! .next directory exists."

# Restart PM2 for frontend
echo "Restarting PM2..."
pm2 delete liveee-frontend 2>/dev/null || true
pm2 start npm --name liveee-frontend -- start -- -p 3077
pm2 save

echo "Deployment complete!"
