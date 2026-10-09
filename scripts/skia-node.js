// Lets the game's drawing code (src/game/draw.ts) run in Node, so the same code
// that draws the game also draws the app icon, splash screen and store screenshots.
// Used only by scripts/build-assets.mjs, never by the app itself.
const { createRequire } = require('node:module');

// Loaded at run time from node_modules (not bundled), so Skia's Node build is used as is.
const nodeRequire = createRequire(__filename);
const types = nodeRequire('@shopify/react-native-skia/lib/commonjs/skia/types');

module.exports = {
  ...types,
  get Skia() {
    return globalThis.__ROCKET_SNAIL_SKIA__;
  },
};
