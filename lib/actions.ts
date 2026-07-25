"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { incomes, fixedExpenses, debts } from "./db/schema";
import { monthlyRate, computeInstallment, remainingBalance } from "./finance";

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
export async function createIncome(formData: FormData) {
  await db.insert(incomes).values({
    name: str(formData.get("name")),
    amount: num(formData.get("amount")),
    active: true,
  });
  revalidatePath("/ingresos");
  revalidatePath("/");
}

export async function updateIncome(formData: FormData) {
  const id = num(formData.get("id"));
  await db
    .update(incomes)
    .set({
      name: str(formData.get("name")),
      amount: num(formData.get("amount")),
      active: str(formData.get("active")) === "on",
    })
    .where(eq(incomes.id, id));
  revalidatePath("/ingresos");
  revalidatePath("/");
}

export async function deleteIncome(formData: FormData) {
  await db.delete(incomes).where(eq(incomes.id, num(formData.get("id"))));
  revalidatePath("/ingresos");
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
  revalidatePath("/egresos");
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
  revalidatePath("/egresos");
  revalidatePath("/");
}

export async function deleteExpense(formData: FormData) {
  await db.delete(fixedExpenses).where(eq(fixedExpenses.id, num(formData.get("id"))));
  revalidatePath("/egresos");
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

  await db
    .update(debts)
    .set({ currentBalance: newBalance, paidInstallments: paid })
    .where(eq(debts.id, id));

  revalidatePath("/deudas");
  revalidatePath("/plan");
  revalidatePath("/");
}

export async function deleteDebt(formData: FormData) {
  await db.delete(debts).where(eq(debts.id, num(formData.get("id"))));
  revalidatePath("/deudas");
  revalidatePath("/plan");
  revalidatePath("/");
}
