/// <reference types="node" />
// Draws the app icon, splash image and store screenshots with the game's own drawing code.
// Run it with `npm run assets` (see scripts/build-assets.mjs).

import { AlphaType, BlendMode, ColorType, TileMode } from '@shopify/react-native-skia';
import type { SkCanvas, SkFont, SkPaint, SkSurface } from '@shopify/react-native-skia';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import zlib from 'node:zlib';

import { COLORS, DAY_CYCLE, GROUND_Y, SNAIL_X, UNITS_PER_POINT, WORLD_HEIGHT } from '../src/game/constants';
import { drawBackground, drawGame, drawLettuce, drawSnail, textWidth, type GameFonts, type ScreenLayout } from '../src/game/draw';
import { createGameState, type GameState, type Obstacle } from '../src/game/engine';
import { HATS, ROCKETS, makeLook, type SkinLook } from '../src/game/skins';
import { LANGUAGES, type Lang } from '../src/i18n/strings';

/* eslint-disable @typescript-eslint/no-explicit-any */
const nodeRequire = createRequire(__filename);
const ROOT = process.cwd();
let Skia: any;
let headless: any;

async function initSkia() {
  const CanvasKitInit = nodeRequire('canvaskit-wasm/bin/full/canvaskit.js');
  (globalThis as any).CanvasKit = await CanvasKitInit();
  headless = nodeRequire('@shopify/react-native-skia/lib/commonjs/headless');
  Skia = headless.getSkiaExports().Skia;
  (globalThis as any).__ROCKET_SNAIL_SKIA__ = Skia;
}

// ---------------------------------------------------------------- files

