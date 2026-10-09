import { StyleSheet, View } from 'react-native';

import { COLORS } from '../game/constants';

/**
 * The lettuce coin for menus, built from plain views (cheaper than a drawing canvas,
 * which matters because the shop shows many of them). Looks like the one in the game.
 */
export function LettuceIcon({ size = 24 }: { size?: number }) {
  const r = size / 2;
  const bump = size * 0.3;
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {Array.from({ length: 8 }, (_, k) => {
        const a = (k / 8) * Math.PI * 2;
        return (
          <View
            key={k}
            style={[
              styles.dot,
              {
                width: bump,
                height: bump,
                borderRadius: bump / 2,
                left: r + Math.cos(a) * r * 0.66 - bump / 2,
                top: r + Math.sin(a) * r * 0.66 - bump / 2,
              },
            ]}
          />
        );
      })}
      <View style={[styles.leaf, { width: size * 0.74, height: size * 0.74, borderRadius: size, left: size * 0.13, top: size * 0.13 }]} />
      <View style={[styles.inner, { width: size * 0.42, height: size * 0.42, borderRadius: size, left: size * 0.29, top: size * 0.29 }]} />
      <View style={[styles.vein, { width: Math.max(1, size * 0.07), height: size * 0.5, left: r - size * 0.035, top: size * 0.28 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { position: 'absolute', backgroundColor: COLORS.lettuceDark },
  leaf: { position: 'absolute', backgroundColor: COLORS.lettuce },
  inner: { position: 'absolute', backgroundColor: COLORS.lettuceLight },
  vein: { position: 'absolute', backgroundColor: COLORS.lettuceDark, borderRadius: 2 },
});
