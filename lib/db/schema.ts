import { sql } from "drizzle-orm";
import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

/** Ingresos mensuales (salario, arriendos, freelance, etc.) */
export const incomes = sqliteTable("incomes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  amount: real("amount").notNull(), // monto mensual en COP
  active: integer("active", { mode: "boolean" }).notNull().default(true),
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
  extraPayment: real("extra_payment").notNull().default(0), // abono extra fijo mensual asignado a esta deuda
  currentBalance: real("current_balance"), // saldo a la fecha (si se conoce; si no, se calcula)
  dueDay: integer("due_day"), // día del mes de pago (1-31), opcional
  startDate: text("start_date"), // fecha de inicio (ISO), opcional
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type Income = typeof incomes.$inferSelect;
export type FixedExpense = typeof fixedExpenses.$inferSelect;
export type Debt = typeof debts.$inferSelect;
