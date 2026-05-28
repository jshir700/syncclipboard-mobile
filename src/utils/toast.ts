import { Platform, ToastAndroid, Alert } from 'react-native';

/** Cross-platform toast. Falls back to Alert on iOS (simulator/dev) or silent on production. */
export function showToast(message: string, duration?: number): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, duration ?? ToastAndroid.SHORT);
  } else {
    // iOS doesn't have native toast. Use a brief Alert or just log silently.
    // In production, a custom in-app toast component would be better.
    if (__DEV__) {
      console.log(`[Toast] ${message}`);
    }
  }
}
