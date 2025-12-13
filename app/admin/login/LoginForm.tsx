"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAction, type LoginFormState } from "./actions";
import { AdminPasswordField } from "../_components/AdminPasswordField";

const initialState: LoginFormState = { error: null };

function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`mt-2 w-full h-9 rounded-full text-xs font-semibold ${
        pending
          ? "bg-pink-500/60 text-black cursor-wait"
          : "bg-pink-500 text-black hover:bg-pink-400"
      }`}
    >
      {pending ? "Logging in..." : "Log in"}
    </button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useFormState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      {state.error && (
        <div className="text-[11px] text-red-400">{state.error}</div>
      )}

      <div className="space-y-1">
        <label className="block text-xs text-white/70">Email</label>
        <input
          type="email"
          name="email"
          required
          className="w-full h-9 rounded-md bg-black/40 border border-white/20 px-3 text-sm"
          placeholder="admin@example.com"
        />
      </div>

      <AdminPasswordField label="Password" name="password" required />

      <LoginSubmitButton />
    </form>
  );
}
