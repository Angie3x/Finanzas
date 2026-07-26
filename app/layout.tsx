import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { headers } from "next/headers";
import { logout } from "./login/actions";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Finanzas · Plan de pago de deudas",
  description:
    "Organiza tus ingresos, egresos y deudas. Crea un plan de pago y proyecta tus pagos.",
};

const nav = [
  { href: "/", label: "Panel", icon: "📊" },
  { href: "/mes", label: "Mes", icon: "📅" },
  { href: "/historial", label: "Historial", icon: "📈" },
  { href: "/deudas", label: "Deudas y egresos", icon: "💳" },
  { href: "/plan", label: "Plan de pago", icon: "🎯" },
];

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const showNav = pathname !== "/login";

  return (
    <html lang="es" className={geist.variable}>
      <body className="min-h-screen flex flex-col">
        {showNav && (
          <header className="border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-10">
            <div className="max-w-6xl mx-auto px-4 flex items-center gap-1 h-14 overflow-x-auto">
              <Link href="/" className="font-bold text-lg mr-4 whitespace-nowrap">
                🪙 Finanzas
              </Link>
              <nav className="flex items-center gap-1">
                {nav.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] whitespace-nowrap transition-colors"
                  >
                    <span className="mr-1">{n.icon}</span>
                    {n.label}
                  </Link>
                ))}
              </nav>
              <form action={logout} className="ml-auto">
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] whitespace-nowrap transition-colors"
                >
                  Salir
                </button>
              </form>
            </div>
          </header>
        )}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>
        <footer className="text-center text-xs text-[var(--muted)] py-6">
          Finanzas personales · valores en COP (pesos colombianos)
        </footer>
      </body>
    </html>
  );
}
