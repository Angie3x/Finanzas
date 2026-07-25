"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE, sessionToken } from "@/lib/auth";

/** Verifica la contraseña y, si es correcta, abre sesión con una cookie httpOnly. */
export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.APP_PASSWORD ?? "";

  if (!expected || password !== expected) {
    redirect("/login?error=1");
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, await sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  redirect("/");
}

/** Cierra la sesión borrando la cookie. */
export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
