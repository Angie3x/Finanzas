import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";

/**
 * Guardián de acceso: exige una sesión válida (cookie con la contraseña
 * correcta) en todas las rutas salvo `/login`. Sin sesión → redirige a login.
 * También expone el pathname en un header para que el layout oculte la
 * barra de navegación en la pantalla de acceso.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login";
  const valid = await isValidSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (!valid && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (valid && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Excluye assets estáticos, imágenes y API para no romper CSS/JS ni imágenes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
