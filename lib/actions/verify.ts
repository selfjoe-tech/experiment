"use server";

import { createClient } from "@/lib/supabase/server";

export type VerificationLinks = {
  onlyfans?: string;
  manyvids?: string;
  pornhub?: string;
  chaturbate?: string;
  fansly?: string;
  clips4sale?: string;
  loyalfans?: string;
  fancentro?: string;
  privacy?: string;
};

export type VerificationStatus = "pending" | "rejected" | "approved";

export type VerificationRow = {
  id: string;
  creator_id: string;
  links: Record<string, string>;
  storage_path: string;
  status: VerificationStatus;
  notes: string | null;
  created_at: string;
  reviewed_at: string | null;
};

async function getCurrentUserId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("You must be signed in to submit a verification request.");
  }

  return user.id;
}

export async function submitVerificationRequest(formData: FormData) {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);

  const links: VerificationLinks = {
    onlyfans: formData.get("onlyfans")?.toString().trim() || undefined,
    manyvids: formData.get("manyvids")?.toString().trim() || undefined,
    pornhub: formData.get("pornhub")?.toString().trim() || undefined,
    chaturbate: formData.get("chaturbate")?.toString().trim() || undefined,
    fansly: formData.get("fansly")?.toString().trim() || undefined,
    clips4sale: formData.get("clips4sale")?.toString().trim() || undefined,
    loyalfans: formData.get("loyalfans")?.toString().trim() || undefined,
    fancentro: formData.get("fancentro")?.toString().trim() || undefined,
    privacy: formData.get("privacy")?.toString().trim() || undefined,
  };

  const selfie = formData.get("selfie");
  if (!(selfie instanceof File) || selfie.size === 0) {
    throw new Error("Please upload a verification photo.");
  }

  const allowedTypes: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  const extension = allowedTypes[selfie.type];
  if (!extension) {
    throw new Error("Verification photo must be JPG, PNG or WEBP.");
  }

  if (selfie.size > 10 * 1024 * 1024) {
    throw new Error("Verification photo must be 10 MB or smaller.");
  }

  const filePath = `verify-selfies/${userId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("verification")
    .upload(filePath, selfie, {
      cacheControl: "3600",
      upsert: false,
      contentType: selfie.type,
    });

  if (uploadError) {
    console.error("submitVerificationRequest upload error", uploadError);
    throw new Error("Failed to upload verification photo.");
  }

  const { error: insertError } = await supabase.from("verify").insert({
    creator_id: userId,
    links,
    selfie_path: filePath,
    storage_path: filePath,
    status: "pending",
  });

  if (insertError) {
    console.error("submitVerificationRequest insert error", insertError);
    await supabase.storage.from("verification").remove([filePath]);
    throw new Error("Failed to create verification request.");
  }

  return { ok: true };
}

type VerificationState =
  | { status: "none" }
  | { status: "pending"; request: VerificationRow }
  | { status: "rejected"; request: VerificationRow }
  | { status: "approved"; request: VerificationRow };

export async function getVerificationStateForCurrentUser(): Promise<VerificationState> {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);

  const { data, error } = await supabase
    .from("verify")
    .select(
      "id, creator_id, links, selfie_path, storage_path, status, notes, review_notes, created_at, reviewed_at"
    )
    .eq("creator_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getVerificationStateForCurrentUser error", error);
    throw new Error("Could not load verification status.");
  }

  if (!data?.length) return { status: "none" };

  const row = data.find((item) => item.status === "pending") ??
    data.find((item) => item.status === "rejected") ??
    data.find((item) => item.status === "approved");

  if (!row) return { status: "none" };

  const request: VerificationRow = {
    id: String(row.id),
    creator_id: row.creator_id,
    links: row.links ?? {},
    storage_path: row.storage_path ?? row.selfie_path ?? "",
    status: row.status as VerificationStatus,
    notes: row.notes ?? row.review_notes ?? null,
    created_at: row.created_at,
    reviewed_at: row.reviewed_at,
  };

  if (request.status === "pending") return { status: "pending", request };
  if (request.status === "rejected") return { status: "rejected", request };
  return { status: "approved", request };
}
