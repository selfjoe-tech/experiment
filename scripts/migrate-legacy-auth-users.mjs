/**
 * One-time migration from the legacy public.profiles password store to Supabase Auth.
 *
 * Safe defaults:
 * - Dry-run unless APPLY=true.
 * - Never prints email addresses or password hashes.
 * - Preserves the existing profile UUID as auth.users.id.
 * - Imports the existing bcrypt hash without needing the user's plaintext password.
 * - Does not overwrite users that already exist in Supabase Auth.
 *
 * Required environment:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 *
 * Optional:
 *   APPLY=true                         Actually create Auth users (default: false).
 *   CONFIRM_LEGACY_EMAILS=true         Mark old emails confirmed. Only use if you
 *                                      have independent evidence that addresses
 *                                      were verified by the old system.
 *
 * Run from the repository root:
 *   node --env-file=.env.local scripts/migrate-legacy-auth-users.mjs
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const applyChanges = process.env.APPLY === "true";
const confirmLegacyEmails = process.env.CONFIRM_LEGACY_EMAILS === "true";

if (!supabaseUrl || !secretKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) or SUPABASE_SECRET_KEY."
  );
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

async function loadAllAuthUsers() {
  const users = [];
  const perPage = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) throw new Error(`Could not list existing Auth users: ${error.message}`);

    users.push(...data.users);
    if (data.users.length < perPage) break;
  }

  return users;
}

const { data: profiles, error: profilesError } = await supabase
  .from("profiles")
  .select("id, username, email, hash")
  .order("created_at", { ascending: true });

if (profilesError) {
  throw new Error(`Could not read legacy profiles: ${profilesError.message}`);
}

const existingUsers = await loadAllAuthUsers();
const usersById = new Map(existingUsers.map((user) => [user.id, user]));
const usersByEmail = new Map(
  existingUsers
    .filter((user) => user.email)
    .map((user) => [user.email.toLowerCase(), user])
);

let created = 0;
let skipped = 0;
let failed = 0;

console.log(`Found ${profiles.length} legacy profile(s).`);
console.log(`Found ${existingUsers.length} existing Supabase Auth user(s).`);
console.log(applyChanges ? "Mode: APPLY" : "Mode: DRY RUN (no changes will be made).");
console.log(
  `Legacy email confirmation: ${confirmLegacyEmails ? "confirmed" : "not confirmed"}.`
);

for (const profile of profiles) {
  const id = String(profile.id ?? "");
  const email = String(profile.email ?? "").trim().toLowerCase();
  const username = String(profile.username ?? "").trim().toLowerCase();
  const hash = String(profile.hash ?? "");

  if (!UUID_V4.test(id)) {
    failed += 1;
    console.error(`SKIP invalid UUID for legacy profile ${id || "(missing id)"}.`);
    continue;
  }

  if (!email || !email.includes("@")) {
    failed += 1;
    console.error(`SKIP profile ${id}: missing or invalid email.`);
    continue;
  }

  if (!username || username.length > 30 || !/^[a-z0-9._]+$/.test(username)) {
    failed += 1;
    console.error(`SKIP profile ${id}: username does not meet current rules.`);
    continue;
  }

  if (!BCRYPT_HASH.test(hash)) {
    failed += 1;
    console.error(
      `SKIP profile ${id}: password hash is not a supported bcrypt-format hash.`
    );
    continue;
  }

  const userWithSameId = usersById.get(id);
  if (userWithSameId) {
    if ((userWithSameId.email ?? "").toLowerCase() !== email) {
      failed += 1;
      console.error(
        `CONFLICT profile ${id}: an Auth user already exists with this ID but a different email.`
      );
      continue;
    }

    skipped += 1;
    console.log(`SKIP ${id}: matching Auth user already exists; no changes made.`);
    continue;
  }

  const userWithSameEmail = usersByEmail.get(email);
  if (userWithSameEmail) {
    failed += 1;
    console.error(
      `CONFLICT profile ${id}: this email is already assigned to a different Auth user ID.`
    );
    continue;
  }

  if (!applyChanges) {
    console.log(`WOULD IMPORT ${id} (username: ${username}).`);
    continue;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    id,
    email,
    password_hash: hash,
    email_confirm: confirmLegacyEmails,
    user_metadata: { username },
  });

  if (error || !data.user) {
    failed += 1;
    console.error(
      `FAILED ${id}: ${error?.message ?? "Auth did not return a created user."}`
    );
    continue;
  }

  created += 1;
  usersById.set(id, data.user);
  usersByEmail.set(email, data.user);
  console.log(`IMPORTED ${id} (username: ${username}).`);
}

console.log("");
console.log("Migration summary");
console.log(`Created: ${created}`);
console.log(`Already present: ${skipped}`);
console.log(`Would create: ${applyChanges ? 0 : profiles.length - skipped - failed}`);
console.log(`Failed/conflicts: ${failed}`);

if (failed > 0) {
  process.exitCode = 1;
}
