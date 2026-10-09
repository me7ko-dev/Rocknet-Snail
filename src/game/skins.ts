// Everything the player can buy in the shop with lettuce.
// To add a new item, add a line here (and, for a hat, a drawing in draw.ts).

import type { Lang } from '../i18n/strings';

export type RocketPattern = 'plain' | 'stripes' | 'gold' | 'rainbow';

/** What the drawing code needs to know about the current look. Plain data, safe for worklets. */
export type SkinLook = {
  rocketColor: string;
  rocketPattern: RocketPattern;
  hat: HatId;
};

export type HatId = 'none' | 'party' | 'flower' | 'cap' | 'tophat' | 'viking' | 'crown' | 'propeller';

type Name = Record<Lang, string>;

export type RocketSkin = {
  id: string;
  kind: 'rocket';
  name: Name;
  price: number;
  color: string;
  pattern: RocketPattern;
};

export type HatSkin = {
  id: HatId;
  kind: 'hat';
  name: Name;
  price: number;
};

export type Skin = RocketSkin | HatSkin;

export const ROCKETS: RocketSkin[] = [
  { id: 'rocket-classic', kind: 'rocket', name: { en: 'Classic', bg: 'Класика' }, price: 0, color: '#FF5A5F', pattern: 'plain' },
  { id: 'rocket-sky', kind: 'rocket', name: { en: 'Sky', bg: 'Небе' }, price: 40, color: '#4DA3FF', pattern: 'plain' },
  { id: 'rocket-mint', kind: 'rocket', name: { en: 'Mint', bg: 'Мента' }, price: 60, color: '#3DD6A3', pattern: 'plain' },
  { id: 'rocket-grape', kind: 'rocket', name: { en: 'Grape', bg: 'Грозде' }, price: 90, color: '#9B6BFF', pattern: 'plain' },
  { id: 'rocket-sunny', kind: 'rocket', name: { en: 'Sunny', bg: 'Слънце' }, price: 120, color: '#FFC23C', pattern: 'plain' },
  { id: 'rocket-bubblegum', kind: 'rocket', name: { en: 'Bubblegum', bg: 'Дъвка' }, price: 160, color: '#FF7EC8', pattern: 'plain' },
  { id: 'rocket-candy', kind: 'rocket', name: { en: 'Candy', bg: 'Бонбон' }, price: 250, color: '#FF5A5F', pattern: 'stripes' },
  { id: 'rocket-gold', kind: 'rocket', name: { en: 'Gold', bg: 'Злато' }, price: 500, color: '#F5C542', pattern: 'gold' },
  { id: 'rocket-rainbow', kind: 'rocket', name: { en: 'Rainbow', bg: 'Дъга' }, price: 900, color: '#FF5A5F', pattern: 'rainbow' },
];

export const HATS: HatSkin[] = [
  { id: 'none', kind: 'hat', name: { en: 'No hat', bg: 'Без шапка' }, price: 0 },
  { id: 'party', kind: 'hat', name: { en: 'Party', bg: 'Парти' }, price: 50 },
  { id: 'flower', kind: 'hat', name: { en: 'Flower', bg: 'Цвете' }, price: 80 },
  { id: 'cap', kind: 'hat', name: { en: 'Cap', bg: 'Шапка' }, price: 120 },
  { id: 'tophat', kind: 'hat', name: { en: 'Top hat', bg: 'Цилиндър' }, price: 200 },
  { id: 'viking', kind: 'hat', name: { en: 'Viking', bg: 'Викинг' }, price: 300 },
  { id: 'crown', kind: 'hat', name: { en: 'Crown', bg: 'Корона' }, price: 450 },
  { id: 'propeller', kind: 'hat', name: { en: 'Propeller', bg: 'Перка' }, price: 700 },
];

export const DEFAULT_ROCKET_ID = ROCKETS[0].id;
export const DEFAULT_HAT_ID: HatId = 'none';

/** Items that are owned from the start */
export const FREE_SKIN_IDS = [...ROCKETS, ...HATS].filter((s) => s.price === 0).map((s) => s.id);

export function findRocket(id: string): RocketSkin {
  return ROCKETS.find((r) => r.id === id) ?? ROCKETS[0];
}

export function findHat(id: string): HatSkin {
  return HATS.find((h) => h.id === id) ?? HATS[0];
}

export function makeLook(rocketId: string, hatId: string): SkinLook {
  const rocket = findRocket(rocketId);
  return { rocketColor: rocket.color, rocketPattern: rocket.pattern, hat: findHat(hatId).id };
}
