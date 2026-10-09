import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_SAVE, loadSave, sanitizeSave, writeSave } from '../save';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('sanitizeSave', () => {
  it('turns garbage into a fresh save', () => {
    expect(sanitizeSave(null)).toEqual(DEFAULT_SAVE);
    expect(sanitizeSave('nonsense')).toEqual(DEFAULT_SAVE);
    expect(sanitizeSave({ best: -5, coins: 'lots', lang: 'xx', music: 'yes' })).toEqual(DEFAULT_SAVE);
  });

  it('keeps progress from the first version of the game', () => {
    const old = { best: 321, coins: 45, lang: 'bg', ownedSkins: [], rocketColor: '#FF5A5F', hat: null };
    const s = sanitizeSave(old);
    expect(s.best).toBe(321);
    expect(s.coins).toBe(45);
    expect(s.lang).toBe('bg');
    expect(s.rocket).toBe(DEFAULT_SAVE.rocket);
    expect(s.hat).toBe('none');
  });

  it('never lets the player wear something they do not own', () => {
    const s = sanitizeSave({ ownedSkins: ['party'], hat: 'crown', rocket: 'rocket-gold' });
    expect(s.hat).toBe('none');
    expect(s.rocket).toBe(DEFAULT_SAVE.rocket);
    expect(s.ownedSkins).toContain('party');
  });

  it('keeps owned items that are being worn', () => {
    const s = sanitizeSave({ ownedSkins: ['crown', 'rocket-gold'], hat: 'crown', rocket: 'rocket-gold' });
    expect(s.hat).toBe('crown');
    expect(s.rocket).toBe('rocket-gold');
  });
});

describe('loading and saving', () => {
  beforeEach(() => AsyncStorage.clear());

  it('starts with a fresh save', async () => {
    expect(await loadSave()).toEqual(DEFAULT_SAVE);
  });

  it('remembers what was saved', async () => {
    const data = { ...DEFAULT_SAVE, best: 99, coins: 12, ownedSkins: [...DEFAULT_SAVE.ownedSkins, 'party'], hat: 'party' };
    await writeSave(data);
    expect(await loadSave()).toEqual(data);
  });
});
