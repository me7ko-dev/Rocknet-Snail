import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LANGUAGES, type Lang } from './src/i18n/strings';
import { GameScreen } from './src/screens/GameScreen';
import { StartScreen } from './src/screens/StartScreen';
import { ads } from './src/services/ads';
import { loadSave, writeSave, type SaveData } from './src/storage/save';

type Screen = 'start' | 'game';

export default function App() {
  const [save, setSave] = useState<SaveData | null>(null);
  const [screen, setScreen] = useState<Screen>('start');
  const saveRef = useRef<SaveData | null>(null);
  const runsPlayed = useRef(0);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    ads.init();
    loadSave().then((data) => {
      saveRef.current = data;
      setSave(data);
    });
  }, []);

  const updateSave = useCallback((change: Partial<SaveData>) => {
    if (!saveRef.current) return;
    const next = { ...saveRef.current, ...change };
    saveRef.current = next;
    setSave(next);
    writeSave(next);
  }, []);

  const onRunFinished = useCallback(
    (score: number, coins: number) => {
      const current = saveRef.current!;
      const isNewBest = score > current.best;
      const best = Math.max(score, current.best);
      updateSave({ best, coins: current.coins + coins });
      runsPlayed.current += 1;
      ads.onGameOver(runsPlayed.current);
      return { best, isNewBest };
    },
    [updateSave],
  );

  const onChangeLang = useCallback((lang: Lang) => updateSave({ lang }), [updateSave]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar hidden />
        {!save ? (
          <View style={styles.loading} />
        ) : screen === 'start' ? (
          <StartScreen save={save} t={LANGUAGES[save.lang]} onPlay={() => setScreen('game')} onChangeLang={onChangeLang} />
        ) : (
          <GameScreen
            t={LANGUAGES[save.lang]}
            rocketColor={save.rocketColor}
            onRunFinished={onRunFinished}
            onMenu={() => setScreen('start')}
          />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, backgroundColor: '#7CC8FF' },
});
