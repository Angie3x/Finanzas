"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

type Point = { month: number; avalancha: number; bola: number };

export function PlanChart({ data }: { data: Point[] }) {
  const fmtShort = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}k`;

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="month"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            label={{ value: "Meses", position: "insideBottom", offset: -2, fill: "var(--muted)", fontSize: 11 }}
          />
          <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} tickFormatter={fmtShort} width={44} />
          <Tooltip
            formatter={(v) => new Intl.NumberFormat("es-CO").format(Math.round(Number(v)))}
            labelFormatter={(m) => `Mes ${m}`}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text)",
            }}
          />
          <Legend />
          <Line type="monotone" dataKey="avalancha" name="Avalancha" stroke="#4f46e5" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="bola" name="Bola de nieve" stroke="#059669" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
