import { Canvas, Picture, Skia, createPicture } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SnailPreview } from '../game/SnailPreview';
import { drawHat, drawRocket } from '../game/draw';
import { HATS, ROCKETS, makeLook, type Skin } from '../game/skins';
import type { Lang, Strings } from '../i18n/strings';
import { haptics } from '../services/haptics';
import { sound } from '../services/sound';
import type { SaveData } from '../storage/save';
import { AppText } from '../ui/AppText';
import { Button, RoundButton } from '../ui/Button';
import { LettuceIcon } from '../ui/LettuceIcon';
import { UI } from '../ui/theme';

type Tab = 'rocket' | 'hat';

type Props = {
  save: SaveData;
  t: Strings;
  lang: Lang;
  onBuy: (skin: Skin) => boolean;
  onWear: (skin: Skin) => void;
  onBack: () => void;
};

export function ShopScreen({ save, t, lang, onBuy, onWear, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('rocket');
  const [rocketId, setRocketId] = useState(save.rocket);
  const [hatId, setHatId] = useState(save.hat);
  const [message, setMessage] = useState('');

  const items: Skin[] = tab === 'rocket' ? ROCKETS : HATS;
  const selectedId = tab === 'rocket' ? rocketId : hatId;
  const selected = items.find((s) => s.id === selectedId) ?? items[0];
  const owned = save.ownedSkins.includes(selected.id);
  const worn = (tab === 'rocket' ? save.rocket : save.hat) === selected.id;
  const look = useMemo(() => makeLook(rocketId, hatId), [rocketId, hatId]);

  // little bounce of the coin badge when there is not enough lettuce
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const pop = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const select = (skin: Skin) => {
    sound.play('tap');
    setMessage('');
    if (skin.kind === 'rocket') setRocketId(skin.id);
    else setHatId(skin.id);
  };

  const buyOrWear = () => {
    if (owned) {
      onWear(selected);
      haptics.tap();
      return;
    }
    if (onBuy(selected)) {
      sound.play('buy');
      haptics.success();
      pop.set(withSequence(withTiming(1.12, { duration: 120 }), withSpring(1, { damping: 8 })));
      setMessage('');
    } else {
      sound.play('nope');
      haptics.warning();
      setMessage(t.notEnough);
      shake.set(
        withSequence(
          withTiming(-8, { duration: 50 }),
          withTiming(8, { duration: 60 }),
          withTiming(-6, { duration: 60 }),
          withTiming(0, { duration: 50 }),
        ),
      );
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'top', 'bottom']}>
        <View style={styles.header}>
          <RoundButton icon="back" label={t.back} onPress={onBack} size={44} />
          <AppText weight="black" size={32} color="#FFFFFF" style={styles.title}>
            {t.shop}
          </AppText>
          <Animated.View style={[styles.coins, shakeStyle]}>
            <LettuceIcon size={26} />
            <AppText weight="black" size={22}>
              {save.coins}
            </AppText>
          </Animated.View>
        </View>

        <View style={styles.body}>
          <View style={styles.left}>
            <Animated.View style={[styles.previewWrap, popStyle]}>
              <SnailPreview look={look} style={styles.preview} />
            </Animated.View>
            <AppText weight="black" size={22} style={styles.center}>
              {selected.name[lang]}
            </AppText>
            {worn ? (
              <Button size="medium" variant="grey" label={t.equipped} onPress={() => {}} disabled />
            ) : owned ? (
              <Button size="medium" variant="green" label={t.equip} onPress={buyOrWear} />
            ) : (
              <Pressable onPress={buyOrWear} accessibilityRole="button" accessibilityLabel={`${t.buy} ${selected.price}`}>
                {({ pressed }) => (
                  <View style={[styles.buyButton, pressed && styles.buyPressed, save.coins < selected.price && styles.buyPoor]}>
                    <AppText weight="black" size={22} color="#FFFFFF">
                      {t.buy}
                    </AppText>
                    <LettuceIcon size={24} />
                    <AppText weight="black" size={22} color="#FFFFFF">
                      {selected.price}
                    </AppText>
                  </View>
                )}
              </Pressable>
            )}
            {!!message && (
              <AppText size={14} color={UI.redDark} style={styles.center}>
                {message}
              </AppText>
            )}
          </View>

          <View style={styles.right}>
            <View style={styles.tabs}>
              {(['rocket', 'hat'] as Tab[]).map((key) => (
                <Pressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === key }}
                  onPress={() => {
                    sound.play('tap');
                    setTab(key);
                    setMessage('');
                  }}
                  style={[styles.tab, tab === key && styles.tabActive]}
                >
                  <AppText weight="black" size={18} color={tab === key ? '#FFFFFF' : UI.inkSoft}>
                    {key === 'rocket' ? t.rockets : t.hats}
                  </AppText>
                </Pressable>
              ))}
            </View>
            <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
              {items.map((skin) => (
                <ItemCard
                  key={skin.id}
                  skin={skin}
                  lang={lang}
                  t={t}
                  selected={skin.id === selected.id}
                  owned={save.ownedSkins.includes(skin.id)}
                  worn={(skin.kind === 'rocket' ? save.rocket : save.hat) === skin.id}
                  onPress={() => select(skin)}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

type CardProps = { skin: Skin; lang: Lang; t: Strings; selected: boolean; owned: boolean; worn: boolean; onPress: () => void };

function ItemCard({ skin, lang, t, selected, owned, worn, onPress }: CardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={skin.name[lang]}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && styles.cardPressed]}
    >
      <Swatch skin={skin} />
      <AppText size={13} numberOfLines={1}>
        {skin.name[lang]}
      </AppText>
      {worn ? (
        <AppText weight="black" size={12} color={UI.greenDark}>
          ✓ {t.equipped}
        </AppText>
      ) : owned ? (
        <AppText weight="black" size={12} color={UI.inkSoft}>
          {t.owned}
        </AppText>
      ) : (
        <View style={styles.price}>
          <LettuceIcon size={14} />
          <AppText weight="black" size={13} color={UI.greenDark}>
            {skin.price}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const SWATCH_W = 70;
const SWATCH_H = 44;

/** Mini picture of a rocket or a hat */
function Swatch({ skin }: { skin: Skin }) {
  const picture = useMemo(
    () =>
      createPicture((c) => {
        const p = Skia.Paint();
        p.setAntiAlias(true);
        if (skin.kind === 'rocket') {
          // the rocket is about 22 x 11 units big, centred around (-5, -12)
          const k = SWATCH_W / 26;
          c.translate(SWATCH_W / 2 + 4 * k, SWATCH_H / 2 + 12 * k);
          c.scale(k, k);
          drawRocket(c, p, makeLook(skin.id, 'none'), 0.6);
        } else if (skin.id === 'none') {
          p.setColor(Skia.Color(UI.grey));
          p.setStyle(1);
          p.setStrokeWidth(3);
          c.drawCircle(SWATCH_W / 2, SWATCH_H / 2, 13, p);
          c.drawLine(SWATCH_W / 2 - 9, SWATCH_H / 2 + 9, SWATCH_W / 2 + 9, SWATCH_H / 2 - 9, p);
        } else {
          const k = SWATCH_H / 11;
          c.translate(SWATCH_W / 2, SWATCH_H * 0.92);
          c.scale(k, k);
          drawHat(c, p, skin.id, 0.3);
        }
      }),
    [skin],
  );
  return (
    <Canvas style={styles.swatch} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#7CC8FF' },
  safe: { flex: 1, paddingHorizontal: 16, paddingBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, paddingBottom: 8 },
  title: { textShadowColor: UI.blueDark, textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 0 },
  coins: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: UI.card,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
  body: { flex: 1, flexDirection: 'row', gap: 14 },
  left: {
    width: '38%',
    backgroundColor: UI.card,
    borderRadius: 24,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  previewWrap: { flex: 1, alignSelf: 'stretch' },
  preview: { flex: 1, borderRadius: 18 },
  center: { textAlign: 'center' },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: UI.red,
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    borderBottomWidth: 6,
    borderBottomColor: UI.redDark,
  },
  buyPressed: { transform: [{ translateY: 2 }], borderBottomWidth: 3 },
  buyPoor: { opacity: 0.75 },
  right: { flex: 1, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 24, padding: 10 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 16, backgroundColor: UI.card },
  tabActive: { backgroundColor: UI.blue },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },
  card: {
    width: 96,
    alignItems: 'center',
    backgroundColor: UI.card,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  cardSelected: { borderColor: UI.blue, backgroundColor: UI.cardSoft },
  cardPressed: { transform: [{ scale: 0.95 }] },
  swatch: { width: SWATCH_W, height: SWATCH_H },
  price: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
