import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MenuBackdrop } from '../game/MenuBackdrop';
import { LANGUAGE_NAMES, LANGUAGES, type Lang, type Strings } from '../i18n/strings';
import type { SaveData } from '../storage/save';
import { Button } from '../ui/Button';

type Props = {
  save: SaveData;
  t: Strings;
  onPlay: () => void;
  onChangeLang: (lang: Lang) => void;
};

export function StartScreen({ save, t, onPlay, onChangeLang }: Props) {
  const langs = Object.keys(LANGUAGES) as Lang[];
  const nextLang = langs[(langs.indexOf(save.lang) + 1) % langs.length];

  return (
    <View style={styles.root}>
      <MenuBackdrop rocketColor={save.rocketColor} />
      <SafeAreaView style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {t.best}: {save.best} m
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              🥬 {save.coins}
            </Text>
          </View>
        </View>

        <View style={styles.center}>
          <Text style={styles.title}>{t.title}</Text>
          <Text style={styles.tagline}>{t.tagline}</Text>
          <Button label={t.play} onPress={onPlay} />
        </View>

        <View style={styles.bottomRow}>
          <Button small color="#6C8EF5" label={LANGUAGE_NAMES[nextLang]} onPress={() => onChangeLang(nextLang)} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16, paddingVertical: 8 },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  badgeText: { fontSize: 18, fontWeight: '800', color: '#2B3A55' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  title: {
    fontSize: 54,
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: '#E8792B',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 1,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2B3A55',
    marginBottom: 8,
  },
  bottomRow: { flexDirection: 'row', justifyContent: 'flex-end' },
});
