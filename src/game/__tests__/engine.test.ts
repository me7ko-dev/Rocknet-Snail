import { describe, expect, it } from '@jest/globals';

import {
  CEILING_Y,
  CRASH_TIME,
  GATE_OPENING,
  GROUND_Y,
  MAX_SPEED,
  SNAIL_X,
  START_SPEED,
  UNITS_PER_POINT,
} from '../constants';
import { collides, createGameState, pressDown, pressUp, stepGame, type GameEvent, type GameState, type Obstacle } from '../engine';

const DT = 1 / 60;
const WORLD_WIDTH = 190;

function run(s: GameState, seconds: number, onStep?: (s: GameState) => void) {
  const events: GameEvent[] = [];
  for (let t = 0; t < seconds; t += DT) {
    onStep?.(s);
    stepGame(s, DT);
    events.push(...s.events);
    s.events.length = 0;
  }
  return events;
}

/** A run with nothing spawning, so physics can be tested alone */
function emptyRun(best = 0) {
  const s = createGameState(WORLD_WIDTH, best);
  pressDown(s);
  pressUp(s);
  s.spawnIn = Number.POSITIVE_INFINITY;
  return s;
}

function obstacle(extra: Partial<Obstacle>): Obstacle {
  return { kind: 'bird', x: SNAIL_X, y: 50, baseY: 50, vy: 0, size: 1, phase: 0, top: false, ...extra };
}

describe('snail physics', () => {
  it('waits for the first touch before moving', () => {
    const s = createGameState(WORLD_WIDTH);
    run(s, 2);
    expect(s.phase).toBe('ready');
    expect(s.distance).toBe(0);
  });

  it('flies up while the finger is held and falls when it is released', () => {
    const s = emptyRun();
    const start = s.snailY;
    s.holding = true;
    run(s, 0.4);
    expect(s.snailY).toBeLessThan(start);
    const top = s.snailY;
    s.holding = false;
    run(s, 0.6);
    expect(s.snailY).toBeGreaterThan(top);
  });

  it('never leaves the screen', () => {
    const s = emptyRun();
    s.holding = true;
    run(s, 3);
    expect(s.snailY).toBe(CEILING_Y);
    s.holding = false;
    run(s, 3);
    expect(s.snailY).toBeLessThanOrEqual(GROUND_Y);
    expect(s.phase).toBe('playing');
  });
});

describe('speed and score', () => {
  it('slowly speeds up but never beyond the maximum', () => {
    const s = emptyRun();
    run(s, 10);
    expect(s.speed).toBeGreaterThan(START_SPEED);
    run(s, 200);
    expect(s.speed).toBe(MAX_SPEED);
  });

  it('turns distance into points', () => {
    const s = emptyRun();
    run(s, 5);
    expect(s.score).toBe(Math.floor(s.distance / UNITS_PER_POINT));
    expect(s.score).toBeGreaterThan(0);
  });
});

describe('hits and lettuce', () => {
  it('a hit makes the snail crash and the run end exactly once', () => {
    const s = emptyRun();
    s.obstacles.push(obstacle({ y: s.snailY - 3 }));
    const events = run(s, CRASH_TIME + 0.5);
    expect(events.filter((e) => e === 'crash')).toHaveLength(1);
    expect(events.filter((e) => e === 'over')).toHaveLength(1);
    expect(s.phase).toBe('over');
  });

  it('collects lettuce', () => {
    const s = emptyRun();
    s.lettuce.push({ x: SNAIL_X + 2, y: s.snailY - 3, phase: 0 });
    const events = run(s, 0.1);
    expect(s.coins).toBe(1);
    expect(s.lettuce).toHaveLength(0);
    expect(events).toContain('coin');
  });

  it('celebrates passing the old record once', () => {
    const s = emptyRun(10);
    const events = run(s, 5);
    expect(events.filter((e) => e === 'best')).toHaveLength(1);
  });

  it('does not celebrate on the very first run', () => {
    const s = emptyRun(0);
    expect(run(s, 5)).not.toContain('best');
  });

  it('reports rocket on/off changes', () => {
    const s = emptyRun();
    s.holding = true;
    run(s, 0.1);
    s.holding = false;
    const events = run(s, 0.1);
    expect(events).toContain('thrustOff');
  });

  it('hoses hit along their whole length, but not above the nozzle', () => {
    const groundHose = obstacle({ kind: 'hose', x: SNAIL_X, y: 60, size: GROUND_Y - 60 });
    expect(collides(80, groundHose)).toBe(true);
    expect(collides(40, groundHose)).toBe(false);
    const hangingHose = obstacle({ kind: 'hose', x: SNAIL_X, y: 30, size: 30, top: true });
    expect(collides(25, hangingHose)).toBe(true);
    expect(collides(50, hangingHose)).toBe(false);
  });
});

describe('long random runs', () => {
  // A simple bot that tries to stay away from the nearest obstacle
  function bot(s: GameState) {
    const threat = s.obstacles.filter((o) => o.x > SNAIL_X - 5 && o.x < SNAIL_X + 40).sort((a, b) => a.x - b.x)[0];
    let target = 50;
    if (threat) target = threat.y > 50 ? threat.y - 22 : threat.y + 22;
    s.holding = s.snailY > target;
  }

  it('stays valid for many runs (no NaN, no runaway objects)', () => {
    const scores: number[] = [];
    for (let i = 0; i < 40; i++) {
      const s = createGameState(WORLD_WIDTH);
      pressDown(s);
      let maxObjects = 0;
      run(s, 120, (st) => {
        bot(st);
        maxObjects = Math.max(maxObjects, st.obstacles.length + st.lettuce.length + st.particles.length);
        if (st.phase === 'over') return;
        expect(Number.isFinite(st.snailY)).toBe(true);
        expect(Number.isFinite(st.distance)).toBe(true);
      });
      expect(maxObjects).toBeLessThan(200);
      scores.push(s.score);
    }
    // the bot is not great, but every run should get somewhere
    expect(Math.min(...scores)).toBeGreaterThan(20);
  });

  it('always leaves a passable opening in hose gates', () => {
    let gatesSeen = 0;
    for (let i = 0; i < 30; i++) {
      const s = emptyRun();
      s.speed = MAX_SPEED; // gates only appear when the game is fast
      s.spawnIn = 0;
      for (let k = 0; k < 400; k++) {
        stepGame(s, DT);
        s.events.length = 0;
        s.obstacles = s.obstacles.filter((o) => o.kind === 'hose');
        const tops = s.obstacles.filter((o) => o.top);
        for (const top of tops) {
          const bottom = s.obstacles.find((o) => !o.top && Math.abs(o.x - top.x) < 0.01);
          if (bottom) {
            gatesSeen++;
            expect(bottom.y - top.y).toBeCloseTo(GATE_OPENING, 5);
          }
        }
        s.phase = 'playing'; // this test only looks at spawning, never at crashes
      }
    }
    expect(gatesSeen).toBeGreaterThan(0);
  });
});