function crc32(buf: Buffer) {
  let c: number;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** PNG without an alpha channel (the App Store icon must not have one). */
function encodeOpaquePng(width: number, height: number, rgba: Uint8Array) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const o = row + 1 + x * 3;
      raw[o] = rgba[i];
      raw[o + 1] = rgba[i + 1];
      raw[o + 2] = rgba[i + 2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function save(surface: SkSurface, file: string, opaque = false) {
  surface.flush();
  const image = surface.makeImageSnapshot();
  let bytes: Uint8Array;
  if (opaque) {
    const w = image.width();
    const h = image.height();
    const px = image.readPixels(0, 0, { width: w, height: h, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
    bytes = encodeOpaquePng(w, h, px as Uint8Array);
  } else {
    bytes = image.encodeToBytes();
  }
  const out = path.resolve(ROOT, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, bytes);
  console.log('  wrote', file);
}

function surface(w: number, h: number): SkSurface {
  return headless.makeOffscreenSurface(w, h);
}

function paint(): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  return p;
}

// ---------------------------------------------------------------- fonts

let typeface: any;
function font(size: number): SkFont {
  if (!typeface) {
    const file = path.join(ROOT, 'node_modules/@expo-google-fonts/nunito/900Black/Nunito_900Black.ttf');
    typeface = Skia.Typeface.MakeFreeTypeFaceFromData(Skia.Data.fromBytes(new Uint8Array(fs.readFileSync(file))));
  }
  return Skia.Font(typeface, size);
}

function gameFonts(height: number): GameFonts {
  return { hud: font(height * 0.075), small: font(height * 0.05), big: font(height * 0.09) };
}

function labelsFor(lang: Lang) {
  const t = LANGUAGES[lang];
  return { holdToFly: t.holdToFly, newBest: t.newBest, bestFlag: t.bestFlag, meters: t.meters };
}

// ---------------------------------------------------------------- scenes

function obstacle(kind: Obstacle['kind'], x: number, y: number, extra: Partial<Obstacle> = {}): Obstacle {
  return { kind, x, y, baseY: y, vy: 0, size: 1, phase: 0.3, top: false, ...extra };
}

type Scene = (ww: number) => GameState;

const SCENES: Record<string, Scene> = {
  day: (ww) => {
    const s = createGameState(ww, 250);
    Object.assign(s, { phase: 'playing', snailY: 42, snailVY: -30, holding: true, time: 1.3, distance: 180 * UNITS_PER_POINT, score: 180, coins: 27 });
    s.obstacles.push(obstacle('bird', SNAIL_X + 48, 28, { phase: 0.35 }));
    s.obstacles.push(obstacle('leaf', SNAIL_X + 85, 60, { size: 1.2, phase: 0.5 }));
    s.obstacles.push(obstacle('hose', SNAIL_X + 125, GROUND_Y - 36, { size: 36 }));
    for (let i = 0; i < 5; i++) s.lettuce.push({ x: SNAIL_X + 18 + i * 7, y: 46 + Math.sin(i * 0.9) * 5, phase: i * 0.6 });
    for (let i = 0; i < 9; i++) {
      s.particles.push({ kind: 'puff', x: SNAIL_X - 14 - i * 3.2, y: 31 + i * 0.9, vx: 0, vy: 0, life: 0.45 - i * 0.045, maxLife: 0.45, size: 1, hue: 0 });
    }
    s.popups.push({ kind: 'plus', x: SNAIL_X + 10, y: 38, life: 0.5 });
    return s;
  },
  sunset: (ww) => {
    const s = createGameState(ww, 410);
    const dist = DAY_CYCLE * 0.53;
    Object.assign(s, { phase: 'playing', snailY: 52, snailVY: 10, holding: false, time: 2.1, distance: dist, score: Math.floor(dist / UNITS_PER_POINT), coins: 64 });
    s.bestDistance = dist - 40; // record just passed: its flag is already off screen
    s.passedBest = true;
    s.obstacles.push(obstacle('hose', SNAIL_X + 70, 34, { size: 34, top: true }));
    s.obstacles.push(obstacle('hose', SNAIL_X + 70, 68, { size: GROUND_Y - 68 }));
    for (let i = 0; i < 4; i++) s.lettuce.push({ x: SNAIL_X + 56 + i * 8, y: 51, phase: i });
    s.obstacles.push(obstacle('bird', SNAIL_X + 120, 30, { phase: 0.1 }));
    s.obstacles.push(obstacle('bird', SNAIL_X + 127, 24, { phase: 0.2 }));
    s.obstacles.push(obstacle('bird', SNAIL_X + 127, 36, { phase: 0.4 }));
    s.popups.push({ kind: 'best', x: SNAIL_X + 6, y: 30, life: 1.2 });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      s.particles.push({ kind: 'confetti', x: SNAIL_X + 6 + Math.cos(a) * (8 + (i % 5) * 3), y: 40 + Math.sin(a) * (8 + (i % 4) * 3), vx: 0, vy: 0, life: 1, maxLife: 1.4, size: 1, hue: i / 26 });
    }
    return s;
  },
  night: (ww) => {
    const s = createGameState(ww, 600);
    const dist = DAY_CYCLE * 0.7;
    Object.assign(s, { phase: 'playing', snailY: 64, snailVY: -45, holding: true, time: 3.4, distance: dist, score: Math.floor(dist / UNITS_PER_POINT), coins: 112 });
    s.obstacles.push(obstacle('drop', SNAIL_X + 34, 30, { vy: 70 }));
    s.obstacles.push(obstacle('drop', SNAIL_X + 43, 44, { vy: 70 }));
    s.obstacles.push(obstacle('drop', SNAIL_X + 52, 22, { vy: 70 }));
    s.obstacles.push(obstacle('leaf', SNAIL_X + 95, 40, { size: 1.1, phase: 1.2 }));
    s.obstacles.push(obstacle('hose', SNAIL_X + 140, 36, { size: 36, top: true }));
    for (let i = 0; i < 5; i++) s.lettuce.push({ x: SNAIL_X + 64 + i * 7, y: 70, phase: i });
    for (let i = 0; i < 9; i++) {
      s.particles.push({ kind: 'puff', x: SNAIL_X - 14 - i * 3.2, y: 52 + i * 1.1, vx: 0, vy: 0, life: 0.45 - i * 0.045, maxLife: 0.45, size: 1, hue: 0 });
    }
    return s;
  },
  ready: (ww) => {
    const s = createGameState(ww, 0);
    s.time = 0.1;
    return s;
  },
};

const LOOKS: Record<string, SkinLook> = {
  day: makeLook('rocket-classic', 'none'),
  sunset: makeLook('rocket-sky', 'crown'),
  night: makeLook('rocket-gold', 'propeller'),
  ready: makeLook('rocket-classic', 'party'),
};

function drawScene(c: SkCanvas, name: string, w: number, h: number, lang: Lang) {
  const unit = h / WORLD_HEIGHT;
  const layout: ScreenLayout = { unit, width: w, height: h, safeLeft: Math.max(24, h * 0.05), safeRight: Math.max(24, h * 0.05) };
  const s = SCENES[name](w / unit);
  drawGame(c, s, LOOKS[name], layout, labelsFor(lang), gameFonts(h));
}

// ---------------------------------------------------------------- marketing art

function drawSkinsShowcase(c: SkCanvas, w: number, h: number) {
  const unit = h / WORLD_HEIGHT;
  const p = paint();
  c.save();
  c.scale(unit, unit);
  const ww = w / unit;
  drawBackground(c, p, ww, 40);
  const combos: [string, string][] = [
    ['rocket-mint', 'tophat'],
    ['rocket-grape', 'viking'],
    ['rocket-candy', 'party'],
    ['rocket-rainbow', 'crown'],
    ['rocket-bubblegum', 'flower'],
    ['rocket-sunny', 'cap'],
  ];
  combos.forEach(([rocket, hat], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = ww * (0.2 + col * 0.3) + (row ? 8 : -8);
    const y = 46 + row * 30;
    c.save();
    c.translate(x, y);
    c.scale(1.15, 1.15);
    drawSnail(c, p, 0, 0, (i % 2 ? -1 : 1) * 6, 0.7 + i * 0.4, 0.8, makeLook(rocket, hat), false);
    c.restore();
  });
  for (let i = 0; i < 7; i++) drawLettuce(c, p, ww * 0.08 + i * ww * 0.14, 90 + (i % 2) * 2, 1.2);
  c.restore();
}

function captionBanner(c: SkCanvas, text: string, w: number, h: number) {
  const f = font(h * 0.075);
  const p = paint();
  const tw = textWidth(f, text);
  const padX = h * 0.05;
  const bw = tw + padX * 2;
  const bh = h * 0.13;
  const x = (w - bw) / 2;
  const y = h * 0.035;
  p.setColor(Skia.Color(COLORS.ink));
  p.setAlphaf(0.25);
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y + h * 0.008, bw, bh), bh / 2, bh / 2), p);
  p.setAlphaf(1);
  p.setColor(Skia.Color('#FFFFFF'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, bw, bh), bh / 2, bh / 2), p);
  p.setColor(Skia.Color('#FF5A5F'));
  c.drawText(text, x + padX, y + bh * 0.68, p, f);
}

