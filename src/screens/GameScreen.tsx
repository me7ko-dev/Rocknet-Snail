import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GameCanvas } from '../game/GameCanvas';
import type { Strings } from '../i18n/strings';
import { Button } from '../ui/Button';

type Result = { score: number; coins: number; best: number; isNewBest: boolean };

type Props = {
  t: Strings;
  rocketColor: string;
  /** Saves the run and returns the (maybe new) record */
  onRunFinished: (score: number, coins: number) => { best: number; isNewBest: boolean };
  onMenu: () => void;
};

export function GameScreen({ t, rocketColor, onRunFinished, onMenu }: Props) {
  // Changing runId re-creates the game canvas = a fresh run
  const [runId, setRunId] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  const handleGameOver = (score: number, coins: number) => {
    const { best, isNewBest } = onRunFinished(score, coins);
    setResult({ score, coins, best, isNewBest });
  };

  const playAgain = () => {
    setResult(null);
    setRunId((id) => id + 1);
  };

  return (
    <View style={styles.root}>
      <GameCanvas key={runId} rocketColor={rocketColor} holdToFlyText={t.holdToFly} onGameOver={handleGameOver} />

      {result && (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.title}>{t.gameOver}</Text>
            <Text style={styles.score}>{result.score} m</Text>
            {result.isNewBest ? (
              <Text style={styles.newBest}>{t.newBest}</Text>
            ) : (
              <Text style={styles.line}>
                {t.best}: {result.best} m
              </Text>
            )}
            <Text style={styles.line}>
              🥬 {t.lettuce}: +{result.coins}
            </Text>
            <View style={styles.buttons}>
              <Button small color="#6C8EF5" label={t.menu} onPress={onMenu} />
              <Button label={t.again} onPress={playAgain} />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#7CC8FF' },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(43,58,85,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 18,
    paddingHorizontal: 36,
    alignItems: 'center',
    gap: 4,
    borderWidth: 5,
    borderColor: '#FFE066',
  },
  title: { fontSize: 34, fontWeight: '900', color: '#F07A5A' },
  score: { fontSize: 44, fontWeight: '900', color: '#2B3A55' },
  newBest: { fontSize: 20, fontWeight: '900', color: '#4FAF3A' },
  line: { fontSize: 18, fontWeight: '700', color: '#2B3A55' },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 },
});
