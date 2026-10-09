// Little vibrations for coins, crashes and purchases (expo-haptics).

import * as Haptics from 'expo-haptics';

let enabled = true;

function run(fn: () => Promise<void>) {
  if (!enabled) return;
  fn().catch(() => {
    // some devices have no vibration motor
  });
}

export const haptics = {
  setEnabled(on: boolean) {
    enabled = on;
  },
  coin: () => run(() => Haptics.selectionAsync()),
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  crash: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
