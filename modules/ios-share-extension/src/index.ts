import { Platform, NativeModules, NativeEventEmitter } from 'react-native';
import * as FileSystem from 'expo-file-system';

const APP_GROUP_ID = 'group.com.jshir700.syncclipboardmobile';
const PAYLOAD_FILE = 'shared_payload.json';

export interface SharedPayload {
  text?: string;
  fileName?: string;
  filePath?: string;
  timestamp: string;
}

/**
 * Check for content shared from the Share Extension.
 * Returns null if no shared content is pending.
 */
export async function checkSharedContent(): Promise<SharedPayload | null> {
  if (Platform.OS !== 'ios') return null;

  try {
    const containerUrl = getContainerUrl();
    const payloadUrl = `${containerUrl}/${PAYLOAD_FILE}`;

    const exists = await FileSystem.getInfoAsync(payloadUrl);
    if (!exists.exists) return null;

    const json = await FileSystem.readAsStringAsync(payloadUrl);
    await FileSystem.deleteAsync(payloadUrl, { idempotent: true });

    return JSON.parse(json) as SharedPayload;
  } catch {
    return null;
  }
}

/**
 * Get the App Group shared container URL (file:// scheme).
 * Files saved by the share extension are located here.
 */
function getContainerUrl(): string {
  // expo-file-system documentDirectory doesn't point to the App Group.
  // We need to construct the URL manually.
  // ~/Library/Group Containers/{APP_GROUP_ID}/
  const home = FileSystem.documentDirectory!.split('/Documents')[0];
  // Actually use the native module if available, or construct from sandbox
  // The reliable way in React Native: NSFileManager.default.containerURL
  if (NativeModules.IosShareExtension?.getContainerUrl) {
    return NativeModules.IosShareExtension.getContainerUrl();
  }
  // Fallback: construct path (less reliable)
  return `${home}/Library/Group Containers/${APP_GROUP_ID}`;
}

/**
 * Listen for incoming shared content in real-time (poll-based).
 * Checks every 2 seconds for new shared content.
 * Returns an unsubscribe function.
 */
export function watchSharedContent(
  callback: (payload: SharedPayload) => void,
  intervalMs: number = 2000
): () => void {
  if (Platform.OS !== 'ios') return () => {};

  const interval = setInterval(async () => {
    const payload = await checkSharedContent();
    if (payload) {
      callback(payload);
    }
  }, intervalMs);

  return () => clearInterval(interval);
}
