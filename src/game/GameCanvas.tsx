// The game view: a Skia canvas + touch input + the 60 FPS loop.
// The loop runs on the UI thread (useFrameCallback), so React never slows it down.

import { Canvas, Group, Picture, Text, createPicture, matchFont } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { COLORS, WORLD_HEIGHT } from './constants';
import { drawGame } from './draw';
import { createGameState, stepGame } from './engine';

type Props = {
  rocketColor: string;
  holdToFlyText: string;
  onGameOver: (score: number, coins: number) => void;
};

const fontFamily = Platform.select({ ios: 'Helvetica', default: 'sans-serif' });

export function GameCanvas({ rocketColor, holdToFlyText, onGameOver }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const unit = height / WORLD_HEIGHT; // pixels per world unit
  const worldWidth = width / unit;
  const hudLeft = Math.max(insets.left, 16);
  const hudRight = Math.max(insets.right, 16);
  const coinIconX = worldWidth - (hudRight + 70) / unit;

  const state = useSharedValue(createGameState(worldWidth));
  const worldWidthSV = useSharedValue(worldWidth);
  useEffect(() => {
    worldWidthSV.value = worldWidth;
  }, [worldWidth, worldWidthSV]);

  // The game loop: runs once per screen refresh
  useFrameCallback((frame) => {
    'worklet';
    // dt = seconds since the last frame (capped, so a hiccup never teleports the snail)
    const dt = Math.min((frame.timeSincePreviousFrame ?? 16) / 1000, 1 / 30);
    const s = state.value;
    s.worldWidth = worldWidthSV.value;
    const ended = stepGame(s, dt);
    state.modify(); // tell the canvas that the state changed
    if (ended) {
      scheduleOnRN(onGameOver, s.score, s.coins);
    }
  });

  // Finger down = fly up, finger up = fall
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin(() => {
          'worklet';
          const s = state.value;
          if (s.phase === 'ready') s.phase = 'playing';
          s.holding = true;
        })
        .onFinalize(() => {
          'worklet';
          state.value.holding = false;
        }),
    [state],
  );

  // Draw the whole world as one picture each frame
  const picture = useDerivedValue(() => {
    const s = state.value;
    return createPicture((c) => {
      c.scale(unit, unit);
      drawGame(c, s, rocketColor, coinIconX);
    });
  });

  // Score / coins / hint text
  const font = useMemo(() => matchFont({ fontFamily, fontSize: 30, fontWeight: 'bold' }), []);
  const hintFont = useMemo(() => matchFont({ fontFamily, fontSize: 34, fontWeight: 'bold' }), []);
  const hintWidth = useMemo(() => hintFont.measureText(holdToFlyText).width, [hintFont, holdToFlyText]);

  const scoreText = useDerivedValue(() => `${state.value.score} m`);
  const coinText = useDerivedValue(() => `${state.value.coins}`);
  const hintOpacity = useDerivedValue(() => (state.value.phase === 'ready' ? 1 : 0));

  const coinTextX = (coinIconX + 5) * unit;
  const hudY = 8 * unit + 11;

  return (
    <GestureDetector gesture={gesture}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Picture picture={picture} />

        <Text x={hudLeft + 2} y={hudY + 2} text={scoreText} font={font} color={COLORS.hudShadow} />
        <Text x={hudLeft} y={hudY} text={scoreText} font={font} color={COLORS.hudText} />
        <Text x={coinTextX + 2} y={hudY + 2} text={coinText} font={font} color={COLORS.hudShadow} />
        <Text x={coinTextX} y={hudY} text={coinText} font={font} color={COLORS.hudText} />

        <Group opacity={hintOpacity}>
          <Text
            x={(width - hintWidth) / 2 + 2}
            y={height * 0.3 + 2}
            text={holdToFlyText}
            font={hintFont}
            color={COLORS.hudShadow}
          />
          <Text x={(width - hintWidth) / 2} y={height * 0.3} text={holdToFlyText} font={hintFont} color={COLORS.hudText} />
        </Group>
      </Canvas>
    </GestureDetector>
  );
}
