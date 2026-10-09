// Animated background for the menu screens: scrolling garden + hovering snail.

import { Canvas, Picture, Skia, createPicture } from '@shopify/react-native-skia';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';

import { WORLD_HEIGHT } from './constants';
import { drawBackground, drawSnail } from './draw';

type Props = { rocketColor: string };

export function MenuBackdrop({ rocketColor }: Props) {
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
      drawBackground(c, p, worldWidth, t * 20);
      drawSnail(c, p, worldWidth * 0.18, 66 + Math.sin(t * 2.5) * 3, Math.sin(t * 2) * 5, t, 0.8, rocketColor, false);
    });
  });

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Picture picture={picture} />
    </Canvas>
  );
}
