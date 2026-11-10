"use client";
import { useEffect, useMemo } from "react";
import Link from "next/link";
import { Plus, DollarSign, CheckCircle2, Clock, AlertTriangle, ArrowRight, ChevronRight, Truck } from "lucide-react";
import { Button, Card, Empty, ErrorBox, Loading, Page, PageHeader, Stat } from "@/components/ui";
import { OrderStatusBadge, planTypeLabel } from "@/components/badges";
import { CashflowBars, Donut, OrdersVsCollections, ProgressBar } from "@/components/charts";
import { useAuth } from "@/components/providers";
import { useData, q } from "@/lib/hooks";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import { updateRatesFromTCMB } from "@/lib/rates";
import { addDays, addMonths, daysBetween, fmtDate, fmtMoney, todayTR } from "@/lib/format";

const AY = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const mLabel = (k: string) => `${AY[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`;

export default function Dashboard() {
  const { canEdit } = useAuth();
  const today = todayTR();
  const from12 = addMonths(today.slice(0, 7) + "-01", -11);

  const { data, error, loading, reload } = useData(async () => {
    const [orders, open, cols, ships, lastRate] = await Promise.all([
      db.orderSummaries(),
      db.openPlan(),
      db.collections({ from: from12, to: today }),
      db.shipmentTotals(),
      q<{ rate_date: string }[]>(supabase().from("exchange_rates").select("rate_date").order("rate_date", { ascending: false }).limit(1)),
    ]);
    const allCollectedUsd = orders.reduce((a, o) => a + Number(o.collected_usd), 0);
    return { orders, open, cols, ships, allCollectedUsd, lastRateDate: lastRate[0]?.rate_date || null };
  });

  // Günde bir kez TCMB kurlarını otomatik güncelle (editör/admin açınca)
  useEffect(() => {
    if (!canEdit || !data || (data.lastRateDate && data.lastRateDate >= today)) return;
    let key = "";
    try { key = sessionStorage.getItem("tcmb_try") || ""; } catch {}
    if (key === today) return;
    try { sessionStorage.setItem("tcmb_try", today); } catch {}
    updateRatesFromTCMB().then(() => reload()).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, data?.lastRateDate]);

  const k = useMemo(() => {
    if (!data) return null;
    const active = data.orders.filter((o) => o.status !== "cancelled");
    const open = data.open.filter((p) => p.order_status !== "cancelled");
    const overdue = open.filter((p) => p.status === "overdue");
    const pending = open.filter((p) => p.status !== "overdue");
    const custById = new Map(data.orders.map((o) => [o.order_id, o]));

    // Son 12 ay: sipariş (sipariş tarihine göre, USD) ve tahsilat (tahsilat günü kuruyla USD)
    const months: string[] = [];
    for (let i = 0; i < 12; i++) months.push(addMonths(from12, i).slice(0, 7));
    const monthly = months.map((m) => ({
      label: mLabel(m),
      orders: Math.round(active.filter((o) => o.order_date.slice(0, 7) === m).reduce((a, o) => a + Number(o.total_usd), 0)),
      collected: Math.round(data.cols.filter((c) => c.received_date.slice(0, 7) === m).reduce((a, c) => a + Number(c.amount_usd), 0)),
    }));

    // Beklenen tahsilat: gecikmiş + önümüzdeki 6 ay (vadeye göre)
    const next = [0, 1, 2, 3, 4, 5].map((i) => addMonths(today.slice(0, 7) + "-01", i).slice(0, 7));
    const cash = [
      { label: "Gecikmiş", value: Math.round(overdue.reduce((a, p) => a + Number(p.remaining_usd), 0)), overdue: true, count: overdue.length },
      ...next.map((m) => {
        const rows = pending.filter((p) => (p.due_date || "").slice(0, 7) === m);
        return { label: mLabel(m), value: Math.round(rows.reduce((a, p) => a + Number(p.remaining_usd), 0)), count: rows.length };
      }),
    ];

    // Döviz dağılımı (sipariş hacmi, USD karşılığı)
    const byCur = new Map<string, number>();
    active.forEach((o) => byCur.set(o.currency.trim(), (byCur.get(o.currency.trim()) || 0) + Number(o.total_usd)));
    const currency = [...byCur.entries()].map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);

    // En değerli müşteriler
    const cust = new Map<string, { id: string; name: string; country: string | null; total: number; count: number; collected: number }>();
    active.forEach((o) => {
      const c = cust.get(o.customer_id) || { id: o.customer_id, name: o.customer_name, country: o.customer_country, total: 0, count: 0, collected: 0 };
      c.total += Number(o.total_usd); c.count += 1; c.collected += Number(o.collected_usd);
      cust.set(o.customer_id, c);
    });
    const top = [...cust.values()].sort((a, b) => b.total - a.total).slice(0, 6);

    const upcoming = open
      .filter((p) => p.due_date && p.due_date <= addDays(today, 30))
      .map((p) => ({ ...p, daysLeft: daysBetween(today, p.due_date!), o: custById.get(p.order_id) }))
      .slice(0, 8);

    return {
      totalUsd: active.reduce((a, o) => a + Number(o.total_usd), 0),
      orderCount: active.length,
      overdue, pending,
      overdueUsd: overdue.reduce((a, p) => a + Number(p.remaining_usd), 0),
      pendingUsd: pending.reduce((a, p) => a + Number(p.remaining_usd), 0),
      monthly, cash, currency, top, upcoming,
      upcomingShips: data.ships.filter((s) => s.status !== "cancelled" && !s.actual_date && s.planned_date && s.planned_date <= addDays(today, 30)).slice(0, 8),
      custById,
    };
  }, [data, today, from12]);

  return (
    <>
      <PageHeader
        title="Gösterge Paneli"
        subtitle={data ? `${new Set(data.orders.map((o) => o.customer_id)).size} müşteri · ${data.orders.length} sipariş · ${fmtDate(today)}` : fmtDate(today)}
      >
        {canEdit && <Link href="/siparisler/yeni"><Button icon={Plus}>Yeni sipariş</Button></Link>}
      </PageHeader>
      <Page>
        {error && <ErrorBox error={error} onRetry={reload} />}
        {loading || !k || !data ? <Loading /> : (
          <>
            {k.overdueUsd > 0 && (
              <div className="rounded-lg p-4 flex flex-wrap items-center gap-3 bg-[#A6383D10] border border-[#A6383D40]">
                <AlertTriangle size={18} className="text-oxblood" />
                <div className="flex-1 text-sm text-oxblood">
                  <strong>{fmtMoney(k.overdueUsd, "USD", 0)}</strong> tutarında <strong>{k.overdue.length}</strong> gecikmiş tahsilat var. Acil takip gerekli.
                </div>
                <Link href="/tahsilatlar?sekme=bekleyen&filtre=gecikmis"><Button variant="ghost" size="sm">İncele <ArrowRight size={12} /></Button></Link>
              </div>
            )}

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <Stat icon={DollarSign} accent="navy" label="Toplam sipariş hacmi" value={fmtMoney(k.totalUsd, "USD", 0)} sub={`${k.orderCount} sipariş · iptaller hariç`} href="/siparisler" />
              <Stat icon={CheckCircle2} accent="forest" label="Tahsil edilen" value={fmtMoney(data.allCollectedUsd, "USD", 0)} sub="Tahsilat günündeki kurla" href="/tahsilatlar" />
              <Stat icon={Clock} accent="gold" label="Bekleyen tahsilat" value={fmtMoney(k.pendingUsd, "USD", 0)} sub={`${k.pending.length} plan kalemi`} href="/tahsilatlar?sekme=bekleyen" />
              <Stat icon={AlertTriangle} accent="oxblood" label="Gecikmiş tahsilat" value={fmtMoney(k.overdueUsd, "USD", 0)} sub={`${k.overdue.length} plan kalemi`} tone={k.overdueUsd > 0 ? "danger" : undefined} href="/tahsilatlar?sekme=bekleyen&filtre=gecikmis" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Card title="Sipariş ve tahsilat" subtitle="Son 12 ay · USD karşılığı" className="xl:col-span-2">
                <OrdersVsCollections data={k.monthly} />
              </Card>
              <Card title="Döviz dağılımı" subtitle="Sipariş hacmi · USD karşılığı">
                <Donut data={k.currency} height={280} />
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Card title="Beklenen tahsilat" subtitle="Vadeye göre · gecikmiş + önümüzdeki 6 ay · bugünkü kurla USD" className="xl:col-span-2"
                action={<Link href="/tahsilatlar?sekme=bekleyen" className="text-xs font-semibold text-navy hover:underline inline-flex items-center gap-1">Bekleyen alacaklar <ChevronRight size={12} /></Link>}>
                <CashflowBars data={k.cash} height={380} />
              </Card>
              <Card title="En değerli müşteriler" subtitle="Sipariş hacmine göre · USD" padded={false}
                action={<Link href="/musteriler" className="text-xs font-semibold text-navy hover:underline inline-flex items-center gap-1">Tümü <ChevronRight size={12} /></Link>}>
                {k.top.length === 0 ? <Empty title="Henüz veri yok" /> : (
                  <div>
                    {k.top.map((c, i) => (
                      <Link key={c.id} href={`/musteriler/${c.id}`} className="px-5 py-3 flex items-center gap-3 border-b border-line last:border-0 hover:bg-cream/50">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${i === 0 ? "bg-gold text-ink" : "bg-cream text-muted"}`}>{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-ink truncate">{c.name}</div>
                          <div className="text-[11px] text-muted mb-1">{c.country ? `${c.country} · ` : ""}{c.count} sipariş · %{c.total ? Math.round((c.collected / c.total) * 100) : 0} tahsil</div>
                          <ProgressBar value={c.collected} total={c.total} />
                        </div>
                        <div className="text-sm font-bold tabular-nums text-ink">{fmtMoney(c.total, "USD", 0)}</div>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card title="Yaklaşan tahsilatlar" subtitle="Gecikmişler ve önümüzdeki 30 gün" padded={false}
                action={<Link href="/tahsilatlar?sekme=bekleyen" className="text-xs font-semibold text-navy hover:underline inline-flex items-center gap-1">Tümü <ChevronRight size={12} /></Link>}>
                {k.upcoming.length === 0 ? <Empty title="30 gün içinde vadesi gelen tahsilat yok" /> : (
                  <div>
                    {k.upcoming.map((p) => {
                      const color = p.daysLeft < 0 ? "text-oxblood" : p.daysLeft <= 7 ? "text-copper" : "text-muted";
                      return (
                        <Link key={p.plan_item_id} href={`/siparisler/${p.order_id}`} className="px-5 py-3 flex items-center gap-3 border-b border-line last:border-0 hover:bg-cream/50">
                          <div className="text-center shrink-0 w-12">
                            <div className={`text-base font-bold leading-tight ${color}`}>{p.daysLeft < 0 ? `-${Math.abs(p.daysLeft)}` : p.daysLeft}</div>
                            <div className="text-[9px] uppercase tracking-wider text-muted">{p.daysLeft < 0 ? "geçti" : p.daysLeft === 0 ? "bugün" : "gün"}</div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-ink truncate">{p.o?.customer_name || "—"}</div>
                            <div className="text-[11px] text-muted"><span className="font-mono">{p.order_number}</span> · {planTypeLabel(p.type)} · {fmtDate(p.due_date)}</div>
                          </div>
                          <div className="text-sm font-bold tabular-nums text-ink">{fmtMoney(p.remaining, p.currency)}</div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card title="Yaklaşan sevkiyatlar" subtitle="Planlanan tarihi geçmiş veya 30 gün içinde" padded={false}
                action={<Link href="/siparisler" className="text-xs font-semibold text-navy hover:underline inline-flex items-center gap-1">Siparişler <ChevronRight size={12} /></Link>}>
                {k.upcomingShips.length === 0 ? <Empty title="30 gün içinde planlı sevkiyat yok" /> : (
                  <div>
                    {k.upcomingShips.map((s) => {
                      const d = daysBetween(today, s.planned_date!);
                      return (
                        <Link key={s.shipment_id} href={`/siparisler/${s.order_id}`} className="px-5 py-3 flex items-center gap-3 border-b border-line last:border-0 hover:bg-cream/50">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${d < 0 ? "bg-[#A6383D18] text-oxblood" : "bg-[#1E3A5F12] text-navy"}`}><Truck size={16} /></div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-ink truncate">{k.custById.get(s.order_id)?.customer_name}</div>
                            <div className="text-[11px] text-muted"><span className="font-mono">{s.order_number}</span> · {s.name || `${s.shipment_no}. sevkiyat`} · <span className={d < 0 ? "text-oxblood font-semibold" : ""}>{fmtDate(s.planned_date)}{d < 0 ? ` (${-d} gün geçti)` : ""}</span></div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold tabular-nums text-ink">{fmtMoney(s.total, s.currency)}</div>
                            <OrderStatusBadge status={s.status} />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </Page>
    </>
  );
}
