import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

import { loadSkia } from './loadSkia';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App).
// The web build loads Skia first (loadSkia.web.ts); phones register right away.
if (Platform.OS === 'web') {
  loadSkia().then(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    registerRootComponent(require('./App').default);
  });
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  registerRootComponent(require('./App').default);
}
