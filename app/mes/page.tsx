import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  incomes,
  fixedExpenses,
  incomeReceipts,
  expensePayments,
  debts,
  debtPayments,
} from "@/lib/db/schema";
import { fmt, pct } from "@/lib/format";
import {
  netIncome,
  prestacionesAmount,
  debtMetrics,
  addMonths,
  monthLabel,
  normalizeMonth,
  currentMonth,
  todayISO,
  dateLabel,
  sum,
} from "@/lib/finance";
import { PageHeader, Stat, Badge, Progress, EmptyState } from "@/components/ui";
import { CancelButton } from "@/components/CancelButton";
import {
  setIncomeReceipt,
  addOccasionalIncome,
  deleteIncomeReceipt,
  registerExpensePayment,
  deleteExpensePayment,
  registerPayment,
  deleteDebtPayment,
} from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function MesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const month = normalizeMonth(mes);

  const [incDefs, expDefs, debtDefs, receipts, payments, debtPays] =
    await Promise.all([
      db.select().from(incomes),
      db.select().from(fixedExpenses),
      db.select().from(debts),
      db.select().from(incomeReceipts).where(eq(incomeReceipts.month, month)),
      db.select().from(expensePayments).where(eq(expensePayments.month, month)),
      db.select().from(debtPayments).where(eq(debtPayments.month, month)),
    ]);

  const activeInc = incDefs.filter((i) => i.active);
  const activeExp = expDefs.filter((e) => e.active);
  const debtMx = debtDefs.map(debtMetrics).filter((m) => m.pendingInstallments > 0 || m.balance > 0);
  const debtPaysByDebt = new Map<number, typeof debtPays>();
  for (const p of debtPays) {
    const list = debtPaysByDebt.get(p.debtId) ?? [];
    list.push(p);
    debtPaysByDebt.set(p.debtId, list);
  }

  const receiptByIncome = new Map<number, (typeof receipts)[number]>();
  const occasional: typeof receipts = [];
  for (const r of receipts) {
    if (r.incomeId == null) occasional.push(r);
    else receiptByIncome.set(r.incomeId, r);
  }

  const paymentsByExpense = new Map<number, typeof payments>();
  for (const p of payments) {
    const list = paymentsByExpense.get(p.expenseId) ?? [];
    list.push(p);
    paymentsByExpense.set(p.expenseId, list);
  }

  const totalReceived = sum(receipts.map((r) => r.amount));
  const expensesPaid = sum(payments.map((p) => p.amount));
  const debtPaidCash = sum(debtPays.map((p) => p.amount + p.insurance));
  const totalPaid = expensesPaid + debtPaidCash;

  const expensesCommitment = sum(activeExp.map((e) => e.amount));
  const debtCommitment = sum(debtMx.map((m) => m.monthlyOutflow));
  const totalCommitments = expensesCommitment + debtCommitment;

  const disponible = totalReceived - totalPaid;
  const pendiente = totalCommitments - totalPaid;
  const paidPct = totalCommitments > 0 ? (totalPaid / totalCommitments) * 100 : 0;

  const prev = addMonths(month, -1);
  const next = addMonths(month, 1);
  const today = todayISO();
  const noDefs = activeInc.length === 0 && activeExp.length === 0 && debtMx.length === 0;

  return (
    <div>
      <PageHeader
        title="Presupuesto del mes"
        subtitle="Registra lo que recibes y marca tus pagos a medida que los haces."
        action={
          <div className="flex items-center gap-2">
            <Link href={`/mes?mes=${prev}`} className="btn btn-ghost btn-sm" aria-label="Mes anterior">
              ←
            </Link>
            <span className="font-semibold capitalize min-w-[9rem] text-center">
              {monthLabel(month)}
            </span>
            <Link href={`/mes?mes=${next}`} className="btn btn-ghost btn-sm" aria-label="Mes siguiente">
              →
            </Link>
          </div>
        }
      />

      {month !== currentMonth() && (
        <div className="mb-4">
          <Link href="/mes" className="btn btn-ghost btn-sm">
            ⟲ Volver al mes actual
          </Link>
        </div>
      )}

      {/* Resumen del mes */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        <Stat label="Recibido este mes" value={totalReceived} tone="green" />
        <Stat label="Compromisos del mes" value={totalCommitments} tone="amber" hint="Egresos + deudas" />
        <Stat label="Pagado hasta ahora" value={totalPaid} />
        <Stat
          label="Falta por pagar"
          value={Math.max(0, pendiente)}
          tone={pendiente > 0 ? "red" : "green"}
          hint="Compromisos − pagado"
        />
        <Stat
          label="Disponible ahora"
          value={disponible}
          tone={disponible >= 0 ? "primary" : "red"}
          hint="Recibido − pagado"
        />
      </div>

      <div className="card mb-6">
        <div className="flex justify-between text-xs text-[var(--muted)] mb-1">
          <span>Progreso de pago (egresos + deudas)</span>
          <span>
            {fmt(totalPaid)} / {fmt(totalCommitments)} · pendiente {fmt(Math.max(0, pendiente))}
          </span>
        </div>
        <Progress value={paidPct} tone="green" />
      </div>

      {noDefs ? (
        <EmptyState
          icon="📅"
          title="Aún no tienes ingresos ni egresos configurados"
          hint="Agrega tus fuentes en Ingresos y tus gastos en Egresos fijos; luego vuelve aquí para registrar el mes."
        />
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* ─────────── INGRESOS ─────────── */}
          <div className="card">
            <div className="font-semibold mb-4">💰 Ingresos del mes</div>

            {activeInc.length === 0 && occasional.length === 0 && (
              <p className="text-sm text-[var(--muted)]">
                No hay ingresos activos. Agrégalos en{" "}
                <Link href="/ingresos" className="underline">Ingresos</Link>.
              </p>
            )}

            <div className="space-y-3 pr-1" style={{ maxHeight: 400, overflowY: "auto" }}>
              {activeInc.map((inc) => {
                const receipt = receiptByIncome.get(inc.id);
                const net = netIncome(inc);
                const received = receipt ? receipt.amount : null;
                return (
                  <div key={inc.id} className="border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{inc.name}</span>
                        {inc.kind === "salario_base" && <Badge tone="primary">Salario base</Badge>}
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-[var(--green)]">
                          {received != null ? fmt(received) : fmt(net)}
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          {received != null ? "recibido" : "estimado"}
                        </div>
                      </div>
                    </div>

                    {inc.kind === "salario_base" && inc.prestacionesRate > 0 && (
                      <div className="text-xs text-[var(--muted)] mt-1">
                        Base {fmt(inc.amount)} − {pct(inc.prestacionesRate, 0)} prestaciones ({fmt(prestacionesAmount(inc))}) = neto {fmt(net)}
                      </div>
                    )}

                    <details className="mt-2">
                      <summary className="btn btn-ghost btn-sm list-none inline-block">
                        {received != null ? "✏️ Ajustar recibido" : "＋ Registrar recibido"}
                      </summary>
                      <form action={setIncomeReceipt} className="flex items-end gap-2 mt-2 flex-wrap">
                        <input type="hidden" name="month" value={month} />
                        <input type="hidden" name="incomeId" value={inc.id} />
                        <div>
                          <label className="label">Recibido este mes (COP)</label>
                          <input
                            name="amount"
                            type="number"
                            min="0"
                            step="any"
                            defaultValue={received != null ? received : Math.round(net)}
                            className="input"
                            style={{ width: 180 }}
                          />
                        </div>
                        <button className="btn btn-primary btn-sm">Guardar</button>
                        <CancelButton className="btn btn-ghost btn-sm" />
                      </form>
                    </details>
                  </div>
                );
              })}

              {/* Ingresos ocasionales del mes */}
              {occasional.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{o.name || "Ingreso ocasional"}</span>
                    <Badge tone="amber">Ocasional</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--green)]">{fmt(o.amount)}</span>
                    <form action={deleteIncomeReceipt}>
                      <input type="hidden" name="id" value={o.id} />
                      <button className="btn btn-ghost btn-sm" aria-label="Quitar ingreso ocasional">🗑️</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>

            <details className="mt-4">
              <summary className="btn btn-ghost btn-sm list-none inline-block">＋ Ingreso ocasional</summary>
              <form action={addOccasionalIncome} className="grid grid-cols-2 gap-2 mt-2">
                <input type="hidden" name="month" value={month} />
                <div className="col-span-2">
                  <label className="label">Concepto</label>
                  <input name="name" required className="input" placeholder="Prima, venta, bono…" />
                </div>
                <div>
                  <label className="label">Monto (COP)</label>
                  <input name="amount" type="number" min="0" step="any" required className="input" placeholder="500000" />
                </div>
                <div className="col-span-2 flex gap-2">
                  <button className="btn btn-primary btn-sm">Agregar</button>
                  <CancelButton className="btn btn-ghost btn-sm" />
                </div>
              </form>
            </details>
          </div>

          {/* ─────────── EGRESOS ─────────── */}
          <div className="card">
            <div className="font-semibold mb-4">🧾 Egresos y servicios del mes</div>

            {activeExp.length === 0 && (
              <p className="text-sm text-[var(--muted)]">
                No hay egresos activos. Agrégalos en{" "}
                <Link href="/egresos" className="underline">Egresos fijos</Link>.
              </p>
            )}

            <div className="space-y-3 pr-1" style={{ maxHeight: 400, overflowY: "auto" }}>
              {activeExp.map((e) => {
                const pays = paymentsByExpense.get(e.id) ?? [];
                const paidTotal = sum(pays.map((p) => p.amount));
                const isPaid = pays.length > 0;
                return (
                  <div key={e.id} className={`border-b border-[var(--border)] pb-3 last:border-0 last:pb-0 ${isPaid ? "opacity-90" : ""}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <div className="font-medium flex items-center gap-2 flex-wrap">
                          {e.name}
                          {isPaid && <Badge tone="green">✓ Pagado</Badge>}
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          {e.category}
                          {e.dueDay ? ` · vence día ${e.dueDay}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-semibold ${isPaid ? "text-[var(--muted)] line-through" : ""}`}>
                          {fmt(e.amount)}
                        </div>
                        {isPaid && paidTotal !== e.amount && (
                          <div className="text-xs text-[var(--green)]">pagado {fmt(paidTotal)}</div>
                        )}
                      </div>
                    </div>

                    {isPaid ? (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-[var(--green)]">
                          Pagado {fmt(paidTotal)}
                          {pays[0]?.paidAt ? ` · ${dateLabel(pays[0].paidAt)}` : ""}
                        </span>
                        {pays.map((p) => (
                          <form key={p.id} action={deleteExpensePayment}>
                            <input type="hidden" name="id" value={p.id} />
                            <button className="btn btn-ghost btn-sm">↩︎ Deshacer</button>
                          </form>
                        ))}
                      </div>
                    ) : (
                      <details className="mt-2">
                        <summary className="btn btn-ghost btn-sm list-none inline-block">💵 Marcar pago</summary>
                        <form action={registerExpensePayment} className="flex items-end gap-2 mt-2 flex-wrap">
                          <input type="hidden" name="month" value={month} />
                          <input type="hidden" name="expenseId" value={e.id} />
                          <div>
                            <label className="label">Monto pagado (COP)</label>
                            <input
                              name="amount"
                              type="number"
                              min="0"
                              step="any"
                              defaultValue={Math.round(e.amount)}
                              className="input"
                              style={{ width: 160 }}
                            />
                          </div>
                          <div>
                            <label className="label">Fecha (opcional)</label>
                            <input name="paidAt" type="date" defaultValue={today} className="input" />
                          </div>
                          <button className="btn btn-primary btn-sm">Registrar</button>
                          <CancelButton className="btn btn-ghost btn-sm" />
                        </form>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!noDefs && debtMx.length > 0 && (
        <div className="card mt-4">
          <div className="font-semibold mb-4">💳 Deudas del mes</div>
          <div className="space-y-3 pr-1" style={{ maxHeight: 400, overflowY: "auto" }}>
            {debtMx.map((m) => {
              const pays = debtPaysByDebt.get(m.id) ?? [];
              const isPaid = pays.length > 0;
              const paidCash = sum(pays.map((p) => p.amount + p.insurance));
              return (
                <div key={m.id} className="border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <div className="font-medium flex items-center gap-2 flex-wrap">
                        {m.name}
                        {isPaid && <Badge tone="green">✓ Pagada este mes</Badge>}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        Saldo {fmt(m.balance)} · cuota {m.paidInstallments}/{m.totalInstallments}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${isPaid ? "text-[var(--muted)] line-through" : ""}`}>
                        {fmt(m.monthlyOutflow)}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        cuota {fmt(m.effectivePayment)}
                        {m.insurance > 0 ? ` + seguro ${fmt(m.insurance)}` : ""}
                      </div>
                    </div>
                  </div>

                  {isPaid ? (
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-[var(--green)]">
                        Pagado {fmt(paidCash)}
                        {pays[0]?.paidAt ? ` · ${dateLabel(pays[0].paidAt)}` : ""}
                      </span>
                      {pays.map((p) => (
                        <form key={p.id} action={deleteDebtPayment}>
                          <input type="hidden" name="id" value={p.id} />
                          <button className="btn btn-ghost btn-sm">↩︎ Deshacer</button>
                        </form>
                      ))}
                    </div>
                  ) : (
                    <details className="mt-2">
                      <summary className="btn btn-ghost btn-sm list-none inline-block">💵 Registrar pago</summary>
                      <form action={registerPayment} className="flex items-end gap-2 mt-2 flex-wrap">
                        <input type="hidden" name="month" value={month} />
                        <input type="hidden" name="id" value={m.id} />
                        <div>
                          <label className="label">Pago a la cuota (COP)</label>
                          <input
                            name="amount"
                            type="number"
                            min="0"
                            step="any"
                            defaultValue={Math.round(m.effectivePayment)}
                            className="input"
                            style={{ width: 160 }}
                          />
                        </div>
                        <div>
                          <label className="label">Fecha (opcional)</label>
                          <input name="paidAt" type="date" defaultValue={today} className="input" />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name="counts" defaultChecked /> Cuenta como cuota
                        </label>
                        <button className="btn btn-primary btn-sm">Registrar</button>
                        <CancelButton className="btn btn-ghost btn-sm" />
                      </form>
                      {m.insurance > 0 && (
                        <p className="text-xs text-[var(--muted)] mt-1">
                          El seguro del mes ({fmt(m.insurance)}) se suma a tu salida de caja; no lo incluyas en el pago a la cuota.
                        </p>
                      )}
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
