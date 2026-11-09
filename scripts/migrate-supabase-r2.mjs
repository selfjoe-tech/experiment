#!/usr/bin/env node
/**
 * One-time, resumable Supabase Storage -> Cloudflare R2 backfill.
 *
 * Run locally (Node 20+) with secrets in your terminal environment.
 * Dry-run by default: node scripts/migrate-supabase-r2.mjs
 * Copy and verify: node scripts/migrate-supabase-r2.mjs --execute
 * Switch database references after verification:
 *   node scripts/migrate-supabase-r2.mjs --execute --update-db
 *
 * Never deletes source objects. Uses only Node built-ins.
 */
import { createHash, createHmac } from "node:crypto";
import { writeFile } from "node:fs/promises";
const env = process.env;
const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "NEXT_PUBLIC_R2_PUBLIC_URL"];
for (const key of required) if (!env[key]) throw new Error("Missing " + key);
const sourceRoot = env.SUPABASE_URL.replace(/\/+$/, "");
const targetRoot = env.NEXT_PUBLIC_R2_PUBLIC_URL.replace(/\/+$/, "");
const execute = process.argv.includes("--execute");
const updateDb = process.argv.includes("--update-db");
if (updateDb && !execute) throw new Error("--update-db requires --execute");
const dry = !execute;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
const account = env.R2_ACCOUNT_ID;
const bucket = env.R2_BUCKET_NAME;
if (!/^https:\/\//.test(sourceRoot) || !/^https:\/\//.test(targetRoot)) {
  throw new Error("Both URLs must be HTTPS.");
}
const pub = new URL(targetRoot);
if (pub.search || pub.hash || pub.username || pub.password) throw new Error("Invalid target public URL");
function encode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}
function keyPath(key) {
  if (!key || key.startsWith("/") || key.split("/").some(x => !x || x === "." || x === "..")) throw new Error("Invalid key " + key);
  return key.split("/").map(encode).join("/");
}
function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function mac(key, msg) { return createHmac("sha256", key).update(msg).digest(); }
function sign(key, method, mime) {
  const dateTime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = dateTime.slice(0, 8);
  const scope = date + "/auto/s3/aws4_request";
  const host = account + ".r2.cloudflarestorage.com";
  const uri = "/" + bucket + "/" + keyPath(key);
  const headers = mime ? "content-type:" + mime + "\nhost:" + host + "\n" : "host:" + host + "\n";
  const signed = mime ? "content-type;host" : "host";
  const params = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": env.R2_ACCESS_KEY_ID + "/" + scope,
    "X-Amz-Date": dateTime,
    "X-Amz-Expires": "3600",
    "X-Amz-SignedHeaders": signed,
  };
  const query = Object.keys(params).sort().map(k => encode(k) + "=" + encode(params[k])).join("&");
  const canonical = [method,uri,query,headers,signed,"UNSIGNED-PAYLOAD"].join("\n");
  const signingKey = mac(mac(mac(mac("AWS4" + env.R2_SECRET_ACCESS_KEY, date), "auto"), "s3"), "aws4_request");
  const sig = createHmac("sha256", signingKey).update(
    "AWS4-HMAC-SHA256\n" + dateTime + "\n" + scope + "\n" + sha(canonical)
  ).digest("hex");
  return "https://" + host + uri + "?" + query + "&X-Amz-Signature=" + sig;
}
function supabaseHeaders(extra = {}) {
  return { apikey: service, Authorization: "Bearer " + service, ...extra };
}
async function checkedResponse(response, label) {
  if (!response.ok) throw new Error(label + ": HTTP " + response.status + " " + (await response.text()).slice(0, 300));
  return response;
}
async function supaJson(path, options = {}) {
  const response = await fetch(sourceRoot + path, { ...options, headers: supabaseHeaders(options.headers) });
  return (await checkedResponse(response, path)).json();
}
async function storageList(storageBucket, prefix = "") {
  const found = [];
  for (let offset = 0;; offset += 1000) {
    const page = await supaJson("/storage/v1/object/list/" + encode(storageBucket), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, offset, limit: 1000, sortBy: { column: "name", order: "asc" } }),
    });
    if (!Array.isArray(page)) throw new Error("Unexpected storage list response");
    for (const obj of page) {
      if (obj.id == null) {
        found.push(...await storageList(storageBucket, prefix + obj.name + "/"));
      } else {
        found.push({ bucket: storageBucket, key: prefix + obj.name, size: Number(obj.metadata?.size ?? obj.metadata?.contentLength ?? 0) });
      }
    }
    if (page.length < 1000) break;
  }
  return found;
}
async function r2Head(key) {
  const response = await fetch(sign(key, "HEAD"), { method: "HEAD" });
  if (response.status === 404) return null;
  await checkedResponse(response, "R2 HEAD " + key);
  return { size: Number(response.headers.get("content-length")), type: response.headers.get("content-type")?.split(";")[0]?.trim() };
}
async function uploadOne(obj) {
  const existing = await r2Head(obj.key);
  if (existing && existing.size === obj.size && obj.size > 0) return { key: obj.key, status: "already-present", size: obj.size };
  if (dry) return { key: obj.key, status: "would-copy", size: obj.size };
  const sourceUrl = sourceRoot + "/storage/v1/object/authenticated/" + encode(obj.bucket) + "/" + keyPath(obj.key);
  const response = await checkedResponse(await fetch(sourceUrl, { headers: supabaseHeaders() }), "Supabase GET " + obj.key);
  const bytes = Buffer.from(await response.arrayBuffer());
  const mime = response.headers.get("content-type")?.split(";")[0]?.trim() ||
    (obj.key.endsWith(".mp4") ? "video/mp4" : "application/octet-stream");
  if (bytes.length === 0 || (obj.size && bytes.length !== obj.size)) {
    throw new Error("Source size mismatch: " + obj.key);
  }
  const targetResponse = await fetch(sign(obj.key, "PUT", mime), {
    method: "PUT", body: bytes, headers: { "Content-Type": mime },
  });
  await checkedResponse(targetResponse, "R2 PUT " + obj.key);
  const head = await r2Head(obj.key);
  if (head?.size !== bytes.length || head?.type !== mime) throw new Error("R2 verification failed: " + obj.key);
  return { key: obj.key, size: bytes.length, mime, status: "verified" };
}
async function tableRows(table, fields) {
  const rows = [];
  for (let from = 0;; from += 500) {
    const response = await supaJson("/rest/v1/" + table + "?select=" + encode(fields), {
      headers: { Range: from + "-" + (from + 499), Prefer: "count=exact" },
    });
    rows.push(...response);
    if (response.length < 500) break;
  }
  return rows;
}
async function patch(table, idColumn, id, field, oldValue, value) {
  const search = new URLSearchParams();
  search.set(idColumn, "eq." + String(id));
  search.set(field, "eq." + oldValue);
  const path = "/rest/v1/" + table + "?" + search.toString();
  const response = await fetch(sourceRoot + path, {
    method: "PATCH",
    headers: supabaseHeaders({ "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify({ [field]: value }),
  });
  const rows = await (await checkedResponse(response, "Supabase PATCH " + table)).json();
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error("Concurrent update or missing row: " + table + "/" + id);
}
const objects = await storageList("media");
const reports = [];
const manifest = new Map();
for (const obj of objects) {
  try {
    const report = await uploadOne(obj);
    reports.push(report);
    if (report.status === "verified" || report.status === "already-present") manifest.set(obj.key, report);
    console.log(report.status + " " + obj.key);
  } catch (error) {
    reports.push({ key: obj.key, status: "FAILED", error: String(error) });
    console.error("FAILED " + obj.key + ": " + error);
  }
}
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
await writeFile("r2-migration-report-" + stamp + ".json", JSON.stringify(reports, null, 2));
const failures = reports.filter(x => x.status === "FAILED");
if (failures.length) throw new Error(failures.length + " object(s) failed; no DB changes made");
if (manifest.size !== objects.length && execute) throw new Error("Not all R2 objects verified");
if (!updateDb) {
  console.log(dry ? "Dry-run complete. No files or database rows changed." : "Copy complete. Run again with --execute --update-db to switch references.");
  process.exit(0);
}
const media = await tableRows("media", "id,storage_path,thumbnail_path");
const ads = await tableRows("ads", "id,storage_path");
const profiles = await tableRows("profiles", "id,avatar_url");
const updates = [];
function addUpdate(table, id, field, oldValue, key) {
  if (!manifest.has(key)) throw new Error("Referenced object not verified: " + key);
  updates.push({ table, id, field, oldValue, value: targetRoot + "/" + keyPath(key) });
}
for (const row of [...media.map(x => ({ ...x, table: "media" })), ...ads.map(x => ({ ...x, table: "ads" }))]) {
  const path = row.storage_path;
  if (!path || /^https:\/\//i.test(path)) continue;
  addUpdate(row.table, row.id, "storage_path", path, path);
}
for (const row of media) {
  if (row.thumbnail_path && !/^https:\/\//i.test(row.thumbnail_path)) {
    addUpdate("media", row.id, "thumbnail_path", row.thumbnail_path, row.thumbnail_path);
  } else if (row.thumbnail_path &&
    row.thumbnail_path.startsWith(sourceRoot + "/storage/v1/object/public/media/")) {
    const key = decodeURIComponent(
      row.thumbnail_path.slice((sourceRoot + "/storage/v1/object/public/media/").length)
    );
    addUpdate("media", row.id, "thumbnail_path", row.thumbnail_path, key);
  }
}
for (const row of profiles) {
  if (!row.avatar_url || !row.avatar_url.startsWith(sourceRoot + "/storage/v1/object/public/media/")) continue;
  const key = decodeURIComponent(row.avatar_url.slice((sourceRoot + "/storage/v1/object/public/media/").length));
  addUpdate("profiles", row.id, "avatar_url", row.avatar_url, key);
}
for (const update of updates) {
  await patch(update.table, "id", update.id, update.field, update.oldValue, update.value);
  console.log("Updated " + update.table + "/" + update.id + "." + update.field);
}
console.log("Completed: " + objects.length + " objects validated, " + updates.length + " database references changed.");
console.log("Original Supabase objects have NOT been deleted.");
