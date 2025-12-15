#!/bin/bash
set -e

echo "🔍 Simulating Vercel Build Environment..."
echo "=================================================="

# Clean previous build
echo "📦 Cleaning old build..."
rm -rf dist

# Run the exact build command from vercel.json
echo "🏗️  Running build command..."
npm ci --include=dev && \
npx vite build client/ --config vite.config.ts && \
npx esbuild server/index.ts \
  --platform=node \
  --packages=external \
  --bundle \
  --format=esm \
  --outfile=dist/index.js \
  --alias:@shared=./shared \
  --external:fs \
  --external:path \
  --external:http \
  --external:ws \
  --external:url \
  --external:express \
  --external:crypto

echo ""
echo "✅ Build successful!"
echo "=================================================="
echo "📁 Build artifacts:"
du -sh dist/
ls -lh dist/
echo ""
echo "🧪 Testing if dist/index.js is valid Node.js..."
node --check dist/index.js && echo "✅ Syntax valid!" || echo "❌ Syntax error!"
