# 🪙 Finanzas — Organizador de finanzas y plan de pago de deudas

Aplicación web personal (en **pesos colombianos, COP**) para:

- Registrar **ingresos** mensuales y **egresos fijos**.
- Registrar **deudas** (préstamos y tarjetas): monto, tasa de interés, cuotas totales/pagadas.
  La **cuota, el saldo a la fecha y los intereses se calculan automáticamente** (amortización francesa).
- Ver **KPIs**: flujo disponible, ratio de endeudamiento (DTI), % de ingreso comprometido, salud financiera.
- Generar un **plan de pago** comparando estrategias **Avalancha** (mayor interés primero) vs. **Bola de nieve** (menor saldo primero).
- **Proyectar los pagos del próximo mes** (cuotas + egresos fijos), ordenados por día.

## 🧱 Tecnologías

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 + React 19 + TypeScript |
| Estilos / gráficos | Tailwind CSS v4 + Recharts |
| Base de datos | SQLite (local) → **Turso / libSQL** (nube) |
| ORM | Drizzle ORM |
| Hosting | Vercel (app) + Turso (datos) — **ambos gratis** |

---

## 🚀 Uso local (pruebas)

Requisitos: **Node.js 18+**.

```bash
npm install          # instalar dependencias (solo la primera vez)
npm run db:push      # crear/actualizar la base de datos local (local.db)
npm run db:seed      # (opcional) cargar datos de ejemplo
npm run dev          # iniciar en http://localhost:3000
```

- Para **empezar de cero** (borrar los datos de ejemplo): elimina el archivo `local.db` y ejecuta `npm run db:push` de nuevo.
- `npm run db:studio` abre un explorador visual de la base de datos.

La base de datos local es el archivo `local.db` (no se sube a Git).

---

## ☁️ Despliegue gratuito a la nube (Turso + Vercel)

### 1) Crear la base de datos en Turso (gratis)

1. Crea una cuenta en <https://turso.tech> e instala su CLI, o usa el panel web.
2. Crea una base de datos, por ejemplo `finanzas`.
3. Obtén dos valores:
   - **URL** de la base (empieza con `libsql://...`).
   - **Token** de autenticación.
4. Crea las tablas en la nube apuntando temporalmente tu `.env.local` a Turso y ejecutando:
   ```bash
   npm run db:push
   ```
   (o desde el panel de Turso ejecutando el SQL de la carpeta `drizzle/`).

### 2) Subir el código a GitHub

```bash
git add .
git commit -m "App de finanzas"
git push
```

### 3) Desplegar en Vercel (gratis)

1. Entra a <https://vercel.com>, conecta tu repositorio de GitHub e importa el proyecto.
2. En **Settings → Environment Variables**, agrega:
   | Variable | Valor |
   |----------|-------|
   | `DATABASE_URL` | `libsql://TU-BASE.turso.io` |
   | `DATABASE_AUTH_TOKEN` | tu token de Turso |
   | `APP_PASSWORD` | una contraseña propia (protege el acceso) |
3. Pulsa **Deploy**. En 1–2 minutos tendrás tu app en una URL pública `https://...vercel.app`.

> Los mismos datos se verán desde cualquier dispositivo porque viven en Turso (nube).

---

## 📁 Estructura del proyecto

```
app/
  page.tsx          → Panel (dashboard con KPIs)
  deudas/           → Gestión de deudas
  plan/             → Plan de pago + proyección próximo mes
  ingresos/         → Gestión de ingresos
  egresos/          → Gestión de egresos fijos
lib/
  db/schema.ts      → Tablas (incomes, fixed_expenses, debts)
  db/index.ts       → Conexión (local o Turso según variables de entorno)
  finance.ts        → Cálculos: amortización, KPIs, simulación del plan
  actions.ts        → Guardar/editar/eliminar (Server Actions)
  format.ts         → Formato COP y porcentajes
components/          → UI y gráficos
scripts/seed.ts     → Datos de ejemplo
```

## 🧮 Notas de cálculo

- **Cuota** (sistema francés): `A = P·i / (1 − (1+i)^−n)`.
- **Tasa mensual**: si la tasa es *Efectiva Anual* (E.A., común en Colombia) se convierte con `(1+EA)^(1/12) − 1`.
- **Saldo a la fecha**: se calcula según las cuotas ya pagadas, salvo que lo ingreses manualmente.
- Si conoces el **valor exacto de tu cuota**, ingrésalo y la app lo respeta en lugar de calcularlo.
