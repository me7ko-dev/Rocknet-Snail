import { Nunito_900Black } from '@expo-google-fonts/nunito';
import { Canvas, Group, Text, useFont } from '@shopify/react-native-skia';

import { textWidth } from '../game/draw';
import { UI } from './theme';

type Props = { text: string; size?: number };

/** Big white title with a thick candy outline, readable over any background. */
export function OutlinedTitle({ text, size = 58 }: Props) {
  const font = useFont(Nunito_900Black, size);
  if (!font) return null;
  const outline = size * 0.2;
  const width = textWidth(font, text) + outline * 2;
  const height = size * 1.35;
  const x = outline;
  const y = size * 1.02;
  return (
    <Canvas style={{ width, height }} pointerEvents="none" accessibilityRole="header" accessibilityLabel={text}>
      <Group>
        <Text x={x} y={y + size * 0.09} text={text} font={font} color={UI.ink} style="stroke" strokeWidth={outline} strokeJoin="round" opacity={0.35} />
        <Text x={x} y={y} text={text} font={font} color={UI.orange} style="stroke" strokeWidth={outline} strokeJoin="round" />
        <Text x={x} y={y} text={text} font={font} color="#FFFFFF" />
      </Group>
    </Canvas>
  );
}
