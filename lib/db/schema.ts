import { sql } from "drizzle-orm";
import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

/** Ingresos mensuales (salario, arriendos, freelance, etc.) */
export const incomes = sqliteTable("incomes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  amount: real("amount").notNull(), // monto mensual en COP (sueldo base si kind=salario_base)
  // Tipo de ingreso: "salario_base" aplica descuento de prestaciones; "recurrente" no.
  kind: text("kind", { enum: ["salario_base", "recurrente"] })
    .notNull()
    .default("recurrente"),
  // % que la empresa retiene del salario base (prestaciones sociales). Solo aplica a salario_base.
  prestacionesRate: real("prestaciones_rate").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Ledger de ingresos recibidos por mes ("YYYY-MM").
 * Guarda cuánto entró realmente cada mes. `incomeId` nulo = ingreso ocasional
 * que solo existe en ese mes (usa `name` como etiqueta).
 */
export const incomeReceipts = sqliteTable("income_receipts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  month: text("month").notNull(), // "YYYY-MM"
  incomeId: integer("income_id").references(() => incomes.id, {
    onDelete: "cascade",
  }),
  name: text("name"), // etiqueta (para ocasionales o historial)
  amount: real("amount").notNull(), // monto realmente recibido
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Ledger de pagos de egresos por mes ("YYYY-MM").
 * Cada fila es un pago registrado; su existencia marca el egreso como pagado.
 */
export const expensePayments = sqliteTable("expense_payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  month: text("month").notNull(), // "YYYY-MM"
  expenseId: integer("expense_id")
    .notNull()
    .references(() => fixedExpenses.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(), // monto pagado
  paidAt: text("paid_at"), // fecha del pago (ISO), opcional
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** Egresos fijos mensuales (arriendo, servicios, suscripciones, etc.) */
export const fixedExpenses = sqliteTable("fixed_expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  amount: real("amount").notNull(), // monto mensual en COP
  category: text("category").notNull().default("General"),
  dueDay: integer("due_day"), // día del mes en que se paga (1-31), opcional
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** Deudas: préstamos y tarjetas de crédito (compras a cuotas) */
export const debts = sqliteTable("debts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type", { enum: ["prestamo", "tarjeta"] })
    .notNull()
    .default("prestamo"),
  principal: real("principal").notNull(), // saldo total original de la deuda
  annualRate: real("annual_rate").notNull().default(0), // tasa de interés (%)
  rateKind: text("rate_kind", {
    enum: ["efectiva_anual", "nominal_anual", "mensual"],
  })
    .notNull()
    .default("efectiva_anual"),
  totalInstallments: integer("total_installments").notNull().default(1), // cuotas totales
  paidInstallments: integer("paid_installments").notNull().default(0), // cuotas pagadas
  installmentAmount: real("installment_amount"), // valor de la cuota (si se conoce; si no, se calcula)
  // Seguro asociado al crédito (vida/cartera). No abona a capital.
  insuranceKind: text("insurance_kind", { enum: ["none", "fijo", "saldo"] })
    .notNull()
    .default("none"), // none = sin seguro; fijo = COP/mes; saldo = % mensual sobre el saldo
  insuranceValue: real("insurance_value").notNull().default(0), // COP (fijo) o % mensual (saldo)
  extraPayment: real("extra_payment").notNull().default(0), // abono extra fijo mensual asignado a esta deuda
  currentBalance: real("current_balance"), // saldo a la fecha (si se conoce; si no, se calcula)
  dueDay: integer("due_day"), // día del mes de pago (1-31), opcional
  startDate: text("start_date"), // fecha de inicio (ISO), opcional
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Ledger de pagos de deuda por mes ("YYYY-MM").
 * `amount` = pago a la cuota (interés + capital); `insurance` = seguro del mes.
 * La salida de caja del mes = amount + insurance. `prevBalance`/`prevPaid`
 * guardan el estado anterior de la deuda para poder deshacer el pago.
 */
export const debtPayments = sqliteTable("debt_payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  month: text("month").notNull(), // "YYYY-MM"
  debtId: integer("debt_id")
    .notNull()
    .references(() => debts.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(), // pago a la cuota (no incluye seguro)
  insurance: real("insurance").notNull().default(0), // seguro del mes
  counts: integer("counts", { mode: "boolean" }).notNull().default(true), // avanzó cuota
  prevBalance: real("prev_balance"), // saldo previo (para deshacer); null = se calculaba
  prevPaid: integer("prev_paid").notNull().default(0), // cuotas pagadas previas
  paidAt: text("paid_at"), // fecha del pago (ISO), opcional
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type Income = typeof incomes.$inferSelect;
export type FixedExpense = typeof fixedExpenses.$inferSelect;
export type Debt = typeof debts.$inferSelect;
export type IncomeReceipt = typeof incomeReceipts.$inferSelect;
export type ExpensePayment = typeof expensePayments.$inferSelect;
export type DebtPayment = typeof debtPayments.$inferSelect;
