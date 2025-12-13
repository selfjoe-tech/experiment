"use server";

import { supabase } from "@/lib/supabaseClient";
import { signAdminJwt } from "@/lib/adminJwt";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type LoginFormState = {
  error: string | null;
};

export async function loginAction(
  prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const { data: admin, error: adminErr } = await supabase
    .from("admin_users")
    .select("id, password_hash")
    .eq("email", email)
    .single();

  if (adminErr || !admin) {
    console.error("login: admin not found", adminErr);
    return { error: "Invalid email or password." };
  }

  const ok = await bcrypt.compare(password, admin.password_hash);

  if (!ok) {
    return { error: "Invalid email or password." };
  }

  const token = await signAdminJwt(admin.id);
  const cookieStore = await cookies();

  cookieStore.set("admin_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: 60 * 60,
  });

  redirect("/admin/dashboard");
}
