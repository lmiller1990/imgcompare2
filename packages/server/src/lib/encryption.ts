import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function aesEncrypt(key: Buffer, plaintext: Buffer, aad?: Buffer): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  if (aad) cipher.setAAD(aad);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

function aesDecrypt(key: Buffer, blob: Buffer, aad?: Buffer): Buffer {
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = blob.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  if (aad) decipher.setAAD(aad);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

/**
 * Envelope encryption using AES-256-GCM with a local master key.
 *
 * Blob layout: [4B BE: enc_key_len][enc_data_key][enc_token]
 * Each encrypted piece: [12B iv][16B auth_tag][...ciphertext]
 *
 * The context string (project ID) is bound as AAD on the token encryption,
 * so a ciphertext cannot be replayed against a different project row.
 */
export class LocalSecretProvider {
  #masterKey: Buffer;

  constructor(masterKey: Buffer) {
    if (masterKey.length !== 32) {
      throw new Error("MASTER_KEY must decode to exactly 32 bytes");
    }
    this.#masterKey = masterKey;
  }

  static fromEnv(): LocalSecretProvider {
    const raw = process.env["MASTER_KEY"];
    if (!raw) throw new Error("MASTER_KEY env var is required");
    return new LocalSecretProvider(Buffer.from(raw, "base64"));
  }

  async encrypt(plaintext: string, context: string): Promise<Buffer> {
    const dataKey = randomBytes(32);
    const aad = Buffer.from(context, "utf8");
    const encToken = aesEncrypt(dataKey, Buffer.from(plaintext, "utf8"), aad);
    const encDataKey = aesEncrypt(this.#masterKey, dataKey);

    const lenBuf = Buffer.allocUnsafe(4);
    lenBuf.writeUInt32BE(encDataKey.length, 0);
    return Buffer.concat([lenBuf, encDataKey, encToken]);
  }

  async decrypt(ciphertext: Buffer, context: string): Promise<string> {
    const keyLen = ciphertext.readUInt32BE(0);
    const encDataKey = ciphertext.subarray(4, 4 + keyLen);
    const encToken = ciphertext.subarray(4 + keyLen);

    const dataKey = aesDecrypt(this.#masterKey, encDataKey);
    const aad = Buffer.from(context, "utf8");
    return aesDecrypt(dataKey, encToken, aad).toString("utf8");
  }
}
