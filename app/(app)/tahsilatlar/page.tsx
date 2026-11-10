"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Pencil, Trash2, CheckCircle2, Clock, AlertTriangle, Coins } from "lucide-react";
import { Button, Card, Empty, ErrorBox, Input, Loading, Page, PageHeader, Select, Stat, Table, Tabs, Td, Th } from "@/components/ui";
import { CollectionsArea } from "@/components/charts";
import { PlanStatusBadge, planTypeLabel } from "@/components/badges";
import { CollectionModal } from "@/components/CollectionModal";
import { useAuth, useToast } from "@/components/providers";
import { useData } from "@/lib/hooks";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import { PAYMENT_METHODS, labelOf } from "@/lib/constants";
import { addDays, errMsg, fmtDate, fmtMoney, todayTR } from "@/lib/format";
import type { Collection } from "@/lib/types";

export default function CollectionsPage() {
  const { canEdit } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<"received" | "open">("received");
  const today = todayTR();
  const [from, setFrom] = useState(today.slice(0, 4) + "-01-01");
  const [to, setTo] = useState(today);
  const [search, setSearch] = useState("");
  const [bank, setBank] = useState("");
  const [openFilter, setOpenFilter] = useState<"overdue" | "30" | "all">("all");
  const [edit, setEdit] = useState<Partial<Collection> | null>(null);

  // Panelden gelen bağlantılar: ?sekme=bekleyen&filtre=gecikmis
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("sekme") === "bekleyen") setTab("open");
    if (sp.get("filtre") === "gecikmis") setOpenFilter("overdue");
  }, []);

  const { data, error, loading, reload } = useData(async () => {
    const [cols, open, banks, orders] = await Promise.all([
      db.collections({ from, to }), db.openPlan(), db.banks(), db.orderSummaries(),
    ]);
    return { cols, open, banks, orders };
  }, [from, to]);

  const orderById = useMemo(() => new Map((data?.orders || []).map((o) => [o.order_id, o])), [data]);
  const s = search.trim().toLocaleLowerCase("tr");

  const cols = useMemo(() => (data?.cols || []).filter((c) =>
    (!bank || c.bank_account_id === bank) &&
    (!s || [c.order_number, c.customer_name, c.reference].some((v) => (v || "").toLocaleLowerCase("tr").includes(s)))
  ), [data, bank, s]);

  const open = useMemo(() => (data?.open || []).filter((p) => {
    if (p.order_status === "cancelled") return false;
    if (openFilter === "overdue" && p.status !== "overdue") return false;
    if (openFilter === "30" && !(p.due_date && p.due_date <= addDays(today, 30))) return false;
    const o = orderById.get(p.order_id);
    return !s || [p.order_number, o?.customer_name].some((v) => (v || "").toLocaleLowerCase("tr").includes(s));
  }), [data, openFilter, s, orderById, today]);

  const sumBy = <T,>(rows: T[], cur: (r: T) => string, val: (r: T) => number) => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(cur(r), (m.get(cur(r)) || 0) + val(r)));
    return [...m.entries()].sort();
  };
  const colTotals = sumBy(cols, (c) => c.order_currency.trim(), (c) => Number(c.amount));
  const colUsd = cols.reduce((a, c) => a + Number(c.amount_usd), 0);
  const openTotals = sumBy(open, (p) => p.currency.trim(), (p) => Number(p.remaining));
  const openUsd = open.reduce((a, p) => a + Number(p.remaining_usd), 0);
  const overdueUsd = open.filter((p) => p.status === "overdue").reduce((a, p) => a + Number(p.remaining_usd), 0);

  const monthly = useMemo(() => {
    const m = new Map<string, { value: number; count: number }>();
    cols.forEach((c) => {
      const k = c.received_date.slice(0, 7);
      const x = m.get(k) || { value: 0, count: 0 };
      x.value += Number(c.amount_usd); x.count += 1;
      m.set(k, x);
    });
    const AY = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
    return [...m.entries()].sort().map(([k, v]) => ({ label: `${AY[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`, value: Math.round(v.value), count: v.count }));
  }, [cols]);

  const remove = async (c: Collection) => {
    if (!confirm(`${fmtDate(c.received_date)} tarihli tahsilat silinsin mi?`)) return;
    const { error } = await supabase().from("collections").delete().eq("id", c.id);
    if (error) return toast(errMsg(error), "error");
    toast("Tahsilat silindi", "success");
    reload();
  };

  return (
    <>
      <PageHeader title="Tahsilatlar" subtitle="Gelen paralar ve bekleyen alacaklar">
        {canEdit && <Button icon={Plus} onClick={() => setEdit({})}>Tahsilat ekle</Button>}
      </PageHeader>
      <Page>
        <Tabs value={tab} onChange={setTab} items={[{ key: "received", label: "Gelen tahsilatlar" }, { key: "open", label: "Bekleyen alacaklar" }]} />

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-3 text-muted" />
            <Input className="pl-9" placeholder="Sipariş, müşteri, referans…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {tab === "received" ? (
            <>
              <Input type="date" className="w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
              <span className="text-muted">—</span>
              <Input type="date" className="w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
              <Select className="w-auto" value={bank} onChange={(e) => setBank(e.target.value)}>
                <option value="">Tüm hesaplar</option>
                {(data?.banks || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </>
          ) : (
            <Select className="w-auto" value={openFilter} onChange={(e) => setOpenFilter(e.target.value as typeof openFilter)}>
              <option value="all">Tüm açık alacaklar</option>
              <option value="overdue">Sadece gecikmiş</option>
              <option value="30">Önümüzdeki 30 gün (gecikmiş dahil)</option>
            </Select>
          )}
        </div>

        {error && <ErrorBox error={error} onRetry={reload} />}
        {loading ? <Loading /> : tab === "received" ? (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <Stat icon={CheckCircle2} accent="forest" label="Toplam (USD karşılığı)" value={fmtMoney(colUsd, "USD")} sub={`${cols.length} tahsilat · tahsilat günündeki kurla`} />
              {colTotals.map(([c, v]) => <Stat key={c} icon={Coins} accent="navy" label={`Toplam ${c}`} value={fmtMoney(v, c)} />)}
            </div>
            {monthly.length > 1 && (
              <Card title="Aylık tahsilat" subtitle="Seçili aralık · USD karşılığı">
                <CollectionsArea data={monthly} height={240} />
              </Card>
            )}
            <Card padded={false}>
              {cols.length === 0 ? <Empty title="Bu aralıkta tahsilat yok" /> : (
                <Table>
                  <thead><tr><Th>Tarih</Th><Th>Müşteri</Th><Th>Sipariş</Th><Th className="text-right">Tutar</Th><Th className="text-right">USD</Th><Th>Banka</Th><Th>Yöntem</Th><Th>Referans</Th>{canEdit && <Th />}</tr></thead>
                  <tbody>
                    {cols.map((c) => (
                      <tr key={c.id} className="hover:bg-cream/50">
                        <Td className="whitespace-nowrap">{fmtDate(c.received_date)}</Td>
                        <Td><Link className="hover:underline" href={`/musteriler/${c.customer_id}`}>{c.customer_name}</Link></Td>
                        <Td className="whitespace-nowrap"><Link className="text-navy font-semibold hover:underline" href={`/siparisler/${c.order_id}`}>{c.order_number}</Link></Td>
                        <Td className="text-right tabular-nums whitespace-nowrap font-semibold">
                          {fmtMoney(c.amount, c.order_currency)}
                          {c.received_currency && c.received_currency.trim() !== c.order_currency.trim() && <div className="text-[11px] text-muted">({fmtMoney(c.received_amount, c.received_currency)})</div>}
                        </Td>
                        <Td className="text-right tabular-nums whitespace-nowrap text-muted">{fmtMoney(c.amount_usd, "USD")}</Td>
                        <Td>{c.bank_account_name || "—"}</Td>
                        <Td className="text-xs">{labelOf(PAYMENT_METHODS, c.method)}</Td>
                        <Td className="text-xs">{c.reference}</Td>
                        {canEdit && (
                          <Td className="whitespace-nowrap">
                            <button className="p-1 text-muted hover:text-navy" onClick={() => setEdit(c)}><Pencil size={14} /></button>
                            <button className="p-1 text-muted hover:text-oxblood" onClick={() => remove(c)}><Trash2 size={14} /></button>
                          </Td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <Stat icon={Clock} accent="gold" label="Açık alacak (USD)" value={fmtMoney(openUsd, "USD")} sub={`${open.length} kalem · bugünkü kurla`} />
              <Stat icon={AlertTriangle} accent="oxblood" label="Gecikmiş (USD)" value={fmtMoney(overdueUsd, "USD")} tone={overdueUsd > 0 ? "danger" : undefined} />
              {openTotals.map(([c, v]) => <Stat key={c} icon={Coins} accent="navy" label={`Açık ${c}`} value={fmtMoney(v, c)} />)}
            </div>
            <Card padded={false}>
              {open.length === 0 ? <Empty title="Açık alacak yok" /> : (
                <Table>
                  <thead><tr><Th>Vade</Th><Th>Müşteri</Th><Th>Sipariş</Th><Th>Tip</Th><Th className="text-right">Plan</Th><Th className="text-right">Tahsil</Th><Th className="text-right">Kalan</Th><Th>Durum</Th>{canEdit && <Th />}</tr></thead>
                  <tbody>
                    {open.map((p) => {
                      const o = orderById.get(p.order_id);
                      return (
                        <tr key={p.plan_item_id} className="hover:bg-cream/50">
                          <Td className="whitespace-nowrap">{fmtDate(p.due_date)}</Td>
                          <Td>{o ? <Link className="hover:underline" href={`/musteriler/${o.customer_id}`}>{o.customer_name}</Link> : "—"}</Td>
                          <Td className="whitespace-nowrap"><Link className="text-navy font-semibold hover:underline" href={`/siparisler/${p.order_id}`}>{p.order_number}</Link>{p.shipment_no ? <span className="text-muted text-xs"> · S{p.shipment_no}</span> : null}</Td>
                          <Td>{planTypeLabel(p.type)}</Td>
                          <Td className="text-right tabular-nums">{fmtMoney(p.amount, p.currency)}</Td>
                          <Td className="text-right tabular-nums text-forest">{Number(p.paid) ? fmtMoney(p.paid, p.currency) : ""}</Td>
                          <Td className="text-right tabular-nums font-semibold">{fmtMoney(p.remaining, p.currency)}</Td>
                          <Td><PlanStatusBadge status={p.status} days={p.days_overdue} /></Td>
                          {canEdit && <Td><Button size="sm" variant="secondary" onClick={() => setEdit({ order_id: p.order_id, amount: Number(p.remaining), plan_item_id: null })}>Tahsil et</Button></Td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </Card>
          </>
        )}
      </Page>
      {edit && data && (
        <CollectionModal initial={edit} orders={data.orders} banks={data.banks}
          onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />
      )}
    </>
  );
}
