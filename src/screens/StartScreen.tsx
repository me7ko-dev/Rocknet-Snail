import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, ZoomIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MenuBackdrop } from '../game/MenuBackdrop';
import { makeLook } from '../game/skins';
import { LANGUAGE_NAMES, LANGUAGES, type Lang, type Strings } from '../i18n/strings';
import { sound } from '../services/sound';
import type { SaveData } from '../storage/save';
import { AppText } from '../ui/AppText';
import { Button, RoundButton } from '../ui/Button';
import { LettuceIcon } from '../ui/LettuceIcon';
import { OutlinedTitle } from '../ui/OutlinedTitle';
import { Toggle } from '../ui/Toggle';
import { UI } from '../ui/theme';

type Props = {
  save: SaveData;
  t: Strings;
  onPlay: () => void;
  onShop: () => void;
  onChange: (change: Partial<SaveData>) => void;
};

export function StartScreen({ save, t, onPlay, onShop, onChange }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  // The title gently bobs up and down
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [bob]);
  const titleStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value * -6 }, { rotate: `${(bob.value - 0.5) * 3}deg` }] }));

  useEffect(() => {
    if (!settingsOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSettingsOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [settingsOpen]);

  return (
    <View style={styles.root}>
      <MenuBackdrop look={makeLook(save.rocket, save.hat)} />
      <SafeAreaView style={styles.content}>
        <View style={styles.topRow}>
          <RoundButton icon="gear" label={t.settings} onPress={() => setSettingsOpen(true)} size={44} />
          <View style={styles.badges}>
            <View style={styles.badge}>
              <AppText size={18}>
                {t.best}: {save.best} {t.meters}
              </AppText>
            </View>
            <View style={styles.badge}>
              <LettuceIcon size={24} />
              <AppText weight="black" size={18}>
                {save.coins}
              </AppText>
            </View>
          </View>
        </View>

        <View style={styles.center}>
          <Animated.View style={titleStyle}>
            <OutlinedTitle text={t.title} size={56} />
          </Animated.View>
          <AppText size={18} color={UI.ink} style={styles.tagline}>
            {t.tagline}
          </AppText>
          <Button size="big" icon="play" label={t.play} onPress={onPlay} />
          <Button size="medium" variant="green" icon="cart" label={t.shop} onPress={onShop} />
        </View>
      </SafeAreaView>

      {settingsOpen && (
        <SettingsPanel save={save} t={t} onChange={onChange} onClose={() => setSettingsOpen(false)} />
      )}
    </View>
  );
}

type SettingsProps = { save: SaveData; t: Strings; onChange: (change: Partial<SaveData>) => void; onClose: () => void };

function SettingsPanel({ save, t, onChange, onClose }: SettingsProps) {
  const langs = Object.keys(LANGUAGES) as Lang[];
  const version = Constants.expoConfig?.version ?? '';
  return (
    <Animated.View entering={FadeIn.duration(150)} style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t.close} />
      <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.panel}>
        <AppText weight="black" size={30} color={UI.blue} style={styles.panelTitle}>
          {t.settings}
        </AppText>
        <View style={styles.panelBody}>
          <View style={styles.column}>
            <Toggle label={t.music} value={save.music} onChange={(music) => onChange({ music })} />
            <Toggle label={t.sounds} value={save.sfx} onChange={(sfx) => onChange({ sfx })} />
            <Toggle label={t.vibration} value={save.haptics} onChange={(haptics) => onChange({ haptics })} />
          </View>
          <View style={styles.column}>
            <AppText size={20}>{t.language}</AppText>
            <View style={styles.langRow}>
              {langs.map((lang) => (
                <Pressable
                  key={lang}
                  accessibilityRole="button"
                  accessibilityState={{ selected: save.lang === lang }}
                  onPress={() => {
                    sound.play('tap');
                    onChange({ lang });
                  }}
                  style={[styles.langButton, save.lang === lang && styles.langActive]}
                >
                  <AppText weight="black" size={16} color={save.lang === lang ? '#FFFFFF' : UI.inkSoft}>
                    {LANGUAGE_NAMES[lang]}
                  </AppText>
                </Pressable>
              ))}
            </View>
            <View style={styles.stats}>
              <AppText size={15} color={UI.inkSoft}>
                {t.runs}: {save.runs}
              </AppText>
              <AppText size={15} color={UI.inkSoft}>
                {t.totalLettuce}: {save.totalLettuce}
              </AppText>
              <AppText size={15} color={UI.inkSoft}>
                {t.best}: {save.best} {t.meters}
              </AppText>
            </View>
          </View>
        </View>
        <View style={styles.panelFooter}>
          <AppText size={12} color={UI.grey}>
            Rocket Snail {version}
          </AppText>
          <Button size="medium" variant="blue" label={t.close} onPress={onClose} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#7CC8FF' },
  content: { flex: 1, paddingHorizontal: 16, paddingVertical: 8 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badges: { flexDirection: 'row', gap: 10 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingLeft: '30%' },
  tagline: { marginTop: -10, marginBottom: 2, textAlign: 'center' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: UI.backdrop, alignItems: 'center', justifyContent: 'center' },
  panel: {
    backgroundColor: UI.card,
    borderRadius: 28,
    borderWidth: 6,
    borderColor: UI.yellow,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: 560,
    maxWidth: '92%',
  },
  panelTitle: { textAlign: 'center' },
  panelBody: { flexDirection: 'row', gap: 28, marginTop: 4 },
  column: { flex: 1, gap: 2 },
  langRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  langButton: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 14, backgroundColor: UI.cardSoft },
  langActive: { backgroundColor: UI.blue },
  stats: { marginTop: 12, gap: 2 },
  panelFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
});
