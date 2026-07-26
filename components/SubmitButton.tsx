"use client";

/**
 * Botón de envío que, tras guardar/actualizar, colapsa el `<details>`
 * contenedor (comprime el formulario ya modificado). Si el formulario es
 * inválido, deja que el navegador muestre la validación y no colapsa.
 */
export function SubmitButton({
  children,
  className = "btn btn-primary btn-sm",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        const form = e.currentTarget.form;
        if (form && !form.checkValidity()) return; // el navegador mostrará el error
        const details = e.currentTarget.closest("details");
        if (details) setTimeout(() => details.removeAttribute("open"), 0);
      }}
    >
      {children}
    </button>
  );
}
