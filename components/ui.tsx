import { fmt } from "@/lib/format";

type Tone = "default" | "green" | "red" | "amber" | "primary";

const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  default: { bg: "var(--surface-2)", fg: "var(--text)" },
  green: { bg: "var(--green-soft)", fg: "var(--green)" },
  red: { bg: "var(--red-soft)", fg: "var(--red)" },
  amber: { bg: "var(--amber-soft)", fg: "var(--amber)" },
  primary: { bg: "var(--primary-soft)", fg: "var(--primary)" },
};

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-[var(--muted)] mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
  isMoney = true,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: Tone;
  isMoney?: boolean;
}) {
  const t = toneStyles[tone];
  return (
    <div className="card">
      <div className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
        {label}
      </div>
      <div
        className="text-2xl font-bold mt-2"
        style={{ color: tone === "default" ? "var(--text)" : t.fg }}
      >
        {typeof value === "number" && isMoney ? fmt(value) : value}
      </div>
      {hint && <div className="text-xs text-[var(--muted)] mt-1">{hint}</div>}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  const t = toneStyles[tone];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="card text-center py-10">
      <div className="text-4xl mb-3">{icon}</div>
      <div className="font-semibold">{title}</div>
      {hint && <div className="text-sm text-[var(--muted)] mt-1">{hint}</div>}
    </div>
  );
}

/** Barra de progreso simple (0-100). */
export function Progress({ value, tone = "primary" }: { value: number; tone?: Tone }) {
  const t = toneStyles[tone];
  return (
    <div
      className="w-full h-2 rounded-full overflow-hidden"
      style={{ background: "var(--surface-2)" }}
    >
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: t.fg }}
      />
    </div>
  );
}
