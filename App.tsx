import { Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black, useFonts } from '@expo-google-fonts/nunito';
import { NavigationBar } from 'expo-navigation-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { RunSnapshot } from './src/game/engine';
import { ACHIEVEMENTS, achievementProgress, addRunToDaily, dailyFor, dayKey } from './src/game/missions';
import { makeLook, type Skin } from './src/game/skins';
import { LANGUAGES } from './src/i18n/strings';
import { GameScreen, type RunResult } from './src/screens/GameScreen';
import { MissionsScreen } from './src/screens/MissionsScreen';
import { ShopScreen } from './src/screens/ShopScreen';
import { StartScreen } from './src/screens/StartScreen';
import { ads } from './src/services/ads';
import { haptics } from './src/services/haptics';
import { purchases } from './src/services/purchases';
import { sound } from './src/services/sound';
import { loadSave, writeSave, type SaveData } from './src/storage/save';

SplashScreen.preventAutoHideAsync().catch(() => {});

type Screen = 'start' | 'game' | 'shop' | 'missions';

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
    (run: RunSnapshot): RunResult => {
      const current = saveRef.current!;
      const isNewBest = run.score > current.best;
      const best = Math.max(run.score, current.best);
      const runs = current.runs + 1;
      const { daily, completed } = addRunToDaily(dailyFor(current.daily, dayKey(new Date())), run);
      updateSave({
        best,
        coins: current.coins + run.coins,
        runs,
        totalLettuce: current.totalLettuce + run.coins,
        totalPowerups: current.totalPowerups + run.powerups,
        totalGates: current.totalGates + run.gates,
        totalShieldSaves: current.totalShieldSaves + run.shieldSaves,
        daily,
      });
      ads.onGameOver(runs);
      return { score: run.score, coins: run.coins, best, isNewBest, missionsDone: completed };
    },
    [updateSave],
  );

  const onClaimMission = useCallback(
    (index: number) => {
      const current = saveRef.current!;
      const daily = dailyFor(current.daily, dayKey(new Date()));
      const mission = daily.missions[index];
      if (!mission || daily.claimed[index] || daily.progress[index] < mission.target) return;
      updateSave({
        coins: current.coins + mission.reward,
        daily: { ...daily, claimed: daily.claimed.map((c, i) => c || i === index) },
      });
    },
    [updateSave],
  );

  const onClaimAchievement = useCallback(
    (id: string) => {
      const current = saveRef.current!;
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (!a || current.claimedAchievements.includes(id) || achievementProgress(a, current) < a.target) return;
      updateSave({ coins: current.coins + a.reward, claimedAchievements: [...current.claimedAchievements, id] });
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
  const goMissions = useCallback(() => setScreen('missions'), []);

  const t = save ? LANGUAGES[save.lang] : LANGUAGES.en;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar hidden />
        <NavigationBar hidden />
        {!ready ? (
          <View style={styles.loading} />
        ) : screen === 'start' ? (
          <StartScreen
            save={save}
            t={t}
            onPlay={() => setScreen('game')}
            onShop={goShop}
            onMissions={goMissions}
            onChange={updateSave}
          />
        ) : screen === 'missions' ? (
          <MissionsScreen
            save={save}
            t={t}
            onClaimMission={onClaimMission}
            onClaimAchievement={onClaimAchievement}
            onBack={goMenu}
          />
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
