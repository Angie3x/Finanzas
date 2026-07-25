import type { Debt, FixedExpense, Income } from "./db/schema";

/* ────────────────────────────────────────────────────────────────────────
 * Utilidades financieras (sistema de amortización francés = cuota fija)
 * ──────────────────────────────────────────────────────────────────────── */

/** Convierte la tasa ingresada a tasa mensual efectiva (decimal). */
export function monthlyRate(annualRate: number, rateKind: Debt["rateKind"]): number {
  const r = (annualRate ?? 0) / 100;
  switch (rateKind) {
    case "mensual":
      return r;
    case "nominal_anual":
      return r / 12;
    case "efectiva_anual":
    default:
      return Math.pow(1 + r, 1 / 12) - 1;
  }
}

/** Cuota fija (sistema francés) para un préstamo P a n cuotas con tasa mensual i. */
export function computeInstallment(P: number, i: number, n: number): number {
  if (n <= 0) return 0;
  if (i <= 0) return P / n;
  return (P * i) / (1 - Math.pow(1 + i, -n));
}

/**
 * Seguro mensual del crédito según su modalidad.
 * - "fijo": monto fijo en COP por mes.
 * - "saldo": tasa mensual (%) aplicada al saldo pendiente (baja con el saldo).
 * - "none": sin seguro.
 * No abona a capital: es un costo adicional que se paga junto a la cuota.
 */
export function monthlyInsurance(
  kind: Debt["insuranceKind"],
  value: number,
  balance: number
): number {
  const v = Math.max(0, value ?? 0);
  if (kind === "fijo") return v;
  if (kind === "saldo") return Math.max(0, balance) * (v / 100);
  return 0;
}

/** Saldo restante tras k pagos de una cuota fija A. */
export function remainingBalance(P: number, i: number, A: number, k: number): number {
  if (k <= 0) return P;
  let bal: number;
  if (i <= 0) {
    bal = P - A * k;
  } else {
    const f = Math.pow(1 + i, k);
    bal = P * f - A * ((f - 1) / i);
  }
  return Math.max(0, bal);
}

/* ────────────────────────────────────────────────────────────────────────
 * Métricas derivadas por deuda
 * ──────────────────────────────────────────────────────────────────────── */

export type DebtMetrics = {
  id: number;
  name: string;
  type: Debt["type"];
  monthlyRate: number; // tasa mensual efectiva (decimal)
  annualEffective: number; // tasa efectiva anual (decimal) para comparar
  installment: number; // valor de la cuota (solo amortización)
  extra: number; // abono extra fijo mensual asignado a esta deuda
  effectivePayment: number; // pago de amortización previsto (cuota + extra, tope al saldo)
  insurance: number; // seguro estimado del mes (sobre el saldo actual)
  monthlyOutflow: number; // salida de caja mensual real = amortización + seguro
  insuranceKind: Debt["insuranceKind"]; // modalidad del seguro
  insuranceValue: number; // COP (fijo) o % mensual (saldo)
  balance: number; // saldo a la fecha
  paidInstallments: number;
  totalInstallments: number;
  pendingInstallments: number;
  nextInterest: number; // interés del próximo pago
  nextPrincipal: number; // abono a capital del próximo pago
  nextPayment: number; // valor estimado del próximo pago (solo la cuota)
  totalRemaining: number; // total que falta por pagar (cuotas pendientes)
  interestRemaining: number; // intereses que faltan por pagar
  dueDay: number | null;
};

