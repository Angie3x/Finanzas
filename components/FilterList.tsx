"use client";

import { useMemo, useState, type ReactNode } from "react";

export type FilterItem = {
  key: string | number;
  /** Texto sobre el que se busca (nombre, categoría, etc.). */
  text: string;
  node: ReactNode;
};

/** Quita tildes y pasa a minúsculas para una búsqueda tolerante. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Lista con buscador por nombre y scroll. El buscador solo aparece cuando hay
 * suficientes elementos como para que valga la pena filtrar.
 */
export function FilterList({
  items,
  placeholder = "Buscar…",
  maxHeight = 400,
  minToSearch = 4,
  empty,
}: {
  items: FilterItem[];
  placeholder?: string;
  maxHeight?: number;
  minToSearch?: number;
  empty?: ReactNode;
}) {
  const [q, setQ] = useState("");
  const nq = norm(q.trim());

  const filtered = useMemo(
    () => (nq ? items.filter((it) => norm(it.text).includes(nq)) : items),
    [items, nq]
  );

  return (
    <div>
      {items.length >= minToSearch && (
        <div className="relative mb-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="input pr-8"
            aria-label={placeholder}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)]"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {items.length === 0
        ? empty
        : filtered.length === 0
          ? (
            <p className="text-sm text-[var(--muted)] py-2">
              Sin resultados para “{q}”.
            </p>
          )
          : (
            <div className="space-y-3 pr-1" style={{ maxHeight, overflowY: "auto" }}>
              {filtered.map((it) => (
                <div key={it.key}>{it.node}</div>
              ))}
            </div>
          )}
    </div>
  );
}
