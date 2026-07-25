import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="card w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🪙</div>
          <h1 className="text-xl font-bold">Finanzas</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Ingresa tu contraseña para continuar.
          </p>
        </div>

        <form action={login} className="flex flex-col gap-3">
          <input
            type="password"
            name="password"
            required
            autoFocus
            autoComplete="current-password"
            placeholder="Contraseña"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          />

          {error && (
            <p className="text-sm text-[var(--red)] font-medium">
              Contraseña incorrecta. Inténtalo de nuevo.
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-[var(--primary)] text-white font-semibold py-2 text-sm hover:opacity-90 transition-opacity"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