const CAPTIONS: Record<Lang, Record<string, string>> = {
  en: {
    day: 'Hold to fly, let go to fall!',
    sunset: 'Beat your best score!',
    night: 'Fly day and night',
    skins: 'Unlock cute hats & rockets',
  },
  bg: {
    day: 'Задръж, за да летиш!',
    sunset: 'Подобри рекорда си!',
    night: 'Летиш денем и нощем',
    skins: 'Сладки шапки и ракети',
  },
};

function storeShot(name: string, w: number, h: number, lang: Lang, file: string) {
  const sf = surface(w, h);
  const c = sf.getCanvas();
  if (name === 'skins') drawSkinsShowcase(c, w, h);
  else drawScene(c, name, w, h, lang);
  captionBanner(c, CAPTIONS[lang][name], w, h);
  save(sf, file, true);
}

// ---------------------------------------------------------------- icons

function iconSky(c: SkCanvas, size: number) {
  const p = paint();
  p.setShader(
    Skia.Shader.MakeLinearGradient(
      Skia.Point(0, 0),
      Skia.Point(0, size),
      [Skia.Color('#6FC3FF'), Skia.Color('#D4F1FF')],
      null,
      TileMode.Clamp,
    ),
  );
  c.drawRect(Skia.XYWHRect(0, 0, size, size), p);
  p.setShader(null);
  const u = size / 100;
  p.setColor(Skia.Color(COLORS.sun));
  p.setAlphaf(0.35);
  c.drawCircle(86 * u, 13 * u, 11 * u, p);
  p.setAlphaf(1);
  c.drawCircle(86 * u, 13 * u, 7 * u, p);
  p.setColor(Skia.Color(COLORS.hillFar));
  c.drawCircle(15 * u, 112 * u, 34 * u, p);
  c.drawCircle(85 * u, 115 * u, 36 * u, p);
  p.setColor(Skia.Color(COLORS.grass));
  c.drawRect(Skia.XYWHRect(0, 88 * u, size, 12 * u), p);
}

/** The snail with its rocket, centred in a box of `size` pixels, using `scale` of that box */
function iconSnail(c: SkCanvas, size: number, scale: number, look: SkinLook) {
  const p = paint();
  // with its rocket and flame, the snail spans about x -24..13 and y -19..5 units around its origin
  const unitsWide = 37;
  const k = (size * scale) / unitsWide;
  c.save();
  c.translate(size / 2 + 3.4 * k, size / 2 + 4.5 * k);
  c.scale(k, k);
  drawSnail(c, p, 0, 0, -8, 0.4, 0.9, look, false);
  c.restore();
}

