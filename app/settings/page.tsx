// app/settings/page.tsx
import { redirect } from "next/navigation";
import SettingsClient from "@/app/components/settings/SettingsClient";
import { getSettingsProfile } from "@/lib/actions/settings";

export default async function SettingsPage() {
  const profile = await getSettingsProfile();

  if (!profile || !profile.username) {
    redirect("/auth/login?redirect=/settings");
  }

  return (
    <div className="min-h-screen bg-black text-white lg:pl-64 lg:pr-80 pt-20 pb-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <SettingsClient initialProfile={profile} />
      </div>
    </div>
  );
}
