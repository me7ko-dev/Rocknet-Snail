import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { sound } from '../services/sound';
import { AppText } from './AppText';
import { UI } from './theme';

type Props = { value: boolean; onChange: (value: boolean) => void; label: string };

/** A chunky on/off switch with a label on the left. */
export function Toggle({ value, onChange, label }: Props) {
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: withSpring(value ? 28 : 0, { damping: 15 }) }] }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => {
        sound.play('tap');
        onChange(!value);
      }}
      style={styles.row}
    >
      <AppText size={20}>{label}</AppText>
      <View style={[styles.track, { backgroundColor: value ? UI.green : UI.grey }]}>
        <Animated.View style={[styles.knob, knob]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, gap: 16 },
  track: { width: 66, height: 38, borderRadius: 19, justifyContent: 'center', paddingHorizontal: 3 },
  knob: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: UI.ink,
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
