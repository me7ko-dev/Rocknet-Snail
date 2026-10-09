// Plays sound effects, the rocket hiss and the background music (expo-audio).
// Sounds are made by scripts/make-sounds.mjs. Any audio error is ignored,
// so sound problems can never break the game.

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

const EFFECTS = {
  coin: require('../../assets/sounds/coin.wav'),
  crash: require('../../assets/sounds/crash.wav'),
  best: require('../../assets/sounds/best.wav'),
  buy: require('../../assets/sounds/buy.wav'),
  tap: require('../../assets/sounds/tap.wav'),
  nope: require('../../assets/sounds/nope.wav'),
};

export type Effect = keyof typeof EFFECTS;

// How many copies of each sound can play at the same time
const POOL: Partial<Record<Effect, number>> = { coin: 4, tap: 2 };

const MUSIC_VOLUME = 0.35;
const THRUST_VOLUME = 0.4;

let ready = false;
let effectsOn = true;
let musicOn = true;
let appActive = true;
let musicWanted = false; // is a screen asking for music right now?
const pools: Partial<Record<Effect, { players: AudioPlayer[]; next: number }>> = {};
let music: AudioPlayer | null = null;
let thrust: AudioPlayer | null = null;

function safe(fn: () => void) {
  try {
    fn();
  } catch {
    // ignore audio errors
  }
}

function updateMusic() {
  safe(() => {
    if (!music) return;
    if (musicOn && musicWanted && appActive) {
      if (!music.playing) music.play();
    } else if (music.playing) {
      music.pause();
    }
  });
}

export const sound = {
  async init() {
    if (ready) return;
    try {
      // Respect the phone's silent switch and let the player's own music keep playing
      await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false });
    } catch {
      // older devices: keep defaults
    }
    safe(() => {
      for (const key of Object.keys(EFFECTS) as Effect[]) {
        const count = POOL[key] ?? 1;
        pools[key] = { players: Array.from({ length: count }, () => createAudioPlayer(EFFECTS[key])), next: 0 };
      }
      music = createAudioPlayer(require('../../assets/sounds/music.wav'));
      music.loop = true;
      music.volume = MUSIC_VOLUME;
      thrust = createAudioPlayer(require('../../assets/sounds/thrust.wav'));
      thrust.loop = true;
      thrust.volume = 0;
    });
    ready = true;
    updateMusic();
  },

  play(effect: Effect) {
    if (!effectsOn || !appActive) return;
    const pool = pools[effect];
    if (!pool) return;
    safe(() => {
      const player = pool.players[pool.next];
      pool.next = (pool.next + 1) % pool.players.length;
      if (player.currentTime > 0) {
        // rewind first (on iOS seeking is asynchronous), then play
        player
          .seekTo(0)
          .then(() => player.play())
          .catch(() => {});
      } else {
        player.play();
      }
    });
  },

  /** Rocket hiss: starts silent with a run, gets loud while the finger is down */
  startThrust() {
    safe(() => {
      if (!thrust || !effectsOn) return;
      thrust.volume = 0;
      if (!thrust.playing) thrust.play();
    });
  },
  setThrust(on: boolean) {
    safe(() => {
      if (!thrust) return;
      const loud = on && effectsOn && appActive;
      thrust.volume = loud ? THRUST_VOLUME : 0;
      if (loud && !thrust.playing) thrust.play();
    });
  },
  stopThrust() {
    safe(() => {
      if (!thrust) return;
      thrust.volume = 0;
      if (thrust.playing) thrust.pause();
    });
  },

  setEffectsEnabled(on: boolean) {
    effectsOn = on;
    if (!on) sound.stopThrust();
  },
  setMusicEnabled(on: boolean) {
    musicOn = on;
    updateMusic();
  },
  /** Screens call this to say whether music should be playing */
  wantMusic(on: boolean) {
    musicWanted = on;
    updateMusic();
  },
  /** Called when the app goes to the background / comes back */
  setAppActive(active: boolean) {
    appActive = active;
    if (!active) sound.stopThrust();
    updateMusic();
  },
};
