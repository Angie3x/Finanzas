import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Finanzas · Plan de pago de deudas",
  description:
    "Organiza tus ingresos, egresos y deudas. Crea un plan de pago y proyecta tus pagos.",
};

const nav = [
  { href: "/", label: "Panel", icon: "📊" },
  { href: "/deudas", label: "Deudas", icon: "💳" },
  { href: "/plan", label: "Plan de pago", icon: "🎯" },
  { href: "/ingresos", label: "Ingresos", icon: "💰" },
  { href: "/egresos", label: "Egresos fijos", icon: "🧾" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={geist.variable}>
      <body className="min-h-screen flex flex-col">
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
          </div>
        </header>
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>
        <footer className="text-center text-xs text-[var(--muted)] py-6">
          Finanzas personales · valores en COP (pesos colombianos)
        </footer>
      </body>
    </html>
  );
}
