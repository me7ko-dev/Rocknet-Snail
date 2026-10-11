// The game "brain": moves everything, spawns obstacles, checks hits.
// Every function here is a worklet, so it runs on the UI thread at 60 FPS
// without waiting for React. It knows nothing about drawing or sound:
// it only changes the GameState and leaves "events" for others to react to.

import {
  CEILING_Y,
  CRASH_TIME,
  DOUBLE_TIME,
  DROP_FALL_SPEED,
  GAP_EASY,
  GAP_HARD,
  GATE_OPENING,
  GRAVITY,
  GROUND_Y,
  LETTUCE_CHANCE,
  LETTUCE_RADIUS,
  MAGNET_RANGE,
  MAGNET_TIME,
  MAX_FALL_SPEED,
  MAX_RISE_SPEED,
  MAX_SPEED,
  POWER_EVERY_MAX,
  POWER_EVERY_MIN,
  POWER_RADIUS,
  SAFE_AFTER_SHIELD,
  SHIELD_TIME,
  SNAIL_BELLY,
  SNAIL_HIT_OFFSET,
  SNAIL_HIT_RADIUS,
  SNAIL_SCALE,
  SNAIL_X,
  SPEED_GAIN,
  START_SPEED,
  THRUST,
  UNITS_PER_POINT,
} from './constants';

// The snail's hit circle centre can be anywhere between these heights
const SAFE_TOP = CEILING_Y - SNAIL_HIT_OFFSET;
const SAFE_BOTTOM = GROUND_Y - SNAIL_BELLY - SNAIL_HIT_OFFSET;
// How far (in units) the hit circle must stay from a hose nozzle end
const HOSE_CLEARANCE = 9;
// The safe band of the next hose must overlap the previous one by at least this much
const MIN_OVERLAP = 10;
// Obstacles never appear closer than this (narrow windows, e.g. iPad split view)
const MIN_SPAWN_X = 150;

export type ObstacleKind = 'bird' | 'leaf' | 'hose' | 'drop';

export type Obstacle = {
  kind: ObstacleKind;
  x: number;
  y: number; // centre (bird, leaf, drop) or the nozzle end of a hose
  baseY: number; // leaves sway around this height; drops: seconds of fall before reaching the snail
  vy: number; // raindrops fall
  size: number; // leaf scale, hose length
  phase: number; // for flapping / swaying
  top: boolean; // hoses: hanging from the top instead of standing on the grass
  gate: boolean; // the lower hose of a gate (used to count gates flown through)
  counted: boolean; // already counted as passed
};

export type Lettuce = { x: number; y: number; phase: number };

export type PowerKind = 'magnet' | 'shield' | 'double';

export type PowerUp = { kind: PowerKind; x: number; y: number; phase: number };

/** What a run achieved (for missions and achievements) */
export type RunSnapshot = { score: number; coins: number; powerups: number; gates: number; shieldSaves: number };

export type ParticleKind = 'puff' | 'sparkle' | 'star' | 'confetti';

export type Particle = {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // seconds left
  maxLife: number;
  size: number;
  hue: number; // 0..1, used for confetti colours
};

export type Popup = { kind: 'plus' | 'best' | PowerKind; x: number; y: number; life: number; value: number };

export type GameEvent = 'start' | 'coin' | 'crash' | 'best' | 'thrustOn' | 'thrustOff' | 'over' | 'power' | 'shieldBreak';

export type Phase = 'ready' | 'playing' | 'crashing' | 'over';

