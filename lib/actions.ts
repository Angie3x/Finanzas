"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import {
  incomes,
  fixedExpenses,
  debts,
  incomeReceipts,
  expensePayments,
  occasionalExpenses,
  monthlyPlans,
  debtPayments,
} from "./db/schema";
import {
  monthlyRate,
  computeInstallment,
  remainingBalance,
  monthlyInsurance,
  normalizeMonth,
  todayISO,
} from "./finance";

/* ── helpers ── */
function num(v: FormDataEntryValue | null, fallback = 0): number {
  if (v == null) return fallback;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}
function str(v: FormDataEntryValue | null, fallback = ""): string {
  return v == null ? fallback : String(v).trim();
}
function intOrNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

/* ────────────────  INGRESOS  ──────────────── */
function incomeKind(v: FormDataEntryValue | null): "salario_base" | "recurrente" {
  return str(v) === "salario_base" ? "salario_base" : "recurrente";
}
function rate(v: FormDataEntryValue | null): number {
  return Math.max(0, Math.min(100, num(v, 0)));
}

export async function createIncome(formData: FormData) {
  const kind = incomeKind(formData.get("kind"));
  await db.insert(incomes).values({
    name: str(formData.get("name")),
    amount: num(formData.get("amount")),
    kind,
    prestacionesRate: kind === "salario_base" ? rate(formData.get("prestacionesRate")) : 0,
    active: true,
  });
  revalidatePath("/mes");
  revalidatePath("/");
}

export async function updateIncome(formData: FormData) {
  const id = num(formData.get("id"));
  const kind = incomeKind(formData.get("kind"));
  await db
    .update(incomes)
    .set({
      name: str(formData.get("name")),
      amount: num(formData.get("amount")),
      kind,
      prestacionesRate: kind === "salario_base" ? rate(formData.get("prestacionesRate")) : 0,
      active: str(formData.get("active")) === "on",
    })
    .where(eq(incomes.id, id));
  revalidatePath("/mes");
  revalidatePath("/");
}

export async function deleteIncome(formData: FormData) {
  const id = num(formData.get("id"));
  await db.delete(incomeReceipts).where(eq(incomeReceipts.incomeId, id));
  await db.delete(incomes).where(eq(incomes.id, id));
  revalidatePath("/mes");
  revalidatePath("/");
}

/* ────────────────  LEDGER MENSUAL: INGRESOS RECIBIDOS  ──────────────── */

/** Registra/actualiza cuánto se recibió de un ingreso en un mes (vacío = borrar). */
export async function setIncomeReceipt(formData: FormData) {
  const month = normalizeMonth(str(formData.get("month")));
  const incomeId = num(formData.get("incomeId"));
  const raw = String(formData.get("amount") ?? "").trim();
  await db
    .delete(incomeReceipts)
    .where(and(eq(incomeReceipts.month, month), eq(incomeReceipts.incomeId, incomeId)));
  if (raw !== "") {
    await db.insert(incomeReceipts).values({
      month,
      incomeId,
      amount: num(formData.get("amount")),
    });
  }
  revalidatePath("/mes");
  revalidatePath("/");
}

/**
 * Agrega una PARTE recibida de un ingreso en un mes (permite varias: un salario
 * que llega en dos pagos, etc.). Suma al disponible; no reemplaza las anteriores.
 */
export async function addIncomeReceipt(formData: FormData) {
  const month = normalizeMonth(str(formData.get("month")));
  const incomeId = num(formData.get("incomeId"));
  await db.insert(incomeReceipts).values({
    month,
    incomeId,
    name: str(formData.get("name")) || null,
    amount: num(formData.get("amount")),
    paidAt: str(formData.get("paidAt")) || todayISO(),
  });
  revalidatePath("/mes");
  revalidatePath("/");
}

/** Agrega un ingreso ocasional que solo existe en ese mes. */
export async function addOccasionalIncome(formData: FormData) {
  const month = normalizeMonth(str(formData.get("month")));
  await db.insert(incomeReceipts).values({
    month,
    incomeId: null,
    name: str(formData.get("name")) || "Ingreso ocasional",
    amount: num(formData.get("amount")),
  });
  revalidatePath("/mes");
  revalidatePath("/");
}

