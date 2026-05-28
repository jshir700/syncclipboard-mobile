import { Platform } from 'react-native';

const getShortcutModule = () => {
  if (Platform.OS !== 'android') return null;
  try {
    return require('shortcut');
  } catch {
    return null;
  }
};

export const shortcut = {
  addDownloadShortcut(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return Promise.reject(new Error('Home-screen shortcuts are only supported on Android'));
    }
    const mod = getShortcutModule();
    if (!mod?.isShortcutModuleAvailable) {
      return Promise.reject(new Error('ShortcutModule is not available'));
    }
    return mod.requestPinDownloadShortcut().catch((error: any) => {
      console.error('ShortcutModule addDownloadShortcut error:', error);
      throw error;
    });
  },

  addUploadShortcut(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return Promise.reject(new Error('Home-screen shortcuts are only supported on Android'));
    }
    const mod = getShortcutModule();
    if (!mod?.isShortcutModuleAvailable) {
      return Promise.reject(new Error('ShortcutModule is not available'));
    }
    return mod.requestPinUploadShortcut().catch((error: any) => {
      console.error('ShortcutModule addUploadShortcut error:', error);
      throw error;
    });
  },
};
