import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { notConfigured } from "../utils/ApiError.js";

// Private file storage. STORAGE_MODE (see config/env.js):
//   disabled → storageEnabled() is false; upload endpoints say "not set up"
//   local    → files under STORAGE_LOCAL_DIR, served through short-lived signed API links
//   r2       → Cloudflare R2 through its S3-compatible API, presigned PUT/GET URLs
//
// Both real modes expose the same contract, so the browser code is identical:
// it PUTs the file to `url` with `headers`, then asks the API to confirm. Nothing
// is ever public: every download is a signed link that expires in minutes.

export const storageEnabled = () => env.storage.mode !== "disabled";
export function requireStorage() {
  if (!storageEnabled()) throw notConfigured("File uploads are not set up on this server yet. Ask your hostel admin.");
}

const ttl = () => env.storage.signedUrlTtl;

// ── Cloudflare R2 ────────────────────────────────────────────────────────────
let r2Client;
async function r2() {
  if (!r2Client) {
    const { S3Client } = await import("@aws-sdk/client-s3");
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${env.storage.r2AccountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: env.storage.r2AccessKeyId, secretAccessKey: env.storage.r2SecretAccessKey },
    });
  }
  return r2Client;
}

const r2Driver = {
  async createUploadUrl({ key, contentType, sizeBytes }) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const cmd = new PutObjectCommand({ Bucket: env.storage.r2Bucket, Key: key, ContentType: contentType, ContentLength: sizeBytes });
    // Type and length are part of the signature: a different file is refused by R2.
    const url = await getSignedUrl(await r2(), cmd, { expiresIn: ttl(), signableHeaders: new Set(["content-type", "content-length"]) });
    return { url, method: "PUT", headers: { "Content-Type": contentType } };
  },
  async head(key) {
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
    try {
      const r = await (await r2()).send(new HeadObjectCommand({ Bucket: env.storage.r2Bucket, Key: key }));
      return { sizeBytes: Number(r.ContentLength), contentType: r.ContentType };
    } catch (err) {
      if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound") return null;
      throw err;
    }
  },
  async createDownloadUrl(key, fileName) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const cmd = new GetObjectCommand({ Bucket: env.storage.r2Bucket, Key: key, ResponseContentDisposition: disposition(fileName) });
    return getSignedUrl(await r2(), cmd, { expiresIn: ttl() });
  },
  async remove(key) {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await (await r2()).send(new DeleteObjectCommand({ Bucket: env.storage.r2Bucket, Key: key }));
  },
};

// ── Local folder (development) ───────────────────────────────────────────────
// Signed links to /api/v1/uploads/local/:token stand in for presigned URLs.
const localRoot = () => path.resolve(env.storage.localDir);
const localPath = (key) => {
  const p = path.resolve(localRoot(), key);
  if (!p.startsWith(localRoot() + path.sep)) throw new Error("Invalid storage key");
  return p;
};
const signingKey = () => crypto.createHash("sha256").update(`storage:${env.jwt.accessSecret}`).digest();

export function signLocalToken(claims) {
  const body = Buffer.from(JSON.stringify({ ...claims, exp: Date.now() + ttl() * 1000 })).toString("base64url");
  const sig = crypto.createHmac("sha256", signingKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
}
export function verifyLocalToken(token) {
  const [body, sig] = String(token).split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", signingKey()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  return claims.exp > Date.now() ? claims : null;
}

const localUrl = (token) => `${env.storage.publicApiUrl}/api/v1/uploads/local/${token}`;

const localDriver = {
  async createUploadUrl({ key, contentType, sizeBytes }) {
    return { url: localUrl(signLocalToken({ op: "put", key, contentType, sizeBytes })), method: "PUT", headers: { "Content-Type": contentType } };
  },
  async head(key) {
    try {
      const [stat, meta] = await Promise.all([fs.stat(localPath(key)), fs.readFile(`${localPath(key)}.meta.json`, "utf8")]);
      return { sizeBytes: stat.size, contentType: JSON.parse(meta).contentType };
    } catch {
      return null;
    }
  },
  async createDownloadUrl(key, fileName) {
    return localUrl(signLocalToken({ op: "get", key, fileName }));
  },
  async remove(key) {
    await fs.rm(localPath(key), { force: true });
    await fs.rm(`${localPath(key)}.meta.json`, { force: true });
  },
  /** Used by the local upload route only. */
  async write(key, contentType, buffer) {
    await fs.mkdir(path.dirname(localPath(key)), { recursive: true });
    await fs.writeFile(localPath(key), buffer);
    await fs.writeFile(`${localPath(key)}.meta.json`, JSON.stringify({ contentType }));
  },
  async read(key) {
    const [buffer, meta] = await Promise.all([fs.readFile(localPath(key)), fs.readFile(`${localPath(key)}.meta.json`, "utf8")]);
    return { buffer, contentType: JSON.parse(meta).contentType };
  },
};

function disposition(fileName) {
  const safe = String(fileName || "file").replace(/[^\w.\- ]/g, "_");
  return `inline; filename="${safe}"`;
}
export { disposition as contentDisposition };

/** The active driver. Tests can swap it with `setStorageDriver`. */
let override = null;
export function storage() {
  requireStorage();
  if (override) return override;
  return env.storage.mode === "r2" ? r2Driver : localDriver;
}
export const localStorageDriver = localDriver;
export function setStorageDriver(driver) { override = driver; }