/** Elimina un movimiento de ingreso del mes (recibo u ocasional). */
export async function deleteIncomeReceipt(formData: FormData) {
  await db.delete(incomeReceipts).where(eq(incomeReceipts.id, num(formData.get("id"))));
  revalidatePath("/mes");
  revalidatePath("/");
}

/* ────────────────  EGRESOS FIJOS  ──────────────── */
export async function createExpense(formData: FormData) {
  await db.insert(fixedExpenses).values({
    name: str(formData.get("name")),
    amount: num(formData.get("amount")),
    category: str(formData.get("category")) || "General",
    dueDay: intOrNull(formData.get("dueDay")),
    active: true,
  });
  revalidatePath("/deudas");
  revalidatePath("/mes");
  revalidatePath("/");
}

export async function updateExpense(formData: FormData) {
  const id = num(formData.get("id"));
  await db
    .update(fixedExpenses)
    .set({
      name: str(formData.get("name")),
      amount: num(formData.get("amount")),
      category: str(formData.get("category")) || "General",
      dueDay: intOrNull(formData.get("dueDay")),
      active: str(formData.get("active")) === "on",
    })
    .where(eq(fixedExpenses.id, id));
  revalidatePath("/deudas");
  revalidatePath("/mes");
  revalidatePath("/");
}

export async function deleteExpense(formData: FormData) {
  const id = num(formData.get("id"));
  await db.delete(expensePayments).where(eq(expensePayments.expenseId, id));
  await db.delete(fixedExpenses).where(eq(fixedExpenses.id, id));
  revalidatePath("/deudas");
  revalidatePath("/mes");
  revalidatePath("/");
}

/* ────────────────  LEDGER MENSUAL: PAGOS DE EGRESOS  ──────────────── */

/** Registra un pago de un egreso en un mes (marca el egreso como pagado). */
export async function registerExpensePayment(formData: FormData) {
  const month = normalizeMonth(str(formData.get("month")));
  await db.insert(expensePayments).values({
    month,
    expenseId: num(formData.get("expenseId")),
    amount: num(formData.get("amount")),
    paidAt: str(formData.get("paidAt")) || todayISO(),
  });
  revalidatePath("/mes");
  revalidatePath("/");
}

/** Elimina un pago registrado (desmarca el egreso de ese mes). */
export async function deleteExpensePayment(formData: FormData) {
  await db.delete(expensePayments).where(eq(expensePayments.id, num(formData.get("id"))));
  revalidatePath("/mes");
  revalidatePath("/");
}

/* ────────────────  GASTOS OCASIONALES DEL MES  ──────────────── */

/** Registra un gasto ocasional (puntual) en un mes; reduce el disponible. */
export async function addOccasionalExpense(formData: FormData) {
  const month = normalizeMonth(str(formData.get("month")));
  await db.insert(occasionalExpenses).values({
    month,
    name: str(formData.get("name")) || "Gasto ocasional",
    amount: num(formData.get("amount")),
    category: str(formData.get("category")) || null,
    paidAt: str(formData.get("paidAt")) || todayISO(),
  });
  revalidatePath("/mes");
  revalidatePath("/historial");
  revalidatePath("/");
}

/** Elimina un gasto ocasional del mes. */
export async function deleteOccasionalExpense(formData: FormData) {
  await db.delete(occasionalExpenses).where(eq(occasionalExpenses.id, num(formData.get("id"))));
  revalidatePath("/mes");
  revalidatePath("/historial");
  revalidatePath("/");
}

/* ────────────────  PLAN MENSUAL: CUOTA PROYECTADA / REAL  ──────────────── */

type PlanKind = "deuda" | "egreso";

