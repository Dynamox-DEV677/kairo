/**
 * AES-256-GCM encryption for Gmail App Passwords.
 * The ENCRYPTION_SECRET env var is the 32-byte (64-char hex) master key.
 * Each credential gets its own random IV → ciphertext is never reusable.
 */

import crypto from 'crypto'

const ALG = 'aes-256-gcm'
const KEY_LEN = 32   // bytes
const IV_LEN  = 16   // bytes (128-bit IV for GCM)
const TAG_LEN = 16   // bytes (128-bit auth tag)

function getKey() {
  const secret = process.env.ENCRYPTION_SECRET
  if (!secret || secret.length < 64) {
    throw new Error('ENCRYPTION_SECRET must be a 64-char hex string (32 bytes). Run: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
  }
  return Buffer.from(secret.slice(0, 64), 'hex')
}

/**
 * Encrypt a plaintext string.
 * @returns {{ enc: string, iv: string, authTag: string }}
 */
export function encrypt(plaintext) {
  const key = getKey()
  const iv  = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv(ALG, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return {
    enc:     enc.toString('hex'),
    iv:      iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
  }
}

/**
 * Decrypt a previously encrypted value.
 */
export function decrypt({ enc, iv, authTag }) {
  const key = getKey()
  const decipher = crypto.createDecipheriv(ALG, key, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(authTag, 'hex'))
  const dec = Buffer.concat([decipher.update(Buffer.from(enc, 'hex')), decipher.final()])
  return dec.toString('utf8')
}

/**
 * Validate that a string looks like a Gmail App Password.
 * Format: 16 lowercase letters, optionally grouped with spaces (xxxx xxxx xxxx xxxx).
 */
export function isAppPassword(raw) {
  const cleaned = raw.replace(/\s/g, '')
  return /^[a-z]{16}$/.test(cleaned)
}

export function cleanAppPassword(raw) {
  return raw.replace(/\s/g, '')
}
