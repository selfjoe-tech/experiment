import "server-only";
import { createHash, createHmac } from "node:crypto";

type R2Method = "PUT" | "GET" | "HEAD" | "DELETE";

function credentials(isPrivate = false) {
  const account = process.env.R2_ACCOUNT_ID;
  const access = isPrivate
    ? (process.env.R2_PRIVATE_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID)
    : process.env.R2_ACCESS_KEY_ID;
  const secret = isPrivate
    ? (process.env.R2_PRIVATE_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY)
    : process.env.R2_SECRET_ACCESS_KEY;
  const bucket = isPrivate
    ? (process.env.R2_PRIVATE_BUCKET_NAME || "goongram-private")
    : process.env.R2_BUCKET_NAME;
  if (!account || !access || !secret || !bucket) {
    throw new Error("Cloudflare R2 credentials not configured.");
  }
  if (!/^[a-z0-9-]+$/.test(bucket) || !/^[a-f0-9]{32}$/i.test(account)) {
    throw new Error("Invalid R2 storage configuration.");
  }
  return { account, access, secret, bucket };
}
function encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    "%" + char.charCodeAt(0).toString(16).toUpperCase()
  );
}
function hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}
function hmac(key: Buffer | string, message: string): Buffer {
  return createHmac("sha256", key).update(message).digest();
}
function checkedKey(key: string) {
  if (
    !key || key.startsWith("/") ||
    key.split("/").some((part) => !part || part === "." || part === "..")
  ) throw new Error("Invalid R2 object key.");
  return key.split("/").map(encode).join("/");
}
export function r2PublicUrl(key: string): string {
  const root = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!root) throw new Error("R2 public URL is missing.");
  const url = new URL(root);
  if (url.protocol !== "https:" || url.search || url.hash || url.username || url.password) {
    throw new Error("Invalid R2 public URL.");
  }
  return url.toString().replace(/\/$/, "") + "/" + checkedKey(key);
}
export function r2KeyFromPublicUrl(value: string): string | null {
  try {
    const base = new URL(r2PublicUrl("test-key"));
    const candidate = new URL(value);
    const prefix = base.pathname.replace(/test-key$/, "");
    if (candidate.origin !== base.origin || !candidate.pathname.startsWith(prefix) ||
        candidate.search || candidate.hash) return null;
    const key = candidate.pathname.slice(prefix.length);
    checkedKey(decodeURIComponent(key));
    return decodeURIComponent(key);
  } catch {
    return null;
  }
}
/** AWS Signature V4 for Cloudflare R2's S3 API; no extra runtime packages. */
export function presignR2({
  key, method, contentType, expires = 300, isPrivate = false,
}: {
  key: string; method: R2Method; contentType?: string; expires?: number; isPrivate?: boolean;
}): string {
  const { account, access, secret, bucket } = credentials(isPrivate);
  if (!Number.isInteger(expires) || expires < 1 || expires > 3600) {
    throw new Error("Invalid presign expiry.");
  }
  const now = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = now.slice(0, 8);
  const scope = date + "/auto/s3/aws4_request";
  const host = account + ".r2.cloudflarestorage.com";
  const uri = "/" + bucket + "/" + checkedKey(key);
  const headers = contentType
    ? "content-type:" + contentType + "\nhost:" + host + "\n"
    : "host:" + host + "\n";
  const signedHeaders = contentType ? "content-type;host" : "host";
  const params: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": access + "/" + scope,
    "X-Amz-Date": now,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": signedHeaders,
  };
  const canonicalQuery = Object.keys(params).sort()
    .map((key) => encode(key) + "=" + encode(params[key])).join("&");
  const canonicalRequest =
    method + "\n" + uri + "\n" + canonicalQuery + "\n" +
    headers + "\n" + signedHeaders + "\nUNSIGNED-PAYLOAD";
  const stringToSign =
    "AWS4-HMAC-SHA256\n" + now + "\n" + scope + "\n" + hex(canonicalRequest);
  const signingKey = hmac(hmac(hmac(hmac("AWS4" + secret, date), "auto"), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return "https://" + host + uri + "?" + canonicalQuery + "&X-Amz-Signature=" + signature;
}
export async function putR2Object(key: string, content: Buffer | Uint8Array, type: string, isPrivate = false) {
  const signed = presignR2({ key, method: "PUT", contentType: type, isPrivate });
  const result = await fetch(signed, {
    method: "PUT", body: Buffer.from(content), headers: { "Content-Type": type },
    cache: "no-store",
  });
  if (!result.ok) throw new Error("R2 upload failed: HTTP " + result.status);
}
export async function deleteR2Object(key: string, isPrivate = false) {
  const signed = presignR2({ key, method: "DELETE", isPrivate });
  const result = await fetch(signed, { method: "DELETE", cache: "no-store" });
  if (!result.ok && result.status !== 404) {
    throw new Error("R2 delete failed: HTTP " + result.status);
  }
}
export async function getR2Object(key: string, isPrivate = false) {
  const signed = presignR2({ key, method: "GET", isPrivate });
  const result = await fetch(signed, { cache: "no-store" });
  if (!result.ok) throw new Error("R2 read failed: HTTP " + result.status);
  return result;
}
