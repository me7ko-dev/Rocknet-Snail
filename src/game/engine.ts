// The game "brain": moves everything, spawns obstacles, checks hits.
// Every function here is a worklet, so it runs on the UI thread at 60 FPS
// without waiting for React.

import {
  CEILING_Y,
  CRASH_TIME,
  DROP_FALL_SPEED,
  GAP_EASY,
  GAP_HARD,
  GRAVITY,
  GROUND_Y,
  LETTUCE_CHANCE,
  LETTUCE_RADIUS,
  MAX_FALL_SPEED,
  MAX_RISE_SPEED,
  MAX_SPEED,
  SNAIL_HIT_RADIUS,
  SNAIL_X,
  SPEED_GAIN,
  START_SPEED,
  THRUST,
  UNITS_PER_POINT,
} from './constants';

export type ObstacleKind = 'bird' | 'leaf' | 'hose' | 'drop';

export type Obstacle = {
  kind: ObstacleKind;
  x: number;
  y: number;
  baseY: number; // leaves sway around this height
  vy: number; // raindrops fall
  size: number; // hose height, leaf size...
  phase: number; // for flapping / swaying
};

export type Lettuce = { x: number; y: number; phase: number; taken: boolean };

export type Phase = 'ready' | 'playing' | 'crashing' | 'over';

export type GameState = {
  phase: Phase;
  time: number; // seconds since the run started
  worldWidth: number;
  snailY: number;
  snailVY: number;
  holding: boolean;
  speed: number;
  distance: number;
  score: number;
  coins: number;
  spawnIn: number; // distance until the next obstacle appears
  crashTime: number;
  obstacles: Obstacle[];
  lettuce: Lettuce[];
};

export function createGameState(worldWidth: number): GameState {
  'worklet';
  return {
    phase: 'ready',
    time: 0,
    worldWidth,
    snailY: 50,
    snailVY: 0,
    holding: false,
    speed: START_SPEED,
    distance: 0,
    score: 0,
    coins: 0,
    spawnIn: worldWidth * 0.6,
    crashTime: 0,
    obstacles: [],
    lettuce: [],
  };
}

function rand(min: number, max: number) {
  'worklet';
  return min + Math.random() * (max - min);
}

// 0 at the start of a run, 1 at top speed
function difficulty(s: GameState) {
  'worklet';
  return (s.speed - START_SPEED) / (MAX_SPEED - START_SPEED);
}

/** Adds one obstacle (or a small group). Returns how much extra room it takes. */
function spawnObstacle(s: GameState): number {
  'worklet';
  const x = s.worldWidth + 10;
  const roll = Math.random();
  const d = difficulty(s);
  if (roll < 0.3) {
    s.obstacles.push({ kind: 'bird', x, y: rand(CEILING_Y, GROUND_Y - 12), baseY: 0, vy: 0, size: 1, phase: rand(0, 6) });
  } else if (roll < 0.55) {
    const baseY = rand(CEILING_Y + 6, GROUND_Y - 14);
    s.obstacles.push({ kind: 'leaf', x, y: baseY, baseY, vy: 0, size: rand(0.9, 1.25), phase: rand(0, 6) });
  } else if (roll < 0.78) {
    // hoses grow taller as the game speeds up
    const h = rand(22, 42 + d * 12);
    s.obstacles.push({ kind: 'hose', x, y: GROUND_Y - h, baseY: 0, vy: 0, size: h, phase: 0 });
  } else {
    // A small shower: 3-4 drops wait above the screen and start falling
    // when the snail gets close. `baseY` holds how long (in seconds) each
    // drop falls before it reaches the snail, so they arrive at different heights.
    const count = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      s.obstacles.push({
        kind: 'drop',
        x: x + i * 9 + rand(-2, 2),
        y: -6,
        baseY: rand(0.35, 1.25),
        vy: 0,
        size: 1,
        phase: 0,
      });
    }
    return count * 9;
  }
  return 0;
}

function spawnLettuceRow(s: GameState, x: number) {
  'worklet';
  const y = rand(CEILING_Y + 8, GROUND_Y - 10);
  const wave = Math.random() < 0.5 ? 0 : rand(4, 9);
  for (let i = 0; i < 5; i++) {
    s.lettuce.push({ x: x + i * 7, y: y + Math.sin(i * 0.9) * wave, phase: i * 0.6, taken: false });
  }
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
  const cx = Math.max(x, Math.min(sx, x + w));
  const cy = Math.max(y, Math.min(sy, y + h));
  const dx = sx - cx;
  const dy = sy - cy;
  return dx * dx + dy * dy < SNAIL_HIT_RADIUS * SNAIL_HIT_RADIUS;
}

