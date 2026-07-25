import { db } from "@/lib/db";
import { debts } from "@/lib/db/schema";
import {
  createDebt,
  updateDebt,
  deleteDebt,
  registerPayment,
} from "@/lib/actions";
import { fmt, pct } from "@/lib/format";
import { debtMetrics, sum } from "@/lib/finance";
import { PageHeader, Stat, EmptyState, Badge, Progress } from "@/components/ui";
import { DeleteButton } from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

function DebtForm({
  action,
  d,
}: {
  action: (fd: FormData) => void;
  d?: typeof debts.$inferSelect;
}) {
  return (
    <form action={action} className="grid sm:grid-cols-2 gap-4 mt-4">
      {d && <input type="hidden" name="id" value={d.id} />}
      <div>
        <label className="label">Nombre</label>
        <input name="name" required defaultValue={d?.name} className="input" placeholder="Tarjeta Visa, Crédito de libre inversión…" />
      </div>
      <div>
        <label className="label">Tipo</label>
        <select name="type" className="select" defaultValue={d?.type ?? "prestamo"}>
          <option value="prestamo">Préstamo</option>
          <option value="tarjeta">Tarjeta de crédito</option>
        </select>
      </div>
      <div>
        <label className="label">Monto / saldo total original (COP)</label>
        <input name="principal" type="number" min="0" step="any" required defaultValue={d?.principal} className="input" placeholder="10000000" />
      </div>
      <div>
        <label className="label">Saldo a la fecha (opcional)</label>
        <input name="currentBalance" type="number" min="0" step="any" defaultValue={d?.currentBalance ?? ""} className="input" placeholder="Se calcula si lo dejas vacío" />
      </div>
      <div>
        <label className="label">Tasa de interés (%)</label>
        <input name="annualRate" type="number" min="0" step="0.01" required defaultValue={d?.annualRate ?? 0} className="input" placeholder="28" />
      </div>
      <div>
        <label className="label">Tipo de tasa</label>
        <select name="rateKind" className="select" defaultValue={d?.rateKind ?? "efectiva_anual"}>
          <option value="efectiva_anual">Efectiva anual (E.A.)</option>
          <option value="nominal_anual">Nominal anual</option>
          <option value="mensual">Mensual</option>
        </select>
      </div>
      <div>
        <label className="label">Cuotas totales</label>
        <input name="totalInstallments" type="number" min="1" step="1" required defaultValue={d?.totalInstallments ?? 12} className="input" placeholder="36" />
      </div>
      <div>
        <label className="label">Cuotas pagadas</label>
        <input name="paidInstallments" type="number" min="0" step="1" defaultValue={d?.paidInstallments ?? 0} className="input" placeholder="0" />
      </div>
      <div>
        <label className="label">Valor de la cuota (opcional)</label>
        <input name="installmentAmount" type="number" min="0" step="any" defaultValue={d?.installmentAmount ?? ""} className="input" placeholder="Se calcula si lo dejas vacío" />
      </div>
      <div>
        <label className="label">Abono extra mensual (opcional)</label>
        <input name="extraPayment" type="number" min="0" step="any" defaultValue={d?.extraPayment || ""} className="input" placeholder="Monto adicional fijo a esta deuda" />
      </div>
      <div>
        <label className="label">Día de pago (opcional)</label>
        <input name="dueDay" type="number" min="1" max="31" defaultValue={d?.dueDay ?? ""} className="input" placeholder="15" />
      </div>
      <div className="sm:col-span-2 flex gap-2">
        <button className="btn btn-primary">{d ? "Actualizar deuda" : "Guardar deuda"}</button>
      </div>
    </form>
  );
}

