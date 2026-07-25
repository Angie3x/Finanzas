<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Proyecto: Finanzas (español, COP)

App de finanzas personales: ingresos, egresos fijos y deudas → KPIs + plan de pago.

## Stack
- Next.js 16 (App Router) + React 19 + TypeScript, Tailwind v4, Recharts.
- Drizzle ORM + libSQL: **SQLite local** (`local.db`) en dev, **Turso** en producción.
- Selección local vs. nube por variables de entorno (`DATABASE_URL`, `DATABASE_AUTH_TOKEN`).

## Convenciones
- Toda la UI y los textos en **español**; montos en **COP** vía `lib/format.ts` (`fmt`, `pct`).
- Lógica financiera pura y testeable en `lib/finance.ts` (amortización francesa, KPIs, simulación
  de plan avalancha/bola de nieve, proyección próximo mes). No duplicar cálculos en las páginas.
- Mutaciones vía Server Actions en `lib/actions.ts` (con `revalidatePath`).
- Esquema en `lib/db/schema.ts`. Tras cambiarlo: `npm run db:push`.
- Evitar `<form>` anidados (el borrado usa `components/DeleteButton.tsx`, un form aparte).

## Comandos
- `npm run dev` · `npm run build` · `npm run db:push` · `npm run db:seed` · `npm run db:studio`