export type GameState = {
  phase: Phase;
  time: number; // seconds since this run was created
  worldWidth: number;
  snailY: number;
  snailVY: number;
  holding: boolean;
  wasHolding: boolean;
  speed: number;
  distance: number;
  score: number;
  coins: number;
  spawnIn: number; // distance until the next obstacle appears
  snailX: number; // where the snail flies (moved right on phones with a notch / Dynamic Island)
  lastGapY: number; // centre of the last hose gate, so gates never jump too far
  // Heights (of the snail's hit circle) that are safe at the last obstacle. The next hose
  // must leave a safe band that overlaps this one, so no sequence is impossible.
  safeTop: number;
  safeBottom: number;
  crashTime: number;
  shake: number; // screen shake, seconds left
  puffTimer: number;
  bestDistance: number; // record of the player, in units (0 = no record yet)
  passedBest: boolean;
  // Power-ups: seconds left for each (0 = not active)
  magnetTime: number;
  doubleTime: number;
  shieldTime: number;
  safeTime: number; // blinking, cannot be hit (right after the shield pops)
  powerIn: number; // distance until the next power-up may appear
  stats: { powerups: number; gates: number; shieldSaves: number };
  obstacles: Obstacle[];
  lettuce: Lettuce[];
  powerUps: PowerUp[];
  particles: Particle[];
  popups: Popup[];
  events: GameEvent[]; // emptied by the game view every frame
};

function rand(min: number, max: number) {
  'worklet';
  return min + Math.random() * (max - min);
}

function clamp(v: number, min: number, max: number) {
  'worklet';
  return Math.max(min, Math.min(max, v));
}

export function createGameState(worldWidth: number, bestScore = 0, snailX = SNAIL_X): GameState {
  'worklet';
  return {
    phase: 'ready',
    time: 0,
    worldWidth,
    snailY: 50,
    snailVY: 0,
    holding: false,
    wasHolding: false,
    speed: START_SPEED,
    distance: 0,
    score: 0,
    coins: 0,
    spawnIn: worldWidth * 0.6,
    snailX,
    lastGapY: 50,
    safeTop: SAFE_TOP,
    safeBottom: SAFE_BOTTOM,
    crashTime: 0,
    shake: 0,
    puffTimer: 0,
    // the record is beaten at best + 1 points (the score has to be higher, not equal)
    bestDistance: (bestScore + 1) * UNITS_PER_POINT,
    passedBest: bestScore <= 0,
    magnetTime: 0,
    doubleTime: 0,
    shieldTime: 0,
    safeTime: 0,
    powerIn: rand(POWER_EVERY_MIN * 0.6, POWER_EVERY_MAX * 0.6),
    stats: { powerups: 0, gates: 0, shieldSaves: 0 },
    obstacles: [],
    lettuce: [],
    powerUps: [],
    particles: [],
    popups: [],
    events: [],
  };
}

/** 0 at the start of a run, 1 at top speed */
export function difficulty(s: GameState) {
  'worklet';
  return (s.speed - START_SPEED) / (MAX_SPEED - START_SPEED);
}

/** How much the snail leans (degrees). Shared by the drawing and the exhaust puffs. */
export function snailAngle(s: GameState) {
  'worklet';
  if (s.phase === 'ready') return Math.sin(s.time * 2) * 4;
  if (s.phase === 'playing') return clamp(s.snailVY * 0.25, -18, 22);
  return s.crashTime * 600;
}

function addObstacle(s: GameState, kind: ObstacleKind, x: number, y: number, extra: Partial<Obstacle> = {}) {
  'worklet';
  s.obstacles.push({
    kind,
    x,
    y,
    baseY: extra.baseY ?? y,
    vy: extra.vy ?? 0,
    size: extra.size ?? 1,
    phase: extra.phase ?? rand(0, 6),
    top: extra.top ?? false,
    gate: extra.gate ?? false,
    counted: false,
  });
}

function lettuceRow(s: GameState, x: number, y: number, count: number, spacing: number, wave: number) {
  'worklet';
  for (let i = 0; i < count; i++) {
    s.lettuce.push({ x: x + i * spacing, y: clamp(y + Math.sin(i * 0.9) * wave, CEILING_Y + 4, GROUND_Y - 6), phase: i * 0.6 });
  }
}

type Pattern = 'bird' | 'leaf' | 'hose' | 'shower' | 'flock' | 'hangingHose' | 'gate';

