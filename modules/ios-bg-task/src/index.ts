import { Platform } from 'react-native';
import { requireNativeModule, type EventSubscription } from 'expo-modules-core';

interface IosBgTaskInterface {
  registerBackgroundTasks(): void;
  scheduleAppRefresh(delaySeconds?: number): void;
  scheduleProcessingTask(delaySeconds?: number): void;
  cancelAllTasks(): void;
  addListener(eventName: 'onBackgroundRefresh', listener: () => void): EventSubscription;
  addListener(eventName: 'onBackgroundProcessing', listener: () => void): EventSubscription;
}

let nativeModule: IosBgTaskInterface | null = null;

function getModule(): IosBgTaskInterface | null {
  if (Platform.OS !== 'ios') return null;
  try {
    if (!nativeModule) {
      nativeModule = requireNativeModule<IosBgTaskInterface>('IosBgTask');
    }
    return nativeModule;
  } catch {
    return null;
  }
}

/**
 * Register background task handlers. Call once on app startup.
 * On Android, this is a no-op (background handled by ForegroundService).
 */
export function registerBackgroundTasks(): void {
  getModule()?.registerBackgroundTasks();
}

/**
 * Schedule a background app refresh. iOS will call this at its discretion
 * (typically every 15+ minutes, depending on battery and usage patterns).
 * @param delaySeconds Minimum delay in seconds before the task can run (default 900 = 15 min)
 */
export function scheduleAppRefresh(delaySeconds?: number): void {
  getModule()?.scheduleAppRefresh(delaySeconds);
}

/**
 * Schedule a background processing task for heavier work (e.g. file sync).
 * iOS runs these less frequently, typically when device is idle and on Wi-Fi.
 * @param delaySeconds Minimum delay before the task can run (default 3600 = 1 hour)
 */
export function scheduleProcessingTask(delaySeconds?: number): void {
  getModule()?.scheduleProcessingTask(delaySeconds);
}

/** Cancel all pending background task requests. */
export function cancelAllTasks(): void {
  getModule()?.cancelAllTasks();
}

/**
 * Listen for background refresh events from iOS.
 * Handler must complete within ~25 seconds.
 */
export function onBackgroundRefresh(handler: () => void): EventSubscription | null {
  return getModule()?.addListener('onBackgroundRefresh', handler) ?? null;
}

/**
 * Listen for background processing events from iOS.
 * Handler must complete within ~55 seconds.
 */
export function onBackgroundProcessing(handler: () => void): EventSubscription | null {
  return getModule()?.addListener('onBackgroundProcessing', handler) ?? null;
}
