"use server";
import { supabase } from "@/lib/supabaseClient"; 

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

export async function submitVerificationRequest(formData: FormData) {

  // read links from formData
  const links: VerificationLinks = {
    onlyfans: formData.get("onlyfans")?.toString() || undefined,
    manyvids: formData.get("manyvids")?.toString() || undefined,
    pornhub: formData.get("pornhub")?.toString() || undefined,
    chaturbate: formData.get("chaturbate")?.toString() || undefined,
    fansly: formData.get("fansly")?.toString() || undefined,
    clips4sale: formData.get("clips4sale")?.toString() || undefined,
    loyalfans: formData.get("loyalfans")?.toString() || undefined,
    fancentro: formData.get("fancentro")?.toString() || undefined,
    privacy: formData.get("privacy")?.toString() || undefined,
  };

  const selfie = formData.get("selfie") as File | null;
  if (!selfie || selfie.size === 0) {
    throw new Error("Please upload a verification photo.");
  }

  const ext = selfie.type === "image/png" ? "png" : "jpg";
  const filePath = `verify-selfies/2d78c663-73dc-4cc1-88e1-a113cc0fc47d/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(filePath, selfie, {
      cacheControl: "3600",
      upsert: true,
      contentType: selfie.type,
    });

  if (uploadError) {
    console.error(uploadError);
    throw new Error("Failed to upload verification photo.");
  }

  const { error: insertError } = await supabase.from("verify").insert({
    creator_id: "2d78c663-73dc-4cc1-88e1-a113cc0fc47d",
    links,
    selfie_path: filePath,
    status: "pending",
  });

  if (insertError) {
    console.error(insertError);
    throw new Error("Failed to create verification request.");
  }

  return { ok: true };
}


type VerificationState =
  | { status: "none" }
  | { status: "pending"; request: VerificationRow }
  | { status: "rejected"; request: VerificationRow };

  export async function getVerificationStateForCurrentUser(): Promise<VerificationState> {
  

  const user = {
        id: "2d78c663-73dc-4cc1-88e1-a113cc0fc47d"
    }


  const { data, error } = await supabase
    .from("verify")
    .select("*")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) return { status: "none" };

  const pending = data.find((r) => r.status === "pending");
  if (pending) return { status: "pending", request: pending as VerificationRow };

  const rejected = data.find((r) => r.status === "rejected");
  if (rejected) return { status: "rejected", request: rejected as VerificationRow, notes: data.review_notes };

  // approved / old records – route will be hidden anyway
  return { status: "none" };
}