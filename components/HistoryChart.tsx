"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

type Point = {
  month: string;
  recibido: number;
  pagado: number;
  disponible: number;
};

export function HistoryChart({ data }: { data: Point[] }) {
  const fmtShort = (n: number) =>
    Math.abs(n) >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : `${Math.round(n / 1000)}k`;

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 12 }} />
          <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} tickFormatter={fmtShort} width={44} />
          <Tooltip
            formatter={(v) => new Intl.NumberFormat("es-CO").format(Math.round(Number(v)))}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text)",
            }}
          />
          <Legend />
          <Bar dataKey="recibido" name="Recibido" fill="#059669" radius={[3, 3, 0, 0]} />
          <Bar dataKey="pagado" name="Pagado" fill="#d97706" radius={[3, 3, 0, 0]} />
          <Bar dataKey="disponible" name="Disponible" fill="#4f46e5" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
