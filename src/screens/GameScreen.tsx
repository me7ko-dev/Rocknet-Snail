import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameCanvas } from '../game/GameCanvas';
import type { GameLabels } from '../game/draw';
import type { GameEvent } from '../game/engine';
import type { SkinLook } from '../game/skins';
import type { Strings } from '../i18n/strings';
import { haptics } from '../services/haptics';
import { sound } from '../services/sound';
import { AppText } from '../ui/AppText';
import { Button, RoundButton } from '../ui/Button';
import { LettuceIcon } from '../ui/LettuceIcon';
import { UI } from '../ui/theme';

export type RunResult = { score: number; coins: number; best: number; isNewBest: boolean };

type Props = {
  t: Strings;
  look: SkinLook;
  best: number;
  /** Saves the run and returns the (maybe new) record */
  onRunFinished: (score: number, coins: number) => RunResult;
  onMenu: () => void;
  onShop: () => void;
};

export function GameScreen({ t, look, best, onRunFinished, onMenu, onShop }: Props) {
  const insets = useSafeAreaInsets();
  // Changing runId re-creates the game canvas = a fresh run
  const [runId, setRunId] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);
  const [paused, setPaused] = useState(false);
  const finishRef = useRef(onRunFinished);
  useLayoutEffect(() => {
    finishRef.current = onRunFinished;
  });

  const labels: GameLabels = useMemo(
    () => ({ holdToFly: t.holdToFly, newBest: t.newBest, bestFlag: t.bestFlag, meters: t.meters }),
    [t],
  );

  const handleEvent = useCallback((event: GameEvent, score: number, coins: number) => {
    switch (event) {
      case 'start':
        sound.startThrust();
        break;
      case 'thrustOn':
        sound.setThrust(true);
        break;
      case 'thrustOff':
        sound.setThrust(false);
        break;
      case 'coin':
        sound.play('coin');
        haptics.coin();
        break;
      case 'best':
        sound.play('best');
        haptics.success();
        break;
      case 'crash':
        sound.stopThrust();
        sound.play('crash');
        haptics.crash();
        break;
      case 'over':
        setResult(finishRef.current(score, coins));
        break;
    }
  }, []);

  const playAgain = () => {
    setResult(null);
    setPaused(false);
    setRunId((id) => id + 1);
  };

  const pause = useCallback(() => {
    setPaused(true);
    sound.stopThrust();
  }, []);

  const resume = () => {
    setPaused(false);
    sound.startThrust();
  };

  // Leaving the app (call, home button...) pauses the game
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && !result) pause();
    });
    return () => sub.remove();
  }, [result, pause]);

  // Android back button: pause first, then go to the menu
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (result || paused) onMenu();
      else pause();
      return true;
    });
    return () => sub.remove();
  }, [result, paused, onMenu, pause]);

  // Stop the rocket hiss when leaving this screen
  useEffect(() => () => sound.stopThrust(), []);

  return (
    <View style={styles.root}>
      <GameCanvas key={runId} look={look} bestScore={best} labels={labels} paused={paused || !!result} onEvent={handleEvent} />

      {!result && !paused && (
        <View style={[styles.pauseButton, { top: Math.max(insets.top, 10) }]}>
          <RoundButton icon="pause" label={t.paused} onPress={pause} size={44} />
        </View>
      )}

      {paused && !result && (
        <Animated.View entering={FadeIn.duration(150)} style={styles.overlay}>
          <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.card}>
            <AppText weight="black" size={38} color={UI.blue}>
              {t.paused}
            </AppText>
            <View style={styles.buttons}>
              <Button size="medium" variant="blue" icon="home" label={t.menu} onPress={onMenu} />
              <Button size="big" variant="red" icon="play" label={t.resume} onPress={resume} />
            </View>
          </Animated.View>
        </Animated.View>
      )}

      {result && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.overlay}>
          <Animated.View entering={ZoomIn.springify().damping(13)} style={styles.card}>
            <AppText weight="black" size={34} color={UI.orange}>
              {t.gameOver}
            </AppText>
            <AppText weight="black" size={54} style={styles.score}>
              {result.score} {t.meters}
            </AppText>
            {result.isNewBest ? (
              <View style={styles.newBest}>
                <AppText weight="black" size={20} color="#FFFFFF">
                  ★ {t.newBest} ★
                </AppText>
              </View>
            ) : (
              <AppText size={20} color={UI.inkSoft}>
                {t.best}: {result.best} {t.meters}
              </AppText>
            )}
            <View style={styles.lettuceRow}>
              <LettuceIcon size={28} />
              <AppText weight="black" size={24} color={UI.greenDark}>
                +{result.coins}
              </AppText>
            </View>
            <View style={styles.buttons}>
              <RoundButton icon="home" label={t.menu} variant="blue" onPress={onMenu} />
              <Button size="big" variant="red" icon="retry" label={t.again} onPress={playAgain} />
              <RoundButton icon="cart" label={t.shop} variant="green" onPress={onShop} />
            </View>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#7CC8FF' },
  pauseButton: { position: 'absolute', alignSelf: 'center' },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: UI.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: UI.card,
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 34,
    alignItems: 'center',
    gap: 4,
    borderWidth: 6,
    borderColor: UI.yellow,
    minWidth: 340,
  },
  score: { lineHeight: 62 },
  newBest: { backgroundColor: UI.green, borderRadius: 16, paddingVertical: 3, paddingHorizontal: 14 },
  lettuceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 },
});
