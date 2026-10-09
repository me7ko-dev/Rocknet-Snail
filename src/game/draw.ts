// Everything you see in the game is drawn here with code (no image files).
// World coordinates are in units: the screen is 100 units tall.
// These are worklets, so they run on the UI thread every frame.

import { PaintStyle, Skia, StrokeCap, TileMode } from '@shopify/react-native-skia';
import type { SkCanvas, SkFont, SkPaint } from '@shopify/react-native-skia';

import { COLORS, DAY_CYCLE, GROUND_Y, SNAIL_X, WORLD_HEIGHT } from './constants';
import { snailAngle, type GameState, type Obstacle, type Particle } from './engine';
import type { HatId, SkinLook } from './skins';

// ---------------------------------------------------------------- helpers

function fill(p: SkPaint, color: string, alpha = 1) {
  'worklet';
  p.setStyle(PaintStyle.Fill);
  p.setColor(Skia.Color(color));
  p.setAlphaf(alpha);
}

function stroke(p: SkPaint, color: string, width: number, alpha = 1) {
  'worklet';
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeWidth(width);
  p.setStrokeCap(StrokeCap.Round);
  p.setColor(Skia.Color(color));
  p.setAlphaf(alpha);
}

function rrect(c: SkCanvas, p: SkPaint, x: number, y: number, w: number, h: number, r: number) {
  'worklet';
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r), p);
}

// Wraps a scrolling position so decorations repeat forever
function wrap(value: number, period: number) {
  'worklet';
  return ((value % period) + period) % period;
}

function clamp01(v: number) {
  'worklet';
  return Math.max(0, Math.min(1, v));
}

