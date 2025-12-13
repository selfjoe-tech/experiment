// app/auth/signup/page.tsx
"use client";

import { FormEvent, Suspense, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import AuthDialog from "@/app/components/auth/AuthDialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { signupAction, AuthFieldErrors, checkUsernameAvailability  } from "@/lib/actions/auth";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
  "idle" | "checking" | "available" | "taken"
>("idle");
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});

  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const sp = useSearchParams();
  const redirect = sp.get("redirect") || "/preferences";

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await signupAction(formData);
      if (result.success) {
        router.push("/preferences");
        router.refresh();
      } else {
        setError(result.message ?? "Unable to sign up.");
        setFieldErrors(result.fieldErrors ?? {});
      }
    });
  };

  const handleUsernameChange = (value: string) => {
  // enforce lowercase + allowed characters only on the client too
  const cleaned = value.toLowerCase().replace(/[^a-z0-9._]/g, "");
  setUsername(cleaned);
  // reset status when user types
  setUsernameStatus(cleaned ? "checking" : "idle");
};

useEffect(() => { (async () => {
if (!username) {
    setUsernameStatus("idle");
    return;
  }

  // Optional: only check when at least 3 characters
  if (username.length < 3) {
    setUsernameStatus("idle");
    return;
  }

  let cancelled = false;

  const handle = window.setTimeout(async () => {
    setUsernameStatus("checking");
    try {
      const res = await checkUsernameAvailability(username);
      if (cancelled) return;
      setUsernameStatus(res.available ? "available" : "taken");
    } catch (err) {
      console.error("username availability check failed", err);
      if (!cancelled) {
        setUsernameStatus("idle");
      }
    }
  }, 400); // 400ms debounce

  return () => {
    cancelled = true;
    window.clearTimeout(handle);
  };

})()
  
}, [username]);

  return (
    <Suspense>
    <AuthDialog title="Sign Up">
      <h2 className="text-xl font-semibold mb-6">Sign Up</h2>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
  <Label htmlFor="username">Username</Label>
  <Input
    id="username"
    name="username"
    value={username}
    onChange={(e) => handleUsernameChange(e.target.value)}
    placeholder="yourname"
    className="bg-black border-white/30 text-white placeholder:text-white/40 h-12"
    autoFocus
  />
  <p className="text-[11px] text-white/50">
    Lowercase letters, numbers, &quot;.&quot; and &quot;_&quot; only.
  </p>

  {fieldErrors.username && (
    <p className="text-xs text-red-400 mt-1">{fieldErrors.username}</p>
  )}

  {username && !fieldErrors.username && (
    <>
      {usernameStatus === "checking" && (
        <p className="text-[11px] text-white/50 mt-1">
          Checking availability…
        </p>
      )}
      {usernameStatus === "available" && (
        <p className="text-[11px] text-emerald-400 mt-1">
          Username is available.
        </p>
      )}
      {usernameStatus === "taken" && (
        <p className="text-[11px] text-red-400 mt-1">
          That username is already taken.
        </p>
      )}
    </>
  )}
</div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="bg-black border-white/30 text-white placeholder:text-white/40 h-12"
          />
          {fieldErrors.email && (
            <p className="text-xs text-red-400 mt-1">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-black border-white/30 text-white placeholder:text-white/40 h-12 pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="absolute inset-y-0 right-3 flex items-center text-white/60 hover:text-white"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="text-[11px] text-white/50">
            At least 6 characters.
          </p>
          {fieldErrors.password && (
            <p className="text-xs text-red-400 mt-1">
              {fieldErrors.password}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-black border-white/30 text-white placeholder:text-white/40 h-12 pr-11"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((p) => !p)}
              className="absolute inset-y-0 right-3 flex items-center text-white/60 hover:text-white"
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {fieldErrors.confirmPassword && (
            <p className="text-xs text-red-400 mt-1">
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-400 text-center">{error}</p>
        )}

        <Button
          type="submit"
          disabled={isPending}
          className="w-full h-12 rounded-full bg-white text-black hover:bg-white/90 font-semibold"
        >
          {isPending ? "Signing up..." : "Sign Up"}
        </Button>

        <p className="text-center text-sm text-white/70">
          Already have an account?{" "}
          <Link
            href={`/auth/login?redirect=${encodeURIComponent(redirect)}`}
            className="text-white underline underline-offset-4"
          >
            Log in
          </Link>
        </p>

        <p className="text-center text-xs text-white/50">
          By continuing, you agree to our policies.
        </p>
      </form>
    </AuthDialog>
    </Suspense>
  );
}
