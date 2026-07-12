
import crypto from 'crypto'

const ALG = 'aes-256-gcm'
const KEY_LEN = 32
const IV_LEN  = 16
const TAG_LEN = 16

function getKey() {
  const secret = process.env.ENCRYPTION_SECRET
  if (!secret || secret.length < 64) {
    throw new Error('ENCRYPTION_SECRET must be a 64-char hex string (32 bytes). Run: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
  }
  return Buffer.from(secret.slice(0, 64), 'hex')
}

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

export function decrypt({ enc, iv, authTag }) {
  const key = getKey()
  const decipher = crypto.createDecipheriv(ALG, key, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(authTag, 'hex'))
  const dec = Buffer.concat([decipher.update(Buffer.from(enc, 'hex')), decipher.final()])
  return dec.toString('utf8')
}

export function isAppPassword(raw) {
  const cleaned = raw.replace(/\s/g, '')
  return /^[a-z]{16}$/.test(cleaned)
}

export function cleanAppPassword(raw) {
  return raw.replace(/\s/g, '')
}
