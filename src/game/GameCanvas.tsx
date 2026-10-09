// The game view: a Skia canvas + touch input + the 60 FPS loop.
// The loop runs on the UI thread (useFrameCallback), so React never slows it down.
// Things React needs to know about (coins, crash, game over...) are sent as events.

import { Nunito_900Black } from '@expo-google-fonts/nunito';
import { Canvas, Picture, createPicture, useFont } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { SNAIL_X, WORLD_HEIGHT } from './constants';
import { drawGame, type GameFonts, type GameLabels, type ScreenLayout } from './draw';
import { createGameState, pressDown, pressUp, stepGame, takeEvents, type GameEvent } from './engine';
import type { SkinLook } from './skins';

/** Events from the game engine, plus 'paused' (a snapshot of score and coins when pausing) */
export type CanvasEvent = GameEvent | 'paused';

type Props = {
  look: SkinLook;
  bestScore: number;
  labels: GameLabels;
  paused: boolean;
  onEvent: (event: CanvasEvent, score: number, coins: number) => void;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function GameCanvas({ look, bestScore, labels, paused, onEvent }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const unit = height / WORLD_HEIGHT; // pixels per world unit
  const worldWidth = width / unit;
  const layout: ScreenLayout = useMemo(
    () => ({ unit, width, height, safeLeft: Math.max(insets.left, 16) + 6, safeRight: Math.max(insets.right, 16) + 6 }),
    [unit, width, height, insets.left, insets.right],
  );

  // Font sizes follow the screen height, so phones and tablets look the same
  const hud = useFont(Nunito_900Black, Math.round(clamp(height * 0.075, 22, 60)));
  const small = useFont(Nunito_900Black, Math.round(clamp(height * 0.05, 16, 40)));
  const big = useFont(Nunito_900Black, Math.round(clamp(height * 0.09, 26, 72)));
  const fonts: GameFonts | null = useMemo(() => (hud && small && big ? { hud, small, big } : null), [hud, small, big]);

  // On phones with a notch / Dynamic Island on the left, the snail flies a bit further right
  const snailX = SNAIL_X + Math.max(0, insets.left - 12) / unit;
  // bestScore and snailX are read only once, when the run starts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const state = useSharedValue(useMemo(() => createGameState(worldWidth, bestScore, snailX), []));
  const worldWidthSV = useSharedValue(worldWidth);
  const pausedSV = useSharedValue(paused);
  useEffect(() => {
    worldWidthSV.set(worldWidth);
  }, [worldWidth, worldWidthSV]);
  useEffect(() => {
    pausedSV.set(paused);
    if (paused) {
      scheduleOnUI(() => {
        'worklet';
        const s = state.value;
        pressUp(s);
        scheduleOnRN(onEvent, 'paused', s.score, s.coins);
      });
    }
  }, [paused, pausedSV, state, onEvent]);

  // The game loop: runs once per screen refresh
  useFrameCallback((frame) => {
    'worklet';
    if (pausedSV.value) return;
    // dt = seconds since the last frame (capped, so a hiccup never teleports the snail)
    const dt = Math.min((frame.timeSincePreviousFrame ?? 16) / 1000, 1 / 30);
    const s = state.value;
    stepGame(s, dt, worldWidthSV.value);
    const events = takeEvents(s);
    for (let i = 0; i < events.length; i++) {
      scheduleOnRN(onEvent, events[i], s.score, s.coins);
    }
    state.modify(); // tell the canvas that the state changed
  });

  // Finger down = fly up, finger up = fall
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin(() => {
          'worklet';
          if (!pausedSV.value) pressDown(state.value);
        })
        .onFinalize(() => {
          'worklet';
          pressUp(state.value);
        }),
    [state, pausedSV],
  );

  // Draw the whole world as one picture each frame
  const picture = useDerivedValue(() => {
    const s = state.value;
    return createPicture((c) => drawGame(c, s, look, layout, labels, fonts));
  });

  return (
    <GestureDetector gesture={gesture}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Picture picture={picture} />
      </Canvas>
    </GestureDetector>
  );
}