export function debtMetrics(d: Debt): DebtMetrics {
  const i = monthlyRate(d.annualRate, d.rateKind);
  const n = d.totalInstallments;
  const paid = Math.min(d.paidInstallments, n);
  const installment =
    d.installmentAmount && d.installmentAmount > 0
      ? d.installmentAmount
      : computeInstallment(d.principal, i, n);

  const balance =
    d.currentBalance != null && d.currentBalance >= 0
      ? d.currentBalance
      : remainingBalance(d.principal, i, installment, paid);

  const pending = Math.max(0, n - paid);
  const extra = Math.max(0, d.extraPayment ?? 0);
  const nextInterest = balance * i;
  const nextPayment = pending > 0 ? Math.min(installment, balance + nextInterest) : 0;
  const nextPrincipal = Math.max(0, nextPayment - nextInterest);
  const effectivePayment =
    pending > 0 || balance > 0 ? Math.min(installment + extra, balance + nextInterest) : 0;
  const insurance =
    pending > 0 || balance > 0
      ? monthlyInsurance(d.insuranceKind, d.insuranceValue, balance)
      : 0;
  const monthlyOutflow = effectivePayment + insurance;
  const totalRemaining = pending > 0 ? installment * pending : 0;

  return {
    id: d.id,
    name: d.name,
    type: d.type,
    monthlyRate: i,
    annualEffective: Math.pow(1 + i, 12) - 1,
    installment,
    extra,
    effectivePayment,
    insurance,
    monthlyOutflow,
    insuranceKind: d.insuranceKind,
    insuranceValue: d.insuranceValue,
    balance,
    paidInstallments: paid,
    totalInstallments: n,
    pendingInstallments: pending,
    nextInterest,
    nextPrincipal,
    nextPayment,
    totalRemaining,
    interestRemaining: Math.max(0, totalRemaining - balance),
    dueDay: d.dueDay ?? null,
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * KPIs globales del panel
 * ──────────────────────────────────────────────────────────────────────── */

export type Kpis = {
  totalIncome: number;
  totalFixedExpenses: number;
  totalDebtPayment: number; // suma de cuotas mensuales de deudas activas
  totalDebtBalance: number; // suma de saldos a la fecha
  totalInterestRemaining: number;
  availableCashFlow: number; // ingresos - egresos fijos - pago deudas
  dti: number; // % ingreso comprometido en deudas (pago deudas / ingresos)
  committedRatio: number; // % ingreso comprometido total (egresos + deudas)
  monthsToDebtFree: number; // pagando solo las cuotas mínimas
};

export function computeKpis(
  incomes: Income[],
  expenses: FixedExpense[],
  metrics: DebtMetrics[]
): Kpis {
  const totalIncome = sum(incomes.filter((x) => x.active).map((x) => x.amount));
  const totalFixedExpenses = sum(expenses.filter((x) => x.active).map((x) => x.amount));
  const active = metrics.filter((m) => m.pendingInstallments > 0);
  const totalDebtPayment = sum(active.map((m) => m.monthlyOutflow));
  const totalDebtBalance = sum(metrics.map((m) => m.balance));
  const totalInterestRemaining = sum(metrics.map((m) => m.interestRemaining));
  const availableCashFlow = totalIncome - totalFixedExpenses - totalDebtPayment;
  const monthsToDebtFree = active.length
    ? Math.max(...active.map((m) => m.pendingInstallments))
    : 0;

  return {
    totalIncome,
    totalFixedExpenses,
    totalDebtPayment,
    totalDebtBalance,
    totalInterestRemaining,
    availableCashFlow,
    dti: totalIncome > 0 ? (totalDebtPayment / totalIncome) * 100 : 0,
    committedRatio:
      totalIncome > 0
        ? ((totalFixedExpenses + totalDebtPayment) / totalIncome) * 100
        : 0,
    monthsToDebtFree,
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * Simulación del plan de pago: Avalancha vs. Bola de nieve
 * ──────────────────────────────────────────────────────────────────────── */

export type PlanStrategy = "avalancha" | "bola_de_nieve";

export type DebtPayoff = {
  id: number;
  name: string;
  payoffMonth: number; // en cuántos meses queda saldada
  interestPaid: number;
};

export type PlanResult = {
  strategy: PlanStrategy;
  months: number; // meses hasta quedar libre de deudas
  totalInterest: number;
  totalPaid: number;
  payoffs: DebtPayoff[];
  monthly: { month: number; totalBalance: number; paid: number }[];
};

type SimDebt = {
  id: number;
  name: string;
  i: number;
  balance: number;
  installment: number;
  extra: number;
  insuranceKind: Debt["insuranceKind"];
  insuranceValue: number;
  interestPaid: number;
  insurancePaid: number;
  payoffMonth: number;
};

/**
 * Simula el pago mes a mes. Cada deuda paga su cuota mínima; el `extraBudget`
 * se destina íntegro a UNA deuda objetivo según la estrategia, y al saldar una
 * deuda su cuota liberada se "rueda" hacia las demás (método snowball/avalanche).
 */
export function simulatePlan(
  metrics: DebtMetrics[],
  extraBudget: number,
  strategy: PlanStrategy,
  maxMonths = 600
): PlanResult {
  const debts: SimDebt[] = metrics
    .filter((m) => m.balance > 0 && m.pendingInstallments > 0)
    .map((m) => ({
      id: m.id,
      name: m.name,
      i: m.monthlyRate,
      balance: m.balance,
      installment: m.installment,
      extra: m.extra,
      insuranceKind: m.insuranceKind,
      insuranceValue: m.insuranceValue,
      interestPaid: 0,
      insurancePaid: 0,
      payoffMonth: 0,
    }));

  const monthly: PlanResult["monthly"] = [];
  let month = 0;
  let totalPaid = 0;

  const order = (list: SimDebt[]) =>
    [...list].sort((a, b) =>
      strategy === "avalancha" ? b.i - a.i : a.balance - b.balance
    );

  while (debts.some((d) => d.balance > 0.01) && month < maxMonths) {
    month++;
    let paidThisMonth = 0;
    // Presupuesto extra disponible este mes (crece con cuotas liberadas).
    const freed = sum(
      debts.filter((d) => d.balance <= 0.01 && d.payoffMonth > 0).map((d) => d.installment)
    );
    let extraPool = Math.max(0, extraBudget) + freed;

    // 1) Aplicar intereses, seguro y (cuota + abono extra fijo de la deuda) a cada deuda con saldo.
    for (const d of debts) {
      if (d.balance <= 0.01) continue;
      const interest = d.balance * d.i;
      d.interestPaid += interest;
      // Seguro sobre el saldo al inicio del mes; es costo, no abona a capital.
      const insurance = monthlyInsurance(d.insuranceKind, d.insuranceValue, d.balance);
      d.insurancePaid += insurance;
      paidThisMonth += insurance;
      const pay = Math.min(d.installment + d.extra, d.balance + interest);
      d.balance = d.balance + interest - pay;
      paidThisMonth += pay;
      if (d.balance <= 0.01 && d.payoffMonth === 0) d.payoffMonth = month;
    }

    // 2) Repartir el extra a las deudas objetivo (según estrategia).
    for (const d of order(debts)) {
      if (extraPool <= 0.01) break;
      if (d.balance <= 0.01) continue;
      const pay = Math.min(extraPool, d.balance);
      d.balance -= pay;
      extraPool -= pay;
      paidThisMonth += pay;
      if (d.balance <= 0.01 && d.payoffMonth === 0) d.payoffMonth = month;
    }

    totalPaid += paidThisMonth;
    monthly.push({
      month,
      totalBalance: sum(debts.map((d) => Math.max(0, d.balance))),
      paid: paidThisMonth,
    });
  }

  return {
    strategy,
    months: month,
    totalInterest: sum(debts.map((d) => d.interestPaid)),
    totalPaid,
    payoffs: debts
      .map((d) => ({
        id: d.id,
        name: d.name,
        payoffMonth: d.payoffMonth || month,
        interestPaid: d.interestPaid,
      }))
      .sort((a, b) => a.payoffMonth - b.payoffMonth),
    monthly,
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * Proyección de pagos del próximo mes
 * ──────────────────────────────────────────────────────────────────────── */

export type NextMonthItem = {
  kind: "deuda" | "egreso";
  name: string;
  amount: number;
  dueDay: number | null;
  detail?: string;
};

export function nextMonthProjection(
  expenses: FixedExpense[],
  metrics: DebtMetrics[]
): { items: NextMonthItem[]; total: number } {
  const items: NextMonthItem[] = [];

  for (const m of metrics) {
    if (m.pendingInstallments > 0) {
      const extraNote = m.extra > 0 ? ` · incluye abono extra` : "";
      const insNote = m.insurance > 0 ? ` · incluye seguro` : "";
      items.push({
        kind: "deuda",
        name: m.name,
        amount: m.monthlyOutflow,
        dueDay: m.dueDay,
        detail: `Cuota ${m.paidInstallments + 1} de ${m.totalInstallments}${extraNote}${insNote}`,
      });
    }
  }
  for (const e of expenses.filter((x) => x.active)) {
    items.push({
      kind: "egreso",
      name: e.name,
      amount: e.amount,
      dueDay: e.dueDay,
      detail: e.category,
    });
  }

  items.sort((a, b) => (a.dueDay ?? 99) - (b.dueDay ?? 99));
  return { items, total: sum(items.map((x) => x.amount)) };
}

/* ── helpers ── */
export function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + (b || 0), 0);
}

export function monthsFromNow(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
}
