"use client";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { fmtMoney } from "@/lib/format";

export const C = {
  ink: "#0F1A2E", navy: "#1E3A5F", gold: "#C9A961", goldDark: "#A88947", copper: "#B87333",
  forest: "#3E7D5A", oxblood: "#A6383D", muted: "#7A736A", line: "#E6DFCE", terracotta: "#C77847",
};
export const PIE = [C.navy, C.gold, C.forest, C.copper, C.oxblood, "#6B7FA3", "#8C6D46", "#4F8A8B"];

const kfmt = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)));

function Tip({ active, payload, label, rows }: { active?: boolean; payload?: { value: number; dataKey: string; color?: string; payload: Record<string, number> }[]; label?: string; rows: { key: string; label: string; color: string }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white border border-line rounded-md px-3 py-2 text-[13px] font-semibold shadow-lg">
      <div className="text-ink mb-1">{label}</div>
      {rows.filter((r) => p[r.key] != null).map((r) => (
        <div key={r.key} style={{ color: r.color }}>{r.label}: {fmtMoney(p[r.key], "USD", 0)}</div>
      ))}
      {p.count != null && <div className="text-muted text-[11px] font-normal mt-0.5">{p.count} kayıt</div>}
    </div>
  );
}

// Aylık tahsilat — alan grafiği (eski panelle aynı stil)
export function CollectionsArea({ data, height = 280 }: { data: { label: string; value: number; count: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.forest} stopOpacity={0.5} />
            <stop offset="100%" stopColor={C.forest} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="revStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={C.forest} />
            <stop offset="100%" stopColor={C.gold} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 6" stroke={C.line} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: C.ink, fontWeight: 600 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: C.muted }} tickFormatter={kfmt} axisLine={false} tickLine={false} width={44} />
        <Tooltip content={<Tip rows={[{ key: "value", label: "Tahsilat", color: C.forest }]} />} cursor={{ stroke: C.gold, strokeDasharray: "3 3" }} />
        <Area isAnimationActive={false} type="monotone" dataKey="value" stroke="url(#revStroke)" strokeWidth={3} fill="url(#revGrad)"
          dot={{ r: 4, fill: C.forest, strokeWidth: 2, stroke: "white" }} activeDot={{ r: 6, fill: C.forest, strokeWidth: 2, stroke: "white" }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Sipariş hacmi (çubuk) + tahsilat (çizgi) — aylık
export function OrdersVsCollections({ data, height = 280 }: { data: { label: string; orders: number; collected: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 6" stroke={C.line} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: C.ink, fontWeight: 600 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: C.muted }} tickFormatter={kfmt} axisLine={false} tickLine={false} width={44} />
        <Tooltip content={<Tip rows={[{ key: "orders", label: "Sipariş", color: C.navy }, { key: "collected", label: "Tahsilat", color: C.forest }]} />} cursor={{ fill: C.gold + "18" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconSize={10} />
        <Bar isAnimationActive={false} dataKey="orders" name="Sipariş" fill={C.navy} radius={[4, 4, 0, 0]} maxBarSize={34} />
        <Line isAnimationActive={false} type="monotone" dataKey="collected" name="Tahsilat" stroke={C.forest} strokeWidth={3} dot={{ r: 3, fill: C.forest, stroke: "white", strokeWidth: 2 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Beklenen tahsilat — gecikmiş + aylar
export function CashflowBars({ data, height = 260 }: { data: { label: string; value: number; overdue?: boolean; count: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 6" stroke={C.line} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: C.ink, fontWeight: 600 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: C.muted }} tickFormatter={kfmt} axisLine={false} tickLine={false} width={44} />
        <Tooltip content={<Tip rows={[{ key: "value", label: "Beklenen", color: C.navy }]} />} cursor={{ fill: C.gold + "18" }} />
        <Bar isAnimationActive={false} dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={44}>
          {data.map((d, i) => <Cell key={i} fill={d.overdue ? C.oxblood : i === 1 ? C.gold : C.navy} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, height = 260 }: { data: { name: string; value: number }[]; height?: number }) {
  if (!data.length) return <div className="flex items-center justify-center text-xs text-muted" style={{ height }}>Henüz veri yok</div>;
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie isAnimationActive={false} data={data} dataKey="value" nameKey="name" outerRadius={82} innerRadius={52} paddingAngle={2} stroke="white">
          {data.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
        </Pie>
        <Tooltip formatter={(v: number) => [`${fmtMoney(v, "USD", 0)} · %${total ? Math.round((v / total) * 100) : 0}`, ""]} contentStyle={{ fontSize: 12, borderRadius: 6, border: `1px solid ${C.line}` }} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconSize={9} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Yatay oran çubuğu (tahsil edilen / toplam)
export function ProgressBar({ value, total, color = C.forest }: { value: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-cream overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
