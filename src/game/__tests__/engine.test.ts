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

  it('only celebrates when the score is really higher than the record', () => {
    const s = emptyRun(10);
    run(s, 0.05, (st) => {
      if (st.events.includes('best')) expect(st.score).toBeGreaterThan(10);
    });
    let celebratedAt = -1;
    for (let t = 0; t < 5 && celebratedAt < 0; t += DT) {
      stepGame(s, DT);
      if (s.events.includes('best')) celebratedAt = s.score;
      s.events.length = 0;
    }
    expect(celebratedAt).toBe(11);
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
    expect(collides(SNAIL_X, 80, groundHose)).toBe(true);
    expect(collides(SNAIL_X, 40, groundHose)).toBe(false);
    const hangingHose = obstacle({ kind: 'hose', x: SNAIL_X, y: 30, size: 30, top: true });
    expect(collides(SNAIL_X, 25, hangingHose)).toBe(true);
    expect(collides(SNAIL_X, 50, hangingHose)).toBe(false);
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

  it('never puts two hoses in a row without a common way through', () => {
    // Heights where the snail's body would not touch any hose of a pattern,
    // found by asking the real hit test (independent of how spawning computes it)
    const safeHeights = (hoses: Obstacle[]) => {
      const ok: number[] = [];
      for (let y = 0; y <= GROUND_Y; y += 0.5) {
        const hit = hoses.some((o) => [0, -4, -8, -12].some((dx) => collides(o.x + dx, y, o)));
        if (!hit) ok.push(y);
      }
      return ok;
    };
    let pairs = 0;
    for (let i = 0; i < 40; i++) {
      const s = emptyRun();
      s.speed = MAX_SPEED;
      s.spawnIn = 0;
      let prev: number[] | null = null;
      const seen = new Set<Obstacle>();
      for (let k = 0; k < 3000; k++) {
        stepGame(s, DT);
        s.events.length = 0;
        s.phase = 'playing';
        s.snailY = -100; // keep the test snail out of the way
        const fresh = s.obstacles.filter((o) => !seen.has(o));
        fresh.forEach((o) => seen.add(o));
        if (fresh.length === 0) continue;
        // a new pattern appeared at the right edge
        if (fresh.every((o) => o.kind === 'hose')) {
          const safe = safeHeights(fresh);
          expect(safe.length).toBeGreaterThan(10);
          if (prev) {
            const common = safe.filter((y) => prev!.includes(y));
            expect(common.length).toBeGreaterThanOrEqual(8); // at least 4 units in common
            pairs++;
          }
          prev = safe;
        } else {
          prev = null;
        }
      }
    }
    expect(pairs).toBeGreaterThan(5);
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