function pickPattern(d: number): Pattern {
  'worklet';
  // Weights change with difficulty: harder patterns only appear later.
  const weights: [Pattern, number][] = [
    ['bird', 0.26],
    ['leaf', 0.2],
    ['hose', 0.2],
    ['shower', 0.16],
    ['flock', d > 0.2 ? 0.06 + 0.1 * d : 0],
    ['hangingHose', d > 0.12 ? 0.12 : 0],
    ['gate', d > 0.3 ? 0.16 * d : 0],
  ];
  let total = 0;
  for (let i = 0; i < weights.length; i++) total += weights[i][1];
  let roll = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i][1];
    if (roll <= 0) return weights[i][0];
  }
  return 'bird';
}

/**
 * Adds one obstacle pattern just off the right edge of the screen.
 * Returns how much extra room the pattern takes, and whether it brought its own lettuce.
 */
function spawnPattern(s: GameState): { extra: number; hasLettuce: boolean } {
  'worklet';
  const x = Math.max(s.worldWidth, MIN_SPAWN_X) + 10;
  const d = difficulty(s);
  let pattern = pickPattern(d);
  const prevTop = s.safeTop;
  const prevBottom = s.safeBottom;

  // Hose patterns must connect with the way through the previous obstacle.
  // Work out the allowed sizes first; if a pattern cannot fit, send a bird instead.
  const groundMaxH = GROUND_Y - (Math.max(prevTop, SAFE_TOP) + MIN_OVERLAP + HOSE_CLEARANCE);
  const topMaxH = Math.min(prevBottom, SAFE_BOTTOM) - MIN_OVERLAP - HOSE_CLEARANCE;
  const half = GATE_OPENING / 2 - HOSE_CLEARANCE; // half of the safe band inside a gate
  const gateLo = Math.max(CEILING_Y + GATE_OPENING / 2 + 4, prevTop + MIN_OVERLAP - half);
  const gateHi = Math.min(GROUND_Y - GATE_OPENING / 2 - 6, prevBottom - MIN_OVERLAP + half);
  const MIN_HOSE = 12;
  if (
    (pattern === 'hose' && groundMaxH < MIN_HOSE) ||
    (pattern === 'hangingHose' && topMaxH < MIN_HOSE) ||
    (pattern === 'gate' && gateHi < gateLo)
  ) {
    pattern = 'bird';
  }
  // Most patterns can be passed at any height, so they reset the safe band
  s.safeTop = SAFE_TOP;
  s.safeBottom = SAFE_BOTTOM;

  if (pattern === 'bird') {
    // keep the bird away from the middle of the previous way through
    const middle = (Math.max(prevTop, SAFE_TOP) + Math.min(prevBottom, SAFE_BOTTOM)) / 2;
    const y = middle < 47 ? rand(Math.min(middle + 20, GROUND_Y - 12), GROUND_Y - 12) : rand(CEILING_Y, Math.max(middle - 20, CEILING_Y));
    addObstacle(s, 'bird', x, prevTop > SAFE_TOP || prevBottom < SAFE_BOTTOM ? y : rand(CEILING_Y, GROUND_Y - 12));
  } else if (pattern === 'leaf') {
    addObstacle(s, 'leaf', x, rand(CEILING_Y + 6, GROUND_Y - 14), { size: rand(0.7, 1.0) });
  } else if (pattern === 'hose') {
    // hoses grow taller as the game speeds up, but always leave a way through
    // that connects with the way through the previous obstacle
    const h = clamp(rand(16, 32 + d * 9), MIN_HOSE, groundMaxH);
    addObstacle(s, 'hose', x, GROUND_Y - h, { size: h, phase: 0 });
    s.safeBottom = GROUND_Y - h - HOSE_CLEARANCE;
  } else if (pattern === 'hangingHose') {
    const h = clamp(rand(16, 28 + d * 8), MIN_HOSE, topMaxH);
    addObstacle(s, 'hose', x, h, { size: h, phase: 0, top: true });
    s.safeTop = h + HOSE_CLEARANCE;
  } else if (pattern === 'gate') {
    // Two hoses with an opening between them - with lettuce right in the middle
    const centre = clamp(s.lastGapY + rand(-22, 22), gateLo, gateHi);
    s.lastGapY = centre;
    s.safeTop = centre - half;
    s.safeBottom = centre + half;
    const topEnd = centre - GATE_OPENING / 2;
    const bottomEnd = centre + GATE_OPENING / 2;
    addObstacle(s, 'hose', x, topEnd, { size: topEnd, phase: 0, top: true });
    addObstacle(s, 'hose', x, bottomEnd, { size: GROUND_Y - bottomEnd, phase: 0, gate: true });
    lettuceRow(s, x - 14, centre, 4, 8, 0);
    return { extra: 14, hasLettuce: true };
  } else if (pattern === 'flock') {
    // Three birds in a V
    const y = rand(CEILING_Y + 8, GROUND_Y - 22);
    addObstacle(s, 'bird', x, y);
    addObstacle(s, 'bird', x + 7, y - 6);
    addObstacle(s, 'bird', x + 7, y + 6);
    return { extra: 10, hasLettuce: false };
  } else {
    // A small shower: 3-4 drops wait above the screen and start falling
    // when the snail gets close. `baseY` holds how long (in seconds) each
    // drop falls before it reaches the snail, so they arrive at different heights.
    const count = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      addObstacle(s, 'drop', x + i * 9 + rand(-2, 2), -6, { baseY: rand(0.35, 1.25), phase: 0 });
    }
    return { extra: count * 9, hasLettuce: false };
  }
  return { extra: 0, hasLettuce: false };
}

