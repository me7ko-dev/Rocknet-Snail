import { describe, expect, it } from '@jest/globals';

import { LANGUAGES } from '../../i18n/strings';
import { FREE_SKIN_IDS, HATS, ROCKETS, makeLook } from '../skins';

describe('shop items', () => {
  const all = [...ROCKETS, ...HATS];

  it('have unique ids', () => {
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
  });

  it('have a name in every language', () => {
    for (const skin of all) {
      for (const lang of Object.keys(LANGUAGES)) {
        expect(skin.name[lang as keyof typeof LANGUAGES]).toBeTruthy();
      }
    }
  });

  it('include a free rocket and "no hat"', () => {
    expect(FREE_SKIN_IDS).toContain(ROCKETS[0].id);
    expect(FREE_SKIN_IDS).toContain('none');
  });

  it('get more expensive further down the list', () => {
    for (const list of [ROCKETS, HATS]) {
      for (let i = 1; i < list.length; i++) expect(list[i].price).toBeGreaterThan(list[i - 1].price);
    }
  });

  it('fall back to the default look for unknown ids', () => {
    expect(makeLook('nope', 'nope')).toEqual(makeLook(ROCKETS[0].id, 'none'));
  });
});

describe('translations', () => {
  it('have every text in every language', () => {
    const keys = Object.keys(LANGUAGES.en).sort();
    for (const strings of Object.values(LANGUAGES)) {
      expect(Object.keys(strings).sort()).toEqual(keys);
      for (const value of Object.values(strings)) expect(value.trim()).not.toBe('');
    }
  });
});
