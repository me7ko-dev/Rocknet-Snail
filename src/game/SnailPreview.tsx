// A small animated window with the snail hovering in the sky (used in the shop).

import { Canvas, Picture, Skia, TileMode, createPicture } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';

import { drawSnail } from './draw';
import type { SkinLook } from './skins';

type Props = { look: SkinLook; style?: StyleProp<ViewStyle> };

export function SnailPreview({ look, style }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const time = useSharedValue(0);

  useFrameCallback((frame) => {
    'worklet';
    time.value += Math.min((frame.timeSincePreviousFrame ?? 16) / 1000, 1 / 30);
  });

  const { width, height } = size;
  const picture = useDerivedValue(() => {
    const t = time.value;
    return createPicture((c) => {
      const p = Skia.Paint();
      p.setAntiAlias(true);
      p.setShader(
        Skia.Shader.MakeLinearGradient(
          Skia.Point(0, 0),
          Skia.Point(0, height),
          [Skia.Color('#8FD3FF'), Skia.Color('#E6F7FF')],
          null,
          TileMode.Clamp,
        ),
      );
      c.drawRect(Skia.XYWHRect(0, 0, width, height), p);
      p.setShader(null);
      // soft "ground" shadow under the snail
      p.setColor(Skia.Color('#2B3A55'));
      p.setAlphaf(0.12);
      c.drawOval(Skia.XYWHRect(width * 0.3, height * 0.8, width * 0.4, height * 0.07), p);
      // the snail is about 30 x 24 units big
      const k = Math.min(width / 34, height / 30);
      c.translate(width / 2 + 1 * k, height * 0.66 + Math.sin(t * 2.4) * k * 1.2);
      c.scale(k, k);
      drawSnail(c, p, 0, 0, Math.sin(t * 1.8) * 4, t, 0.7 + 0.2 * Math.sin(t * 6), look, false);
    });
  });

  const onLayout = (e: LayoutChangeEvent) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });

  return (
    <View style={[styles.box, style]} onLayout={onLayout}>
      {width > 0 && (
        <Canvas style={StyleSheet.absoluteFill}>
          <Picture picture={picture} />
        </Canvas>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
});
