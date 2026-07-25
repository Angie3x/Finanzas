import Link from "next/link";
import { db } from "@/lib/db";
import { incomes, fixedExpenses, debts } from "@/lib/db/schema";
import { debtMetrics, computeKpis, nextMonthProjection } from "@/lib/finance";
import { fmt, pct, monthsToText } from "@/lib/format";
import { PageHeader, Stat, Badge, EmptyState, Progress } from "@/components/ui";
import { DashboardChart } from "@/components/DashboardChart";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [inc, exp, deb] = await Promise.all([
    db.select().from(incomes),
    db.select().from(fixedExpenses),
    db.select().from(debts),
  ]);
  const metrics = deb.map(debtMetrics);
  const k = computeKpis(inc, exp, metrics);
  const proj = nextMonthProjection(exp, metrics);

  const empty = inc.length === 0 && exp.length === 0 && deb.length === 0;

  const chartData = [
    { name: "Egresos fijos", value: k.totalFixedExpenses, color: "#d97706" },
    { name: "Pago de deudas", value: k.totalDebtPayment, color: "#dc2626" },
    { name: "Disponible", value: Math.max(0, k.availableCashFlow), color: "#059669" },
  ];

  const healthTone = k.availableCashFlow < 0 ? "red" : k.committedRatio > 70 ? "amber" : "green";
  const healthMsg =
    k.availableCashFlow < 0
      ? "⚠️ Tus gastos y deudas superan tus ingresos. Revisa tu plan de pago."
      : k.committedRatio > 70
      ? "Atención: comprometes más del 70% de tus ingresos. Margen ajustado."
      : "Buen margen: tus ingresos cubren gastos y deudas con holgura.";

  return (
    <div>
      <PageHeader
        title="Panel de finanzas"
        subtitle="Resumen de tu situación financiera del mes."
        action={
          <Link href="/plan" className="btn btn-primary">
            🎯 Ver plan de pago
          </Link>
        }
      />

      {empty ? (
        <EmptyState
          icon="👋"
          title="¡Bienvenido! Empecemos a ordenar tus finanzas"
          hint="Registra tus ingresos, egresos fijos y deudas para ver tus KPIs y tu plan de pago."
        />
      ) : (
        <>
          {/* KPIs principales */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Stat label="Ingresos mensuales" value={k.totalIncome} tone="green" />
            <Stat label="Egresos fijos" value={k.totalFixedExpenses} tone="amber" />
            <Stat label="Pago de deudas" value={k.totalDebtPayment} tone="red" hint="Cuotas + abonos extra" />
            <Stat
              label="Flujo disponible"
              value={k.availableCashFlow}
              tone={k.availableCashFlow >= 0 ? "green" : "red"}
              hint="Ingresos − egresos − deudas"
            />
          </div>

          {/* Salud financiera */}
          <div className="card mb-6" style={{ borderColor: `var(--${healthTone === "green" ? "green" : healthTone === "amber" ? "amber" : "red"})` }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="font-semibold">Salud financiera</div>
              <Badge tone={healthTone}>
                {k.availableCashFlow < 0 ? "En riesgo" : k.committedRatio > 70 ? "Ajustada" : "Saludable"}
              </Badge>
            </div>
            <p className="text-sm text-[var(--muted)] mt-2">{healthMsg}</p>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-[var(--muted)] mb-1">
                <span>Ingreso comprometido (egresos + deudas)</span>
                <span>{pct(k.committedRatio, 0)}</span>
              </div>
              <Progress value={k.committedRatio} tone={healthTone} />
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4 mb-6">
            {/* Distribución del ingreso */}
            <div className="card">
              <div className="font-semibold mb-3">¿A dónde va tu ingreso?</div>
              <DashboardChart data={chartData} />
            </div>

            {/* Indicadores de deuda */}
            <div className="card">
              <div className="font-semibold mb-4">Indicadores de deuda</div>
              <div className="space-y-4">
                <Row
                  label="Deuda total pendiente"
                  value={fmt(k.totalDebtBalance)}
                  tone="red"
                />
                <Row
                  label="Intereses por pagar (estimado)"
                  value={fmt(k.totalInterestRemaining)}
                  tone="red"
                />
                <Row
                  label="Ratio de endeudamiento (DTI)"
                  value={pct(k.dti, 1)}
                  hint={k.dti > 40 ? "Alto (> 40%)" : k.dti > 30 ? "Moderado" : "Sano"}
                  tone={k.dti > 40 ? "red" : k.dti > 30 ? "amber" : "green"}
                />
                <Row
                  label="Libre de deudas en (cuotas mínimas)"
                  value={monthsToText(k.monthsToDebtFree)}
                />
                <Row
                  label="Pago estimado próximo mes"
                  value={fmt(proj.total)}
                  tone="amber"
                />
              </div>
              <Link href="/plan" className="btn btn-ghost btn-sm mt-4">
                Optimizar con el plan de pago →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "green" | "red" | "amber";
}) {
  const color =
    tone === "default"
      ? "var(--text)"
      : `var(--${tone})`;
  return (
    <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--border)] last:border-0 last:pb-0">
      <div className="text-sm text-[var(--muted)]">{label}</div>
      <div className="text-right">
        <div className="font-bold" style={{ color }}>{value}</div>
        {hint && <div className="text-xs text-[var(--muted)]">{hint}</div>}
      </div>
    </div>
  );
}
