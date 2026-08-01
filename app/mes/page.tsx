import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  incomes,
  fixedExpenses,
  incomeReceipts,
  expensePayments,
  occasionalExpenses,
  monthlyPlans,
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
  dateLabel,
  sum,
} from "@/lib/finance";
import { PageHeader, Stat, Badge, Progress } from "@/components/ui";
import { FilterList } from "@/components/FilterList";
import { CancelButton } from "@/components/CancelButton";
import { SubmitButton } from "@/components/SubmitButton";
import { DeleteButton } from "@/components/DeleteButton";
import {
  createIncome,
  updateIncome,
  deleteIncome,
  setIncomeReceipt,
  addOccasionalIncome,
  deleteIncomeReceipt,
  registerExpensePayment,
  deleteExpensePayment,
  addOccasionalExpense,
  deleteOccasionalExpense,
  setProjectedAmount,
  setActualAmount,
  registerPayment,
  deleteDebtPayment,
} from "@/lib/actions";

export const dynamic = "force-dynamic";

/** Editor compacto de cuota Proyectada (manual) y Real (corte) por ítem/mes. */
function PlanEditor({
  month,
  kind,
  refId,
  projected,
  actual,
  computed,
}: {
  month: string;
  kind: "deuda" | "egreso";
  refId: number;
  projected: number | null;
  actual: number | null;
  computed: number;
}) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      {/* Proyectada */}
      <div className="rounded-lg border border-[var(--border)] px-2 py-1.5">
        <div className="text-xs text-[var(--muted)]">Proyectada</div>
        <div className="font-semibold text-sm">
          {projected != null ? fmt(projected) : <span className="text-[var(--muted)]">—</span>}
        </div>
        <details>
          <summary className="btn btn-ghost btn-sm list-none inline-block mt-1">✏️ Fijar</summary>
          <form action={setProjectedAmount} className="flex items-end gap-1 mt-1">
            <input type="hidden" name="month" value={month} />
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="refId" value={refId} />
            <input
              name="amount"
              type="number"
              min="0"
              step="any"
              defaultValue={projected ?? Math.round(computed)}
              className="input"
              style={{ width: 130 }}
            />
            <SubmitButton>OK</SubmitButton>
          </form>
        </details>
      </div>
      {/* Real (corte) */}
      <div className="rounded-lg border border-[var(--border)] px-2 py-1.5">
        <div className="text-xs text-[var(--muted)]">Real (corte)</div>
        <div className="font-semibold text-sm">
          {actual != null ? fmt(actual) : <span className="text-[var(--muted)]">pendiente de corte</span>}
        </div>
        <details>
          <summary className="btn btn-ghost btn-sm list-none inline-block mt-1">✏️ Registrar</summary>
          <form action={setActualAmount} className="flex items-end gap-1 mt-1">
            <input type="hidden" name="month" value={month} />
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="refId" value={refId} />
            <input
              name="amount"
              type="number"
              min="0"
              step="any"
              defaultValue={actual ?? projected ?? Math.round(computed)}
              className="input"
              style={{ width: 130 }}
            />
            <SubmitButton>OK</SubmitButton>
          </form>
        </details>
      </div>
    </div>
  );
}

