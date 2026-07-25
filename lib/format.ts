const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** Formatea un valor como pesos colombianos: $1.234.567 */
export function fmt(n: number | null | undefined): string {
  return cop.format(Math.round(n ?? 0));
}

/** Formatea porcentaje: 12.5% */
export function pct(n: number | null | undefined, decimals = 1): string {
  return `${(n ?? 0).toFixed(decimals)}%`;
}

/** Convierte meses a texto legible: "1 año 3 meses" */
export function monthsToText(m: number): string {
  if (m <= 0) return "—";
  const years = Math.floor(m / 12);
  const months = m % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} año${years > 1 ? "s" : ""}`);
  if (months) parts.push(`${months} mes${months > 1 ? "es" : ""}`);
  return parts.join(" ") || "0 meses";
}
