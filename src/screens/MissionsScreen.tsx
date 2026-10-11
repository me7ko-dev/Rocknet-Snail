import { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ACHIEVEMENTS,
  achievementProgress,
  claimableCount,
  dailyFor,
  dayKey,
  describeAchievement,
  describeMission,
} from '../game/missions';
import type { Strings } from '../i18n/strings';
import { haptics } from '../services/haptics';
import { sound } from '../services/sound';
import type { SaveData } from '../storage/save';
import { AppText } from '../ui/AppText';
import { RoundButton } from '../ui/Button';
import { LettuceIcon } from '../ui/LettuceIcon';
import { UI } from '../ui/theme';

type Tab = 'daily' | 'achievements';

type Props = {
  save: SaveData;
  t: Strings;
  onClaimMission: (index: number) => void;
  onClaimAchievement: (id: string) => void;
  onBack: () => void;
};

type Row = { key: string; text: string; progress: number; target: number; reward: number; claimed: boolean; claim: () => void };

export function MissionsScreen({ save, t, onClaimMission, onClaimAchievement, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('daily');
  const today = dayKey(new Date());
  const daily = dailyFor(save.daily, today);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const dailyRows: Row[] = daily.missions.map((m, i) => ({
    key: `${today}-${i}`,
    text: describeMission(m, t),
    progress: daily.progress[i],
    target: m.target,
    reward: m.reward,
    claimed: daily.claimed[i],
    claim: () => onClaimMission(i),
  }));

  const achievementRows: Row[] = ACHIEVEMENTS.map((a) => ({
    key: a.id,
    text: describeAchievement(a, t),
    progress: Math.min(achievementProgress(a, save), a.target),
    target: a.target,
    reward: a.reward,
    claimed: save.claimedAchievements.includes(a.id),
    claim: () => onClaimAchievement(a.id),
  }))
    // ready to claim first, then the ones in progress, finished ones at the bottom
    .sort((a, b) => rowOrder(a) - rowOrder(b));

  const dailyReady = dailyRows.filter((r) => !r.claimed && r.progress >= r.target).length;
  const achievementsReady = claimableCount(save, today) - dailyReady;
  const rows = tab === 'daily' ? dailyRows : achievementRows;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'top', 'bottom']}>
        <View style={styles.header}>
          <RoundButton icon="back" label={t.back} onPress={onBack} size={44} />
          <AppText weight="black" size={32} color="#FFFFFF" style={styles.title}>
            {t.missions}
          </AppText>
          <View style={styles.coins}>
            <LettuceIcon size={26} />
            <AppText weight="black" size={22}>
              {save.coins}
            </AppText>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.tabs}>
            {(['daily', 'achievements'] as Tab[]).map((key) => {
              const ready = key === 'daily' ? dailyReady : achievementsReady;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === key }}
                  onPress={() => {
                    sound.play('tap');
                    setTab(key);
                  }}
                  style={[styles.tab, tab === key && styles.tabActive]}
                >
                  <AppText weight="black" size={18} color={tab === key ? '#FFFFFF' : UI.inkSoft}>
                    {key === 'daily' ? t.daily : t.achievements}
                  </AppText>
                  {ready > 0 && (
                    <View style={styles.badge}>
                      <AppText weight="black" size={13} color="#FFFFFF">
                        {ready}
                      </AppText>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {rows.map((row) => (
              <MissionRow key={row.key} row={row} t={t} />
            ))}
            {tab === 'daily' && (
              <AppText size={14} color={UI.inkSoft} style={styles.footnote}>
                {t.newMissionsDaily}
              </AppText>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

function rowOrder(r: Row) {
  if (r.claimed) return 2;
  return r.progress >= r.target ? 0 : 1;
}

function MissionRow({ row, t }: { row: Row; t: Strings }) {
  const done = row.progress >= row.target;
  const ready = done && !row.claimed;
  return (
    <View style={[styles.row, row.claimed && styles.rowClaimed]}>
      <View style={[styles.starCircle, done && styles.starDone]}>
        <AppText weight="black" size={20} color={done ? '#FFFFFF' : UI.grey}>
          ★
        </AppText>
      </View>
      <View style={styles.rowMiddle}>
        <AppText size={16} numberOfLines={1}>
          {row.text}
        </AppText>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${(row.progress / row.target) * 100}%` }, done && styles.barDone]} />
          <AppText weight="black" size={11} color={UI.ink} style={styles.barText}>
            {row.progress} / {row.target}
          </AppText>
        </View>
      </View>
      {row.claimed ? (
        <AppText weight="black" size={15} color={UI.greenDark} style={styles.claimedText}>
          ✓ {t.claimed}
        </AppText>
      ) : (
        <Pressable
          disabled={!ready}
          accessibilityRole="button"
          accessibilityLabel={`${t.claim} ${row.reward}`}
          accessibilityState={{ disabled: !ready }}
          onPress={() => {
            sound.play('buy');
            haptics.success();
            row.claim();
          }}
          style={({ pressed }) => [styles.claim, !ready && styles.claimLocked, pressed && styles.claimPressed]}
        >
          {ready && (
            <Animated.View entering={FadeIn}>
              <AppText weight="black" size={15} color="#FFFFFF">
                {t.claim}
              </AppText>
            </Animated.View>
          )}
          <LettuceIcon size={18} />
          <AppText weight="black" size={15} color={ready ? '#FFFFFF' : UI.inkSoft}>
            {row.reward}
          </AppText>
        </Pressable>
      )}
    </View>
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
  panel: { flex: 1, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 24, padding: 10 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: UI.card,
  },
  tabActive: { backgroundColor: UI.blue },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: UI.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { gap: 8, paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: UI.card,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  rowClaimed: { opacity: 0.6 },
  starCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: UI.cardSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starDone: { backgroundColor: '#F5C542' },
  rowMiddle: { flex: 1, gap: 5 },
  barTrack: { height: 16, borderRadius: 8, backgroundColor: UI.cardSoft, overflow: 'hidden', justifyContent: 'center' },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: UI.blue, borderRadius: 8 },
  barDone: { backgroundColor: UI.green },
  barText: { textAlign: 'center' },
  claim: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 92,
    justifyContent: 'center',
    backgroundColor: UI.green,
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderBottomWidth: 4,
    borderBottomColor: UI.greenDark,
  },
  claimLocked: { backgroundColor: UI.cardSoft, borderBottomColor: UI.cardSoft },
  claimPressed: { transform: [{ translateY: 2 }], borderBottomWidth: 2 },
  claimedText: { minWidth: 92, textAlign: 'center' },
  footnote: { textAlign: 'center', marginTop: 4 },
});