function makeIcons() {
  const look = makeLook('rocket-classic', 'none');

  // iOS + store icon: opaque square, the system rounds the corners
  let sf = surface(1024, 1024);
  iconSky(sf.getCanvas(), 1024);
  iconSnail(sf.getCanvas(), 1024, 0.86, look);
  save(sf, 'assets/icon.png', true);

  // Web favicon
  sf = surface(48, 48);
  iconSky(sf.getCanvas(), 48);
  iconSnail(sf.getCanvas(), 48, 0.9, look);
  save(sf, 'assets/favicon.png', true);

  // Android adaptive icon: background + foreground (kept inside the middle 66% safe zone)
  sf = surface(1024, 1024);
  iconSky(sf.getCanvas(), 1024);
  save(sf, 'assets/android-icon-background.png', true);

  sf = surface(1024, 1024);
  iconSnail(sf.getCanvas(), 1024, 0.6, look);
  save(sf, 'assets/android-icon-foreground.png');

  // Android 13+ themed (monochrome) icon: a white silhouette
  sf = surface(1024, 1024);
  const c = sf.getCanvas();
  const layer = paint();
  layer.setColorFilter(Skia.ColorFilter.MakeBlend(Skia.Color('#FFFFFF'), BlendMode.SrcIn));
  c.saveLayer(layer);
  iconSnail(c, 1024, 0.6, look);
  c.restore();
  save(sf, 'assets/android-icon-monochrome.png');

  // Splash screen image (shown on a sky-blue background)
  sf = surface(1024, 1024);
  iconSnail(sf.getCanvas(), 1024, 0.92, look);
  save(sf, 'assets/splash-icon.png');

  // Google Play feature graphic
  sf = surface(1024, 500);
  const fc = sf.getCanvas();
  drawSkinsShowcase(fc, 1024, 500);
  const title = font(86);
  const tw = textWidth(title, 'Rocket Snail');
  const p = paint();
  p.setStyle(1);
  p.setStrokeWidth(14);
  p.setColor(Skia.Color(COLORS.ink));
  fc.drawText('Rocket Snail', (1024 - tw) / 2, 120, p, title);
  p.setStyle(0);
  p.setColor(Skia.Color('#FFFFFF'));
  fc.drawText('Rocket Snail', (1024 - tw) / 2, 120, p, title);
  save(sf, 'store/google-play/feature-graphic.png', true);
}

// ---------------------------------------------------------------- commands

async function main() {
  await initSkia();
  const cmd = process.argv[2] ?? 'all';

  if (cmd === 'preview') {
    const dir = process.argv[3] ?? 'preview-out';
    for (const name of ['day', 'sunset', 'night', 'ready']) {
      const sf = surface(1600, 720);
      drawScene(sf.getCanvas(), name, 1600, 720, 'bg');
      save(sf, path.join(dir, `${name}.png`));
    }
    // All hats and rockets
    const sf = surface(1600, 720);
    const c = sf.getCanvas();
    const p = paint();
    c.drawColor(Skia.Color('#DDF4FF'));
    const all = Math.max(HATS.length, ROCKETS.length);
    for (let i = 0; i < all; i++) {
      const hat = HATS[i % HATS.length].id;
      const rocket = ROCKETS[i % ROCKETS.length].id;
      c.save();
      c.translate(90 + (i % 5) * 300, 200 + Math.floor(i / 5) * 320);
      c.scale(7, 7);
      drawSnail(c, p, 0, 0, 0, 1.1, 0.7, makeLook(rocket, hat), false);
      c.restore();
    }
    save(sf, path.join(dir, 'skins.png'));
    return;
  }

  console.log('Icons and splash:');
  makeIcons();

  console.log('Store screenshots:');
  const sizes: [string, number, number][] = [
    ['app-store/iphone-6.9', 2868, 1320],
    ['app-store/ipad-13', 2752, 2064],
    ['google-play/phone', 1920, 1080],
  ];
  for (const lang of ['en', 'bg'] as Lang[]) {
    for (const [dir, w, h] of sizes) {
      ['day', 'sunset', 'night', 'skins'].forEach((name, i) => {
        storeShot(name, w, h, lang, `store/${dir}/${lang}/${i + 1}-${name}.png`);
      });
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
