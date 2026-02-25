#!/usr/bin/env bash
set -o errexit

# Install dependencies
npm install

# Build Next.js
npm run build

# Puppeteer: Install Chrome (see .puppeteerrc.cjs for cache path inside project)
npx puppeteer browsers install chrome
