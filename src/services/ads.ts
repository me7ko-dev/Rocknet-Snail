// Placeholder for ads. Right now it does nothing.
// Later: install react-native-google-mobile-ads (needs a development build,
// it does not work in Expo Go) and fill in these functions.
// The rest of the game already calls them at the right moments.

export const ads = {
  async init(): Promise<void> {},

  /** Called after every game over. Could show an interstitial every few runs. */
  async onGameOver(_runsPlayed: number): Promise<void> {},

  /** "Watch an ad to get a reward". Returns true if the player earned it. */
  async showRewarded(): Promise<boolean> {
    return false;
  },
};
