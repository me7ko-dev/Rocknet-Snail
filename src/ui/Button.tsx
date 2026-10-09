import { Pressable, StyleSheet, View } from 'react-native';

import { sound } from '../services/sound';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { UI } from './theme';

type Variant = 'red' | 'blue' | 'green' | 'grey';

const COLORS: Record<Variant, [string, string]> = {
  red: [UI.red, UI.redDark],
  blue: [UI.blue, UI.blueDark],
  green: [UI.green, UI.greenDark],
  grey: [UI.grey, UI.greyDark],
};

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: 'big' | 'medium' | 'small';
  icon?: IconName;
  disabled?: boolean;
  /** Plays the click sound (default true) */
  clickSound?: boolean;
};

/** Big, chunky, candy-coloured button with a "3D" bottom edge. */
export function Button({ label, onPress, variant = 'red', size = 'medium', icon, disabled = false, clickSound = true }: Props) {
  const [face, edge] = COLORS[disabled ? 'grey' : variant];
  const s = SIZES[size];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        if (clickSound) sound.play('tap');
        onPress();
      }}
      style={({ pressed }) => [styles.outer, { borderRadius: s.radius, backgroundColor: edge, paddingBottom: pressed ? 2 : 5, marginTop: pressed ? 3 : 0 }]}
    >
      <View style={[styles.face, { backgroundColor: face, borderRadius: s.radius, paddingVertical: s.padV, paddingHorizontal: s.padH, minWidth: s.minWidth }]}>
        {icon && <Icon name={icon} size={s.font * 1.05} />}
        <AppText weight="black" size={s.font} color="#FFFFFF" style={styles.label}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

type RoundProps = { icon: IconName; onPress: () => void; label: string; variant?: Variant; size?: number };

/** Round button with only an icon (pause, settings, back). */
export function RoundButton({ icon, onPress, label, variant = 'blue', size = 48 }: RoundProps) {
  const [face, edge] = COLORS[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPress={() => {
        sound.play('tap');
        onPress();
      }}
      style={({ pressed }) => [
        styles.round,
        { width: size, height: size + 4, borderRadius: size / 2, backgroundColor: edge, paddingBottom: pressed ? 1 : 4, marginTop: pressed ? 3 : 0 },
      ]}
    >
      <View style={[styles.roundFace, { width: size, height: size, borderRadius: size / 2, backgroundColor: face }]}>
        <Icon name={icon} size={size * 0.55} />
      </View>
    </Pressable>
  );
}

const SIZES = {
  big: { font: 30, padV: 12, padH: 34, radius: 26, minWidth: 210 },
  medium: { font: 22, padV: 9, padH: 22, radius: 22, minWidth: 150 },
  small: { font: 17, padV: 7, padH: 14, radius: 18, minWidth: 0 },
};

const styles = StyleSheet.create({
  outer: {
    shadowColor: UI.ink,
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  face: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  label: {
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  round: {
    shadowColor: UI.ink,
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  roundFace: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
  },
});
