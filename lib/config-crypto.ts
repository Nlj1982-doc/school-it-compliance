/**
 * AES-256-GCM encryption for credential configs stored in the database.
 *
 * Stored format:  enc:v1:<base64(iv[12] + authTag[16] + ciphertext)>
 *
 * Backward-compat: if the stored string does NOT start with "enc:v1:" it is
 * treated as plain JSON — existing rows are silently accepted and will be
 * re-encrypted the next time they are written.
 */
import crypto from "crypto";

const SESSION_SECRET =
  process.env.SESSION_SECRET ??
  "change-this-secret-to-something-long-and-random-32chars";

// Fixed domain-separation salt — not secret, just ensures key derivation is
// scoped to this use-case even if SESSION_SECRET is reused elsewhere.
const SALT = Buffer.from("school-it-compliance-config-v1");

/** Derive a 32-byte AES key from SESSION_SECRET (cached after first call). */
let _key: Buffer | null = null;
function getKey(): Buffer {
  if (!_key) {
    _key = crypto.scryptSync(SESSION_SECRET, SALT, 32) as Buffer;
  }
  return _key;
}

/** Encrypt any JSON-serialisable value and return the enc:v1:… string. */
export function encryptConfig(config: unknown): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(config);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag(); // 16 bytes
  const packed = Buffer.concat([iv, authTag, ciphertext]);
  return `enc:v1:${packed.toString("base64")}`;
}

/** Decrypt an enc:v1:… string back to the original value.
 *  Falls back to JSON.parse for plain-text rows (migration path). */
export function decryptConfig(stored: string): unknown {
  if (!stored.startsWith("enc:v1:")) {
    // Legacy plain-text row — parse as-is
    return JSON.parse(stored);
  }
  const key = getKey();
  const packed = Buffer.from(stored.slice("enc:v1:".length), "base64");
  const iv = packed.subarray(0, 12);
  const authTag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8"));
}

/** Returns true if the value is already encrypted. */
export function isEncrypted(stored: string): boolean {
  return stored.startsWith("enc:v1:");
}
