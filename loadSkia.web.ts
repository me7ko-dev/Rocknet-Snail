import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

// On the web, Skia's drawing engine (CanvasKit) must be loaded before the app starts.
export const loadSkia = (): Promise<void> => LoadSkiaWeb({ locateFile: (file: string) => `/${file}` });
