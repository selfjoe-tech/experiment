import Link from "next/link";
import LoginForm from "./LoginForm";

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111] p-6 space-y-5">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Admin login</h1>
          <p className="text-xs text-white/60">
            Log in to manage users, reports and ads.
          </p>
        </div>

        <LoginForm />

        <div className="text-[11px] text-white/50 text-center">
          First time here?{" "}
          <Link
            href="/admin/signup"
            className="text-pink-400 hover:text-pink-300 underline"
          >
            Create an admin
          </Link>
        </div>
      </div>
    </div>
  );
}
