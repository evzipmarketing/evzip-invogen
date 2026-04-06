const { join } = require("path");

/**
 * Cache Chrome inside the project so Render (and similar) deploy includes it.
 * Build: npx puppeteer browsers install chrome
 * Runtime: Puppeteer finds Chrome at <project>/.cache/puppeteer
 */
module.exports = {
  cacheDirectory: join(__dirname, ".cache", "puppeteer"),
};
