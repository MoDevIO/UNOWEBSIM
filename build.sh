#!/bin/bash
set -e

echo "Building client..."
npx vite build client/ --config vite.config.ts

echo "Building server..."
npx esbuild server/index.ts \
  --platform=node \
  --packages=external \
  --bundle \
  --format=esm \
  --outfile=dist/index.js \
  --alias:@shared=./shared \
  --external:fs \
  --external:path \
  --external:crypto \
  --external:http \
  --external:ws \
  --external:url \
  --external:express

echo "Build complete!"
