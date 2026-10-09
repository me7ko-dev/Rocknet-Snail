// Saves progress on the phone (record, coins, skins, settings) with AsyncStorage.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_HAT_ID, DEFAULT_ROCKET_ID, FREE_SKIN_IDS, findHat, findRocket } from '../game/skins';
import { LANGUAGES, type Lang } from '../i18n/strings';

const KEY = 'rocket-snail/save-v1';

export type SaveData = {
  best: number;
  coins: number;
  lang: Lang;
  ownedSkins: string[];
  rocket: string; // id of the rocket being used
  hat: string; // id of the hat being worn
  music: boolean;
  sfx: boolean;
  haptics: boolean;
  runs: number;
  totalLettuce: number;
};

export const DEFAULT_SAVE: SaveData = {
  best: 0,
  coins: 0,
  lang: 'en',
  ownedSkins: FREE_SKIN_IDS,
  rocket: DEFAULT_ROCKET_ID,
  hat: DEFAULT_HAT_ID,
  music: true,
  sfx: true,
  haptics: true,
  runs: 0,
  totalLettuce: 0,
};

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';

/** Accepts anything (old versions, broken data) and always returns a valid save. */
export function sanitizeSave(raw: unknown): SaveData {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const owned = Array.isArray(r.ownedSkins) ? r.ownedSkins.filter((s): s is string => typeof s === 'string') : [];
  const ownedSkins = Array.from(new Set([...FREE_SKIN_IDS, ...owned]));
  const rocket = typeof r.rocket === 'string' && ownedSkins.includes(r.rocket) ? findRocket(r.rocket).id : DEFAULT_ROCKET_ID;
  const hat = typeof r.hat === 'string' && ownedSkins.includes(r.hat) ? findHat(r.hat).id : DEFAULT_HAT_ID;
  return {
    best: isNum(r.best) ? Math.floor(r.best) : 0,
    coins: isNum(r.coins) ? Math.floor(r.coins) : 0,
    lang: typeof r.lang === 'string' && r.lang in LANGUAGES ? (r.lang as Lang) : DEFAULT_SAVE.lang,
    ownedSkins,
    rocket,
    hat,
    music: isBool(r.music) ? r.music : true,
    sfx: isBool(r.sfx) ? r.sfx : true,
    haptics: isBool(r.haptics) ? r.haptics : true,
    runs: isNum(r.runs) ? Math.floor(r.runs) : 0,
    totalLettuce: isNum(r.totalLettuce) ? Math.floor(r.totalLettuce) : 0,
  };
}

export async function loadSave(): Promise<SaveData> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return sanitizeSave(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_SAVE;
  }
}

export async function writeSave(data: SaveData): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Saving failed (e.g. phone storage full). The game keeps working.
  }
}
