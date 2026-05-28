/**
 * End-to-End Encryption Service for SyncClipboard Mobile
 *
 * Uses AES-256-GCM for encryption and PBKDF2-SHA256 for key derivation.
 * Deterministic salt ensures the same password produces identical keys
 * across all devices (desktop, mobile, scripts).
 *
 * Requires: npm install @noble/ciphers @noble/hashes
 */

// @ts-nocheck — @noble/ciphers types vary by version; API accessed at runtime via require()

import { sha256 } from 'js-sha256';

// Dynamic imports for @noble packages — install with:
//   npm install @noble/ciphers @noble/hashes
let nobleCiphers: typeof import('@noble/ciphers') | null = null;
let nobleHashes: typeof import('@noble/hashes') | null = null;

async function ensureNoble(): Promise<boolean> {
  if (nobleCiphers && nobleHashes) return true;
  try {
    nobleCiphers = require('@noble/ciphers');
    nobleHashes = require('@noble/hashes');
    return true;
  } catch {
    console.error(
      '@noble/ciphers and @noble/hashes are required for E2E encryption.\n' +
        'Run: npm install @noble/ciphers @noble/hashes'
    );
    return false;
  }
}

// ====== Constants (must match desktop C# ClipboardCryptoService) ======

const PBKDF2_ITERATIONS = 600_000;
const KEY_SIZE = 32; // bytes
const NONCE_SIZE = 12; // bytes
const VERSION = 1;
const SALT_PREFIX = 'SyncClipboardE2EE:v1:salt:';
const VERIFY_PREFIX = 'SyncClipboardE2EE:v1:verify:';

// ====== Pure JS PBKDF2 using js-sha256 (fallback) ======

function pbkdf2Sync(
  password: string,
  salt: Uint8Array,
  iterations: number,
  keyLen: number
): Uint8Array {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const hLen = 32; // SHA-256 output = 32 bytes

  // PBKDF2: compute U1 = HMAC(password, salt || INT(1))
  // then U_i = HMAC(password, U_{i-1}), XOR all U_i to get block
  // Repeat for ceil(keyLen / hLen) blocks

  const blockCount = Math.ceil(keyLen / hLen);
  const result = new Uint8Array(keyLen);

  for (let blockIndex = 1; blockIndex <= blockCount; blockIndex++) {
    // Build salt || INT_BE(blockIndex)
    const saltWithBlock = new Uint8Array(salt.length + 4);
    saltWithBlock.set(salt);
    saltWithBlock[salt.length] = (blockIndex >>> 24) & 0xff;
    saltWithBlock[salt.length + 1] = (blockIndex >>> 16) & 0xff;
    saltWithBlock[salt.length + 2] = (blockIndex >>> 8) & 0xff;
    saltWithBlock[salt.length + 3] = blockIndex & 0xff;

    // U1 = HMAC-SHA256(password, salt_with_block)
    let u = computeHMAC(passwordBytes, saltWithBlock);
    let blockOutput = u;

    for (let i = 1; i < iterations; i++) {
      u = computeHMAC(passwordBytes, u);
      for (let j = 0; j < blockOutput.length; j++) {
        blockOutput[j] ^= u[j];
      }
    }

    result.set(
      blockOutput.subarray(0, Math.min(hLen, keyLen - (blockIndex - 1) * hLen)),
      (blockIndex - 1) * hLen
    );
  }

  return result;
}

function computeHMAC(key: Uint8Array, message: Uint8Array): Uint8Array {
  // Use js-sha256's HMAC
  // sha256.hmac expects key and message as strings or Uint8Arrays
  const hmac = sha256.hmac as unknown as (
    key: Uint8Array | string,
    message: Uint8Array | string
  ) => Uint8Array | string;
  const result = hmac(key, message);
  if (typeof result === 'string') {
    return new TextEncoder().encode(result);
  }
  return result;
}

// ====== Salt & Key Derivation (Deterministic) ======

function deriveSalt(password: string): Uint8Array {
  const hash = sha256.create();
  hash.update(SALT_PREFIX + password);
  return new Uint8Array(hash.arrayBuffer()).slice(0, 16);
}

function computeVerificationHash(password: string): string {
  const hash = sha256.create();
  hash.update(VERIFY_PREFIX + password);
  return hash.hex();
}

// ====== Encryption Service State ======

export interface EncryptionState {
  enabled: boolean;
  keyDerived: boolean;
}

let derivedKey: Uint8Array | null = null;
let encryptionEnabled = false;

// ====== Public API ======

/** Check if encryption is configured */
export function isEncryptionConfigured(encryptedPasswordHash?: string): boolean {
  return !!encryptedPasswordHash && encryptedPasswordHash.length > 0;
}

/** Derive the AES key from a password (stays in memory, not persisted) */
export function loadOrDeriveKey(password: string, storedHash: string): void {
  const verificationHash = computeVerificationHash(password);

  if (verificationHash !== storedHash) {
    throw new Error('Incorrect encryption password');
  }

  const salt = deriveSalt(password);
  derivedKey = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_SIZE);
  encryptionEnabled = true;
}