function hitsCircle(sx: number, sy: number, x: number, y: number, r: number) {
  'worklet';
  const dx = sx - x;
  const dy = sy - y;
  const rr = SNAIL_HIT_RADIUS + r;
  return dx * dx + dy * dy < rr * rr;
}

function hitsRect(sx: number, sy: number, x: number, y: number, w: number, h: number) {
  'worklet';
  const cx = clamp(sx, x, x + w);
  const cy = clamp(sy, y, y + h);
  const dx = sx - cx;
  const dy = sy - cy;
  return dx * dx + dy * dy < SNAIL_HIT_RADIUS * SNAIL_HIT_RADIUS;
}

export function collides(snailX: number, snailY: number, o: Obstacle) {
  'worklet';
  // The snail's hit circle sits a bit above its belly (where the shell is)
  const sx = snailX;
  const sy = snailY - SNAIL_HIT_OFFSET;
  if (o.kind === 'bird') return hitsCircle(sx, sy, o.x, o.y, 3.6);
  if (o.kind === 'leaf') return hitsCircle(sx, sy, o.x, o.y, 3.2 * o.size);
  if (o.kind === 'drop') return hitsCircle(sx, sy, o.x, o.y, 2);
  // Hose: the straight pipe + the nozzle that points to the left
  if (o.top) {
    return hitsRect(sx, sy, o.x - 2.5, -10, 5, o.y + 10) || hitsRect(sx, sy, o.x - 10, o.y - 2, 10, 5);
  }
  return hitsRect(sx, sy, o.x - 2.5, o.y, 5, GROUND_Y - o.y) || hitsRect(sx, sy, o.x - 10, o.y - 3, 10, 5);
}

function burst(s: GameState, kind: ParticleKind, x: number, y: number, count: number, speed: number, life: number) {
  'worklet';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rand(-0.3, 0.3);
    const v = speed * rand(0.6, 1.1);
    s.particles.push({
      kind,
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life,
      maxLife: life,
      size: rand(0.8, 1.3),
      hue: Math.random(),
    });
  }
}

/** A snapshot of the run for React (missions, saving) */
export function snapshot(s: GameState): RunSnapshot {
  'worklet';
  return { score: s.score, coins: s.coins, powerups: s.stats.powerups, gates: s.stats.gates, shieldSaves: s.stats.shieldSaves };
}