function rgb(r: number, g: number, b: number) {
  'worklet';
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function hexToRgb(hex: string) {
  'worklet';
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mixes a #RRGGBB colour towards dark night blue by `t` (0..1) */
function dusk(hex: string, t: number) {
  'worklet';
  if (t <= 0) return hex;
  const a = hexToRgb(hex);
  return rgb(a[0] + (27 - a[0]) * t, a[1] + (35 - a[1]) * t, a[2] + (80 - a[2]) * t);
}

/** hue 0..1 → bright candy colour */
function hueColor(h: number, s = 0.85, l = 0.62) {
  'worklet';
  const k = (n: number) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return rgb(f(0) * 255, f(8) * 255, f(4) * 255);
}

// ---------------------------------------------------------------- sky

type Sky = { top: number[]; bottom: number[]; night: number; sunLow: number };

// Keyframes of the day cycle: position 0..1, sky top, sky bottom, darkness, how low the sun is
const SKY_KEYS: [number, number[], number[], number, number][] = [
  [0, [124, 200, 255], [221, 244, 255], 0, 0],
  [0.42, [124, 200, 255], [221, 244, 255], 0, 0],
  [0.52, [255, 150, 140], [255, 214, 160], 0.12, 0.7],
  [0.6, [32, 40, 92], [84, 96, 160], 1, 1],
  [0.84, [32, 40, 92], [84, 96, 160], 1, 1],
  [0.92, [255, 170, 160], [255, 226, 180], 0.15, 0.7],
  [1, [124, 200, 255], [221, 244, 255], 0, 0],
];

export function skyAt(distance: number): Sky {
  'worklet';
  const t = wrap(distance, DAY_CYCLE) / DAY_CYCLE;
  let i = 0;
  while (i < SKY_KEYS.length - 2 && t > SKY_KEYS[i + 1][0]) i++;
  const a = SKY_KEYS[i];
  const b = SKY_KEYS[i + 1];
  const k = clamp01((t - a[0]) / (b[0] - a[0]));
  const mix = (x: number[], y: number[]) => [x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k];
  return { top: mix(a[1], b[1]), bottom: mix(a[2], b[2]), night: a[3] + (b[3] - a[3]) * k, sunLow: a[4] + (b[4] - a[4]) * k };
}

function drawCloud(c: SkCanvas, p: SkPaint, x: number, y: number, s: number, alpha: number) {
  'worklet';
  fill(p, COLORS.cloud, alpha);
  c.drawCircle(x, y, 4 * s, p);
  c.drawCircle(x + 4.5 * s, y - 2 * s, 5 * s, p);
  c.drawCircle(x + 9 * s, y, 4 * s, p);
  rrect(c, p, x, y - 1 * s, 9 * s, 5 * s, 2.5 * s);
}

export function drawBackground(c: SkCanvas, p: SkPaint, w: number, distance: number) {
  'worklet';
  const sky = skyAt(distance);

  // Sky gradient
  p.setShader(
    Skia.Shader.MakeLinearGradient(
      Skia.Point(0, 0),
      Skia.Point(0, GROUND_Y),
      [Skia.Color(rgb(sky.top[0], sky.top[1], sky.top[2])), Skia.Color(rgb(sky.bottom[0], sky.bottom[1], sky.bottom[2]))],
      null,
      TileMode.Clamp,
    ),
  );
  fill(p, '#FFFFFF');
  c.drawRect(Skia.XYWHRect(0, 0, w, WORLD_HEIGHT), p);
  p.setShader(null);

  // Stars twinkle at night
  if (sky.night > 0.05) {
    for (let i = 0; i < 26; i++) {
      const sx = wrap(i * 37.7 - distance * 0.03, w + 10) - 5;
      const sy = 4 + ((i * 53) % 52);
      const tw = 0.6 + 0.4 * Math.sin(distance * 0.05 + i * 1.7);
      fill(p, '#FFFFFF', sky.night * tw);
      c.drawCircle(sx, sy, i % 3 === 0 ? 0.7 : 0.45, p);
    }
  }

  // Sun goes down at sunset, moon comes up at night
  const sunY = 22 + 60 * sky.sunLow;
  const sunAlpha = 1 - sky.night;
  if (sunAlpha > 0.02) {
    fill(p, COLORS.sun, 0.35 * sunAlpha);
    c.drawCircle(w - 65, sunY, 12, p);
    fill(p, sky.sunLow > 0.5 ? '#FFB347' : COLORS.sun, sunAlpha);
    c.drawCircle(w - 65, sunY, 8, p);
  }
  if (sky.night > 0.3) {
    const moonY = 20 + 50 * (1 - sky.night);
    fill(p, COLORS.moon, 0.25 * sky.night);
    c.drawCircle(w * 0.55, moonY, 9, p);
    fill(p, COLORS.moon, sky.night);
    c.drawCircle(w * 0.55, moonY, 6, p);
    fill(p, '#E9DFB8', sky.night);
    c.drawCircle(w * 0.55 - 2, moonY - 1.5, 1.2, p);
    c.drawCircle(w * 0.55 + 1.8, moonY + 1.5, 0.8, p);
  }

  // Clouds (slow parallax)
  const cloudPeriod = w + 30;
  for (let i = 0; i < 3; i++) {
    const x = wrap(i * (cloudPeriod / 3) - distance * 0.12, cloudPeriod) - 15;
    drawCloud(c, p, x, 16 + i * 9, 0.9 + (i % 2) * 0.3, 0.95 - sky.night * 0.6);
  }

  // The landscape gets darker in the evening and at night
  const tint = sky.night * 0.42 + sky.sunLow * 0.08;

  // Far hills
  fill(p, dusk(COLORS.hillFar, tint));
  const farPeriod = 46;
  const farShift = wrap(distance * 0.25, farPeriod);
  for (let x = -farPeriod; x < w + farPeriod; x += farPeriod) {
    c.drawCircle(x - farShift, GROUND_Y + 20, 32, p);
  }

  // Near bushes
  fill(p, dusk(COLORS.hillNear, tint));
  const nearPeriod = 30;
  const nearShift = wrap(distance * 0.5, nearPeriod);
  for (let x = -nearPeriod; x < w + nearPeriod; x += nearPeriod) {
    c.drawCircle(x - nearShift, GROUND_Y + 6, 11, p);
    c.drawCircle(x - nearShift + 11, GROUND_Y + 4, 8, p);
  }

  // Grass and dirt
  fill(p, dusk(COLORS.grass, tint));
  c.drawRect(Skia.XYWHRect(0, GROUND_Y, w, WORLD_HEIGHT - GROUND_Y), p);
  fill(p, dusk(COLORS.dirt, tint));
  c.drawRect(Skia.XYWHRect(0, GROUND_Y + 7, w, WORLD_HEIGHT - GROUND_Y - 7), p);

  // Grass stripes move at full speed, so you can feel how fast you go
  fill(p, dusk(COLORS.grassDark, tint));
  const stripe = 10;
  const stripeShift = wrap(distance, stripe);
  for (let x = -stripe; x < w + stripe; x += stripe) {
    rrect(c, p, x - stripeShift, GROUND_Y + 2.5, 5, 2, 1);
  }

  // Little flowers in the grass
  const flowerPeriod = 37;
  const flowerShift = wrap(distance, flowerPeriod);
  for (let x = -flowerPeriod; x < w + flowerPeriod; x += flowerPeriod) {
    const fx = x - flowerShift + 6;
    fill(p, dusk('#FFFFFF', tint));
    c.drawCircle(fx - 0.8, GROUND_Y + 5.2, 0.7, p);
    c.drawCircle(fx + 0.8, GROUND_Y + 5.2, 0.7, p);
    c.drawCircle(fx, GROUND_Y + 4.4, 0.7, p);
    c.drawCircle(fx, GROUND_Y + 6, 0.7, p);
    fill(p, COLORS.sun);
    c.drawCircle(fx, GROUND_Y + 5.2, 0.5, p);
  }

}

// ---------------------------------------------------------------- hats

function dome(r: number) {
  'worklet';
  const b = Skia.PathBuilder.Make();
  b.moveTo(-r, 0);
  b.cubicTo(-r, -r * 1.35, r, -r * 1.35, r, 0);
  b.close();
  return b.build();
}

/** Draws a hat with its bottom centre at (0, 0). */
export function drawHat(c: SkCanvas, p: SkPaint, hat: HatId, time: number) {
  'worklet';
  if (hat === 'party') {
    const cone = Skia.PathBuilder.Make();
    cone.moveTo(-2.8, 0);
    cone.lineTo(0.4, -7.5);
    cone.lineTo(2.8, 0);
    cone.close();
    fill(p, '#FF7EC8');
    c.drawPath(cone.build(), p);
    fill(p, '#FFE066');
    c.drawCircle(-0.6, -1.6, 0.6, p);
    c.drawCircle(1, -3.4, 0.6, p);
    c.drawCircle(-0.1, -5.2, 0.5, p);
    fill(p, '#6C8EF5');
    c.drawCircle(1.3, -1.2, 0.5, p);
    fill(p, '#FFE066');
    c.drawCircle(0.4, -7.8, 1.2, p);
  } else if (hat === 'flower') {
    fill(p, '#4FAF3A');
    c.drawOval(Skia.XYWHRect(-3, -1.6, 3, 1.6), p);
    fill(p, '#FF8FB1');
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
      c.drawCircle(0.8 + Math.cos(a) * 1.5, -2.4 + Math.sin(a) * 1.5, 1.2, p);
    }
    fill(p, '#FFE066');
    c.drawCircle(0.8, -2.4, 1, p);
  } else if (hat === 'cap') {
    fill(p, '#4DA3FF');
    c.drawPath(dome(3.1), p);
    fill(p, '#2F7FD8');
    rrect(c, p, 1, -0.9, 5.2, 1.5, 0.75);
    fill(p, '#FFFFFF');
    c.drawCircle(0, -4.1, 0.6, p);
    stroke(p, '#FFFFFF', 0.4);
    c.drawLine(-1.6, -2.4, 1.6, -2.4, p);
  } else if (hat === 'tophat') {
    fill(p, '#2B2B3A');
    rrect(c, p, -2.6, -7.2, 5.2, 7, 0.8);
    rrect(c, p, -4, -0.9, 8, 1.6, 0.8);
    fill(p, '#FF5A5F');
    c.drawRect(Skia.XYWHRect(-2.6, -2.8, 5.2, 1.3), p);
    fill(p, '#FFFFFF', 0.25);
    c.drawRect(Skia.XYWHRect(-2, -6.6, 0.8, 3.6), p);
  } else if (hat === 'viking') {
    const horn = Skia.PathBuilder.Make();
    horn.moveTo(-2.4, -1.2);
    horn.quadTo(-6.2, -1.6, -5.6, -6.4);
    horn.quadTo(-4.8, -3.2, -2, -2.8);
    horn.close();
    horn.moveTo(2.4, -1.2);
    horn.quadTo(6.2, -1.6, 5.6, -6.4);
    horn.quadTo(4.8, -3.2, 2, -2.8);
    horn.close();
    fill(p, '#FFF6E0');
    c.drawPath(horn.build(), p);
    fill(p, '#B8C2CC');
    c.drawPath(dome(3.3), p);
    fill(p, '#9B6B43');
    rrect(c, p, -3.4, -1, 6.8, 1.4, 0.6);
    fill(p, '#FFFFFF', 0.5);
    c.drawCircle(-1, -3, 0.6, p);
  } else if (hat === 'crown') {
    const crown = Skia.PathBuilder.Make();
    crown.moveTo(-3, 0);
    crown.lineTo(-3.2, -4.4);
    crown.lineTo(-1.5, -2.4);
    crown.lineTo(0, -5.4);
    crown.lineTo(1.5, -2.4);
    crown.lineTo(3.2, -4.4);
    crown.lineTo(3, 0);
    crown.close();
    fill(p, '#F5C542');
    c.drawPath(crown.build(), p);
    fill(p, '#D9A520');
    c.drawRect(Skia.XYWHRect(-3, -1.2, 6, 1.2), p);
    fill(p, '#FF5A5F');
    c.drawCircle(0, -0.6, 0.55, p);
    fill(p, '#4DA3FF');
    c.drawCircle(-1.9, -0.6, 0.45, p);
    c.drawCircle(1.9, -0.6, 0.45, p);
    fill(p, '#FFFFFF');
    c.drawCircle(0, -5.4, 0.5, p);
    c.drawCircle(-3.2, -4.4, 0.45, p);
    c.drawCircle(3.2, -4.4, 0.45, p);
  } else if (hat === 'propeller') {
    fill(p, '#FF5A5F');
    c.drawPath(dome(3.1), p);
    fill(p, '#FFE066');
    const mid = Skia.PathBuilder.Make();
    mid.moveTo(-1, 0);
    mid.lineTo(-0.6, -4.1);
    mid.lineTo(0.6, -4.1);
    mid.lineTo(1, 0);
    mid.close();
    c.drawPath(mid.build(), p);
    stroke(p, '#2B2B3A', 0.5);
    c.drawLine(0, -4.1, 0, -5.6, p);
    // spinning blades: their width changes like a real propeller seen from the side
    const spin = Math.cos(time * 28);
    fill(p, '#4DA3FF');
    c.drawOval(Skia.XYWHRect(-4.5 * Math.abs(spin), -6.3, 4.5 * Math.abs(spin) + 0.01, 1.3), p);
    fill(p, '#3DD6A3');
    c.drawOval(Skia.XYWHRect(0, -6.3, 4.5 * Math.abs(spin) + 0.01, 1.3), p);
    fill(p, '#2B2B3A');
    c.drawCircle(0, -5.7, 0.55, p);
  }
}

// ---------------------------------------------------------------- snail

const ROCKET_SHIFT = -3;

export function drawRocket(c: SkCanvas, p: SkPaint, look: SkinLook, time: number) {
  'worklet';
  const fin = Skia.PathBuilder.Make();
  fin.moveTo(-11.5, -15);
  fin.lineTo(-14, -17.5);
  fin.lineTo(-8, -15);
  fin.close();
  fin.moveTo(-11.5, -9);
  fin.lineTo(-14, -6.5);
  fin.lineTo(-8, -9);
  fin.close();
  fill(p, look.rocketPattern === 'gold' ? '#FFF1A8' : COLORS.rocketFin);
  c.drawPath(fin.build(), p);

  const body = look.rocketPattern === 'rainbow' ? hueColor(time * 0.25) : look.rocketColor;
  const noseColor = look.rocketPattern === 'rainbow' ? hueColor(time * 0.25 + 0.5) : body;
  fill(p, body);
  rrect(c, p, -12, -15, 14, 6, 2.5);
  const nose = Skia.PathBuilder.Make();
  nose.moveTo(1, -15);
  nose.quadTo(6, -14.5, 7, -12);
  nose.quadTo(6, -9.5, 1, -9);
  nose.close();
  fill(p, noseColor);
  c.drawPath(nose.build(), p);

  if (look.rocketPattern === 'stripes') {
    fill(p, '#FFFFFF');
    c.drawRect(Skia.XYWHRect(-9.4, -15, 1.6, 6), p);
    c.drawRect(Skia.XYWHRect(-0.4, -15, 1.4, 6), p);
  } else if (look.rocketPattern === 'gold') {
    fill(p, '#FFF1A8', 0.8);
    rrect(c, p, -10.5, -14.3, 10, 1.3, 0.65);
  } else if (look.rocketPattern === 'rainbow') {
    fill(p, hueColor(time * 0.25 + 0.33));
    c.drawRect(Skia.XYWHRect(-9.4, -15, 1.6, 6), p);
    fill(p, hueColor(time * 0.25 + 0.66));
    c.drawRect(Skia.XYWHRect(-0.4, -15, 1.4, 6), p);
  }

  // Window
  fill(p, COLORS.rocketFin);
  c.drawCircle(-4.5, -12, 2, p);
  fill(p, COLORS.rocketWindow);
  c.drawCircle(-4.5, -12, 1.4, p);
  fill(p, '#FFFFFF', 0.8);
  c.drawCircle(-5, -12.5, 0.45, p);

  if (look.rocketPattern === 'gold') {
    // a little twinkle running along the rocket
    const tx = -10 + wrap(time * 9, 16);
    const tw = 0.5 + 0.5 * Math.sin(time * 9);
    fill(p, '#FFFFFF', tw);
    c.drawCircle(tx, -13.6, 0.5, p);
  }
}

export function drawSnail(
  c: SkCanvas,
  p: SkPaint,
  x: number,
  y: number,
  angle: number,
  time: number,
  flame: number, // 0 = no flame, 1 = full power
  look: SkinLook,
  dizzy: boolean,
) {
  'worklet';
  c.save();
  c.translate(x, y);
  c.rotate(angle, 0, -3);

  // The rocket sits a bit towards the back of the shell, so hats have room
  c.save();
  c.translate(ROCKET_SHIFT, 0);
  // Rocket flame (behind everything)
  if (flame > 0) {
    const len = (3 + 7 * flame) * (0.85 + 0.15 * Math.sin(time * 45));
    const outer = Skia.PathBuilder.Make();
    outer.moveTo(-12, -14.6);
    outer.quadTo(-12 - len, -12, -12, -9.4);
    outer.close();
    fill(p, COLORS.flameOuter);
    c.drawPath(outer.build(), p);
    const inner = Skia.PathBuilder.Make();
    inner.moveTo(-12, -13.6);
    inner.quadTo(-12 - len * 0.6, -12, -12, -10.4);
    inner.close();
    fill(p, COLORS.flameInner);
    c.drawPath(inner.build(), p);
  }
  c.restore();

  // Body (the soft "foot" with the head on the right)
  const bodyB = Skia.PathBuilder.Make();
  bodyB.moveTo(-11, 4.5);
  bodyB.lineTo(8, 4.5);
  bodyB.quadTo(12.5, 4.5, 12, 0);
  bodyB.quadTo(11.5, -5.5, 8, -5.5);
  bodyB.quadTo(4.5, -5.5, 4.5, -1);
  bodyB.lineTo(4.5, 0.5);
  bodyB.lineTo(-9, 0.5);
  bodyB.quadTo(-12.5, 1, -11, 4.5);
  bodyB.close();
  const body = bodyB.detach();
  fill(p, COLORS.snailBody);
  c.drawPath(body, p);
  stroke(p, COLORS.snailBodyDark, 0.6);
  c.drawPath(body, p);

  // Hat on the head
  if (look.hat !== 'none') {
    c.save();
    c.translate(9.6, -5);
    c.rotate(-8, 0, 0);
    c.scale(1.45, 1.45);
    drawHat(c, p, look.hat, time);
    c.restore();
  }

  // Eye stalks + eyes
  stroke(p, COLORS.snailBodyDark, 0.9);
  c.drawLine(7.5, -5, 7.5, -10, p);
  c.drawLine(10, -4.5, 11.5, -9, p);
  fill(p, COLORS.eyeWhite);
  c.drawCircle(7.5, -10.5, 1.7, p);
  c.drawCircle(11.7, -9.5, 1.7, p);
  if (dizzy) {
    stroke(p, COLORS.pupil, 0.45);
    c.drawLine(6.8, -11.2, 8.2, -9.8, p);
    c.drawLine(8.2, -11.2, 6.8, -9.8, p);
    c.drawLine(11, -10.2, 12.4, -8.8, p);
    c.drawLine(12.4, -10.2, 11, -8.8, p);
  } else {
    // blink every few seconds
    const blink = wrap(time, 3.7) < 0.12;
    if (blink) {
      stroke(p, COLORS.pupil, 0.45);
      c.drawLine(6.6, -10.4, 8.4, -10.4, p);
      c.drawLine(10.8, -9.4, 12.6, -9.4, p);
    } else {
      fill(p, COLORS.pupil);
      c.drawCircle(8, -10.4, 0.85, p);
      c.drawCircle(12.2, -9.4, 0.85, p);
      fill(p, '#FFFFFF');
      c.drawCircle(8.3, -10.8, 0.28, p);
      c.drawCircle(12.5, -9.8, 0.28, p);
    }
  }

  // Cheek and smile
  fill(p, COLORS.cheek, 0.8);
  c.drawCircle(9.6, -0.6, 1, p);
  const smile = Skia.PathBuilder.Make();
  if (dizzy) {
    smile.moveTo(10.2, 1.8);
    smile.quadTo(11.2, 0.8, 12, 1.8);
  } else {
    smile.moveTo(10.2, 1.2);
    smile.quadTo(11.2, 2.2, 12, 1);
  }
  stroke(p, COLORS.pupil, 0.45);
  c.drawPath(smile.build(), p);

  // Shell with a spiral
  fill(p, COLORS.shell);
  c.drawCircle(-2, -3, 6.2, p);
  stroke(p, COLORS.shellDark, 0.7);
  c.drawCircle(-2, -3, 6.2, p);
  const spiral = Skia.PathBuilder.Make();
  for (let k = 0; k <= 56; k++) {
    const th = k * 0.21;
    const r = 4.8 - k * 0.08;
    const px = -2 + Math.cos(th) * r;
    const py = -3 + Math.sin(th) * r;
    if (k === 0) spiral.moveTo(px, py);
    else spiral.lineTo(px, py);
  }
  stroke(p, COLORS.shellDark, 0.9);
  c.drawPath(spiral.build(), p);
  fill(p, '#FFFFFF', 0.3);
  c.drawCircle(-4.6, -6, 1.1, p);

  // Rocket strapped on the shell
  c.save();
  c.translate(ROCKET_SHIFT, 0);
  drawRocket(c, p, look, time);
  stroke(p, COLORS.shellDark, 0.8);
  c.drawLine(-3.5, -9.2, -3.5, -8.3, p);
  c.restore();

  c.restore();
}

// ---------------------------------------------------------------- obstacles

function drawBird(c: SkCanvas, p: SkPaint, o: Obstacle) {
  'worklet';
  const { x, y } = o;
  // Tail
  const tail = Skia.PathBuilder.Make();
  tail.moveTo(x + 3, y - 0.5);
  tail.lineTo(x + 6.5, y - 3);
  tail.lineTo(x + 6, y + 1.5);
  tail.close();
  fill(p, COLORS.birdWing);
  c.drawPath(tail.build(), p);
  // Body
  fill(p, COLORS.bird);
  c.drawCircle(x, y, 3.8, p);
  fill(p, '#FFFFFF', 0.35);
  c.drawCircle(x - 0.6, y + 1.4, 2.2, p);
  // Beak (birds face left, towards the snail)
  const beak = Skia.PathBuilder.Make();
  beak.moveTo(x - 3.3, y - 0.8);
  beak.lineTo(x - 6.5, y + 0.3);
  beak.lineTo(x - 3.3, y + 1.4);
  beak.close();
  fill(p, COLORS.beak);
  c.drawPath(beak.build(), p);
  // Angry little eyebrow + eye
  fill(p, COLORS.eyeWhite);
  c.drawCircle(x - 1.4, y - 1.4, 1.2, p);
  fill(p, COLORS.pupil);
  c.drawCircle(x - 1.8, y - 1.4, 0.6, p);
  stroke(p, COLORS.pupil, 0.4);
  c.drawLine(x - 2.6, y - 3.1, x - 0.6, y - 2.5, p);
  // Flapping wing
  c.save();
  c.translate(x + 0.5, y - 0.3);
  c.rotate(Math.sin(o.phase * 16) * 40 - 10, 0, 0);
  fill(p, COLORS.birdWing);
  c.drawOval(Skia.XYWHRect(0, -1.5, 5.5, 3), p);
  c.restore();
}

function drawLeaf(c: SkCanvas, p: SkPaint, o: Obstacle) {
  'worklet';
  c.save();
  c.translate(o.x, o.y);
  c.scale(o.size, o.size);
  c.rotate(Math.sin(o.phase * 1.7) * 35 + o.phase * 30, 0, 0);
  const leaf = Skia.PathBuilder.Make();
  leaf.moveTo(-4.5, 0);
  leaf.quadTo(0, -4, 4.5, 0);
  leaf.quadTo(0, 4, -4.5, 0);
  leaf.close();
  fill(p, COLORS.leaf);
  c.drawPath(leaf.build(), p);
  stroke(p, COLORS.leafVein, 0.5);
  c.drawLine(-5.8, 0.9, 3.8, 0, p);
  c.drawLine(-1, 0, 0.8, -1.6, p);
  c.drawLine(1.2, 0, 2.6, 1.3, p);
  c.restore();
}

function drawHose(c: SkCanvas, p: SkPaint, o: Obstacle, time: number) {
  'worklet';
  const { x, y } = o;
  // `dir` = 1 for a hose standing on the grass, -1 for one hanging from the top.
  // The nozzle end is at `y` in both cases.
  const dir = o.top ? -1 : 1;
  const pipeTop = o.top ? -5 : y + 2;
  const pipeBottom = o.top ? y - 2 : GROUND_Y;

  if (!o.top) {
    // Coil lying on the grass
    stroke(p, COLORS.hoseDark, 1.6);
    c.drawOval(Skia.XYWHRect(x - 7, GROUND_Y - 1.5, 14, 4), p);
  }
  // Straight pipe
  fill(p, COLORS.hose);
  rrect(c, p, x - 2.5, pipeTop, 5, pipeBottom - pipeTop, 2);
  // Rings on the pipe
  stroke(p, COLORS.hoseDark, 0.6);
  for (let ry = pipeTop + 4; ry < pipeBottom - 2; ry += 5) {
    c.drawLine(x - 2.2, ry, x + 2.2, ry + 0.8, p);
  }
  // Bend to the left
  const bend = Skia.PathBuilder.Make();
  bend.moveTo(x, y + 4 * dir);
  bend.quadTo(x, y - 1 * dir, x - 5, y - 1 * dir);
  stroke(p, COLORS.hose, 5);
  c.drawPath(bend.build(), p);
  // Nozzle
  fill(p, COLORS.nozzle);
  rrect(c, p, x - 10, y - 1 * dir - 2, 5.5, 4, 1);
  // Water spraying out
  fill(p, COLORS.water);
  for (let k = 0; k < 4; k++) {
    const t = wrap(time * 1.8 + k / 4, 1);
    c.drawCircle(x - 10.5 - t * 9, y - 1 * dir + t * t * 7, 0.9 * (1 - t * 0.5), p);
  }
}

function drawDrop(c: SkCanvas, p: SkPaint, o: Obstacle) {
  'worklet';
  const { x, y } = o;
  if (y < -4) return;
  const drop = Skia.PathBuilder.Make();
  drop.moveTo(x, y - 3.4);
  drop.cubicTo(x + 0.6, y - 1.8, x + 2.2, y - 0.2, x + 2.2, y + 0.7);
  drop.cubicTo(x + 2.2, y + 2, x + 1.2, y + 2.7, x, y + 2.7);
  drop.cubicTo(x - 1.2, y + 2.7, x - 2.2, y + 2, x - 2.2, y + 0.7);
  drop.cubicTo(x - 2.2, y - 0.2, x - 0.6, y - 1.8, x, y - 3.4);
  drop.close();
  fill(p, COLORS.water);
  c.drawPath(drop.build(), p);
  fill(p, COLORS.waterLight);
  c.drawCircle(x - 0.8, y + 0.5, 0.6, p);
}

export function drawLettuce(c: SkCanvas, p: SkPaint, x: number, y: number, size = 1) {
  'worklet';
  const r = 3 * size;
  // crinkly edge = a ring of small circles
  fill(p, COLORS.lettuceDark);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    c.drawCircle(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85, r * 0.4, p);
  }
  fill(p, COLORS.lettuce);
  c.drawCircle(x, y, r * 0.95, p);
  fill(p, COLORS.lettuceLight);
  c.drawCircle(x, y, r * 0.55, p);
  stroke(p, COLORS.lettuceDark, 0.35 * size);
  c.drawLine(x, y + r * 0.7, x, y - r * 0.6, p);
  c.drawLine(x, y, x - r * 0.45, y - r * 0.4, p);
  c.drawLine(x, y, x + r * 0.45, y - r * 0.4, p);
  fill(p, '#FFFFFF', 0.7);
  c.drawCircle(x - r * 0.45, y - r * 0.5, r * 0.15, p);
}

