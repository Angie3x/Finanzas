"use client";

export function DeleteButton({
  action,
  id,
  message = "¿Eliminar este registro? Esta acción no se puede deshacer.",
  label = "Eliminar",
}: {
  action: (formData: FormData) => void;
  id: number;
  message?: string;
  label?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn btn-danger btn-sm">
        {label}
      </button>
    </form>
  );
}
