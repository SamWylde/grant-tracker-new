/**
 * Two-Factor Authentication (2FA) utilities
 * Handles TOTP generation, verification, and backup codes
 */

import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { encrypt, decrypt, hash, generateSecureRandom, formatBackupCode } from './crypto.js';

/**
 * Generate a new TOTP secret for a user
 */
export function generateTOTPSecret(userEmail: string): {
  secret: string;
  otpAuthUrl: string;
} {
  const secret = speakeasy.generateSecret({
    name: `GrantCue (${userEmail})`,
    issuer: 'GrantCue',
    length: 32,
  });

  if (!secret.base32 || !secret.otpauth_url) {
    throw new Error('Failed to generate TOTP secret');
  }

  return {
    secret: secret.base32,
    otpAuthUrl: secret.otpauth_url,
  };
}

/**
 * Generate a QR code data URL from an OTP auth URL
 */
export async function generateQRCode(otpAuthUrl: string): Promise<string> {
  try {
    return await QRCode.toDataURL(otpAuthUrl);
  } catch (error) {
    console.error('QR code generation error:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Verify a TOTP code against a secret
 * Allows a window of ±1 period (30 seconds) for clock skew
 */
export function verifyTOTPCode(secret: string, token: string): boolean {
  try {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 1, // Allow ±1 period (30 seconds) for clock skew
    });
  } catch (error) {
    console.error('TOTP verification error:', error);
    return false;
  }
}

/**
 * Generate a set of backup codes for account recovery
 * Returns 10 unique codes
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  const seen = new Set<string>();

  while (codes.length < count) {
    const code = generateSecureRandom(8);
    if (!seen.has(code)) {
      seen.add(code);
      codes.push(formatBackupCode(code));
    }
  }

  return codes;
}

/**
 * Hash backup codes for secure storage
 */
export function hashBackupCodes(codes: string[]): string[] {
  return codes.map(code => hash(code.replace(/-/g, '')));
}

/**
 * Encrypt a TOTP secret for database storage
 */
export async function encryptTOTPSecret(secret: string): Promise<string> {
  return await encrypt(secret);
}

/**
 * Decrypt a TOTP secret from database storage
 */
export async function decryptTOTPSecret(encryptedSecret: string): Promise<string> {
  return await decrypt(encryptedSecret);
}

/**
 * Generate a complete 2FA setup including secret, QR code, and backup codes
 */
export async function generate2FASetup(userEmail: string): Promise<{
  secret: string;
  encryptedSecret: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
  backupCodesHashed: string[];
}> {
  // Generate TOTP secret
  const { secret, otpAuthUrl } = generateTOTPSecret(userEmail);

  // Encrypt the secret for storage
  const encryptedSecret = await encryptTOTPSecret(secret);

  // Generate QR code
  const qrCodeDataUrl = await generateQRCode(otpAuthUrl);

  // Generate backup codes
  const backupCodes = generateBackupCodes(10);
  const backupCodesHashed = hashBackupCodes(backupCodes);

  return {
    secret, // Plain secret (only returned during setup, never stored unencrypted)
    encryptedSecret, // Encrypted secret for database storage
    qrCodeDataUrl, // QR code data URL for display
    backupCodes, // Plain backup codes (only shown once to user)
    backupCodesHashed, // Hashed backup codes for database storage
  };
}

/**
 * Verify a 2FA code (either TOTP or backup code)
 */
export async function verify2FACode(
  encryptedSecret: string,
  code: string,
  backupCodesHashed: string[]
): Promise<{ valid: boolean; isBackupCode: boolean }> {
  // First, try as TOTP code
  try {
    const secret = await decryptTOTPSecret(encryptedSecret);
    const isValidTOTP = verifyTOTPCode(secret, code);

    if (isValidTOTP) {
      return { valid: true, isBackupCode: false };
    }
  } catch (error) {
    console.error('Error verifying TOTP:', error);
  }

  // If TOTP fails, try as backup code
  const codeHash = hash(code.replace(/-/g, ''));
  const isValidBackupCode = backupCodesHashed.includes(codeHash);

  return {
    valid: isValidBackupCode,
    isBackupCode: isValidBackupCode,
  };
}

/**
 * Rate limiting check for 2FA attempts
 */
export function checkRateLimit(
  failedAttempts: number,
  lastFailedAttempt: Date | null
): {
  allowed: boolean;
  remainingAttempts?: number;
  waitTime?: number; // in seconds
} {
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 15 * 60; // 15 minutes in seconds

  if (failedAttempts >= MAX_ATTEMPTS && lastFailedAttempt) {
    const now = new Date();
    const timeSinceLastAttempt = Math.floor(
      (now.getTime() - lastFailedAttempt.getTime()) / 1000
    );

    if (timeSinceLastAttempt < LOCKOUT_DURATION) {
      return {
        allowed: false,
        waitTime: LOCKOUT_DURATION - timeSinceLastAttempt,
      };
    }
  }

  return {
    allowed: true,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - failedAttempts),
  };
}
