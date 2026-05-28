import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { encryptText, decryptText, loadOrDeriveKey } from '@/services/crypto/CryptoService';
import { useSettingsStore } from '@/stores';

interface Props {
  action: 'encrypt' | 'decrypt';
  text: string;
  password?: string;
  callback?: string;
  onComplete: () => void;
}

export function CryptoActionScreen({ action, text, password, callback, onComplete }: Props) {
  const { theme } = useTheme();
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const config = useSettingsStore((s) => s.config);

  useEffect(() => {
    if (!text) {
      setErrorMsg('No text provided');
      setStatus('error');
      setTimeout(onComplete, 2000);
      return;
    }

    processText();
  }, []);

  async function processText() {
    try {
      // Ensure encryption key is loaded.
      // Priority: 1) already loaded in memory, 2) password provided via URL
      if (password && config?.encryptionEnabled && config?.encryptionPasswordHash) {
        // Cold start: derive key from the password passed via URL scheme.
        // Password is passed locally (never leaves the device) — same security
        // as entering it in the app directly.
        loadOrDeriveKey(password, config.encryptionPasswordHash);
      }

      let result: string;
      if (action === 'encrypt') {
        result = await encryptText(text);
      } else {
        result = await decryptText(text);
      }

      // Copy result to clipboard
      const Clipboard = await require('expo-clipboard');
      await Clipboard.setStringAsync(result);

      setStatus('done');

      // Return to Shortcuts via callback
      setTimeout(() => {
        onComplete();
        if (callback) {
          try {
            const { Linking } = require('react-native');
            Linking.openURL(callback);
          } catch {}
        }
      }, 500);
    } catch (e: any) {
      setErrorMsg(e.message || 'Unknown error');
      setStatus('error');
      setTimeout(onComplete, 3000);
    }
  }

  const bg = theme.colors.background;
  const fg = theme.colors.text;

  return (
    <View style={[styles.container, { backgroundColor: bg + 'F0' }]}>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        {status === 'loading' && (
          <>
            <ActivityIndicator size="large" />
            <Text style={[styles.text, { color: fg }]}>
              {action === 'encrypt' ? 'Encrypting...' : 'Decrypting...'}
            </Text>
          </>
        )}
        {status === 'done' && (
          <Text style={[styles.text, { color: '#4CAF50' }]}>
            {action === 'encrypt' ? '✓ Encrypted & copied' : '✓ Decrypted & copied'}
          </Text>
        )}
        {status === 'error' && (
          <Text style={[styles.text, { color: '#f44336' }]}>{errorMsg || 'Failed'}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
    minWidth: 200,
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
  },
});
