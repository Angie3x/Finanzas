"use client";

/**
 * Cierra el `<details>` contenedor más cercano (colapsa un formulario
 * desplegable) sin enviar nada. Útil para cancelar edición/creación.
 */
export function CancelButton({
  label = "Cancelar",
  className = "btn btn-ghost",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={(e) => {
        e.currentTarget.closest("details")?.removeAttribute("open");
      }}
    >
      {label}
    </button>
  );
}