/** Upsert de un campo del plan mensual (projected|actual) para un ítem y mes. */
async function upsertMonthlyPlan(
  month: string,
  kind: PlanKind,
  refId: number,
  field: "projected" | "actual",
  raw: string
) {
  const value = raw.trim() === "" ? null : num(raw);
  const existing = await db
    .select()
    .from(monthlyPlans)
    .where(
      and(
        eq(monthlyPlans.month, month),
        eq(monthlyPlans.kind, kind),
        eq(monthlyPlans.refId, refId)
      )
    );

  if (existing[0]) {
    // Si ambos campos quedan vacíos, elimina la fila.
    const other = field === "projected" ? existing[0].actual : existing[0].projected;
    if (value == null && other == null) {
      await db.delete(monthlyPlans).where(eq(monthlyPlans.id, existing[0].id));
    } else {
      await db
        .update(monthlyPlans)
        .set({ [field]: value })
        .where(eq(monthlyPlans.id, existing[0].id));
    }
  } else if (value != null) {
    await db.insert(monthlyPlans).values({ month, kind, refId, [field]: value });
  }
}

function planKind(v: FormDataEntryValue | null): PlanKind {
  return str(v) === "egreso" ? "egreso" : "deuda";
}

/** Fija (o borra, si viene vacío) la cuota PROYECTADA de un ítem para el mes. */
export async function setProjectedAmount(formData: FormData) {
  const month = normalizeMonth(str(formData.get("month")));
  await upsertMonthlyPlan(
    month,
    planKind(formData.get("kind")),
    num(formData.get("refId")),
    "projected",
    String(formData.get("amount") ?? "")
  );
  revalidatePath("/mes");
  revalidatePath("/");
}

/** Fija (o borra) la cuota REAL del corte de un ítem para el mes. */
export async function setActualAmount(formData: FormData) {
  const month = normalizeMonth(str(formData.get("month")));
  await upsertMonthlyPlan(
    month,
    planKind(formData.get("kind")),
    num(formData.get("refId")),
    "actual",
    String(formData.get("amount") ?? "")
  );
  revalidatePath("/mes");
  revalidatePath("/");
}

/* ────────────────  DEUDAS  ──────────────── */
export async function createDebt(formData: FormData) {
  await db.insert(debts).values({
    name: str(formData.get("name")),
    type: (str(formData.get("type")) as "prestamo" | "tarjeta") || "prestamo",
    principal: num(formData.get("principal")),
    annualRate: num(formData.get("annualRate")),
    rateKind:
      (str(formData.get("rateKind")) as
        | "efectiva_anual"
        | "nominal_anual"
        | "mensual") || "efectiva_anual",
    totalInstallments: Math.max(1, num(formData.get("totalInstallments"), 1)),
    paidInstallments: Math.max(0, num(formData.get("paidInstallments"), 0)),
    installmentAmount: num(formData.get("installmentAmount")) || null,
    insuranceKind:
      (str(formData.get("insuranceKind")) as "none" | "fijo" | "saldo") || "none",
    insuranceValue: Math.max(0, num(formData.get("insuranceValue"), 0)),
    extraPayment: Math.max(0, num(formData.get("extraPayment"), 0)),
    currentBalance:
      String(formData.get("currentBalance") ?? "").trim() === ""
        ? null
        : num(formData.get("currentBalance")),
    dueDay: intOrNull(formData.get("dueDay")),
    startDate: str(formData.get("startDate")) || null,
  });
  revalidatePath("/deudas");
  revalidatePath("/plan");
  revalidatePath("/");
}

