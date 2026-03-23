import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { requireEnv } from "@/lib/env";

function buildKey(material: string): Buffer {
  return createHash("sha256").update(material).digest();
}

export function encryptSecret(secret: string): string {
  const keyMaterial = requireEnv("TOKEN_ENCRYPTION_KEY");
  const key = buildKey(keyMaterial);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(payload: string): string {
  const keyMaterial = requireEnv("TOKEN_ENCRYPTION_KEY");
  const key = buildKey(keyMaterial);
  const [ivEncoded, authTagEncoded, encryptedEncoded] = payload.split(".");

  if (!ivEncoded || !authTagEncoded || !encryptedEncoded) {
    throw new Error("Invalid encrypted payload format.");
  }

  const iv = Buffer.from(ivEncoded, "base64url");
  const authTag = Buffer.from(authTagEncoded, "base64url");
  const encrypted = Buffer.from(encryptedEncoded, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
