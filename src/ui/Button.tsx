import { Pressable, StyleSheet, Text } from 'react-native';

type Props = {
  label: string;
  onPress: () => void;
  color?: string;
  small?: boolean;
};

export function Button({ label, onPress, color = '#FF5A5F', small = false }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.small,
        { backgroundColor: color, transform: [{ scale: pressed ? 0.94 : 1 }] },
      ]}
    >
      <Text style={[styles.label, small && styles.smallLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 180,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 28,
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#2B3A55',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  small: {
    minWidth: 110,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1,
  },
  smallLabel: {
    fontSize: 18,
  },
});
