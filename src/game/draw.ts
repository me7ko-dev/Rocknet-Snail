// Everything you see in the game is drawn here with code (no image files).
// All coordinates are in world units: the screen is 100 units tall.
// These are worklets, so they run on the UI thread every frame.

import { PaintStyle, Skia, StrokeCap, TileMode } from '@shopify/react-native-skia';
import type { SkCanvas, SkPaint } from '@shopify/react-native-skia';

import { COLORS, GROUND_Y, SNAIL_X, WORLD_HEIGHT } from './constants';
import type { GameState, Lettuce, Obstacle } from './engine';

function fill(p: SkPaint, color: string, alpha = 1) {
  'worklet';
  p.setStyle(PaintStyle.Fill);
  p.setColor(Skia.Color(color));
  p.setAlphaf(alpha);
}

function stroke(p: SkPaint, color: string, width: number) {
  'worklet';
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeWidth(width);
  p.setStrokeCap(StrokeCap.Round);
  p.setColor(Skia.Color(color));
  p.setAlphaf(1);
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

// ---------------------------------------------------------------- background

function drawCloud(c: SkCanvas, p: SkPaint, x: number, y: number, s: number) {
  'worklet';
  fill(p, COLORS.cloud, 0.95);
  c.drawCircle(x, y, 4 * s, p);
  c.drawCircle(x + 4.5 * s, y - 2 * s, 5 * s, p);
  c.drawCircle(x + 9 * s, y, 4 * s, p);
  rrect(c, p, x, y - 1 * s, 9 * s, 5 * s, 2.5 * s);
}

export function drawBackground(c: SkCanvas, p: SkPaint, w: number, distance: number) {
  'worklet';
  // Sky
  p.setShader(
    Skia.Shader.MakeLinearGradient(
      Skia.Point(0, 0),
      Skia.Point(0, GROUND_Y),
      [Skia.Color(COLORS.skyTop), Skia.Color(COLORS.skyBottom)],
      null,
      TileMode.Clamp,
    ),
  );
  fill(p, '#FFFFFF');
  c.drawRect(Skia.XYWHRect(0, 0, w, WORLD_HEIGHT), p);
  p.setShader(null);

  // Sun
  fill(p, COLORS.sun, 0.35);
  c.drawCircle(w - 65, 22, 12, p);
  fill(p, COLORS.sun);
  c.drawCircle(w - 65, 22, 8, p);

  // Clouds (slow parallax)
  const cloudPeriod = w + 30;
  for (let i = 0; i < 3; i++) {
    const x = wrap(i * (cloudPeriod / 3) - distance * 0.12, cloudPeriod) - 15;
    drawCloud(c, p, x, 16 + i * 9, 0.9 + (i % 2) * 0.3);
  }

  // Far hills
  fill(p, COLORS.hillFar);
  const farPeriod = 46;
  const farShift = wrap(distance * 0.25, farPeriod);
  for (let x = -farPeriod; x < w + farPeriod; x += farPeriod) {
    c.drawCircle(x - farShift, GROUND_Y + 20, 32, p);
  }

  // Near bushes
  fill(p, COLORS.hillNear);
  const nearPeriod = 30;
  const nearShift = wrap(distance * 0.5, nearPeriod);
  for (let x = -nearPeriod; x < w + nearPeriod; x += nearPeriod) {
    c.drawCircle(x - nearShift, GROUND_Y + 6, 11, p);
    c.drawCircle(x - nearShift + 11, GROUND_Y + 4, 8, p);
  }

  // Grass and dirt
  fill(p, COLORS.grass);
  c.drawRect(Skia.XYWHRect(0, GROUND_Y, w, WORLD_HEIGHT - GROUND_Y), p);
  fill(p, COLORS.dirt);
  c.drawRect(Skia.XYWHRect(0, GROUND_Y + 7, w, WORLD_HEIGHT - GROUND_Y - 7), p);

  // Grass stripes move at full speed, so you can feel how fast you go
  fill(p, COLORS.grassDark);
  const stripe = 10;
  const stripeShift = wrap(distance, stripe);
  for (let x = -stripe; x < w + stripe; x += stripe) {
    rrect(c, p, x - stripeShift, GROUND_Y + 2.5, 5, 2, 1);
  }
}

// ---------------------------------------------------------------- snail

export function drawSnail(
  c: SkCanvas,
  p: SkPaint,
  x: number,
  y: number,
  angle: number,
  time: number,
  flame: number, // 0 = no flame, 1 = full power
  rocketColor: string,
  dizzy: boolean,
) {
  'worklet';
  c.save();
  c.translate(x, y);
  c.rotate(angle, 0, -3);

  // Rocket flame (behind everything)
  if (flame > 0) {
    const len = (3 + 7 * flame) * (0.85 + 0.15 * Math.sin(time * 45));
    const flamePath = Skia.PathBuilder.Make();
    flamePath.moveTo(-12, -14.6);
    flamePath.quadTo(-12 - len, -12, -12, -9.4);
    flamePath.close();
    fill(p, COLORS.flameOuter);
    c.drawPath(flamePath.build(), p);
    const inner = Skia.PathBuilder.Make();
    inner.moveTo(-12, -13.6);
    inner.quadTo(-12 - len * 0.6, -12, -12, -10.4);
    inner.close();
    fill(p, COLORS.flameInner);
    c.drawPath(inner.build(), p);
  }

  // Body (the soft "foot" with the head on the right)
  const body = Skia.PathBuilder.Make();
  body.moveTo(-11, 4.5);
  body.lineTo(8, 4.5);
  body.quadTo(12.5, 4.5, 12, 0);
  body.quadTo(11.5, -5.5, 8, -5.5);
  body.quadTo(4.5, -5.5, 4.5, -1);
  body.lineTo(4.5, 0.5);
  body.lineTo(-9, 0.5);
  body.quadTo(-12.5, 1, -11, 4.5);
  body.close();
  const bodyPath = body.detach();
  fill(p, COLORS.snailBody);
  c.drawPath(bodyPath, p);
  stroke(p, COLORS.snailBodyDark, 0.6);
  c.drawPath(bodyPath, p);

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
    fill(p, COLORS.pupil);
    c.drawCircle(8, -10.4, 0.85, p);
    c.drawCircle(12.2, -9.4, 0.85, p);
  }

  // Cheek and smile
  fill(p, COLORS.cheek, 0.8);
  c.drawCircle(9.6, -0.6, 1, p);
  const smile = Skia.PathBuilder.Make();
  smile.moveTo(10.2, 1.2);
  smile.quadTo(11.2, 2.2, 12, 1);
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

  // Rocket strapped on the shell
  const fin = Skia.PathBuilder.Make();
  fin.moveTo(-11.5, -15);
  fin.lineTo(-14, -17.5);
  fin.lineTo(-8, -15);
  fin.close();
  fin.moveTo(-11.5, -9);
  fin.lineTo(-14, -6.5);
  fin.lineTo(-8, -9);
  fin.close();
  fill(p, COLORS.rocketFin);
  c.drawPath(fin.build(), p);

  fill(p, rocketColor);
  rrect(c, p, -12, -15, 14, 6, 2.5);
  const nose = Skia.PathBuilder.Make();
  nose.moveTo(1, -15);
  nose.quadTo(6, -14.5, 7, -12);
  nose.quadTo(6, -9.5, 1, -9);
  nose.close();
  c.drawPath(nose.build(), p);

  fill(p, COLORS.rocketFin);
  c.drawCircle(-3, -12, 2, p);
  fill(p, COLORS.rocketWindow);
  c.drawCircle(-3, -12, 1.4, p);
  fill(p, '#FFFFFF', 0.8);
  c.drawCircle(-3.5, -12.5, 0.45, p);

  // Strap
  stroke(p, COLORS.shellDark, 0.8);
  c.drawLine(-6.5, -9.2, -6.5, -8.3, p);

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
  // Eye
  fill(p, COLORS.eyeWhite);
  c.drawCircle(x - 1.4, y - 1.4, 1.2, p);
  fill(p, COLORS.pupil);
  c.drawCircle(x - 1.8, y - 1.4, 0.6, p);
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
  // Coil lying on the grass
  stroke(p, COLORS.hoseDark, 1.6);
  c.drawOval(Skia.XYWHRect(x - 7, GROUND_Y - 1.5, 14, 4), p);
  // Upright pipe
  fill(p, COLORS.hose);
  rrect(c, p, x - 2.5, y + 2, 5, GROUND_Y - y, 2);
  // Rings on the pipe
  stroke(p, COLORS.hoseDark, 0.6);
  for (let ry = y + 6; ry < GROUND_Y - 1; ry += 5) {
    c.drawLine(x - 2.2, ry, x + 2.2, ry + 0.8, p);
  }
  // Bend to the left
  const bend = Skia.PathBuilder.Make();
  bend.moveTo(x, y + 4);
  bend.quadTo(x, y - 1, x - 5, y - 1);
  stroke(p, COLORS.hose, 5);
  c.drawPath(bend.build(), p);
  // Nozzle
  fill(p, COLORS.nozzle);
  rrect(c, p, x - 10, y - 3, 5.5, 4, 1);
  // Water spraying out
  fill(p, COLORS.water);
  for (let k = 0; k < 4; k++) {
    const t = wrap(time * 1.8 + k / 4, 1);
    c.drawCircle(x - 10.5 - t * 9, y - 1 + t * t * 7, 0.9 * (1 - t * 0.5), p);
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

function drawLettuceItem(c: SkCanvas, p: SkPaint, l: Lettuce) {
  'worklet';
  drawLettuce(c, p, l.x, l.y + Math.sin(l.phase * 3) * 1);
}

// ---------------------------------------------------------------- whole frame

export function drawGame(c: SkCanvas, s: GameState, rocketColor: string, coinIconX: number) {
  'worklet';
  const p = Skia.Paint();
  p.setAntiAlias(true);

  drawBackground(c, p, s.worldWidth, s.distance);

  for (let i = 0; i < s.lettuce.length; i++) {
    drawLettuceItem(c, p, s.lettuce[i]);
  }
  for (let i = 0; i < s.obstacles.length; i++) {
    const o = s.obstacles[i];
    if (o.kind === 'bird') drawBird(c, p, o);
    else if (o.kind === 'leaf') drawLeaf(c, p, o);
    else if (o.kind === 'hose') drawHose(c, p, o, s.time);
    else drawDrop(c, p, o);
  }

  let angle = 0;
  let y = s.snailY;
  let flame = 0.25;
  if (s.phase === 'ready') {
    // gentle hover while waiting for the first touch
    y += Math.sin(s.time * 3) * 1.5;
    angle = Math.sin(s.time * 2) * 4;
    flame = 0.5;
  } else if (s.phase === 'playing') {
    angle = Math.max(-18, Math.min(22, s.snailVY * 0.25));
    flame = s.holding ? 1 : 0.15;
  } else {
    angle = s.crashTime * 600;
    flame = 0;
  }
  drawSnail(c, p, SNAIL_X, y, angle, s.time, flame, rocketColor, s.phase !== 'playing' && s.phase !== 'ready');

  // Lettuce icon for the coin counter in the top right corner
  drawLettuce(c, p, coinIconX, 8, 1.1);
}
