import { describe, expect, it } from '@jest/globals';

import { en } from '../../i18n/strings';
import { DEFAULT_SAVE } from '../../storage/save';
import type { RunSnapshot } from '../engine';
import {
  ACHIEVEMENTS,
  achievementProgress,
  addRunToDaily,
  claimableCount,
  dailyFor,
  dayKey,
  describeAchievement,
  describeMission,
  makeDailyMissions,
  type DailyState,
} from '../missions';

const run = (extra: Partial<RunSnapshot>): RunSnapshot => ({ score: 0, coins: 0, powerups: 0, gates: 0, shieldSaves: 0, ...extra });

describe('daily missions', () => {
  it('are the same all day and change the next day', () => {
    expect(makeDailyMissions('2026-10-11')).toEqual(makeDailyMissions('2026-10-11'));
    const week = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'].map((d) => JSON.stringify(makeDailyMissions(d)));
    expect(new Set(week).size).toBeGreaterThan(1);
  });

  it('are always 3 different kinds', () => {
    for (let d = 1; d <= 28; d++) {
      const missions = makeDailyMissions(`2026-02-${String(d).padStart(2, '0')}`);
      expect(missions).toHaveLength(3);
      expect(new Set(missions.map((m) => m.kind)).size).toBe(3);
    }
  });

  it('start fresh on a new day', () => {
    const today = dailyFor(null, '2026-10-11');
    expect(dailyFor(today, '2026-10-11')).toBe(today);
    expect(dailyFor(today, '2026-10-12').day).toBe('2026-10-12');
  });

  it('count the best flight for distance, and add up the rest', () => {
    const daily: DailyState = {
      day: 'x',
      missions: [
        { kind: 'distance', target: 200, reward: 10 },
        { kind: 'flights', target: 3, reward: 10 },
        { kind: 'lettuceDay', target: 30, reward: 10 },
      ],
      progress: [0, 0, 0],
      claimed: [false, false, false],
    };
    let state = daily;
    let completed = 0;
    for (const r of [run({ score: 120, coins: 10 }), run({ score: 80, coins: 10 }), run({ score: 250, coins: 15 })]) {
      const next = addRunToDaily(state, r);
      state = next.daily;
      completed += next.completed;
    }
    expect(state.progress).toEqual([200, 3, 30]);
    expect(completed).toBe(3);
    // already done: no more "completed" after that
    expect(addRunToDaily(state, run({ score: 500 })).completed).toBe(0);
  });

  it('have texts with the number filled in', () => {
    for (const m of makeDailyMissions('2026-10-11')) {
      expect(describeMission(m, en)).toContain(String(m.target));
      expect(describeMission(m, en)).not.toContain('{n}');
    }
  });

  it('use the local date', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('achievements', () => {
  it('have unique ids and texts', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) expect(describeAchievement(a, en)).not.toContain('{n}');
  });

  it('follow the saved progress', () => {
    const save = { ...DEFAULT_SAVE, best: 350, runs: 12 };
    const best300 = ACHIEVEMENTS.find((a) => a.id === 'best-300')!;
    expect(achievementProgress(best300, save)).toBe(350);
    const items5 = ACHIEVEMENTS.find((a) => a.id === 'items-5')!;
    expect(achievementProgress(items5, save)).toBe(0); // free items don't count
  });

  it('are counted for the menu badge until claimed', () => {
    const day = '2026-10-11';
    const save = { ...DEFAULT_SAVE, best: 120, daily: dailyFor(null, day) };
    expect(claimableCount(save, day)).toBe(1); // "reach 100 m"
    expect(claimableCount({ ...save, claimedAchievements: ['best-100'] }, day)).toBe(0);
  });
});
