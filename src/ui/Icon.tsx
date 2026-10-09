// Small icons drawn with code (no image files or icon fonts).

import { Canvas, Circle, Group, Path, RoundedRect, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';

export type IconName = 'pause' | 'play' | 'gear' | 'back' | 'home' | 'cart' | 'retry';

type Props = { name: IconName; size?: number; color?: string };

function svg(d: string) {
  return Skia.Path.MakeFromSVGString(d) ?? Skia.Path.Make();
}

/** All icons are designed on a 24×24 grid and scaled to `size`. */
export function Icon({ name, size = 24, color = '#FFFFFF' }: Props) {
  const scale = size / 24;
  const paths = useMemo(
    () => ({
      play: svg('M8 5.5 L19 12 L8 18.5 Z'),
      back: svg('M14.5 5 L7.5 12 L14.5 19'),
      home: svg('M4 11.5 L12 4.5 L20 11.5 M6.5 10 L6.5 19.5 L17.5 19.5 L17.5 10'),
      cart: svg('M3 5 L6 5 L8 15 L18 15 L20 8 L7 8'),
      retry: svg('M18.5 12 A6.5 6.5 0 1 1 15.5 6.4 M15.5 2.8 L15.5 6.6 L19.3 6.6'),
    }),
    [],
  );

  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Group transform={[{ scale }]}>
        {name === 'pause' && (
          <>
            <RoundedRect x={6} y={5} width={4} height={14} r={1.5} color={color} />
            <RoundedRect x={14} y={5} width={4} height={14} r={1.5} color={color} />
          </>
        )}
        {name === 'play' && <Path path={paths.play} color={color} strokeJoin="round" />}
        {name === 'gear' && (
          <Group color={color}>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <Group key={deg} transform={[{ rotate: (deg * Math.PI) / 180 }]} origin={{ x: 12, y: 12 }}>
                <RoundedRect x={10.1} y={1.6} width={3.8} height={5} r={1.2} />
              </Group>
            ))}
            <Circle cx={12} cy={12} r={5.6} style="stroke" strokeWidth={3.8} />
          </Group>
        )}
        {(name === 'back' || name === 'home' || name === 'cart' || name === 'retry') && (
          <Path path={paths[name]} color={color} style="stroke" strokeWidth={3} strokeCap="round" strokeJoin="round" />
        )}
        {name === 'cart' && (
          <>
            <Circle cx={9} cy={19} r={1.8} color={color} />
            <Circle cx={17} cy={19} r={1.8} color={color} />
          </>
        )}
      </Group>
    </Canvas>
  );
}
