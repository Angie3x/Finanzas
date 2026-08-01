import Link from "next/link";
import { db } from "@/lib/db";
import {
  incomeReceipts,
  expensePayments,
  occasionalExpenses,
  debtPayments,
} from "@/lib/db/schema";
import { fmt } from "@/lib/format";
import { sum, monthLabel, monthLabelShort } from "@/lib/finance";
import { PageHeader, Stat, EmptyState } from "@/components/ui";
import { HistoryChart } from "@/components/HistoryChart";

export const dynamic = "force-dynamic";

type Agg = { recibido: number; egresos: number; deudas: number };

export default async function HistorialPage() {
  const [receipts, expPays, occExps, debtPays] = await Promise.all([
    db.select().from(incomeReceipts),
    db.select().from(expensePayments),
    db.select().from(occasionalExpenses),
    db.select().from(debtPayments),
  ]);

  const map = new Map<string, Agg>();
  const ensure = (m: string): Agg => {
    let a = map.get(m);
    if (!a) {
      a = { recibido: 0, egresos: 0, deudas: 0 };
      map.set(m, a);
    }
    return a;
  };
  for (const r of receipts) ensure(r.month).recibido += r.amount;
  for (const p of expPays) ensure(p.month).egresos += p.amount;
  for (const o of occExps) ensure(o.month).egresos += o.amount; // ocasionales cuentan como egreso del mes
  for (const p of debtPays) ensure(p.month).deudas += p.amount + p.insurance;

  const monthsAsc = [...map.keys()].sort();
  const rows = monthsAsc.map((m) => {
    const a = map.get(m)!;
    const pagado = a.egresos + a.deudas;
    return {
      month: m,
      recibido: a.recibido,
      egresos: a.egresos,
      deudas: a.deudas,
      pagado,
      disponible: a.recibido - pagado,
    };
  });

  const empty = rows.length === 0;
  const chart = rows.slice(-12).map((r) => ({
    month: monthLabelShort(r.month),
    recibido: r.recibido,
    pagado: r.pagado,
    disponible: r.disponible,
  }));
  const recent = [...rows].reverse();
  const n = rows.length || 1;
  const avgRecibido = sum(rows.map((r) => r.recibido)) / n;
  const avgPagado = sum(rows.map((r) => r.pagado)) / n;
  const avgDisponible = sum(rows.map((r) => r.disponible)) / n;

  return (
    <div>
      <PageHeader
        title="Historial mensual"
        subtitle="Compara lo recibido, lo pagado y lo disponible mes a mes."
        action={
          <Link href="/mes" className="btn btn-ghost">
            📅 Ir al mes actual
          </Link>
        }
      />

      {empty ? (
        <EmptyState
          icon="📈"
          title="Aún no hay historial"
          hint="Registra ingresos recibidos y pagos en la pantalla Mes; aquí verás la comparación mes a mes."
        />
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <Stat label="Promedio recibido" value={avgRecibido} tone="green" hint={`${rows.length} mes(es)`} />
            <Stat label="Promedio pagado" value={avgPagado} tone="amber" />
            <Stat
              label="Promedio disponible"
              value={avgDisponible}
              tone={avgDisponible >= 0 ? "primary" : "red"}
            />
          </div>

          <div className="card mb-6">
            <div className="font-semibold mb-3">Comparativo de meses</div>
            <HistoryChart data={chart} />
          </div>

          <div className="card overflow-x-auto">
            <div className="font-semibold mb-3">Detalle por mes</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--muted)] text-left border-b border-[var(--border)]">
                  <th className="py-2 pr-3 font-medium">Mes</th>
                  <th className="py-2 px-3 font-medium text-right">Recibido</th>
                  <th className="py-2 px-3 font-medium text-right">Egresos</th>
                  <th className="py-2 px-3 font-medium text-right">Deudas</th>
                  <th className="py-2 px-3 font-medium text-right">Pagado</th>
                  <th className="py-2 pl-3 font-medium text-right">Disponible</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.month} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2 pr-3 capitalize">
                      <Link href={`/mes?mes=${r.month}`} className="hover:underline">
                        {monthLabel(r.month)}
                      </Link>
                    </td>
                    <td className="py-2 px-3 text-right text-[var(--green)]">{fmt(r.recibido)}</td>
                    <td className="py-2 px-3 text-right">{fmt(r.egresos)}</td>
                    <td className="py-2 px-3 text-right">{fmt(r.deudas)}</td>
                    <td className="py-2 px-3 text-right text-[var(--amber)]">{fmt(r.pagado)}</td>
                    <td
                      className="py-2 pl-3 text-right font-semibold"
                      style={{ color: r.disponible >= 0 ? "var(--primary)" : "var(--red)" }}
                    >
                      {fmt(r.disponible)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