function drawBestFlag(c: SkCanvas, p: SkPaint, x: number) {
  'worklet';
  stroke(p, '#FFFFFF', 0.9);
  c.drawLine(x, GROUND_Y + 1, x, GROUND_Y - 32, p);
  const flag = Skia.PathBuilder.Make();
  flag.moveTo(x, GROUND_Y - 32);
  flag.lineTo(x + 9, GROUND_Y - 29);
  flag.lineTo(x, GROUND_Y - 26);
  flag.close();
  fill(p, COLORS.flag);
  c.drawPath(flag.build(), p);
  fill(p, COLORS.star);
  c.drawCircle(x, GROUND_Y - 32.5, 1, p);
}

function drawParticle(c: SkCanvas, p: SkPaint, q: Particle) {
  'worklet';
  const t = q.life / q.maxLife; // 1 → 0
  if (q.kind === 'puff') {
    fill(p, '#FFFFFF', 0.55 * t);
    c.drawCircle(q.x, q.y, (1 + (1 - t) * 2.2) * q.size, p);
  } else if (q.kind === 'sparkle') {
    fill(p, t > 0.5 ? '#FFFFFF' : COLORS.lettuceLight, t);
    c.drawCircle(q.x, q.y, 0.9 * q.size * t + 0.2, p);
  } else if (q.kind === 'star') {
    c.save();
    c.translate(q.x, q.y);
    c.rotate((1 - t) * 360, 0, 0);
    const s = 1.4 * q.size;
    const star = Skia.PathBuilder.Make();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      const r = k % 2 === 0 ? s : s * 0.45;
      if (k === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    star.close();
    fill(p, COLORS.star, Math.min(1, t * 1.5));
    c.drawPath(star.build(), p);
    c.restore();
  } else {
    fill(p, hueColor(q.hue), Math.min(1, t * 2));
    c.save();
    c.translate(q.x, q.y);
    c.rotate(q.hue * 360 + (1 - t) * 500, 0, 0);
    c.drawRect(Skia.XYWHRect(-0.8, -0.4, 1.6, 0.8), p);
    c.restore();
  }
}

// ---------------------------------------------------------------- text

/** Width of a text in pixels (works the same on phones and in Node) */
export function textWidth(font: SkFont, text: string) {
  'worklet';
  const widths = font.getGlyphWidths(font.getGlyphIDs(text));
  let w = 0;
  for (let i = 0; i < widths.length; i++) w += widths[i];
  return w;
}

function outlinedText(
  c: SkCanvas,
  p: SkPaint,
  text: string,
  x: number,
  y: number,
  font: SkFont,
  color: string,
  outline: string,
  width: number,
  alpha = 1,
) {
  'worklet';
  stroke(p, outline, width, alpha);
  p.setStrokeCap(StrokeCap.Round);
  c.drawText(text, x, y, p, font);
  fill(p, color, alpha);
  c.drawText(text, x, y, p, font);
}

// ---------------------------------------------------------------- whole frame

export type ScreenLayout = {
  unit: number; // pixels per world unit
  width: number; // pixels
  height: number;
  safeLeft: number; // distance (px) that HUD keeps from the screen edges
  safeRight: number;
};

export type GameFonts = { hud: SkFont; small: SkFont; big: SkFont };

export type GameLabels = { holdToFly: string; newBest: string; bestFlag: string; meters: string };


export function drawGame(
  c: SkCanvas,
  s: GameState,
  look: SkinLook,
  layout: ScreenLayout,
  labels: GameLabels,
  fonts: GameFonts | null,
) {
  'worklet';
  const p = Skia.Paint();
  p.setAntiAlias(true);
  const u = layout.unit;
  const w = s.worldWidth;

  c.save();
  if (s.shake > 0) {
    const k = s.shake * 4 * u;
    c.translate(Math.sin(s.time * 80) * k, Math.cos(s.time * 67) * k);
  }
  c.scale(u, u);

  drawBackground(c, p, w, s.distance);

  // Flag at the player's record
  const flagX = SNAIL_X + (s.bestDistance - s.distance);
  const showFlag = s.bestDistance > 0 && flagX > -12 && flagX < w + 12;
  if (showFlag) drawBestFlag(c, p, flagX);

  for (let i = 0; i < s.lettuce.length; i++) {
    const l = s.lettuce[i];
    drawLettuce(c, p, l.x, l.y + Math.sin(l.phase * 3) * 1);
  }
  for (let i = 0; i < s.obstacles.length; i++) {
    const o = s.obstacles[i];
    if (o.kind === 'bird') drawBird(c, p, o);
    else if (o.kind === 'leaf') drawLeaf(c, p, o);
    else if (o.kind === 'hose') drawHose(c, p, o, s.time);
    else drawDrop(c, p, o);
  }
  for (let i = 0; i < s.particles.length; i++) {
    if (s.particles[i].kind === 'puff') drawParticle(c, p, s.particles[i]);
  }

  let y = s.snailY;
  let flame = 0;
  if (s.phase === 'ready') {
    y += Math.sin(s.time * 3) * 1.5; // gentle hover while waiting for the first touch
    flame = 0.5;
  } else if (s.phase === 'playing') {
    flame = s.holding ? 1 : 0.15;
  }
  drawSnail(c, p, SNAIL_X, y, snailAngle(s), s.time, flame, look, s.phase === 'crashing' || s.phase === 'over');

  for (let i = 0; i < s.particles.length; i++) {
    if (s.particles[i].kind !== 'puff') drawParticle(c, p, s.particles[i]);
  }

  c.restore();

  // ---- texts, in pixels
  if (!fonts) return;
  const hudY = 8 * u + fonts.hud.getSize() * 0.36;
  outlinedText(c, p, `${s.score} ${labels.meters}`, layout.safeLeft, hudY, fonts.hud, COLORS.hudText, COLORS.hudShadow, 5);
  // Coin counter, right-aligned: [lettuce icon] 123
  const coinText = `${s.coins}`;
  const coinX = layout.width - layout.safeRight - textWidth(fonts.hud, coinText);
  outlinedText(c, p, coinText, coinX, hudY, fonts.hud, COLORS.hudText, COLORS.hudShadow, 5);
  c.save();
  c.scale(u, u);
  drawLettuce(c, p, (coinX - 0.6 * fonts.hud.getSize()) / u, 8, 1.15);
  c.restore();

  if (showFlag) {
    const tw = textWidth(fonts.small, labels.bestFlag);
    outlinedText(c, p, labels.bestFlag, flagX * u - tw / 2, (GROUND_Y - 35) * u, fonts.small, '#FFFFFF', COLORS.flag, 4);
  }

  for (let i = 0; i < s.popups.length; i++) {
    const pop = s.popups[i];
    const alpha = Math.min(1, pop.life * 3);
    if (pop.kind === 'plus') {
      outlinedText(c, p, '+1', pop.x * u - 8, pop.y * u, fonts.small, '#FFFFFF', COLORS.lettuceDark, 4, alpha);
    } else {
      const tw = textWidth(fonts.big, labels.newBest);
      const x = Math.min(pop.x * u, layout.width - tw - 16);
      outlinedText(c, p, labels.newBest, x, pop.y * u, fonts.big, COLORS.star, COLORS.hudShadow, 6, alpha);
    }
  }

  if (s.phase === 'ready') {
    const tw = textWidth(fonts.big, labels.holdToFly);
    const bob = Math.sin(s.time * 4) * layout.height * 0.012;
    outlinedText(c, p, labels.holdToFly, (layout.width - tw) / 2, layout.height * 0.3 + bob, fonts.big, '#FFFFFF', COLORS.hudShadow, 6);
  }
}
