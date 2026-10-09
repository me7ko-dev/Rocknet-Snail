// Saves progress on the phone (record, coins, skins, language) with AsyncStorage.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_ROCKET_COLOR } from '../game/constants';
import type { Lang } from '../i18n/strings';

const KEY = 'rocket-snail/save-v1';

export type SaveData = {
  best: number;
  coins: number;
  lang: Lang;
  // Ready for the skin shop:
  ownedSkins: string[];
  rocketColor: string;
  hat: string | null;
};

export const DEFAULT_SAVE: SaveData = {
  best: 0,
  coins: 0,
  lang: 'en',
  ownedSkins: [],
  rocketColor: DEFAULT_ROCKET_COLOR,
  hat: null,
};

export async function loadSave(): Promise<SaveData> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_SAVE;
    // Merge with defaults, so new fields added in future versions get a value
    return { ...DEFAULT_SAVE, ...(JSON.parse(raw) as Partial<SaveData>) };
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
