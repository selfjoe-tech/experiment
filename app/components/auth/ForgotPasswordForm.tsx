import { Button } from "@/components/ui/button";
import AuthDialog from "./AuthDialog";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ForgotPasswordFieldErrors, requestPasswordResetAction, resetPasswordWithOtpAction } from "@/lib/actions/auth";
import { FormEvent, Suspense, useState, useTransition } from "react";

export function ForgotPasswordForm({ onBackToLogin }: { onBackToLogin: () => void }) {
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ForgotPasswordFieldErrors>({});
  const [isPending, startTransition] = useTransition();

  const handleRequest = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setFieldErrors({});

    const formData = new FormData();
    formData.set("email", email);

    startTransition(async () => {
      const res = await requestPasswordResetAction(formData);
      if (res.success) {
        setMessage(res.message ?? "We sent a code to your email.");
        setStep("reset");
      } else {
        setError(res.message ?? null);
        setFieldErrors(res.fieldErrors ?? {});
      }
    });
  };

  const handleReset = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setFieldErrors({});

    const formData = new FormData();
    formData.set("email", email);
    formData.set("otp", otp);
    formData.set("password", password);
    formData.set("confirmPassword", confirmPassword);

    startTransition(async () => {
      const res = await resetPasswordWithOtpAction(formData);
      if (res.success) {
        setMessage(res.message ?? "Password updated. You can log in now.");
        // optional: automatically go back to login after a bit
        setTimeout(onBackToLogin, 1500);
      } else {
        setError(res.message ?? null);
        setFieldErrors(res.fieldErrors ?? {});
      }
    });
  };

  const title = step === "request" ? "Forgot Password" : "Reset Password";

  return (
    <Suspense>

    <AuthDialog title={title}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onBackToLogin}
          className="text-xs text-white/70 underline underline-offset-4"
        >
          Back to log in
        </button>
      </div>

      {step === "request" ? (
        <form onSubmit={handleRequest} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="fp-email">Email</Label>
            <Input
              id="fp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-black border-white/30 text-white placeholder:text-white/40 h-12"
              autoFocus
            />
            {fieldErrors.email && (
              <p className="text-xs text-red-400 mt-1">
                {fieldErrors.email}
              </p>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}
          {message && (
            <p className="text-xs text-green-400 text-center">{message}</p>
          )}

          <Button
            type="submit"
            disabled={isPending}
            className="w-full h-12 rounded-full bg-white text-black hover:bg-white/90 font-semibold"
          >
            {isPending ? "Sending code..." : "Send reset code"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleReset} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="fp-email-readonly">Email</Label>
            <Input
              id="fp-email-readonly"
              type="email"
              value={email}
              readOnly
              className="bg-black border-white/30 text-white h-12 opacity-70"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fp-otp">Code</Label>
            <Input
              id="fp-otp"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6-digit code"
              className="bg-black border-white/30 text-white placeholder:text-white/40 h-12"
            />
            {fieldErrors.otp && (
              <p className="text-xs text-red-400 mt-1">
                {fieldErrors.otp}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fp-password">New password</Label>
            <div className="relative">
              <Input
                id="fp-password"
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

          <div className="space-y-2">
            <Label htmlFor="fp-password2">Confirm new password</Label>
            <div className="relative">
              <Input
                id="fp-password2"
                type={showPassword2 ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-black border-white/30 text-white placeholder:text-white/40 h-12 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword2((p) => !p)}
                className="absolute inset-y-0 right-3 flex items-center text-white/60 hover:text-white"
                aria-label={showPassword2 ? "Hide password" : "Show password"}
              >
                {showPassword2 ? (
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
          {message && (
            <p className="text-xs text-green-400 text-center">{message}</p>
          )}

          <Button
            type="submit"
            disabled={isPending}
            className="w-full h-12 rounded-full bg-white text-black hover:bg-white/90 font-semibold"
          >
            {isPending ? "Updating password..." : "Reset Password"}
          </Button>
        </form>
      )}
    </AuthDialog>
  </Suspense>

  );
}
