import { db } from "@/lib/db";
import { incomes } from "@/lib/db/schema";
import { createIncome, updateIncome, deleteIncome } from "@/lib/actions";
import { fmt, pct } from "@/lib/format";
import { sum, netIncome } from "@/lib/finance";
import { PageHeader, Stat, EmptyState, Badge } from "@/components/ui";
import { DeleteButton } from "@/components/DeleteButton";
import { CancelButton } from "@/components/CancelButton";

export const dynamic = "force-dynamic";

export default async function IngresosPage() {
  const rows = await db.select().from(incomes);
  const total = sum(rows.filter((r) => r.active).map((r) => netIncome(r)));

  return (
    <div>
      <PageHeader
        title="Ingresos mensuales"
        subtitle="Registra tus fuentes de ingreso recurrentes (salario, arriendos, freelance…)."
      />

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <Stat label="Ingreso mensual total" value={total} tone="green" />
        <Stat label="Fuentes activas" value={String(rows.filter((r) => r.active).length)} isMoney={false} />
      </div>

      <details className="card mb-6">
        <summary className="cursor-pointer font-semibold">➕ Agregar ingreso</summary>
        <form action={createIncome} className="grid sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="label">Nombre</label>
            <input name="name" required className="input" placeholder="Salario, arriendo…" />
          </div>
          <div>
            <label className="label">Monto mensual / sueldo base (COP)</label>
            <input name="amount" type="number" min="0" step="any" required className="input" placeholder="3500000" />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select name="kind" className="select" defaultValue="recurrente">
              <option value="recurrente">Recurrente</option>
              <option value="salario_base">Salario base (descuenta prestaciones)</option>
            </select>
          </div>
          <div>
            <label className="label">Prestaciones (%)</label>
            <input name="prestacionesRate" type="number" min="0" max="100" step="any" className="input" placeholder="8 — solo si es salario base" />
            <p className="text-xs text-[var(--muted)] mt-1">% que retiene la empresa. Solo aplica al salario base.</p>
          </div>
          <div className="sm:col-span-2 flex gap-2">
            <button className="btn btn-primary">Guardar ingreso</button>
            <CancelButton />
          </div>
        </form>
      </details>

      {rows.length === 0 ? (
        <EmptyState icon="💰" title="Aún no tienes ingresos registrados" hint="Agrega tu primera fuente de ingreso arriba." />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-semibold">{r.name}</span>
                  {r.kind === "salario_base" && <Badge tone="primary">Salario base</Badge>}
                  {!r.active && <Badge tone="amber">Inactivo</Badge>}
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-[var(--green)]">{fmt(netIncome(r))}</div>
                  {r.kind === "salario_base" && r.prestacionesRate > 0 && (
                    <div className="text-xs text-[var(--muted)]">
                      base {fmt(r.amount)} − {pct(r.prestacionesRate, 0)} prestaciones
                    </div>
                  )}
                </div>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-[var(--muted)]">Editar</summary>
                <form action={updateIncome} className="grid sm:grid-cols-2 gap-4 mt-3">
                  <input type="hidden" name="id" value={r.id} />
                  <div>
                    <label className="label">Nombre</label>
                    <input name="name" defaultValue={r.name} required className="input" />
                  </div>
                  <div>
                    <label className="label">Monto mensual / sueldo base (COP)</label>
                    <input name="amount" type="number" min="0" step="any" defaultValue={r.amount} required className="input" />
                  </div>
                  <div>
                    <label className="label">Tipo</label>
                    <select name="kind" className="select" defaultValue={r.kind}>
                      <option value="recurrente">Recurrente</option>
                      <option value="salario_base">Salario base (descuenta prestaciones)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Prestaciones (%)</label>
                    <input name="prestacionesRate" type="number" min="0" max="100" step="any" defaultValue={r.prestacionesRate || ""} className="input" placeholder="8 — solo si es salario base" />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="active" defaultChecked={r.active} /> Activo
                  </label>
                  <div className="sm:col-span-2 flex gap-2">
                    <button className="btn btn-primary btn-sm">Actualizar</button>
                    <CancelButton className="btn btn-ghost btn-sm" />
                  </div>
                </form>
                <div className="mt-2">
                  <DeleteButton action={deleteIncome} id={r.id} />
                </div>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
