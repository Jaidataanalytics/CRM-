#!/bin/bash
# Production startup script for frontend
# This script ensures a fresh build is served every time

set -e

cd /app/frontend

echo "=== Frontend Production Startup ==="
echo "$(date): Starting production build process..."

# Clear any development caches
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf .cache 2>/dev/null || true

# Build production version (only if build folder doesn't exist or is older than src)
if [ ! -d "build" ] || [ "$(find src -newer build -print -quit 2>/dev/null)" ]; then
    echo "$(date): Building production bundle..."
    yarn build
fi

echo "$(date): Starting production server on port 3000..."

# Serve the production build
# -s: Single page app mode (routes all requests to index.html)
# -l: Listen on port 3000
# -n: No clipboard (don't copy URL to clipboard)
exec npx serve -s build -l 3000 -n
