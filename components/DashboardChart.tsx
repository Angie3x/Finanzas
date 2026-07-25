"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

type Slice = { name: string; value: number; color: string };

export function DashboardChart({ data }: { data: Slice[] }) {
  const clean = data.filter((d) => d.value > 0);
  if (clean.length === 0)
    return <div className="text-sm text-[var(--muted)]">Sin datos para graficar.</div>;

  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={clean}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            outerRadius={95}
            paddingAngle={2}
          >
            {clean.map((d) => (
              <Cell key={d.name} fill={d.color} stroke="var(--surface)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) =>
              new Intl.NumberFormat("es-CO", {
                style: "currency",
                currency: "COP",
                maximumFractionDigits: 0,
              }).format(Math.round(Number(v)))
            }
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text)",
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
