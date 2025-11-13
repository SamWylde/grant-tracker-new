/**
 * Encryption utilities for sensitive data
 * Used for encrypting TOTP secrets and backup codes
 */

import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// Encryption algorithm
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits

/**
 * Get encryption key from environment variable
 * This should be a secure random string set in your environment
 */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  return key;
}

/**
 * Derive a key from the master encryption key and salt
 */
async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
}

/**
 * Encrypt a string value
 * Returns: salt:iv:authTag:encryptedData (all base64 encoded)
 */
export async function encrypt(plaintext: string): Promise<string> {
  try {
    const masterKey = getEncryptionKey();

    // Generate random salt and IV
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);

    // Derive key from master key and salt
    const key = await deriveKey(masterKey, salt);

    // Create cipher and encrypt
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Combine salt, iv, authTag, and encrypted data
    const combined = Buffer.concat([salt, iv, authTag, encrypted]);

    // Return as base64 string
    return combined.toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt an encrypted string
 * Input format: salt:iv:authTag:encryptedData (all base64 encoded)
 */
export async function decrypt(encryptedData: string): Promise<string> {
  try {
    const masterKey = getEncryptionKey();

    // Decode base64
    const combined = Buffer.from(encryptedData, 'base64');

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

    // Derive key from master key and salt
    const key = await deriveKey(masterKey, salt);

    // Create decipher and decrypt
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Hash a value using SHA-256
 * Used for hashing backup codes before storage
 */
export function hash(value: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Generate a cryptographically secure random string
 * Used for generating backup codes
 */
export function generateSecureRandom(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(length);
  let result = '';

  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }

  return result;
}

/**
 * Format a backup code with dashes for readability
 * Example: ABCD1234 -> ABCD-1234
 */
export function formatBackupCode(code: string): string {
  if (code.length === 8) {
    return `${code.substring(0, 4)}-${code.substring(4)}`;
  }
  return code;
}

/**
 * Remove formatting from a backup code
 * Example: ABCD-1234 -> ABCD1234
 */
export function unformatBackupCode(code: string): string {
  return code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}
