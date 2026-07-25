/**
 * Autenticación por contraseña única (APP_PASSWORD).
 * Helpers puros y sin efectos, importables tanto desde `proxy.ts`
 * como desde las Server Actions. No pongas `"use server"` aquí.
 */

export const SESSION_COOKIE = "finanzas_session";
// Duración de la sesión: 30 días.
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Token de sesión derivado de la contraseña con SHA-256.
 * Guardamos este hash en la cookie (no la contraseña en claro) y el proxy
 * lo recalcula desde `APP_PASSWORD` para validar cada request.
 */
export async function sessionToken(): Promise<string> {
  const secret = process.env.APP_PASSWORD ?? "";
  const data = new TextEncoder().encode(`finanzas::${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Verifica que el valor de una cookie corresponda a la contraseña actual. */
export async function isValidSession(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token) return false;
  return token === (await sessionToken());
}
