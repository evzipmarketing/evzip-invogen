#!/usr/bin/env bash
set -o errexit

# Install dependencies
npm install

# Build Next.js
npm run build

# Puppeteer: Install Chrome for Render's environment
# Render free tier uses /opt/render; Chrome must be installed at build time
export PUPPETEER_CACHE_DIR="${PUPPETEER_CACHE_DIR:-/opt/render/project/src/.cache/puppeteer}"
mkdir -p "$PUPPETEER_CACHE_DIR"
npx puppeteer browsers install chrome