export async function updateDebt(formData: FormData) {
  const id = num(formData.get("id"));
  await db
    .update(debts)
    .set({
      name: str(formData.get("name")),
      type: (str(formData.get("type")) as "prestamo" | "tarjeta") || "prestamo",
      principal: num(formData.get("principal")),
      annualRate: num(formData.get("annualRate")),
      rateKind:
        (str(formData.get("rateKind")) as
          | "efectiva_anual"
          | "nominal_anual"
          | "mensual") || "efectiva_anual",
      totalInstallments: Math.max(1, num(formData.get("totalInstallments"), 1)),
      paidInstallments: Math.max(0, num(formData.get("paidInstallments"), 0)),
      installmentAmount: num(formData.get("installmentAmount")) || null,
      insuranceKind:
        (str(formData.get("insuranceKind")) as "none" | "fijo" | "saldo") || "none",
      insuranceValue: Math.max(0, num(formData.get("insuranceValue"), 0)),
      extraPayment: Math.max(0, num(formData.get("extraPayment"), 0)),
      currentBalance:
        String(formData.get("currentBalance") ?? "").trim() === ""
          ? null
          : num(formData.get("currentBalance")),
      dueDay: intOrNull(formData.get("dueDay")),
      startDate: str(formData.get("startDate")) || null,
    })
    .where(eq(debts.id, id));
  revalidatePath("/deudas");
  revalidatePath("/plan");
  revalidatePath("/");
}

/**
 * Registra un pago real por un monto (personalizable). El pago cubre primero el
 * interés del mes y el resto abona a capital, reduciendo el saldo real.
 * - counts=true  → cuenta como cuota (avanza el contador de cuotas pagadas).
 * - counts=false → abono extraordinario a capital (no avanza cuotas).
 */
export async function registerPayment(formData: FormData) {
  const id = num(formData.get("id"));
  const amount = Math.max(0, num(formData.get("amount")));
  const counts = str(formData.get("counts")) === "on";
  const month = normalizeMonth(str(formData.get("month")));
  const paidAt = str(formData.get("paidAt")) || todayISO();

  const rows = await db.select().from(debts).where(eq(debts.id, id));
  const d = rows[0];
  if (!d) return;

  const i = monthlyRate(d.annualRate, d.rateKind);
  const installment =
    d.installmentAmount && d.installmentAmount > 0
      ? d.installmentAmount
      : computeInstallment(d.principal, i, d.totalInstallments);
  const balance =
    d.currentBalance != null && d.currentBalance >= 0
      ? d.currentBalance
      : remainingBalance(d.principal, i, installment, d.paidInstallments);

  const interest = balance * i;
  const newBalance = Math.max(0, balance + interest - amount);
  const paid = counts
    ? Math.min(d.paidInstallments + 1, d.totalInstallments)
    : d.paidInstallments;
  // Seguro del mes calculado sobre el saldo antes del pago.
  const insurance = monthlyInsurance(d.insuranceKind, d.insuranceValue, balance);

  await db
    .update(debts)
    .set({ currentBalance: newBalance, paidInstallments: paid })
    .where(eq(debts.id, id));

  // Registro en el ledger del mes (para el disponible y el historial).
  await db.insert(debtPayments).values({
    month,
    debtId: id,
    amount,
    insurance,
    counts,
    prevBalance: d.currentBalance, // estado previo para deshacer (puede ser null)
    prevPaid: d.paidInstallments,
    paidAt,
  });

  revalidatePath("/deudas");
  revalidatePath("/plan");
  revalidatePath("/mes");
  revalidatePath("/historial");
  revalidatePath("/");
}

/** Deshace un pago de deuda: restaura saldo/cuotas previos y borra el registro. */
export async function deleteDebtPayment(formData: FormData) {
  const payId = num(formData.get("id"));
  const rows = await db.select().from(debtPayments).where(eq(debtPayments.id, payId));
  const p = rows[0];
  if (!p) return;

  await db
    .update(debts)
    .set({ currentBalance: p.prevBalance, paidInstallments: p.prevPaid })
    .where(eq(debts.id, p.debtId));
  await db.delete(debtPayments).where(eq(debtPayments.id, payId));

  revalidatePath("/deudas");
  revalidatePath("/plan");
  revalidatePath("/mes");
  revalidatePath("/historial");
  revalidatePath("/");
}

export async function deleteDebt(formData: FormData) {
  const id = num(formData.get("id"));
  await db.delete(debtPayments).where(eq(debtPayments.debtId, id));
  await db.delete(debts).where(eq(debts.id, id));
  revalidatePath("/deudas");
  revalidatePath("/plan");
  revalidatePath("/mes");
  revalidatePath("/historial");
  revalidatePath("/");
}
