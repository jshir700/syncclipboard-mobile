/**
 * iOS Background Sync Service
 *
 * Wires BGTaskScheduler events into the existing SyncClipboard sync pipeline.
 * On Android, background sync is handled by ForegroundServiceTask — this is the iOS counterpart.
 */

import { Platform, AppState } from 'react-native';
import { registerBackgroundTasks, scheduleAppRefresh, onBackgroundRefresh } from 'ios-bg-task';
import { fetchRemoteClipboard } from './sync/ClipboardSyncActions';
export { fetchRemoteClipboard } from './sync/ClipboardSyncActions';
import { getAPIClient } from './ClientFactory';
import { configService } from './ConfigService';
import type { EventSubscription } from 'expo-modules-core';

let bgRefreshSub: EventSubscription | null = null;
let initialized = false;

/**
 * Initialize iOS background sync. Safe to call on both platforms.
 * On Android, this is a no-op.
 */
export function initIosBackgroundSync(): void {
  if (Platform.OS !== 'ios') return;
  if (initialized) return;
  initialized = true;

  // Register BGTaskScheduler handlers (must be called during app launch)
  registerBackgroundTasks();

  // Listen for background refresh events from iOS
  bgRefreshSub = onBackgroundRefresh(async () => {
    console.log('[IosBgSync] Background refresh triggered');
    try {
      const client = await getAPIClient();
      const profile = await client.getClipboard();
      if (profile && profile.text) {
        // Trigger the normal sync pipeline
        await fetchRemoteClipboard();
      }
    } catch (e) {
      console.warn('[IosBgSync] Background refresh failed:', e);
    }

    // Schedule the next refresh
    scheduleNextRefresh();
  });

  // Schedule initial refresh
  scheduleNextRefresh();

  // Re-schedule when app goes to background
  AppState.addEventListener('change', (state) => {
    if (state === 'background') {
      scheduleNextRefresh();
    }
  });
}

function scheduleNextRefresh(): void {
  // Default 15 minutes. iOS decides the actual timing.
  scheduleAppRefresh(900);
}

/**
 * Clean up subscriptions. Call on app shutdown.
 */
export function stopIosBackgroundSync(): void {
  bgRefreshSub?.remove();
  bgRefreshSub = null;
  initialized = false;
}
