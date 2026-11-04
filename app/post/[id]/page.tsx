import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Redirect legacy post links to the canonical watch URL. */
export default async function LegacyPostRedirect({ params }: { params: Promise<{id: string}> }) {
  const { id } = await params;
  const mediaId = Number(id);
  if (!Number.isSafeInteger(mediaId) || mediaId <= 0) redirect("/");
  const supabase = await createClient();
  const { data } = await supabase.from("media").select("media_type").eq("id", mediaId).maybeSingle();
  if (data?.media_type === "video") redirect(`/watch/${mediaId}`);
  redirect("/explore/images");
}
