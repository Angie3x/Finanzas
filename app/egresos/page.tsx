import { db } from "@/lib/db";
import { fixedExpenses } from "@/lib/db/schema";
import { createExpense, updateExpense, deleteExpense } from "@/lib/actions";
import { fmt } from "@/lib/format";
import { sum } from "@/lib/finance";
import { PageHeader, Stat, EmptyState, Badge } from "@/components/ui";
import { DeleteButton } from "@/components/DeleteButton";

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

export default async function EgresosPage() {
  const rows = await db.select().from(fixedExpenses);
  const total = sum(rows.filter((r) => r.active).map((r) => r.amount));

  return (
    <div>
      <PageHeader
        title="Egresos fijos mensuales"
        subtitle="Gastos recurrentes que pagas cada mes (arriendo, servicios, suscripciones…)."
      />

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <Stat label="Egresos fijos totales" value={total} tone="red" />
        <Stat label="Gastos activos" value={String(rows.filter((r) => r.active).length)} isMoney={false} />
      </div>

      <details className="card mb-6">
        <summary className="cursor-pointer font-semibold">➕ Agregar egreso fijo</summary>
        <form action={createExpense} className="grid sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="label">Nombre</label>
            <input name="name" required className="input" placeholder="Arriendo, Internet…" />
          </div>
          <div>
            <label className="label">Monto mensual (COP)</label>
            <input name="amount" type="number" min="0" step="1000" required className="input" placeholder="1200000" />
          </div>
          <div>
            <label className="label">Categoría</label>
            <select name="category" className="select" defaultValue="General">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Día de pago (opcional)</label>
            <input name="dueDay" type="number" min="1" max="31" className="input" placeholder="5" />
          </div>
          <div className="sm:col-span-2">
            <button className="btn btn-primary">Guardar egreso</button>
          </div>
        </form>
      </details>

      {rows.length === 0 ? (
        <EmptyState icon="🧾" title="Aún no tienes egresos fijos" hint="Agrega tus gastos recurrentes arriba." />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
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

              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-[var(--muted)]">Editar</summary>
                <form action={updateExpense} className="grid sm:grid-cols-2 gap-4 mt-3">
                  <input type="hidden" name="id" value={r.id} />
                  <div>
                    <label className="label">Nombre</label>
                    <input name="name" defaultValue={r.name} required className="input" />
                  </div>
                  <div>
                    <label className="label">Monto mensual (COP)</label>
                    <input name="amount" type="number" min="0" step="1000" defaultValue={r.amount} required className="input" />
                  </div>
                  <div>
                    <label className="label">Categoría</label>
                    <select name="category" className="select" defaultValue={r.category}>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Día de pago</label>
                    <input name="dueDay" type="number" min="1" max="31" defaultValue={r.dueDay ?? ""} className="input" />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="active" defaultChecked={r.active} /> Activo
                  </label>
                  <div className="sm:col-span-2">
                    <button className="btn btn-primary btn-sm">Actualizar</button>
                  </div>
                </form>
                <div className="mt-2">
                  <DeleteButton action={deleteExpense} id={r.id} />
                </div>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
