"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import AuthDialog from "./AuthDialog";
import { Eye, EyeOff } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { loginAction } from "@/lib/actions/auth";
import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";



export function LoginForm({ onShowForgot }: { onShowForgot: () => void }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});

  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const sp = useSearchParams();
  const redirect = sp.get("redirect") || "/";

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await loginAction(formData);
      if (result.success) {
        router.push(redirect);
        router.refresh();
      } else {
        setError(result.message ?? "Unable to log in.");
        setFieldErrors(result.fieldErrors ?? {});
      }
    });
  };

  return (
    <AuthDialog title="Log In">
      <h2 className="text-xl font-semibold mb-6">Log In</h2>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="id">Username or Email</Label>
          <Input
            id="id"
            name="identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="you@example.com"
            className="bg-black border-white/30 text-white placeholder:text-white/40 h-12"
            autoFocus
          />
          {fieldErrors.identifier && (
            <p className="text-xs text-red-400 mt-1">
              {fieldErrors.identifier}
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
          {fieldErrors.password && (
            <p className="text-xs text-red-400 mt-1">
              {fieldErrors.password}
            </p>
          )}
        </div>

        <div className="flex justify-between text-xs text-white/70">
          <span />
          <button
            type="button"
            onClick={onShowForgot}
            className="underline underline-offset-4 hover:text-white"
          >
            Forgot password?
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-400 text-center">{error}</p>
        )}

        <Button
          type="submit"
          disabled={isPending}
          className="w-full h-12 rounded-full bg-white text-black hover:bg-white/90 font-semibold"
        >
          {isPending ? "Logging in..." : "Log In"}
        </Button>

        <p className="text-center text-sm text-white/70">
          New to Upskirt Candy?{" "}
          <Link
            href={`/auth/signup?redirect=${encodeURIComponent(redirect)}`}
            className="text-white underline underline-offset-4"
          >
            Sign up now.
          </Link>
        </p>
      </form>
    </AuthDialog>
  );
}





