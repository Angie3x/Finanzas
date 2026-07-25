import "dotenv/config";
import { db } from "../lib/db";
import { incomes, fixedExpenses, debts } from "../lib/db/schema";

async function main() {
  await db.delete(debts);
  await db.delete(fixedExpenses);
  await db.delete(incomes);

  await db.insert(incomes).values([
    { name: "Salario", amount: 4500000, active: true },
    { name: "Freelance", amount: 800000, active: true },
  ]);

  await db.insert(fixedExpenses).values([
    { name: "Arriendo", amount: 1300000, category: "Vivienda", dueDay: 5, active: true },
    { name: "Servicios", amount: 350000, category: "Servicios", dueDay: 10, active: true },
    { name: "Internet + celular", amount: 150000, category: "Servicios", dueDay: 15, active: true },
    { name: "Mercado", amount: 700000, category: "Alimentación", dueDay: 1, active: true },
  ]);

  await db.insert(debts).values([
    {
      name: "Tarjeta Visa",
      type: "tarjeta",
      principal: 6000000,
      annualRate: 28,
      rateKind: "efectiva_anual",
      totalInstallments: 24,
      paidInstallments: 5,
      dueDay: 15,
    },
    {
      name: "Crédito libre inversión",
      type: "prestamo",
      principal: 15000000,
      annualRate: 19,
      rateKind: "efectiva_anual",
      totalInstallments: 48,
      paidInstallments: 12,
      dueDay: 20,
    },
    {
      name: "Compra electrodoméstico",
      type: "tarjeta",
      principal: 2400000,
      annualRate: 32,
      rateKind: "efectiva_anual",
      totalInstallments: 12,
      paidInstallments: 3,
      dueDay: 8,
    },
  ]);

  console.log("✓ Datos de ejemplo insertados.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
