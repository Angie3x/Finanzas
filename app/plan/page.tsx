import Link from "next/link";
import { db } from "@/lib/db";
import { incomes, fixedExpenses, debts } from "@/lib/db/schema";
import {
  debtMetrics,
  computeKpis,
  simulatePlan,
  nextMonthProjection,
  monthsFromNow,
  sum,
} from "@/lib/finance";
import { fmt, pct, monthsToText } from "@/lib/format";
import { PageHeader, Stat, EmptyState, Badge } from "@/components/ui";
import { PlanChart } from "@/components/PlanChart";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ extra?: string }>;
}) {
  const sp = await searchParams;
  const [inc, exp, deb] = await Promise.all([
    db.select().from(incomes),
    db.select().from(fixedExpenses),
    db.select().from(debts),
  ]);
  const metrics = deb.map(debtMetrics);
  const kpis = computeKpis(inc, exp, metrics);

  // Presupuesto extra: por defecto el flujo disponible positivo; editable por query.
  const defaultExtra = Math.max(0, Math.round(kpis.availableCashFlow));
  const extra =
    sp.extra != null && sp.extra !== ""
      ? Math.max(0, parseInt(sp.extra, 10) || 0)
      : defaultExtra;

  const activeDebts = metrics.filter((m) => m.pendingInstallments > 0 && m.balance > 0);
  const hasDebts = activeDebts.length > 0;

  const avalancha = simulatePlan(metrics, extra, "avalancha");
  const bola = simulatePlan(metrics, extra, "bola_de_nieve");

  // Serie combinada para el gráfico
  const maxLen = Math.max(avalancha.monthly.length, bola.monthly.length);
  const chartData = Array.from({ length: maxLen }, (_, idx) => ({
    month: idx + 1,
    avalancha: avalancha.monthly[idx]?.totalBalance ?? 0,
    bola: bola.monthly[idx]?.totalBalance ?? 0,
  }));

  const best = avalancha.totalInterest <= bola.totalInterest ? avalancha : bola;
  const proj = nextMonthProjection(exp, metrics);

  return (
    <div>
      <PageHeader
        title="Plan de pago de deudas"
        subtitle="Simula cuánto tardarías en quedar libre de deudas y cuánto pagarías en intereses según la estrategia."
      />

      {!hasDebts ? (
        <EmptyState
          icon="🎯"
          title="No hay deudas activas para planificar"
          hint="Agrega tus deudas para generar un plan de pago."
        />
      ) : (
        <>
          {/* Presupuesto extra */}
          <div className="card mb-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="font-semibold">💵 Abono extra mensual global</div>
                <p className="text-sm text-[var(--muted)] mt-1 max-w-xl">
                  Dinero adicional que se reparte según la estrategia, además de las cuotas y de los
                  abonos extra que ya asignaste a cada deuda. Tu flujo disponible actual es{" "}
                  <b>{fmt(kpis.availableCashFlow)}</b>.
                </p>
              </div>
              <form method="GET" className="flex items-end gap-2">
                <div>
                  <label className="label">Abono extra (COP)</label>
                  <input
                    name="extra"
                    type="number"
                    min="0"
                    step="any"
                    defaultValue={extra}
                    className="input"
                    style={{ width: 180 }}
                  />
                </div>
                <button className="btn btn-primary">Recalcular</button>
              </form>
            </div>
          </div>

          {/* Comparación de estrategias */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <StrategyCard
              title="🏔️ Avalancha"
              subtitle="Ataca primero la deuda con MAYOR tasa de interés. Ahorra más dinero."
              months={avalancha.months}
              interest={avalancha.totalInterest}
              recommended={best === avalancha}
            />
            <StrategyCard
              title="❄️ Bola de nieve"
              subtitle="Ataca primero la deuda con MENOR saldo. Motiva con logros rápidos."
              months={bola.months}
              interest={bola.totalInterest}
              recommended={best === bola}
            />
          </div>

          <div className="card mb-6">
            <div className="font-semibold mb-1">Evolución del saldo total de tus deudas</div>
            <p className="text-sm text-[var(--muted)] mb-4">
              Con un abono extra de {fmt(extra)}/mes, así bajaría tu deuda con cada estrategia.
            </p>
            <PlanChart data={chartData} />
          </div>

          {/* Orden de pago recomendado */}
          <div className="card mb-6">
            <div className="font-semibold mb-3">
              Orden de pago recomendado ({best.strategy === "avalancha" ? "Avalancha" : "Bola de nieve"})
            </div>
            <div className="space-y-2">
              {best.payoffs.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--border)] last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="font-medium">{p.name}</span>
                  </div>
                  <div className="text-sm text-[var(--muted)] text-right">
                    Libre en <b className="text-[var(--text)]">{monthsToText(p.payoffMonth)}</b>
                    <span className="hidden sm:inline"> · {monthsFromNow(p.payoffMonth)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Proyección del próximo mes */}
      <PageHeader
        title="Pagos del próximo mes"
        subtitle="Estimación de lo que deberás pagar el mes entrante (cuotas de deudas + egresos fijos)."
      />
      <div className="grid sm:grid-cols-3 gap-4 mb-4">
        <Stat label="Total a pagar próximo mes" value={proj.total} tone="amber" />
        <Stat
          label="Cuotas de deudas"
          value={sum(proj.items.filter((i) => i.kind === "deuda").map((i) => i.amount))}
          tone="red"
        />
        <Stat
          label="Egresos fijos"
          value={sum(proj.items.filter((i) => i.kind === "egreso").map((i) => i.amount))}
        />
      </div>

      {proj.items.length === 0 ? (
        <EmptyState icon="📅" title="Nada proyectado" hint="Agrega deudas o egresos fijos." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--muted)] border-b border-[var(--border)]">
                <th className="py-2 font-semibold">Concepto</th>
                <th className="py-2 font-semibold">Tipo</th>
                <th className="py-2 font-semibold">Día</th>
                <th className="py-2 font-semibold text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {proj.items.map((it, i) => (
                <tr key={i} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2.5">
                    <div className="font-medium">{it.name}</div>
                    {it.detail && <div className="text-xs text-[var(--muted)]">{it.detail}</div>}
                  </td>
                  <td className="py-2.5">
                    <Badge tone={it.kind === "deuda" ? "red" : "default"}>
                      {it.kind === "deuda" ? "Deuda" : "Egreso"}
                    </Badge>
                  </td>
                  <td className="py-2.5 text-[var(--muted)]">{it.dueDay ? `Día ${it.dueDay}` : "—"}</td>
                  <td className="py-2.5 text-right font-semibold">{fmt(it.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td className="py-3" colSpan={3}>Total</td>
                <td className="py-3 text-right text-[var(--amber)]">{fmt(proj.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-xs text-[var(--muted)] mt-6">
        ¿Faltan datos? Ajusta tus{" "}
        <Link href="/ingresos" className="underline">ingresos</Link>,{" "}
        <Link href="/egresos" className="underline">egresos</Link> o{" "}
        <Link href="/deudas" className="underline">deudas</Link>.
      </p>
    </div>
  );
}

function StrategyCard({
  title,
  subtitle,
  months,
  interest,
  recommended,
}: {
  title: string;
  subtitle: string;
  months: number;
  interest: number;
  recommended: boolean;
}) {
  return (
    <div className="card" style={recommended ? { borderColor: "var(--primary)", borderWidth: 2 } : undefined}>
      <div className="flex items-center justify-between">
        <div className="font-semibold">{title}</div>
        {recommended && <Badge tone="primary">Recomendada</Badge>}
      </div>
      <p className="text-sm text-[var(--muted)] mt-1">{subtitle}</p>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div>
          <div className="text-xs text-[var(--muted)]">Tiempo hasta saldar</div>
          <div className="text-lg font-bold">{monthsToText(months)}</div>
        </div>
        <div>
          <div className="text-xs text-[var(--muted)]">Intereses totales</div>
          <div className="text-lg font-bold text-[var(--red)]">{fmt(interest)}</div>
        </div>
      </div>
    </div>
  );
}