function spawnPowerUp(s: GameState, x: number) {
  'worklet';
  // never offer a shield while one is still on
  const kinds: PowerKind[] = s.shieldTime > 0 ? ['magnet', 'double'] : ['magnet', 'shield', 'double'];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  // somewhere the snail can reach from the last obstacle (safe band is in hit-circle heights)
  const y = clamp((s.safeTop + s.safeBottom) / 2 + 3 + rand(-6, 6), CEILING_Y + 6, GROUND_Y - 10);
  s.powerUps.push({ kind, x, y, phase: 0 });
}

function collectPowerUp(s: GameState, p: PowerUp) {
  'worklet';
  if (p.kind === 'magnet') s.magnetTime = MAGNET_TIME;
  else if (p.kind === 'double') s.doubleTime = DOUBLE_TIME;
  else s.shieldTime = SHIELD_TIME;
  s.stats.powerups += 1;
  s.events.push('power');
  s.popups.push({ kind: p.kind, x: p.x, y: p.y - 6, life: 1.2, value: 0 });
  burst(s, 'sparkle', p.x, p.y, 10, 30, 0.5);
}

function updateEffects(s: GameState, dt: number, move: number) {
  'worklet';
  for (let i = s.particles.length - 1; i >= 0; i--) {
    const p = s.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      s.particles.splice(i, 1);
      continue;
    }
    if (p.kind === 'confetti' || p.kind === 'star') p.vy += 60 * dt;
    if (p.kind === 'puff') {
      p.vx *= 1 - 2 * dt;
      p.vy *= 1 - 2 * dt;
    }
    p.x += p.vx * dt - move;
    p.y += p.vy * dt;
  }
  for (let i = s.popups.length - 1; i >= 0; i--) {
    const p = s.popups[i];
    p.life -= dt;
    p.y -= (p.kind === 'plus' ? 14 : 6) * dt;
    if (p.life <= 0) s.popups.splice(i, 1);
  }
  if (s.shake > 0) s.shake = Math.max(0, s.shake - dt);
}

function updatePowerTimers(s: GameState, dt: number) {
  'worklet';
  s.magnetTime = Math.max(0, s.magnetTime - dt);
  s.doubleTime = Math.max(0, s.doubleTime - dt);
  s.safeTime = Math.max(0, s.safeTime - dt);
  if (s.shieldTime > 0) {
    s.shieldTime = Math.max(0, s.shieldTime - dt);
    if (s.shieldTime === 0) burst(s, 'sparkle', s.snailX, s.snailY - 6, 10, 30, 0.4);
  }
}

/** The shield takes the hit: it pops, the obstacle is knocked away, and the snail blinks for a moment */
function shieldSave(s: GameState, index: number) {
  'worklet';
  const o = s.obstacles[index];
  s.shieldTime = 0;
  s.safeTime = SAFE_AFTER_SHIELD;
  s.stats.shieldSaves += 1;
  s.shake = 0.15;
  burst(s, 'star', o.x, o.kind === 'hose' ? s.snailY - SNAIL_HIT_OFFSET : o.y, 6, 30, 0.6);
  burst(s, 'sparkle', s.snailX, s.snailY - 6, 12, 40, 0.5);
  s.obstacles.splice(index, 1);
  s.events.push('shieldBreak');
}

function emitPuff(s: GameState) {
  'worklet';
  if (s.particles.length > 90) return;
  // Rocket nozzle position, turned together with the snail around its pivot (0, -SNAIL_HIT_OFFSET)
  const a = (snailAngle(s) * Math.PI) / 180;
  const lx = -16 * SNAIL_SCALE;
  const ly = -9 * SNAIL_SCALE;
  const x = s.snailX + lx * Math.cos(a) - ly * Math.sin(a);
  const y = s.snailY - SNAIL_HIT_OFFSET + lx * Math.sin(a) + ly * Math.cos(a);
  s.particles.push({
    kind: 'puff',
    x,
    y,
    vx: rand(-30, -18),
    vy: rand(-6, 10),
    life: 0.45,
    maxLife: 0.45,
    size: rand(0.8, 1.2),
    hue: 0,
  });
}

