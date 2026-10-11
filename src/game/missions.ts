// Daily missions and achievements. Plain TypeScript (runs in React, not in the game loop).
//
// Daily: every day the game picks 3 missions (the same for everybody on that date).
// Achievements: permanent goals with bigger rewards.
// Both are claimed by tapping "Claim", which gives lettuce.

import type { RunSnapshot } from './engine';
import { HATS, ROCKETS } from './skins';
import type { Strings } from '../i18n/strings';

export type MissionKind = 'distance' | 'lettuceRun' | 'lettuceDay' | 'flights' | 'powerups' | 'gates' | 'shieldSaves';

export type Mission = { kind: MissionKind; target: number; reward: number };

export type DailyState = {
  day: string; // 'YYYY-MM-DD' in the player's time zone
  missions: Mission[];
  progress: number[];
  claimed: boolean[];
};

/** The parts of the save that missions and achievements look at */
export type Progress = {
  best: number;
  runs: number;
  totalLettuce: number;
  totalPowerups: number;
  totalGates: number;
  totalShieldSaves: number;
  ownedSkins: string[];
  daily: DailyState | null;
  claimedAchievements: string[];
};

// ---------------------------------------------------------------- daily

// Possible missions: [kind, possible targets, reward]
const POOL: [MissionKind, number[], number][] = [
  ['distance', [150, 250, 400], 40],
  ['lettuceRun', [15, 25, 40], 40],
  ['lettuceDay', [50, 100], 35],
  ['flights', [3, 5, 8], 25],
  ['powerups', [3, 6], 35],
  ['gates', [3, 6], 45],
  ['shieldSaves', [1, 2], 40],
];

/** Missions where only the best single flight counts (the rest add up over the day) */
const BEST_OF_ONE_FLIGHT: MissionKind[] = ['distance', 'lettuceRun'];

export function dayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Small predictable random numbers, so a date always gives the same missions */
function seededRandom(seedText: string) {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeDailyMissions(day: string): Mission[] {
  const random = seededRandom(day);
  const pool = [...POOL];
  const missions: Mission[] = [];
  while (missions.length < 3) {
    const [kind, targets, reward] = pool.splice(Math.floor(random() * pool.length), 1)[0];
    const level = Math.floor(random() * targets.length);
    missions.push({ kind, target: targets[level], reward: reward + level * 15 });
  }
  return missions;
}

/** Gives back the daily state for `day`, starting fresh missions when the day has changed */
export function dailyFor(daily: DailyState | null, day: string): DailyState {
  if (daily && daily.day === day) return daily;
  const missions = makeDailyMissions(day);
  return { day, missions, progress: missions.map(() => 0), claimed: missions.map(() => false) };
}

function runValue(kind: MissionKind, run: RunSnapshot) {
  switch (kind) {
    case 'distance':
      return run.score;
    case 'lettuceRun':
    case 'lettuceDay':
      return run.coins;
    case 'flights':
      return 1;
    case 'powerups':
      return run.powerups;
    case 'gates':
      return run.gates;
    case 'shieldSaves':
      return run.shieldSaves;
  }
}

/**
 * Adds a finished flight to the daily missions.
 * Returns the new daily state and how many missions this flight completed.
 */
export function addRunToDaily(daily: DailyState, run: RunSnapshot): { daily: DailyState; completed: number } {
  let completed = 0;
  const progress = daily.missions.map((m, i) => {
    const before = daily.progress[i];
    const value = runValue(m.kind, run);
    const after = Math.min(m.target, BEST_OF_ONE_FLIGHT.includes(m.kind) ? Math.max(before, value) : before + value);
    if (before < m.target && after >= m.target) completed++;
    return after;
  });
  return { daily: { ...daily, progress }, completed };
}

export function describeMission(m: Mission, t: Strings) {
  return t[`m_${m.kind}`].replace('{n}', String(m.target));
}

// ---------------------------------------------------------------- achievements

export type AchievementKind = 'best' | 'lettuce' | 'flights' | 'powerups' | 'gates' | 'shieldSaves' | 'items';

export type Achievement = { id: string; kind: AchievementKind; target: number; reward: number };

const ALL_ITEMS = ROCKETS.length + HATS.length;

const LADDERS: [AchievementKind, number[], number[]][] = [
  ['best', [100, 300, 600, 1000, 2000], [30, 60, 100, 150, 300]],
  ['lettuce', [100, 500, 1500, 5000], [30, 80, 150, 400]],
  ['flights', [10, 50, 200], [30, 80, 200]],
  ['powerups', [10, 50], [40, 120]],
  ['gates', [10, 50], [50, 150]],
  ['shieldSaves', [5, 25], [50, 150]],
  ['items', [5, 10, ALL_ITEMS], [50, 120, 500]],
];

export const ACHIEVEMENTS: Achievement[] = LADDERS.flatMap(([kind, targets, rewards]) =>
  targets.map((target, i) => ({ id: `${kind}-${target}`, kind, target, reward: rewards[i] })),
);

export function achievementProgress(a: Achievement, p: Progress) {
  switch (a.kind) {
    case 'best':
      return p.best;
    case 'lettuce':
      return p.totalLettuce;
    case 'flights':
      return p.runs;
    case 'powerups':
      return p.totalPowerups;
    case 'gates':
      return p.totalGates;
    case 'shieldSaves':
      return p.totalShieldSaves;
    case 'items':
      // the free rocket and "no hat" don't count
      return p.ownedSkins.length - 2;
  }
}

export function describeAchievement(a: Achievement, t: Strings) {
  return t[`a_${a.kind}`].replace('{n}', String(a.target));
}

/** How many rewards are waiting to be claimed (for the badge on the menu button) */
export function claimableCount(p: Progress, day: string) {
  const daily = dailyFor(p.daily, day);
  const dailyReady = daily.missions.filter((m, i) => !daily.claimed[i] && daily.progress[i] >= m.target).length;
  const achievementsReady = ACHIEVEMENTS.filter(
    (a) => !p.claimedAchievements.includes(a.id) && achievementProgress(a, p) >= a.target,
  ).length;
  return dailyReady + achievementsReady;
}