/** Set a new encryption password. Returns the verification hash to store. */
export function setPassword(password: string): string {
  const verificationHash = computeVerificationHash(password);
  const salt = deriveSalt(password);
  derivedKey = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_SIZE);
  encryptionEnabled = true;
  return verificationHash;
}

/** Disable encryption and clear the key from memory */
export function disableEncryption(): void {
  if (derivedKey) {
    // Zero out the key
    derivedKey.fill(0);
    derivedKey = null;
  }
  encryptionEnabled = false;
}

/** Get current encryption state */
export function getState(): EncryptionState {
  return {
    enabled: encryptionEnabled,
    keyDerived: derivedKey !== null,
  };
}

// ====== AES-256-GCM Encryption ======

/**
 * Encrypt plaintext bytes with AES-256-GCM.
 * Output: [1 byte: version] [12 bytes: nonce] [ciphertext+16 byte tag]
 */
export async function encryptBytes(plaintext: Uint8Array): Promise<Uint8Array> {
  if (!derivedKey) throw new Error('Encryption key not loaded');

  const ok = await ensureNoble();
  if (!ok) throw new Error('Crypto libraries not available');

  const nonce = nobleCiphers!.randomBytes(NONCE_SIZE);
  // @noble/ciphers AES-GCM
  const gcm = nobleCiphers!.gcm(derivedKey, nonce);
  const ciphertext = gcm.encrypt(plaintext);

  const result = new Uint8Array(1 + NONCE_SIZE + ciphertext.length);
  result[0] = VERSION;
  result.set(nonce, 1);
  result.set(ciphertext, 1 + NONCE_SIZE);
  return result;
}

/**
 * Decrypt ciphertext bytes with AES-256-GCM.
 * Input: [1 byte: version] [12 bytes: nonce] [ciphertext+16 byte tag]
 */
export async function decryptBytes(ciphertext: Uint8Array): Promise<Uint8Array> {
  if (!derivedKey) throw new Error('Encryption key not loaded');

  const ok = await ensureNoble();
  if (!ok) throw new Error('Crypto libraries not available');

  if (ciphertext.length < 1 + NONCE_SIZE + 16) {
    throw new Error('Encrypted data too short');
  }

  const version = ciphertext[0];
  if (version !== VERSION) {
    throw new Error(`Unsupported encryption version: ${version}`);
  }

  const nonce = ciphertext.slice(1, 1 + NONCE_SIZE);
  const encryptedData = ciphertext.slice(1 + NONCE_SIZE);

  const gcm = nobleCiphers!.gcm(derivedKey, nonce);
  return gcm.decrypt(encryptedData);
}

/**
 * Encrypt a text string. Returns base64-encoded ciphertext.
 */
export async function encryptText(plaintext: string): Promise<string> {
  const encoder = new TextEncoder();
  const plainBytes = encoder.encode(plaintext);
  const cipherBytes = await encryptBytes(plainBytes);
  // Base64 encode
  return btoa(String.fromCharCode(...cipherBytes));
}

/**
 * Decrypt a base64-encoded ciphertext back to string.
 */
export async function decryptText(base64Cipher: string): Promise<string> {
  const decoder = new TextDecoder();
  const binary = atob(base64Cipher);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const plainBytes = await decryptBytes(bytes);
  return decoder.decode(plainBytes);
}

// ====== File Encryption ======

/**
 * Encrypt a file at sourcePath, writing encrypted data to destPath.
 * Uses AES-256-GCM (reads the entire file into memory).
 */
export async function encryptFile(
  sourcePath: string,
  destPath: string,
  fs: typeof import('expo-file-system')
): Promise<void> {
  const base64Content = await fs.readAsStringAsync(sourcePath, {
    encoding: fs.EncodingType.Base64,
  });
  const plainBytes = new Uint8Array(
    atob(base64Content)
      .split('')
      .map((c) => c.charCodeAt(0))
  );
  const cipherBytes = await encryptBytes(plainBytes);
  const b64 = btoa(String.fromCharCode(...cipherBytes));
  await fs.writeAsStringAsync(destPath, b64, {
    encoding: fs.EncodingType.Base64,
  });
}

/**
 * Decrypt a file at sourcePath, writing plaintext to destPath.
 */
export async function decryptFile(
  sourcePath: string,
  destPath: string,
  fs: typeof import('expo-file-system')
): Promise<void> {
  const base64Content = await fs.readAsStringAsync(sourcePath, {
    encoding: fs.EncodingType.Base64,
  });
  const cipherBytes = new Uint8Array(
    atob(base64Content)
      .split('')
      .map((c) => c.charCodeAt(0))
  );
  const plainBytes = await decryptBytes(cipherBytes);
  const b64 = btoa(String.fromCharCode(...plainBytes));
  await fs.writeAsStringAsync(destPath, b64, {
    encoding: fs.EncodingType.Base64,
  });
}
