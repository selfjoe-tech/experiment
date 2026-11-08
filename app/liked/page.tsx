import { redirect } from "next/navigation";

export default function LikedPage() {
  redirect("/history?tab=liked");
}