function collides(s: GameState, o: Obstacle) {
  'worklet';
  // The snail's hit circle sits a bit above its belly (where the shell is)
  const sx = SNAIL_X;
  const sy = s.snailY - 3;
  switch (o.kind) {
    case 'bird':
      return hitsCircle(sx, sy, o.x, o.y, 3.6);
    case 'leaf':
      return hitsCircle(sx, sy, o.x, o.y, 3.2 * o.size);
    case 'drop':
      return hitsCircle(sx, sy, o.x, o.y, 2);
    case 'hose':
      // the upright pipe + the nozzle that bends to the left
      return hitsRect(sx, sy, o.x - 2.5, o.y, 5, o.size) || hitsRect(sx, sy, o.x - 10, o.y - 3, 10, 5);
  }
  return false;
}

/** Advances the game by `dt` seconds. Returns true when the run has just ended. */
export function stepGame(s: GameState, dt: number): boolean {
  'worklet';
  if (s.phase === 'ready' || s.phase === 'over') {
    s.time += dt;
    return false;
  }

  if (s.phase === 'crashing') {
    // The snail tumbles down, the world stands still
    s.time += dt;
    s.crashTime += dt;
    s.snailVY = Math.min(s.snailVY + GRAVITY * dt, MAX_FALL_SPEED);
    s.snailY = Math.min(s.snailY + s.snailVY * dt, GROUND_Y + 4);
    if (s.crashTime >= CRASH_TIME) {
      s.phase = 'over';
      return true;
    }
    return false;
  }

  s.time += dt;

  // 1. Snail physics: hold = go up, release = fall
  const accel = s.holding ? GRAVITY - THRUST : GRAVITY;
  s.snailVY = Math.max(-MAX_RISE_SPEED, Math.min(MAX_FALL_SPEED, s.snailVY + accel * dt));
  s.snailY += s.snailVY * dt;
  if (s.snailY < CEILING_Y) {
    s.snailY = CEILING_Y;
    s.snailVY = 0;
  }
  const floor = GROUND_Y - 4; // belly touches the grass
  if (s.snailY > floor) {
    s.snailY = floor;
    s.snailVY = 0;
  }

  // 2. Speed slowly grows, distance becomes points
  s.speed = Math.min(MAX_SPEED, s.speed + SPEED_GAIN * dt);
  const move = s.speed * dt;
  s.distance += move;
  s.score = Math.floor(s.distance / UNITS_PER_POINT);

  // 3. Spawn new things
  s.spawnIn -= move;
  if (s.spawnIn <= 0) {
    const extra = spawnObstacle(s);
    const gap = GAP_EASY + (GAP_HARD - GAP_EASY) * difficulty(s);
    s.spawnIn = extra + gap + rand(0, 15);
    if (Math.random() < LETTUCE_CHANCE) {
      // put the lettuce row in the free space before the next obstacle
      spawnLettuceRow(s, s.worldWidth + 10 + extra + gap * 0.2);
    }
  }

  // 4. Move obstacles and check for hits
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
      if (o.vy === 0 && o.x - SNAIL_X < o.baseY * s.speed) o.vy = DROP_FALL_SPEED;
      o.y += o.vy * dt;
    } else {
      o.x -= move;
    }
    if (o.x < -20 || o.y > GROUND_Y + 5) {
      s.obstacles.splice(i, 1);
      continue;
    }
    if (collides(s, o)) {
      s.phase = 'crashing';
      s.crashTime = 0;
      s.snailVY = -40; // a little hop before falling
      s.holding = false;
      return false;
    }
  }

  // 5. Move lettuce and collect it
  for (let i = s.lettuce.length - 1; i >= 0; i--) {
    const l = s.lettuce[i];
    l.x -= move;
    l.phase += dt;
    if (l.x < -10 || l.taken) {
      s.lettuce.splice(i, 1);
      continue;
    }
    if (hitsCircle(SNAIL_X, s.snailY - 3, l.x, l.y, LETTUCE_RADIUS + 1)) {
      l.taken = true;
      s.coins += 1;
    }
  }

  return false;
}
