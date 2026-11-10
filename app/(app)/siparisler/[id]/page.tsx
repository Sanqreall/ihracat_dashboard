"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Plus, Trash2, AlertTriangle, Lock, DollarSign, CheckCircle2, Wallet, CalendarClock } from "lucide-react";
import { Button, Card, Empty, ErrorBox, Loading, Page, PageHeader, Stat, Table, Td, Th } from "@/components/ui";
import { OrderStatusBadge, PlanStatusBadge, planTypeLabel } from "@/components/badges";
import { CollectionModal } from "@/components/CollectionModal";
import { useAuth, useToast } from "@/components/providers";
import { useData } from "@/lib/hooks";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import { lineTotal } from "@/lib/calc";
import { INCOTERMS, PAYMENT_METHODS, SHIPPING_METHODS, labelOf } from "@/lib/constants";
import { errMsg, fmtDate, fmtMoney, fmtNum } from "@/lib/format";
import type { Collection } from "@/lib/types";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { canEdit } = useAuth();
  const [colEdit, setColEdit] = useState<Partial<Collection> | null>(null);

  const { data, error, loading, reload } = useData(async () => {
    const [summary, draft, plan, ships, cols, banks, allOrders] = await Promise.all([
      db.orderSummary(id), db.loadOrderDraft(id), db.planStatus(id), db.shipmentTotals(id),
      db.collections({ orderId: id }), db.banks(), db.orderSummaries(),
    ]);
    return { summary, draft, plan, ships, cols, banks, allOrders };
  }, [id]);

  if (loading) return <Loading />;
  if (error || !data?.summary) return <Page><ErrorBox error={error || "Sipariş bulunamadı"} onRetry={reload} /></Page>;
  const { summary: s, draft: d, plan, ships, cols, banks } = data;
  const cur = s.currency.trim();
  const multi = d.shipments.length > 1;

  const remove = async () => {
    if (cols.length) return toast("Bu siparişe bağlı tahsilat var. Önce tahsilatları silin veya başka siparişe taşıyın.", "error");
    if (!confirm(`${s.order_number} silinsin mi? Bu işlem geri alınamaz.`)) return;
    try {
      await db.deleteOrder(id);
      toast("Sipariş silindi", "success");
      router.replace("/siparisler");
    } catch (e) {
      toast(errMsg(e), "error");
    }
  };

  const removeCollection = async (c: Collection) => {
    if (!confirm(`${fmtDate(c.received_date)} tarihli ${fmtMoney(c.amount, cur)} tahsilat silinsin mi?`)) return;
    const { error } = await supabase().from("collections").delete().eq("id", c.id);
    if (error) return toast(errMsg(error), "error");
    toast("Tahsilat silindi", "success");
    reload();
  };

  return (
    <>
      <PageHeader title={`${s.order_number}`} subtitle={`${s.customer_name} · ${fmtDate(s.order_date)}`}>
        <Link href="/siparisler"><Button variant="secondary" icon={ArrowLeft}>Siparişler</Button></Link>
        {canEdit && <Button icon={Plus} variant="gold" onClick={() => setColEdit({ order_id: id })}>Tahsilat ekle</Button>}
        {canEdit && <Link href={`/siparisler/${id}/duzenle`}><Button icon={Pencil}>Düzenle</Button></Link>}
        {canEdit && <Button variant="ghost" icon={Trash2} className="text-oxblood" onClick={remove}>Sil</Button>}
      </PageHeader>
      <Page>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <OrderStatusBadge status={s.status} />
          <Link href={`/musteriler/${s.customer_id}`} className="font-semibold text-navy hover:underline">{s.customer_name}</Link>
          {d.order.incoterm && <span className="text-muted">· {labelOf(INCOTERMS, d.order.incoterm)}</span>}
          {d.order.shipping_method && <span className="text-muted">· {labelOf(SHIPPING_METHODS, d.order.shipping_method)}</span>}
          {d.order.invoice_number && <span className="text-muted">· Fatura {d.order.invoice_number}</span>}
        </div>

        {s.status === "cancelled" && Number(s.collected) > 0 && (
          <Warn>Sipariş iptal edildi ama {fmtMoney(s.collected, cur)} tahsilat var. İade edilecekse tahsilatı silin, başka siparişe sayılacaksa tahsilatı düzenleyip siparişini değiştirin.</Warn>
        )}
        {Math.abs(Number(s.plan_diff)) > 0.005 && s.status !== "cancelled" && (
          <Warn>Ödeme planı toplamı sipariş toplamından {fmtMoney(s.plan_diff, cur)} farklı. {canEdit && <Link className="underline font-bold" href={`/siparisler/${id}/duzenle`}>Planı düzelt</Link>}</Warn>
        )}
        {Number(s.unallocated) > 0.005 && (
          <Warn>{fmtMoney(s.unallocated, cur)} tahsilat plana sığmıyor (fazla ödeme / avans). Planı güncelleyin veya tahsilatı başka siparişe taşıyın.</Warn>
        )}

        <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
          <Stat icon={DollarSign} accent="navy" label="Sipariş toplamı" value={fmtMoney(s.total, cur)} sub={cur !== "USD" ? `≈ ${fmtMoney(s.total_usd, "USD")}` : undefined} />
          <Stat icon={CheckCircle2} accent="forest" label="Tahsil edilen" value={fmtMoney(s.collected, cur)} sub={Number(s.total) > 0 ? `%${Math.round((Number(s.collected) / Number(s.total)) * 100)}` : undefined} />
          <Stat icon={Wallet} accent="gold" label="Bakiye" value={fmtMoney(s.balance, cur)} />
          <Stat icon={AlertTriangle} accent="oxblood" label="Gecikmiş" value={fmtMoney(s.overdue_amount, cur)} tone={Number(s.overdue_amount) > 0.005 ? "danger" : undefined} />
          <Stat icon={CalendarClock} accent="copper" label="Sonraki vade" value={fmtDate(s.next_due_date)} />
        </div>

        <Card title="Ödeme planı ve durum" padded={false}>
          {plan.length === 0 ? <Empty title="Ödeme planı yok" hint="Siparişi düzenleyip plan oluşturun." /> : (
            <Table>
              <thead><tr><Th>Vade</Th><Th>Tip</Th>{multi && <Th>Sevk.</Th>}<Th className="text-right">Tutar</Th><Th className="text-right">Tahsil</Th><Th className="text-right">Kalan</Th><Th>Durum</Th><Th>Yöntem</Th><Th>Açıklama</Th></tr></thead>
              <tbody>
                {plan.map((p) => (
                  <tr key={p.plan_item_id}>
                    <Td className="whitespace-nowrap">{fmtDate(p.due_date)}</Td>
                    <Td>{planTypeLabel(p.type)}{p.percentage != null && <span className="text-muted text-xs"> %{fmtNum(p.percentage)}</span>}</Td>
                    {multi && <Td>{p.shipment_no ?? "Genel"}</Td>}
                    <Td className="text-right tabular-nums">{fmtMoney(p.amount, cur)}</Td>
                    <Td className="text-right tabular-nums text-forest">{fmtMoney(p.paid, cur)}</Td>
                    <Td className="text-right tabular-nums font-semibold">{fmtMoney(p.remaining, cur)}</Td>
                    <Td><PlanStatusBadge status={p.status} days={p.days_overdue} /></Td>
                    <Td className="text-xs">{labelOf(PAYMENT_METHODS, p.method)}</Td>
                    <Td className="text-xs text-muted">{p.notes}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card title={`Tahsilatlar (${cols.length})`} padded={false} action={canEdit ? <Button size="sm" icon={Plus} onClick={() => setColEdit({ order_id: id })}>Ekle</Button> : undefined}>
          {cols.length === 0 ? <Empty title="Henüz tahsilat yok" /> : (
            <Table>
              <thead><tr><Th>Tarih</Th><Th className="text-right">Tutar</Th><Th>Hesaba giren</Th><Th>Banka</Th><Th>Yöntem</Th><Th>Referans</Th><Th>Plan kalemi</Th><Th>Not</Th>{canEdit && <Th />}</tr></thead>
              <tbody>
                {cols.map((c) => (
                  <tr key={c.id}>
                    <Td className="whitespace-nowrap">{fmtDate(c.received_date)}</Td>
                    <Td className="text-right tabular-nums font-semibold">{fmtMoney(c.amount, cur)}</Td>
                    <Td className="whitespace-nowrap text-xs">{c.received_currency && c.received_currency.trim() !== cur ? fmtMoney(c.received_amount, c.received_currency) : "—"}</Td>
                    <Td>{c.bank_account_name || "—"}</Td>
                    <Td className="text-xs">{labelOf(PAYMENT_METHODS, c.method)}</Td>
                    <Td className="text-xs">{c.reference}</Td>
                    <Td className="text-xs">{c.plan_item_type ? planTypeLabel(c.plan_item_type) : <span className="text-muted">otomatik</span>}</Td>
                    <Td className="text-xs text-muted">{c.notes}</Td>
                    {canEdit && (
                      <Td className="whitespace-nowrap">
                        <button className="p-1 text-muted hover:text-navy" onClick={() => setColEdit(c)}><Pencil size={14} /></button>
                        <button className="p-1 text-muted hover:text-oxblood" onClick={() => removeCollection(c)}><Trash2 size={14} /></button>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card title="Sevkiyatlar" padded={false}>
          <Table>
            <thead><tr><Th>No</Th><Th>Ad</Th><Th>Planlanan</Th><Th>Fiili</Th><Th className="text-right">Tutar</Th><Th className="text-right">USD</Th><Th>Kur</Th></tr></thead>
            <tbody>
              {ships.map((x) => (
                <tr key={x.shipment_id}>
                  <Td className="font-bold">{x.shipment_no}</Td>
                  <Td>{x.name || `${x.shipment_no}. Sevkiyat`}</Td>
                  <Td>{fmtDate(x.planned_date)}</Td>
                  <Td>{x.actual_date ? fmtDate(x.actual_date) : <span className="text-muted">bekliyor</span>}</Td>
                  <Td className="text-right tabular-nums">{fmtMoney(x.total, cur)}</Td>
                  <Td className="text-right tabular-nums">{fmtMoney(x.total_usd, "USD")}</Td>
                  <Td className="text-xs text-muted whitespace-nowrap">{x.locked_rate_to_usd ? <span className="inline-flex items-center gap-1"><Lock size={11} /> {fmtNum(x.locked_rate_to_usd, 4)}</span> : `güncel ${fmtNum(x.rate_to_usd, 4)}`}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card title={`Kalemler (${d.items.length})`} padded={false}>
          <Table>
            <thead><tr>{multi && <Th>Sevk.</Th>}<Th>Kod</Th><Th>Ürün</Th><Th>Birim</Th><Th className="text-right">Miktar</Th><Th className="text-right">Birim fiyat</Th><Th className="text-right">İsk.</Th><Th className="text-right">Tutar</Th></tr></thead>
            <tbody>
              {d.items.map((it) => (
                <tr key={it.id}>
                  {multi && <Td>{it.shipment_no}</Td>}
                  <Td className="whitespace-nowrap font-semibold">{it.product_code}</Td>
                  <Td>{it.name_tr}{it.name_en && <div className="text-xs text-muted">{it.name_en}</div>}</Td>
                  <Td>{it.unit}</Td>
                  <Td className="text-right tabular-nums">{fmtNum(it.quantity, 3)}</Td>
                  <Td className="text-right tabular-nums">{fmtMoney(it.unit_price, cur)}</Td>
                  <Td className="text-right">{it.discount_pct ? `%${fmtNum(it.discount_pct)}` : ""}</Td>
                  <Td className="text-right tabular-nums">{fmtMoney(lineTotal(it.quantity, it.unit_price, it.discount_pct), cur)}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot className="text-sm">
              <TotRow label="Ara toplam" v={fmtMoney(s.subtotal, cur)} span={multi ? 7 : 6} />
              {Number(s.discount) > 0 && <TotRow label="İskonto" v={`− ${fmtMoney(s.discount, cur)}`} span={multi ? 7 : 6} />}
              {Number(s.vat_amount) > 0 && <TotRow label={`KDV %${fmtNum(s.vat_rate)}`} v={fmtMoney(s.vat_amount, cur)} span={multi ? 7 : 6} />}
              {d.costs.map((c) => <TotRow key={c.id} label={`${c.description || "Ek maliyet"}${c.vat_rate ? ` (+%${fmtNum(c.vat_rate)} KDV)` : ""}`} v={fmtMoney(c.amount * (1 + c.vat_rate / 100), cur)} span={multi ? 7 : 6} />)}
              <TotRow label="Genel toplam" v={fmtMoney(s.total, cur)} span={multi ? 7 : 6} bold />
            </tfoot>
          </Table>
        </Card>

        {(d.order.notes || d.order.port_of_loading || d.order.port_of_discharge || d.order.bill_of_lading) && (
          <Card title="Diğer bilgiler">
            <dl className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
              {[["Yükleme limanı", d.order.port_of_loading], ["Varış limanı", d.order.port_of_discharge], ["Konşimento", d.order.bill_of_lading], ["Not", d.order.notes]].map(([k, v]) => (
                <div key={k}><dt className="text-[11px] font-bold uppercase text-muted">{k}</dt><dd className="whitespace-pre-wrap">{v || "—"}</dd></div>
              ))}
            </dl>
          </Card>
        )}
      </Page>
      {colEdit && (
        <CollectionModal initial={colEdit} orders={data.allOrders} banks={banks} fixedOrderId={colEdit.id ? undefined : id}
          onClose={() => setColEdit(null)} onSaved={() => { setColEdit(null); reload(); }} />
      )}
    </>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-[#EBCFB5] bg-[#F8EDE3] text-copper text-sm px-3 py-2">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" /><div>{children}</div>
    </div>
  );
}

function TotRow({ label, v, span, bold }: { label: string; v: string; span: number; bold?: boolean }) {
  return (
    <tr className={bold ? "font-bold text-base" : ""}>
      <td colSpan={span} className="px-3 py-1.5 text-right text-muted">{label}</td>
      <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">{v}</td>
    </tr>
  );
}