function crash(s: GameState) {
  'worklet';
  s.phase = 'crashing';
  s.crashTime = 0;
  s.snailVY = -40; // a little hop before falling
  s.holding = false;
  s.shake = 0.35;
  s.magnetTime = 0;
  s.doubleTime = 0;
  s.shieldTime = 0;
  burst(s, 'star', s.snailX + 4, s.snailY - 8, 7, 28, 0.9);
  s.events.push('crash');
}

/** Hands over the events that happened since the last call (and forgets them). */
export function takeEvents(s: GameState): GameEvent[] {
  'worklet';
  const events = s.events.slice();
  s.events.length = 0;
  return events;
}

/** Advances the game by `dt` seconds. `worldWidth` follows screen size changes. */
export function stepGame(s: GameState, dt: number, worldWidth = s.worldWidth): void {
  'worklet';
  s.worldWidth = worldWidth;
  s.time += dt;

  // Tell the sound system when the rocket turns on and off
  if (s.phase === 'playing' && s.holding !== s.wasHolding) {
    s.events.push(s.holding ? 'thrustOn' : 'thrustOff');
  }
  s.wasHolding = s.phase === 'playing' && s.holding;

  if (s.phase === 'ready' || s.phase === 'over') {
    updateEffects(s, dt, 0);
    return;
  }

  if (s.phase === 'crashing') {
    // The snail tumbles down, the world stands still
    s.crashTime += dt;
    s.snailVY = Math.min(s.snailVY + GRAVITY * dt, MAX_FALL_SPEED);
    s.snailY = Math.min(s.snailY + s.snailVY * dt, GROUND_Y + 4);
    updateEffects(s, dt, 0);
    if (s.crashTime >= CRASH_TIME) {
      s.phase = 'over';
      s.events.push('over');
    }
    return;
  }

  // 1. Snail physics: hold = go up, release = fall
  const accel = s.holding ? GRAVITY - THRUST : GRAVITY;
  s.snailVY = clamp(s.snailVY + accel * dt, -MAX_RISE_SPEED, MAX_FALL_SPEED);
  s.snailY += s.snailVY * dt;
  if (s.snailY < CEILING_Y) {
    s.snailY = CEILING_Y;
    s.snailVY = 0;
  }
  const floor = GROUND_Y - SNAIL_BELLY; // belly touches the grass
  if (s.snailY > floor) {
    s.snailY = floor;
    s.snailVY = 0;
  }

  // 2. Speed slowly grows, distance becomes points
  s.speed = Math.min(MAX_SPEED, s.speed + SPEED_GAIN * dt);
  const move = s.speed * dt;
  s.distance += move;
  s.score = Math.floor(s.distance / UNITS_PER_POINT);

  if (!s.passedBest && s.distance >= s.bestDistance) {
    s.passedBest = true;
    s.events.push('best');
    s.popups.push({ kind: 'best', x: s.snailX + 6, y: s.snailY - 20, life: 1.6, value: 0 });
    burst(s, 'confetti', s.snailX + 4, s.snailY - 10, 22, 40, 1.4);
  }

  // 3. Rocket exhaust
  if (s.holding) {
    s.puffTimer -= dt;
    if (s.puffTimer <= 0) {
      s.puffTimer = 0.035;
      emitPuff(s);
    }
  }

  updatePowerTimers(s, dt);

  // 4. Spawn new things
  s.spawnIn -= move;
  s.powerIn -= move;
  if (s.spawnIn <= 0) {
    const { extra, hasLettuce } = spawnPattern(s);
    const gap = GAP_EASY + (GAP_HARD - GAP_EASY) * difficulty(s);
    s.spawnIn = extra + gap + rand(0, 15);
    if (s.powerIn <= 0 && !hasLettuce) {
      // a power-up bubble in the free space before the next obstacle (instead of lettuce)
      spawnPowerUp(s, Math.max(s.worldWidth, MIN_SPAWN_X) + 10 + extra + gap * 0.45);
      s.powerIn = rand(POWER_EVERY_MIN, POWER_EVERY_MAX);
    } else if (!hasLettuce && Math.random() < LETTUCE_CHANCE) {
      // put the lettuce row in the free space before the next obstacle
      const wave = Math.random() < 0.5 ? 0 : rand(4, 9);
      // as many as fit before the next obstacle's nozzle (3 to 5)
      const count = clamp(Math.floor((gap * 0.8 - 16) / 7) + 1, 3, 5);
      lettuceRow(s, Math.max(s.worldWidth, MIN_SPAWN_X) + 10 + extra + gap * 0.2, rand(CEILING_Y + 8, GROUND_Y - 10), count, 7, wave);
    }
  }

  // 5. Move obstacles and check for hits
  for (let i = s.obstacles.length - 1; i >= 0; i--) {
    const o = s.obstacles[i];
    o.phase += dt;
    if (o.kind === 'bird') {
      o.x -= move + 14 * dt; // birds fly towards the snail
      o.y += Math.sin(o.phase * 3) * 6 * dt;
    } else if (o.kind === 'leaf') {
      o.x -= move + 4 * dt;
      o.y = o.baseY + Math.sin(o.phase * 2.2) * 8;
    } else if (o.kind === 'drop') {
      o.x -= move;
      if (o.vy === 0 && o.x - s.snailX < o.baseY * s.speed) o.vy = DROP_FALL_SPEED;
      o.y += o.vy * dt;
    } else {
      o.x -= move;
    }
    if (o.x < -20 || o.y > GROUND_Y + 5) {
      s.obstacles.splice(i, 1);
      continue;
    }
    if (o.gate && !o.counted && o.x < s.snailX - 3) {
      o.counted = true;
      s.stats.gates += 1;
    }
    if (s.safeTime > 0 || !collides(s.snailX, s.snailY, o)) continue;
    if (s.shieldTime > 0) {
      shieldSave(s, i);
      continue;
    }
    crash(s);
    updateEffects(s, dt, 0);
    return;
  }

  // 5b. Power-up bubbles
  for (let i = s.powerUps.length - 1; i >= 0; i--) {
    const p = s.powerUps[i];
    p.x -= move;
    p.phase += dt;
    if (p.x < -10) {
      s.powerUps.splice(i, 1);
    } else if (hitsCircle(s.snailX, s.snailY - SNAIL_HIT_OFFSET, p.x, p.y, POWER_RADIUS)) {
      s.powerUps.splice(i, 1);
      collectPowerUp(s, p);
    }
  }

  // 6. Move lettuce and collect it
  for (let i = s.lettuce.length - 1; i >= 0; i--) {
    const l = s.lettuce[i];
    l.x -= move;
    l.phase += dt;
    if (s.magnetTime > 0) {
      // the magnet pulls nearby lettuce towards the snail
      const dx = s.snailX - l.x;
      const dy = s.snailY - SNAIL_HIT_OFFSET - l.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MAGNET_RANGE && dist > 0.01) {
        const pull = Math.min(dist, (60 + s.speed) * dt);
        l.x += (dx / dist) * pull;
        l.y += (dy / dist) * pull;
      }
    }
    if (l.x < -10) {
      s.lettuce.splice(i, 1);
      continue;
    }
    if (hitsCircle(s.snailX, s.snailY - SNAIL_HIT_OFFSET, l.x, l.y, LETTUCE_RADIUS + 1)) {
      s.lettuce.splice(i, 1);
      const value = s.doubleTime > 0 ? 2 : 1;
      s.coins += value;
      s.events.push('coin');
      s.popups.push({ kind: 'plus', x: l.x, y: l.y - 4, life: 0.7, value });
      burst(s, 'sparkle', l.x, l.y, 6, 22, 0.4);
    }
  }

  updateEffects(s, dt, move);
}

/** Starts the run on the first touch. */
export function pressDown(s: GameState) {
  'worklet';
  if (s.phase === 'ready') {
    s.phase = 'playing';
    s.events.push('start');
  }
  s.holding = true;
}

export function pressUp(s: GameState) {
  'worklet';
  s.holding = false;
}
