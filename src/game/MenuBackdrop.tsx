// Animated background for the menu: scrolling garden + hovering snail.

import { Canvas, Picture, Skia, createPicture } from '@shopify/react-native-skia';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';

import { WORLD_HEIGHT } from './constants';
import { drawBackground, drawSnail } from './draw';
import type { SkinLook } from './skins';

type Props = { look: SkinLook };

export function MenuBackdrop({ look }: Props) {
  const { width, height } = useWindowDimensions();
  const unit = height / WORLD_HEIGHT;
  const worldWidth = width / unit;
  const time = useSharedValue(0);

  useFrameCallback((frame) => {
    'worklet';
    time.value += Math.min((frame.timeSincePreviousFrame ?? 16) / 1000, 1 / 30);
  });

  const picture = useDerivedValue(() => {
    const t = time.value;
    return createPicture((c) => {
      const p = Skia.Paint();
      p.setAntiAlias(true);
      c.scale(unit, unit);
      drawBackground(c, p, worldWidth, t * 18);
      c.save();
      c.translate(worldWidth * 0.17, 64 + Math.sin(t * 2.5) * 3);
      c.scale(1.5, 1.5);
      drawSnail(c, p, 0, 0, Math.sin(t * 2) * 5, t, 0.75 + 0.25 * Math.sin(t * 7), look, false);
      c.restore();
    });
  });

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
}
