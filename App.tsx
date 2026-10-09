import { Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black, useFonts } from '@expo-google-fonts/nunito';
import { NavigationBar } from 'expo-navigation-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { makeLook, type Skin } from './src/game/skins';
import { LANGUAGES } from './src/i18n/strings';
import { GameScreen, type RunResult } from './src/screens/GameScreen';
import { ShopScreen } from './src/screens/ShopScreen';
import { StartScreen } from './src/screens/StartScreen';
import { ads } from './src/services/ads';
import { haptics } from './src/services/haptics';
import { purchases } from './src/services/purchases';
import { sound } from './src/services/sound';
import { loadSave, writeSave, type SaveData } from './src/storage/save';

SplashScreen.preventAutoHideAsync().catch(() => {});

type Screen = 'start' | 'game' | 'shop';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black });
  const [save, setSave] = useState<SaveData | null>(null);
  const [screen, setScreen] = useState<Screen>('start');
  const saveRef = useRef<SaveData | null>(null);

  // Start-up: lock landscape, prepare sound, load the saved progress
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    sound.init();
    ads.init();
    purchases.init();
    loadSave().then((data) => {
      saveRef.current = data;
      setSave(data);
    });
  }, []);

  const ready = (fontsLoaded || !!fontError) && !!save;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Keep the sound and vibration services in sync with the settings
  useEffect(() => {
    if (!save) return;
    sound.setMusicEnabled(save.music);
    sound.setEffectsEnabled(save.sfx);
    haptics.setEnabled(save.haptics);
  }, [save]);

  useEffect(() => {
    sound.wantMusic(ready);
    const sub = AppState.addEventListener('change', (state) => sound.setAppActive(state === 'active'));
    return () => sub.remove();
  }, [ready]);

  const updateSave = useCallback((change: Partial<SaveData>) => {
    if (!saveRef.current) return;
    const next = { ...saveRef.current, ...change };
    saveRef.current = next;
    setSave(next);
    writeSave(next);
  }, []);

  const onRunFinished = useCallback(
    (score: number, coins: number): RunResult => {
      const current = saveRef.current!;
      const isNewBest = score > current.best;
      const best = Math.max(score, current.best);
      const runs = current.runs + 1;
      updateSave({ best, coins: current.coins + coins, runs, totalLettuce: current.totalLettuce + coins });
      ads.onGameOver(runs);
      return { score, coins, best, isNewBest };
    },
    [updateSave],
  );

  const onBuy = useCallback(
    (skin: Skin) => {
      const current = saveRef.current!;
      if (current.ownedSkins.includes(skin.id)) return true;
      if (current.coins < skin.price) return false;
      updateSave({
        coins: current.coins - skin.price,
        ownedSkins: [...current.ownedSkins, skin.id],
        ...(skin.kind === 'rocket' ? { rocket: skin.id } : { hat: skin.id }),
      });
      return true;
    },
    [updateSave],
  );

  const onWear = useCallback(
    (skin: Skin) => updateSave(skin.kind === 'rocket' ? { rocket: skin.id } : { hat: skin.id }),
    [updateSave],
  );

  const goMenu = useCallback(() => setScreen('start'), []);
  const goShop = useCallback(() => setScreen('shop'), []);

  const t = save ? LANGUAGES[save.lang] : LANGUAGES.en;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar hidden />
        <NavigationBar hidden />
        {!ready ? (
          <View style={styles.loading} />
        ) : screen === 'start' ? (
          <StartScreen save={save} t={t} onPlay={() => setScreen('game')} onShop={goShop} onChange={updateSave} />
        ) : screen === 'shop' ? (
          <ShopScreen save={save} t={t} lang={save.lang} onBuy={onBuy} onWear={onWear} onBack={goMenu} />
        ) : (
          <GameScreen
            t={t}
            look={makeLook(save.rocket, save.hat)}
            best={save.best}
            onRunFinished={onRunFinished}
            onMenu={goMenu}
            onShop={goShop}
          />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#7CC8FF' },
  loading: { flex: 1, backgroundColor: '#7CC8FF' },
});
