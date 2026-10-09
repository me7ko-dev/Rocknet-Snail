import { StyleSheet, Text, type TextProps } from 'react-native';

import { FONTS, UI } from './theme';

type Props = TextProps & { weight?: keyof typeof FONTS; size?: number; color?: string };

/** Text in the game's rounded font. */
export function AppText({ weight = 'extraBold', size = 18, color = UI.ink, style, ...rest }: Props) {
  return (
    <Text
      allowFontScaling={false}
      {...rest}
      style={[styles.base, { fontFamily: FONTS[weight], fontSize: size, color }, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: { includeFontPadding: false },
});
