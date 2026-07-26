import { db } from "@/lib/db";
import { debts, fixedExpenses } from "@/lib/db/schema";
import {
  createDebt,
  updateDebt,
  deleteDebt,
  registerPayment,
  createExpense,
  updateExpense,
  deleteExpense,
} from "@/lib/actions";
import { fmt, pct } from "@/lib/format";
import { debtMetrics, sum } from "@/lib/finance";
import { PageHeader, Stat, EmptyState, Badge, Progress } from "@/components/ui";
import { DeleteButton } from "@/components/DeleteButton";
import { CancelButton } from "@/components/CancelButton";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  "Vivienda",
  "Servicios",
  "Alimentación",
  "Transporte",
  "Suscripciones",
  "Salud",
  "Educación",
  "General",
];

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
        <label className="label">Seguro</label>
        <select name="insuranceKind" className="select" defaultValue={d?.insuranceKind ?? "none"}>
          <option value="none">Sin seguro</option>
          <option value="fijo">Valor fijo mensual (COP)</option>
          <option value="saldo">% mensual sobre el saldo</option>
        </select>
      </div>
      <div>
        <label className="label">Valor del seguro</label>
        <input name="insuranceValue" type="number" min="0" step="any" defaultValue={d?.insuranceValue || ""} className="input" placeholder="COP si es fijo · % mensual si es sobre saldo (ej. 0.3)" />
        <p className="text-xs text-[var(--muted)] mt-1">
          Fijo: monto en pesos. Sobre saldo: tasa mensual (ej. 0.3 = 0,3% del saldo).
        </p>
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
        <SubmitButton className="btn btn-primary">{d ? "Actualizar deuda" : "Guardar deuda"}</SubmitButton>
        <CancelButton />
      </div>
    </form>
  );
}

function ExpenseForm({
  action,
  e,
}: {
  action: (fd: FormData) => void;
  e?: typeof fixedExpenses.$inferSelect;
}) {
  return (
    <form action={action} className="grid sm:grid-cols-2 gap-4 mt-4">
      {e && <input type="hidden" name="id" value={e.id} />}
      <div>
        <label className="label">Nombre</label>
        <input name="name" required defaultValue={e?.name} className="input" placeholder="Arriendo, Internet…" />
      </div>
      <div>
        <label className="label">Monto mensual (COP)</label>
        <input name="amount" type="number" min="0" step="any" required defaultValue={e?.amount} className="input" placeholder="1200000" />
      </div>
      <div>
        <label className="label">Categoría</label>
        <select name="category" className="select" defaultValue={e?.category ?? "General"}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Día de pago (opcional)</label>
        <input name="dueDay" type="number" min="1" max="31" defaultValue={e?.dueDay ?? ""} className="input" placeholder="5" />
      </div>
      {e && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={e.active} /> Activo
        </label>
      )}
      <div className="sm:col-span-2 flex gap-2">
        <SubmitButton className="btn btn-primary">{e ? "Actualizar egreso" : "Guardar egreso"}</SubmitButton>
        <CancelButton />
      </div>
    </form>
  );
}

export default async function DeudasPage() {
  const [rows, expenses] = await Promise.all([
    db.select().from(debts),
    db.select().from(fixedExpenses),
  ]);
  const metrics = rows.map(debtMetrics);
  const totalBalance = sum(metrics.map((m) => m.balance));
  const totalPayment = sum(metrics.filter((m) => m.pendingInstallments > 0).map((m) => m.monthlyOutflow));
  const totalInterest = sum(metrics.map((m) => m.interestRemaining));
  const totalExpenses = sum(expenses.filter((e) => e.active).map((e) => e.amount));

  return (
    <div>
      <PageHeader
        title="Deudas y egresos fijos"
        subtitle="Tus obligaciones mensuales: egresos fijos, tarjetas de crédito y préstamos."
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Stat label="Egresos fijos" value={totalExpenses} tone="amber" hint="Mensuales activos" />
        <Stat label="Deuda total pendiente" value={totalBalance} tone="red" />
        <Stat label="Pago mensual de deudas" value={totalPayment} tone="amber" hint="Cuotas + seguro + abonos" />
        <Stat label="Intereses por pagar" value={totalInterest} tone="red" hint="Sobre cuotas pendientes" />
      </div>

      {/* ─────────── EGRESOS FIJOS ─────────── */}
      <h2 className="text-lg font-semibold mb-3">🧾 Egresos fijos</h2>
      <details className="card mb-4">
        <summary className="cursor-pointer font-semibold">➕ Agregar egreso fijo</summary>
        <ExpenseForm action={createExpense} />
      </details>

      {expenses.length === 0 ? (
        <EmptyState icon="🧾" title="Aún no tienes egresos fijos" hint="Agrega tus gastos recurrentes (arriendo, servicios, suscripciones…) arriba." />
      ) : (
        <div className="space-y-3 mb-8">
          {expenses.map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-semibold">{r.name}</span>
                  <Badge tone="primary">{r.category}</Badge>
                  {r.dueDay && <Badge>Día {r.dueDay}</Badge>}
                  {!r.active && <Badge tone="amber">Inactivo</Badge>}
                </div>
                <div className="text-lg font-bold text-[var(--red)]">{fmt(r.amount)}</div>
              </div>
              <div className="flex gap-2 mt-3 flex-wrap items-start">
                <details className="inline-block">
                  <summary className="btn btn-ghost btn-sm list-none">✏️ Editar</summary>
                  <ExpenseForm action={updateExpense} e={r} />
                </details>
                <DeleteButton action={deleteExpense} id={r.id} label="🗑️ Eliminar" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─────────── DEUDAS ─────────── */}
      <h2 className="text-lg font-semibold mb-3">💳 Deudas (tarjetas y préstamos)</h2>
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
                    {m.insurance > 0 && (
                      <div className="text-xs text-[var(--amber)]">+ {fmt(m.insurance)} seguro</div>
                    )}
                    {m.extra > 0 && (
                      <div className="text-xs text-[var(--green)]">+ {fmt(m.extra)} extra</div>
                    )}
                    {(m.insurance > 0 || m.extra > 0) && (
                      <div className="text-xs text-[var(--muted)] mt-0.5">= {fmt(m.monthlyOutflow)} total</div>
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
                          {m.insurance > 0 && (
                            <> No incluyas aquí el seguro (<b>{fmt(m.insurance)}</b>): no abona a capital.</>
                          )}
                        </p>
                        <div className="flex gap-2 mt-3">
                          <SubmitButton>Guardar pago</SubmitButton>
                          <CancelButton className="btn btn-ghost btn-sm" />
                        </div>
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