export default async function MesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const month = normalizeMonth(mes);

  const [incDefs, expDefs, debtDefs, receipts, payments, occExpenses, plans, debtPays] =
    await Promise.all([
      db.select().from(incomes),
      db.select().from(fixedExpenses),
      db.select().from(debts),
      db.select().from(incomeReceipts).where(eq(incomeReceipts.month, month)),
      db.select().from(expensePayments).where(eq(expensePayments.month, month)),
      db.select().from(occasionalExpenses).where(eq(occasionalExpenses.month, month)),
      db.select().from(monthlyPlans).where(eq(monthlyPlans.month, month)),
      db.select().from(debtPayments).where(eq(debtPayments.month, month)),
    ]);

  const activeExp = expDefs.filter((e) => e.active);

  // Plan del mes (cuota proyectada / real) por ítem.
  const planByKey = new Map<string, (typeof plans)[number]>();
  for (const p of plans) planByKey.set(`${p.kind}-${p.refId}`, p);
  const debtPlan = (id: number) => planByKey.get(`deuda-${id}`);
  const expPlan = (id: number) => planByKey.get(`egreso-${id}`);

  const debtPaysByDebt = new Map<number, typeof debtPays>();
  for (const p of debtPays) {
    const list = debtPaysByDebt.get(p.debtId) ?? [];
    list.push(p);
    debtPaysByDebt.set(p.debtId, list);
  }

  // Mostramos una deuda en el mes si aún le quedan cuotas por pagar, o si ya
  // tiene un pago registrado este mes (para verla como "✓ Pagada este mes" y
  // poder deshacerla). Al pagar la última cuota, deja de aparecer el próximo mes.
  const debtMx = debtDefs
    .map(debtMetrics)
    .filter((m) => !m.settled || debtPaysByDebt.has(m.id));

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
  const occasionalSpent = sum(occExpenses.map((o) => o.amount)); // gastos ocasionales del mes

  // Compromiso y pago del mes, ítem por ítem. Para lo ya pagado, el compromiso
  // del mes ES lo que se pagó (así una deuda que se saldó este mes no descuadra
  // el total al desaparecer su cuota futura); para lo pendiente, el monto
  // esperado. Con esto "falta por pagar" refleja exactamente lo que queda sin
  // pagar y el progreso nunca supera el 100%.
  // Monto esperado del mes por ítem: cuota real (corte) si existe, si no la
  // proyectada (manual), y si no, el valor calculado/base como respaldo.
  const expExpected = (e: (typeof activeExp)[number]) => {
    const p = expPlan(e.id);
    return p?.actual ?? p?.projected ?? e.amount;
  };
  const debtExpected = (m: (typeof debtMx)[number]) => {
    const p = debtPlan(m.id);
    return p?.actual ?? p?.projected ?? m.monthlyOutflow;
  };

  let expensesCommitment = 0;
  let expensesPaid = 0;
  for (const e of activeExp) {
    const pays = paymentsByExpense.get(e.id) ?? [];
    if (pays.length > 0) {
      const paid = sum(pays.map((p) => p.amount));
      expensesPaid += paid;
      expensesCommitment += paid;
    } else {
      expensesCommitment += expExpected(e);
    }
  }

  let debtCommitment = 0;
  let debtPaidCash = 0;
  for (const m of debtMx) {
    const pays = debtPaysByDebt.get(m.id) ?? [];
    if (pays.length > 0) {
      const cash = sum(pays.map((p) => p.amount + p.insurance));
      debtPaidCash += cash;
      debtCommitment += cash;
    } else {
      debtCommitment += debtExpected(m);
    }
  }

  const totalPaid = expensesPaid + debtPaidCash; // pagos a compromisos (egresos + deudas)
  const totalCommitments = expensesCommitment + debtCommitment;

  // El disponible descuenta TODA la salida de caja: compromisos pagados + ocasionales.
  const disponible = totalReceived - totalPaid - occasionalSpent;
  const pendiente = totalCommitments - totalPaid;
  const paidPct = totalCommitments > 0 ? (totalPaid / totalCommitments) * 100 : 0;

  const prev = addMonths(month, -1);
  const next = addMonths(month, 1);

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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
        <Stat label="Recibido este mes" value={totalReceived} tone="green" />
        <Stat label="Compromisos del mes" value={totalCommitments} tone="amber" hint="Egresos + deudas" />
        <Stat label="Pagado hasta ahora" value={totalPaid} hint="A compromisos" />
        <Stat
          label="Gastos ocasionales"
          value={occasionalSpent}
          tone={occasionalSpent > 0 ? "amber" : "default"}
          hint="Compras puntuales"
        />
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
          hint="Recibido − pagado − ocasionales"
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

      {(
        <div className="grid lg:grid-cols-2 gap-4">
          {/* ─────────── INGRESOS ─────────── */}
          <div className="card">
            <div className="font-semibold mb-3">💰 Ingresos del mes</div>

            <details className="mb-3">
              <summary className="btn btn-ghost btn-sm list-none inline-block">＋ Agregar ingreso</summary>
              <form action={createIncome} className="grid grid-cols-2 gap-2 mt-2">
                <div className="col-span-2">
                  <label className="label">Nombre</label>
                  <input name="name" required className="input" placeholder="Salario, arriendo, freelance…" />
                </div>
                <div>
                  <label className="label">Monto / sueldo base (COP)</label>
                  <input name="amount" type="number" min="0" step="any" required className="input" placeholder="3500000" />
                </div>
                <div>
                  <label className="label">Tipo</label>
                  <select name="kind" className="select" defaultValue="recurrente">
                    <option value="recurrente">Recurrente</option>
                    <option value="salario_base">Salario base (descuenta prestaciones)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Prestaciones (%)</label>
                  <input name="prestacionesRate" type="number" min="0" max="100" step="any" className="input" placeholder="8 — solo si es salario base" />
                </div>
                <div className="col-span-2 flex gap-2">
                  <SubmitButton>Guardar ingreso</SubmitButton>
                  <CancelButton className="btn btn-ghost btn-sm" />
                </div>
              </form>
            </details>

            {incDefs.length === 0 && occasional.length === 0 && (
              <p className="text-sm text-[var(--muted)]">Agrega tu primera fuente de ingreso arriba.</p>
            )}

            <FilterList
              placeholder="Buscar ingreso…"
              items={[
                ...incDefs.map((inc) => {
                const receipt = receiptByIncome.get(inc.id);
                const net = netIncome(inc);
                const received = receipt ? receipt.amount : null;
                return { key: `inc-${inc.id}`, text: inc.name, node: (
                  <div className="border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{inc.name}</span>
                        {inc.kind === "salario_base" && <Badge tone="primary">Salario base</Badge>}
                        {!inc.active && <Badge tone="amber">Inactivo</Badge>}
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

                    <div className="flex gap-2 mt-2 flex-wrap items-start">
                      {inc.active && (
                        <details>
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
                            <SubmitButton>Guardar</SubmitButton>
                            <CancelButton className="btn btn-ghost btn-sm" />
                          </form>
                        </details>
                      )}
                      <details>
                        <summary className="btn btn-ghost btn-sm list-none inline-block">⚙️ Editar</summary>
                        <form action={updateIncome} className="grid grid-cols-2 gap-2 mt-2" style={{ minWidth: 260 }}>
                          <input type="hidden" name="id" value={inc.id} />
                          <div className="col-span-2">
                            <label className="label">Nombre</label>
                            <input name="name" defaultValue={inc.name} required className="input" />
                          </div>
                          <div>
                            <label className="label">Monto / sueldo base (COP)</label>
                            <input name="amount" type="number" min="0" step="any" defaultValue={inc.amount} required className="input" />
                          </div>
                          <div>
                            <label className="label">Tipo</label>
                            <select name="kind" className="select" defaultValue={inc.kind}>
                              <option value="recurrente">Recurrente</option>
                              <option value="salario_base">Salario base (descuenta prestaciones)</option>
                            </select>
                          </div>
                          <div className="col-span-2">
                            <label className="label">Prestaciones (%)</label>
                            <input name="prestacionesRate" type="number" min="0" max="100" step="any" defaultValue={inc.prestacionesRate || ""} className="input" placeholder="8" />
                          </div>
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" name="active" defaultChecked={inc.active} /> Activo
                          </label>
                          <div className="col-span-2 flex gap-2">
                            <SubmitButton>Actualizar</SubmitButton>
                            <CancelButton className="btn btn-ghost btn-sm" />
                          </div>
                        </form>
                      </details>
                      <DeleteButton action={deleteIncome} id={inc.id} label="🗑️" />
                    </div>
                  </div>
                ) };
              }),

              /* Ingresos ocasionales del mes */
              ...occasional.map((o) => ({ key: `occ-${o.id}`, text: o.name || "Ingreso ocasional", node: (
                <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
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
              ) })),
              ]}
            />

            <details className="mt-3">
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
                  <SubmitButton>Agregar</SubmitButton>
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
                <Link href="/deudas" className="underline">Deudas y egresos</Link>.
              </p>
            )}

            <FilterList
              placeholder="Buscar egreso…"
              items={activeExp.map((e) => {
                const pays = paymentsByExpense.get(e.id) ?? [];
                const paidTotal = sum(pays.map((p) => p.amount));
                const isPaid = pays.length > 0;
                const plan = expPlan(e.id);
                const expected = expExpected(e);
                return { key: e.id, text: `${e.name} ${e.category}`, node: (
                  <div className={`border-b border-[var(--border)] pb-3 last:border-0 last:pb-0 ${isPaid ? "opacity-90" : ""}`}>
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
                          {fmt(expected)}
                        </div>
                        {isPaid && paidTotal !== expected && (
                          <div className="text-xs text-[var(--green)]">pagado {fmt(paidTotal)}</div>
                        )}
                      </div>
                    </div>

                    {!isPaid && (
                      <PlanEditor
                        month={month}
                        kind="egreso"
                        refId={e.id}
                        projected={plan?.projected ?? null}
                        actual={plan?.actual ?? null}
                        computed={e.amount}
                      />
                    )}

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
                              defaultValue={Math.round(expected)}
                              className="input"
                              style={{ width: 160 }}
                            />
                          </div>
                          <SubmitButton>Registrar</SubmitButton>
                          <CancelButton className="btn btn-ghost btn-sm" />
                        </form>
                        <p className="text-xs text-[var(--muted)] mt-1">
                          Toma la cuota real (o proyectada) y se registra con la fecha de hoy.
                        </p>
                      </details>
                    )}
                  </div>
                ) };
              })}
            />
          </div>
        </div>
      )}

      {/* ─────────── GASTOS OCASIONALES ─────────── */}
      <div className="card mt-4">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="font-semibold">💸 Gastos ocasionales del mes</div>
          {occasionalSpent > 0 && (
            <span className="text-sm font-semibold text-[var(--red)]">
              − {fmt(occasionalSpent)}
            </span>
          )}
        </div>

        <details className="mb-3">
          <summary className="btn btn-ghost btn-sm list-none inline-block">＋ Agregar gasto ocasional</summary>
          <form action={addOccasionalExpense} className="grid grid-cols-2 gap-2 mt-2">
            <input type="hidden" name="month" value={month} />
            <div className="col-span-2">
              <label className="label">Concepto</label>
              <input name="name" required className="input" placeholder="Regalo, viaje, imprevisto…" />
            </div>
            <div>
              <label className="label">Monto (COP)</label>
              <input name="amount" type="number" min="0" step="any" required className="input" placeholder="150000" />
            </div>
            <div>
              <label className="label">Categoría (opcional)</label>
              <input name="category" className="input" placeholder="Compras, salud…" />
            </div>
            <div className="col-span-2 flex gap-2">
              <SubmitButton>Agregar</SubmitButton>
              <CancelButton className="btn btn-ghost btn-sm" />
            </div>
          </form>
          <p className="text-xs text-[var(--muted)] mt-1">
            Se registra con la fecha de hoy y se descuenta del disponible.
          </p>
        </details>

        {occExpenses.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Sin gastos ocasionales este mes.</p>
        ) : (
          <FilterList
            placeholder="Buscar gasto ocasional…"
            items={occExpenses.map((o) => ({
              key: o.id,
              text: `${o.name} ${o.category ?? ""}`,
              node: (
                <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
                  <div>
                    <div className="font-medium flex items-center gap-2 flex-wrap">
                      {o.name}
                      {o.category && <Badge tone="amber">{o.category}</Badge>}
                    </div>
                    {o.paidAt && (
                      <div className="text-xs text-[var(--muted)]">{dateLabel(o.paidAt)}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--red)]">− {fmt(o.amount)}</span>
                    <form action={deleteOccasionalExpense}>
                      <input type="hidden" name="id" value={o.id} />
                      <button className="btn btn-ghost btn-sm" aria-label="Quitar gasto ocasional">🗑️</button>
                    </form>
                  </div>
                </div>
              ),
            }))}
          />
        )}
      </div>

      {debtMx.length > 0 && (
        <div className="card mt-4">
          <div className="font-semibold mb-4">💳 Deudas del mes</div>
          <FilterList
            placeholder="Buscar deuda…"
            items={debtMx.map((m) => {
              const pays = debtPaysByDebt.get(m.id) ?? [];
              const isPaid = pays.length > 0;
              const paidCash = sum(pays.map((p) => p.amount + p.insurance));
              const plan = debtPlan(m.id);
              const expected = debtExpected(m);
              return { key: m.id, text: m.name, node: (
                <div className="border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
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
                        {fmt(isPaid ? paidCash : expected)}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        calc. {fmt(m.effectivePayment)}
                        {m.insurance > 0 ? ` + seguro ${fmt(m.insurance)}` : ""}
                      </div>
                    </div>
                  </div>

                  {!isPaid && (
                    <PlanEditor
                      month={month}
                      kind="deuda"
                      refId={m.id}
                      projected={plan?.projected ?? null}
                      actual={plan?.actual ?? null}
                      computed={m.monthlyOutflow}
                    />
                  )}

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
                            defaultValue={Math.round(expected)}
                            className="input"
                            style={{ width: 160 }}
                          />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name="counts" defaultChecked /> Cuenta como cuota
                        </label>
                        <SubmitButton>Registrar</SubmitButton>
                        <CancelButton className="btn btn-ghost btn-sm" />
                      </form>
                      <p className="text-xs text-[var(--muted)] mt-1">
                        Se registra con la fecha de hoy.
                        {m.insurance > 0 && (
                          <> El seguro del mes ({fmt(m.insurance)}) se suma a tu salida de caja; no lo incluyas en el pago a la cuota.</>
                        )}
                      </p>
                    </details>
                  )}
                </div>
              ) };
            })}
          />
        </div>
      )}
    </div>
  );
}