export default async function DeudasPage() {
  const rows = await db.select().from(debts);
  const metrics = rows.map(debtMetrics);
  const totalBalance = sum(metrics.map((m) => m.balance));
  const totalPayment = sum(metrics.filter((m) => m.pendingInstallments > 0).map((m) => m.effectivePayment));
  const totalInterest = sum(metrics.map((m) => m.interestRemaining));

  return (
    <div>
      <PageHeader
        title="Deudas"
        subtitle="Préstamos y tarjetas. La cuota, el saldo y los intereses se calculan automáticamente (amortización francesa)."
      />

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Stat label="Deuda total pendiente" value={totalBalance} tone="red" />
        <Stat label="Pago mensual de deudas" value={totalPayment} tone="amber" hint="Cuotas + abonos extra" />
        <Stat label="Intereses por pagar" value={totalInterest} tone="red" hint="Estimado sobre cuotas pendientes" />
      </div>

      <details className="card mb-6">
        <summary className="cursor-pointer font-semibold">➕ Agregar deuda</summary>
        <DebtForm action={createDebt} />
      </details>

      {rows.length === 0 ? (
        <EmptyState icon="💳" title="Aún no tienes deudas registradas" hint="Agrega tu primer préstamo o tarjeta arriba." />
      ) : (
        <div className="space-y-4">
          {metrics.map((m) => {
            const d = rows.find((r) => r.id === m.id)!;
            const progress = m.totalInstallments > 0 ? (m.paidInstallments / m.totalInstallments) * 100 : 0;
            return (
              <div key={m.id} className="card">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-lg">{m.name}</span>
                      <Badge tone={m.type === "tarjeta" ? "primary" : "default"}>
                        {m.type === "tarjeta" ? "💳 Tarjeta" : "🏦 Préstamo"}
                      </Badge>
                      {m.pendingInstallments === 0 && <Badge tone="green">✓ Pagada</Badge>}
                    </div>
                    <div className="text-sm text-[var(--muted)] mt-1">
                      Tasa {pct(m.annualEffective * 100)} E.A. · {pct(m.monthlyRate * 100, 2)} mensual
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[var(--muted)]">Saldo a la fecha</div>
                    <div className="text-xl font-bold text-[var(--red)]">{fmt(m.balance)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-sm">
                  <div>
                    <div className="text-[var(--muted)] text-xs">Cuota mensual</div>
                    <div className="font-semibold">{fmt(m.installment)}</div>
                    {m.extra > 0 && (
                      <div className="text-xs text-[var(--green)]">+ {fmt(m.extra)} extra</div>
                    )}
                  </div>
                  <div>
                    <div className="text-[var(--muted)] text-xs">Cuotas</div>
                    <div className="font-semibold">
                      {m.paidInstallments} / {m.totalInstallments}
                      <span className="text-[var(--muted)] font-normal"> · faltan {m.pendingInstallments}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--muted)] text-xs">Próximo interés</div>
                    <div className="font-semibold">{fmt(m.nextInterest)}</div>
                  </div>
                  <div>
                    <div className="text-[var(--muted)] text-xs">Abono a capital</div>
                    <div className="font-semibold">{fmt(m.nextPrincipal)}</div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-xs text-[var(--muted)] mb-1">
                    <span>Progreso de pago</span>
                    <span>{pct(progress, 0)}</span>
                  </div>
                  <Progress value={progress} tone="green" />
                </div>

                <div className="flex gap-2 mt-4 flex-wrap items-start">
                  {m.pendingInstallments > 0 && (
                    <details className="inline-block">
                      <summary className="btn btn-ghost btn-sm list-none">💵 Registrar pago</summary>
                      <form action={registerPayment} className="card mt-2" style={{ minWidth: 300 }}>
                        <input type="hidden" name="id" value={m.id} />
                        <label className="label">Monto pagado (COP)</label>
                        <input
                          name="amount"
                          type="number"
                          min="0"
                          step="any"
                          defaultValue={Math.round(m.effectivePayment)}
                          className="input"
                        />
                        <label className="flex items-center gap-2 text-sm mt-3">
                          <input type="checkbox" name="counts" defaultChecked /> Cuenta como cuota
                          <span className="text-[var(--muted)]">(desmárcalo para un abono extraordinario)</span>
                        </label>
                        <p className="text-xs text-[var(--muted)] mt-2">
                          Interés de este mes: <b>{fmt(m.nextInterest)}</b>. El resto abona a capital y baja tu saldo.
                        </p>
                        <button className="btn btn-primary btn-sm mt-3">Guardar pago</button>
                      </form>
                    </details>
                  )}
                  <details className="inline-block">
                    <summary className="btn btn-ghost btn-sm list-none">✏️ Editar</summary>
                    <DebtForm action={updateDebt} d={d} />
                  </details>
                  <DeleteButton action={deleteDebt} id={m.id} label="🗑️ Eliminar" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
