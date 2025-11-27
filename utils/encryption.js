const crypto = require("crypto");

const HEX_KEY_LENGTH = 64; // 32 bytes represented as hex
const encryptionKey = process.env.ENCRYPTION_KEY;
const shouldLogEncryption = process.env.ENCRYPTION_DEBUG === "true";

if (!encryptionKey || encryptionKey.length !== HEX_KEY_LENGTH) {
  throw new Error(
    "ENCRYPTION_KEY must be defined in the environment as a 64-character hex string (32 bytes)."
  );
}

const keyBuffer = Buffer.from(encryptionKey, "hex");

const logEncryptionEvent = (action, label) => {
  if (shouldLogEncryption) {
    console.log(`[Encryption] ${action} (${label})`);
  }
};

const encrypt = (text, { label = "value" } = {}) => {
  if (text === null || text === undefined) {
    return null;
  }

  const stringValue = String(text);
  if (!stringValue.length) {
    return null;
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", keyBuffer, iv);
  let encrypted = cipher.update(stringValue, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const payload = `${iv.toString("hex")}:${encrypted.toString("hex")}`;
  logEncryptionEvent("Encrypted", label);
  return payload;
};

const decrypt = (payload, { label = "value" } = {}) => {
  if (payload === null || payload === undefined || payload === "") {
    return "";
  }

  const [ivHex, encryptedHex] = payload.split(":");
  if (!ivHex || !encryptedHex) {
    throw new Error("Invalid encrypted payload format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const encryptedText = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", keyBuffer, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  logEncryptionEvent("Decrypted", label);
  return decrypted.toString("utf8");
};

const safeEncrypt = (value, options = {}) => {
  const result = encrypt(value, options);
  return result;
};

const safeDecrypt = (value, { returnNull = false, label = "value" } = {}) => {
  if (value === null || value === undefined || value === "") {
    return returnNull ? null : "";
  }
  try {
    return decrypt(value, { label });
  } catch {
    // Value was probably stored before encryption was enabled
    return value;
  }
};

module.exports = { encrypt, decrypt, safeEncrypt, safeDecrypt };
