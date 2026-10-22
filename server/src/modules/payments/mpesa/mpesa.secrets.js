const crypto = require("crypto");

// A workspace's Daraja secrets (consumer secret, passkey, security credential) are kept in the
// database encrypted with AES-256-GCM under MPESA_SECRETS_KEY — any long random string; the key
// is its SHA-256. Without it a workspace can't save its own Paybill (the installation's Paybill
// in .env still works). Changing the key makes saved secrets unreadable: they'd have to be
// entered again.
//
// Stored as "v1:<iv>:<tag>:<ciphertext>", each part base64.

function keyFrom(secret = process.env.MPESA_SECRETS_KEY) {
  if (!secret || String(secret).length < 16) return null;
  return crypto.createHash("sha256").update(String(secret)).digest();
}

function canEncrypt(secret) {
  return Boolean(keyFrom(secret));
}

function encrypt(plain, secret) {
  if (plain === null || plain === undefined || plain === "") return null;
  const key = keyFrom(secret);
  if (!key) throw Object.assign(new Error("MPESA_SECRETS_KEY isn't set on this server, so M-Pesa keys can't be saved"), { statusCode: 409 });
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

// Null when there's nothing stored, or it can't be read (no key, or a different key).
function decrypt(stored, secret) {
  if (!stored) return null;
  const key = keyFrom(secret);
  const [version, iv, tag, data] = String(stored).split(":");
  if (!key || version !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

module.exports = { encrypt, decrypt, canEncrypt };
