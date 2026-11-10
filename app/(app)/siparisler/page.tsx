"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, DollarSign, CheckCircle2, Wallet, AlertTriangle } from "lucide-react";
import { Button, Card, Empty, ErrorBox, Input, Loading, Page, PageHeader, Select, Stat, Table, Td, Th } from "@/components/ui";
import { ProgressBar } from "@/components/charts";
import { OrderStatusBadge } from "@/components/badges";
import { useAuth } from "@/components/providers";
import { useData } from "@/lib/hooks";
import { db } from "@/lib/db";
import { ORDER_STATUSES } from "@/lib/constants";
import { fmtDate, fmtMonth, fmtMoney, monthKey } from "@/lib/format";
import type { OrderSummary } from "@/lib/types";

type SortKey = "order_date" | "order_number" | "customer_name" | "first_shipment_date" | "total_usd" | "balance" | "next_due_date";

export default function OrdersPage() {
  const { canEdit } = useAuth();
  const { data, error, loading, reload } = useData(() => db.orderSummaries());
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [month, setMonth] = useState("");
  const [dateBasis, setDateBasis] = useState<"order" | "shipment">("shipment");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "order_date", dir: -1 });

  const dateOf = (o: OrderSummary) => (dateBasis === "order" ? o.order_date : o.first_shipment_date);

  const months = useMemo(() => {
    const set = new Set<string>();
    (data || []).forEach((o) => { const k = monthKey(dateOf(o)); if (k) set.add(k); });
    return [...set].sort().reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, dateBasis]);

  const rows = useMemo(() => {
    const s = search.trim().toLocaleLowerCase("tr");
    const list = (data || []).filter((o) => {
      if (status === "active" && o.status === "cancelled") return false;
      if (status !== "active" && status !== "all" && o.status !== status) return false;
      if (month && monthKey(dateOf(o)) !== month) return false;
      if (onlyOpen && !(Number(o.balance) > 0.005)) return false;
      if (s && ![o.order_number, o.customer_name, o.customer_code].some((v) => (v || "").toLocaleLowerCase("tr").includes(s))) return false;
      return true;
    });
    const k = sort.key;
    return [...list].sort((a, b) => {
      const va = a[k] ?? "", vb = b[k] ?? "";
      if (typeof va === "number" || typeof vb === "number") return (Number(va) - Number(vb)) * sort.dir;
      return String(va).localeCompare(String(vb), "tr") * sort.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, search, status, month, onlyOpen, sort, dateBasis]);

  const totalsByCur = useMemo(() => {
    const m = new Map<string, { total: number; collected: number; balance: number; overdue: number }>();
    rows.forEach((o) => {
      if (o.status === "cancelled") return;
      const t = m.get(o.currency) || { total: 0, collected: 0, balance: 0, overdue: 0 };
      t.total += Number(o.total); t.collected += Number(o.collected); t.balance += Number(o.balance); t.overdue += Number(o.overdue_amount);
      m.set(o.currency, t);
    });
    return [...m.entries()];
  }, [rows]);

  const usd = useMemo(() => {
    const act = rows.filter((o) => o.status !== "cancelled");
    return {
      total: act.reduce((a, o) => a + Number(o.total_usd), 0),
      collected: act.reduce((a, o) => a + Number(o.collected_usd), 0),
      open: act.reduce((a, o) => a + Number(o.open_usd), 0),
      overdue: act.reduce((a, o) => a + Number(o.overdue_usd), 0),
      count: act.length,
    };
  }, [rows]);

  const SortTh = ({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <Th className={`cursor-pointer select-none ${right ? "text-right" : ""}`} onClick={() => setSort((x) => ({ key: k, dir: x.key === k ? (x.dir === 1 ? -1 : 1) : -1 }))}>
      {children}{sort.key === k ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
    </Th>
  );

  return (
    <>
      <PageHeader title="Siparişler" subtitle={data ? `${rows.length} / ${data.length} sipariş` : undefined}>
        {canEdit && <Link href="/siparisler/yeni"><Button icon={Plus}>Yeni sipariş</Button></Link>}
      </PageHeader>
      <Page>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-3 text-muted" />
            <Input className="pl-9" placeholder="Sipariş no, müşteri…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Tüm durumlar (iptal hariç)</option>
            <option value="all">Tümü (iptal dahil)</option>
            {ORDER_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </Select>
          <Select className="w-auto" value={dateBasis} onChange={(e) => { setDateBasis(e.target.value as "order" | "shipment"); setMonth(""); }}>
            <option value="shipment">Ay: sevk tarihine göre</option>
            <option value="order">Ay: sipariş tarihine göre</option>
          </Select>
          <Select className="w-auto" value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">Tüm aylar</option>
            {months.map((m) => <option key={m} value={m}>{fmtMonth(m)}</option>)}
          </Select>
          <label className="flex items-center gap-2 text-sm px-2"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> Sadece bakiyesi olanlar</label>
        </div>

        {error && <ErrorBox error={error} onRetry={reload} />}
        {!loading && (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <Stat icon={DollarSign} accent="navy" label="Sipariş hacmi" value={fmtMoney(usd.total, "USD", 0)} sub={`${usd.count} sipariş · filtreye göre`} />
            <Stat icon={CheckCircle2} accent="forest" label="Tahsil edilen" value={fmtMoney(usd.collected, "USD", 0)} sub={usd.total ? `%${Math.round((usd.collected / usd.total) * 100)} tahsil` : undefined} />
            <Stat icon={Wallet} accent="gold" label="Açık alacak" value={fmtMoney(usd.open, "USD", 0)} sub="Bugünkü kurla" />
            <Stat icon={AlertTriangle} accent="oxblood" label="Gecikmiş" value={fmtMoney(usd.overdue, "USD", 0)} tone={usd.overdue > 0 ? "danger" : undefined} />
          </div>
        )}
        <Card padded={false}>
          {loading ? <Loading /> : rows.length === 0 ? <Empty title="Sipariş yok" hint="Filtreleri değiştir veya yeni sipariş ekle." /> : (
            <Table>
              <thead>
                <tr>
                  <SortTh k="order_number">No</SortTh>
                  <SortTh k="customer_name">Müşteri</SortTh>
                  <SortTh k="order_date">Tarih</SortTh>
                  <SortTh k="first_shipment_date">Sevk</SortTh>
                  <Th>Durum</Th>
                  <SortTh k="total_usd" right>Toplam</SortTh>
                  <Th className="text-right">Tahsil</Th>
                  <SortTh k="balance" right>Bakiye</SortTh>
                  <SortTh k="next_due_date">Sonraki vade</SortTh>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.order_id} className={`hover:bg-cream/50 ${o.status === "cancelled" ? "opacity-50" : ""}`}>
                    <Td className="whitespace-nowrap"><Link href={`/siparisler/${o.order_id}`} className="font-semibold text-navy hover:underline">{o.order_number}</Link></Td>
                    <Td className="min-w-[200px]"><Link href={`/musteriler/${o.customer_id}`} className="hover:underline">{o.customer_name}</Link></Td>
                    <Td className="whitespace-nowrap">{fmtDate(o.order_date)}</Td>
                    <Td className="whitespace-nowrap">
                      {fmtDate(o.first_shipment_date)}
                      {o.shipment_count > 1 && <span className="text-xs text-muted"> · {o.shipped_count}/{o.shipment_count}</span>}
                    </Td>
                    <Td><OrderStatusBadge status={o.status} /></Td>
                    <Td className="text-right tabular-nums whitespace-nowrap">{fmtMoney(o.total, o.currency)}</Td>
                    <Td className="text-right tabular-nums whitespace-nowrap text-forest">
                      {fmtMoney(o.collected, o.currency)}
                      {o.status !== "cancelled" && Number(o.total) > 0 && <div className="w-20 ml-auto mt-1"><ProgressBar value={Number(o.collected)} total={Number(o.total)} /></div>}
                    </Td>
                    <Td className="text-right tabular-nums whitespace-nowrap font-semibold">
                      <span className={Number(o.balance) < -0.005 ? "text-forest" : ""}>{fmtMoney(o.balance, o.currency)}</span>
                      {Number(o.overdue_amount) > 0.005 && <div className="text-[11px] text-oxblood">gecikmiş {fmtMoney(o.overdue_amount, o.currency)}</div>}
                    </Td>
                    <Td className="whitespace-nowrap">{fmtDate(o.next_due_date)}</Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {totalsByCur.map(([c, t]) => (
                  <tr key={c} className="font-bold bg-cream/60">
                    <td colSpan={5} className="px-3 py-2 text-right text-muted">Toplam ({c})</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmtMoney(t.total, c)}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-forest">{fmtMoney(t.collected, c)}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmtMoney(t.balance, c)}{t.overdue > 0.005 && <div className="text-[11px] text-oxblood">gecikmiş {fmtMoney(t.overdue, c)}</div>}</td>
                    <td />
                  </tr>
                ))}
              </tfoot>
            </Table>
          )}
        </Card>
      </Page>
    </>
  );
}
