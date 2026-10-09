// Generates the app icon, splash image and store screenshots from code.
//
//   npm run assets            → writes assets/*.png and store/**/*.png
//   npm run assets -- preview → writes a few test pictures to ./preview-out
//
// It bundles scripts/assets.ts (which reuses the game's own drawing code) and runs it in Node.
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outfile = path.join(root, 'node_modules', '.cache', 'rocket-snail', 'assets.cjs');

await build({
  entryPoints: [path.join(root, 'scripts', 'assets.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile,
  logLevel: 'warning',
  alias: { '@shopify/react-native-skia': path.join(root, 'scripts', 'skia-node.js') },
});

const result = spawnSync(process.execPath, [outfile, ...process.argv.slice(2)], { stdio: 'inherit', cwd: root });
process.exit(result.status ?? 1);
