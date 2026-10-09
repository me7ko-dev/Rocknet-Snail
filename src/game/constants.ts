// All game tuning lives here. The world is measured in "units":
// the screen is always 100 units tall, and as wide as it needs to be.
// That way the game feels the same on every phone and tablet.

export const WORLD_HEIGHT = 100;
export const GROUND_Y = 88; // top of the grass
export const CEILING_Y = 14; // the snail can't fly higher than this

// Snail
export const SNAIL_X = 22;
export const SNAIL_HIT_RADIUS = 5;
export const GRAVITY = 260; // units / s² pulling down
export const THRUST = 560; // units / s² pushing up while the finger is held
export const MAX_RISE_SPEED = 75;
export const MAX_FALL_SPEED = 95;

// Speed and score
export const START_SPEED = 38; // units / s
export const MAX_SPEED = 95;
export const SPEED_GAIN = 0.8; // extra units / s, every second
export const UNITS_PER_POINT = 5; // 1 point ("metre") = 5 units travelled

// Spawning
export const GAP_EASY = 70; // distance between obstacles at the start
export const GAP_HARD = 40; // distance between obstacles at top speed
export const GATE_OPENING = 34; // free space between the two hoses of a "gate"
export const LETTUCE_CHANCE = 0.55; // chance of a row of lettuce between obstacles
export const LETTUCE_RADIUS = 3;
export const DROP_FALL_SPEED = 70;

// Day → sunset → night → day. One full cycle every this many units.
export const DAY_CYCLE = 3000;

// How long the crash animation plays before the "Game over" panel
export const CRASH_TIME = 1.0;

export const COLORS = {
  skyTop: '#7CC8FF',
  skyBottom: '#DDF4FF',
  sun: '#FFE066',
  moon: '#FFF6D5',
  cloud: '#FFFFFF',
  hillFar: '#B5E8A8',
  hillNear: '#86D47F',
  grass: '#5CC66B',
  grassDark: '#47B058',
  dirt: '#9B6B43',
  snailBody: '#FFD27F',
  snailBodyDark: '#E9AE52',
  shell: '#F07A5A',
  shellDark: '#BF4E37',
  eyeWhite: '#FFFFFF',
  pupil: '#2B2B3A',
  cheek: '#FF9AA2',
  rocketFin: '#FFFFFF',
  rocketWindow: '#9BE3FF',
  flameOuter: '#FF8C2B',
  flameInner: '#FFE45C',
  bird: '#6C8EF5',
  birdWing: '#4F6FD8',
  beak: '#FFA62B',
  leaf: '#E8792B',
  leafVein: '#B4521A',
  hose: '#FFB627',
  hoseDark: '#D88E0A',
  nozzle: '#9AA3AE',
  water: '#4AA3FF',
  waterLight: '#BFE3FF',
  lettuce: '#7ED957',
  lettuceLight: '#C4F5A6',
  lettuceDark: '#4FAF3A',
  flag: '#FF5A5F',
  star: '#FFD84D',
  hudText: '#FFFFFF',
  hudShadow: '#2B3A55',
  ink: '#2B3A55',
};
