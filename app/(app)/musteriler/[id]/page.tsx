"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Plus, Trash2, Check, Banknote } from "lucide-react";
import { Button, Card, Empty, ErrorBox, Input, Loading, Page, PageHeader, Stat, Table, Td, Th } from "@/components/ui";
import { CustomerFormModal } from "@/components/CustomerForm";
import { OrderStatusBadge, PlanStatusBadge, planTypeLabel } from "@/components/badges";
import { useAuth, useToast } from "@/components/providers";
import { useData, q } from "@/lib/hooks";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import { errMsg, fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import { labelOf, PAYMENT_METHODS } from "@/lib/constants";
import type { Customer } from "@/lib/types";

interface Note { id: string; customer_id: string; text: string; done: boolean; created_at: string }

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { canEdit } = useAuth();
  const [editing, setEditing] = useState(false);
  const [noteText, setNoteText] = useState("");

  const { data, error, loading, reload } = useData(async () => {
    const sb = supabase();
    const [customer, customers, balances, orders, plan, collections, notes] = await Promise.all([
      q<Customer>(sb.from("customers").select("*").eq("id", id).single()),
      db.customers(),
      db.customerBalances(id),
      db.orderSummaries({ customerId: id }),
      db.planStatus(undefined, id),
      db.collections({ customerId: id }),
      q<Note[]>(sb.from("customer_notes").select("*").eq("customer_id", id).order("created_at", { ascending: false })),
    ]);
    return { customer, customers, balances, orders, plan, collections, notes };
  }, [id]);

  if (loading) return <Loading />;
  if (error || !data) return <Page><ErrorBox error={error || "Bulunamadı"} onRetry={reload} /></Page>;
  const { customer: c, balances, orders, plan, collections, notes } = data;
  const openPlan = plan.filter((p) => ["open", "partial", "overdue"].includes(p.status));

  const remove = async () => {
    if (orders.length) return toast(`Bu müşterinin ${orders.length} siparişi var, silinemez. Pasife alabilirsin.`, "error");
    if (!confirm(`${c.name} silinsin mi?`)) return;
    const { error } = await supabase().from("customers").delete().eq("id", c.id);
    if (error) return toast(errMsg(error), "error");
    toast("Müşteri silindi", "success");
    router.replace("/musteriler");
  };

  const toggleActive = async () => {
    const { error } = await supabase().from("customers").update({ is_active: !c.is_active }).eq("id", c.id);
    if (error) return toast(errMsg(error), "error");
    reload();
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    const { error } = await supabase().from("customer_notes").insert({ customer_id: id, text: noteText.trim() });
    if (error) return toast(errMsg(error), "error");
    setNoteText("");
    reload();
  };
  const toggleNote = async (n: Note) => {
    const { error } = await supabase().from("customer_notes").update({ done: !n.done }).eq("id", n.id);
    if (error) return toast(errMsg(error), "error");
    reload();
  };
  const deleteNote = async (n: Note) => {
    if (!confirm("Not silinsin mi?")) return;
    const { error } = await supabase().from("customer_notes").delete().eq("id", n.id);
    if (error) return toast(errMsg(error), "error");
    reload();
  };

  return (
    <>
      <PageHeader title={c.name} subtitle={[c.code, c.country, c.contact_person].filter(Boolean).join(" · ")}>
        <Link href="/musteriler"><Button variant="secondary" icon={ArrowLeft}>Müşteriler</Button></Link>
        {canEdit && <Link href={`/siparisler/yeni?musteri=${c.id}`}><Button icon={Plus}>Yeni sipariş</Button></Link>}
        {canEdit && <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>Düzenle</Button>}
        {canEdit && <Button variant="secondary" onClick={toggleActive}>{c.is_active ? "Pasife al" : "Aktifleştir"}</Button>}
        {canEdit && <Button variant="ghost" icon={Trash2} onClick={remove} className="text-oxblood">Sil</Button>}
      </PageHeader>
      <Page>
        {!c.is_active && <div className="text-sm font-bold text-muted">Bu müşteri pasif.</div>}

        {balances.length === 0 ? null : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {balances.map((b) => (
              <Stat
                key={b.currency}
                icon={Banknote}
                accent={Number(b.overdue_amount) > 0.005 ? "oxblood" : "navy"}
                label={`Bakiye (${b.currency})`}
                value={fmtMoney(b.balance, b.currency)}
                tone={Number(b.overdue_amount) > 0.005 ? "danger" : undefined}
                sub={<>
                  Ciro {fmtMoney(b.total, b.currency)} · Tahsil {fmtMoney(b.collected, b.currency)}
                  {Number(b.overdue_amount) > 0.005 && <span className="text-oxblood font-bold"> · Gecikmiş {fmtMoney(b.overdue_amount, b.currency)}</span>}
                </>}
              />
            ))}
          </div>
        )}

        <Card title={`Siparişler (${orders.length})`} padded={false}>
          {orders.length === 0 ? <Empty title="Sipariş yok" /> : (
            <Table>
              <thead><tr><Th>No</Th><Th>Tarih</Th><Th>Durum</Th><Th className="text-right">Toplam</Th><Th className="text-right">Tahsil</Th><Th className="text-right">Bakiye</Th><Th>Sonraki vade</Th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.order_id} className="hover:bg-cream/50">
                    <Td><Link className="font-semibold text-navy hover:underline" href={`/siparisler/${o.order_id}`}>{o.order_number}</Link></Td>
                    <Td>{fmtDate(o.order_date)}</Td>
                    <Td><OrderStatusBadge status={o.status} /></Td>
                    <Td className="text-right tabular-nums">{fmtMoney(o.total, o.currency)}</Td>
                    <Td className="text-right tabular-nums">{fmtMoney(o.collected, o.currency)}</Td>
                    <Td className={`text-right tabular-nums font-semibold ${Number(o.balance) < 0 ? "text-forest" : ""}`}>{fmtMoney(o.balance, o.currency)}</Td>
                    <Td>{fmtDate(o.next_due_date)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card title={`Açık plan kalemleri (${openPlan.length})`} padded={false}>
            {openPlan.length === 0 ? <Empty title="Açık alacak yok" /> : (
              <Table>
                <thead><tr><Th>Vade</Th><Th>Sipariş</Th><Th>Tip</Th><Th className="text-right">Kalan</Th><Th>Durum</Th></tr></thead>
                <tbody>
                  {openPlan.map((p) => (
                    <tr key={p.plan_item_id}>
                      <Td>{fmtDate(p.due_date)}</Td>
                      <Td><Link className="text-navy hover:underline" href={`/siparisler/${p.order_id}`}>{p.order_number}</Link>{p.shipment_no ? <span className="text-muted"> · S{p.shipment_no}</span> : null}</Td>
                      <Td>{planTypeLabel(p.type)}</Td>
                      <Td className="text-right tabular-nums">{fmtMoney(p.remaining, p.currency)}</Td>
                      <Td><PlanStatusBadge status={p.status} days={p.days_overdue} /></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card title={`Tahsilatlar (${collections.length})`} padded={false}>
            {collections.length === 0 ? <Empty title="Tahsilat yok" /> : (
              <Table>
                <thead><tr><Th>Tarih</Th><Th>Sipariş</Th><Th className="text-right">Tutar</Th><Th>Banka</Th><Th>Yöntem</Th></tr></thead>
                <tbody>
                  {collections.map((x) => (
                    <tr key={x.id}>
                      <Td>{fmtDate(x.received_date)}</Td>
                      <Td><Link className="text-navy hover:underline" href={`/siparisler/${x.order_id}`}>{x.order_number}</Link></Td>
                      <Td className="text-right tabular-nums">{fmtMoney(x.amount, x.order_currency)}</Td>
                      <Td>{x.bank_account_name || "—"}</Td>
                      <Td>{labelOf(PAYMENT_METHODS, x.method)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <Card title="Takip notları">
          {canEdit && (
            <div className="flex gap-2 mb-3">
              <Input placeholder="Not ekle… (ör. 15'inde ödeme sözü verdi)" value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} />
              <Button icon={Plus} onClick={addNote}>Ekle</Button>
            </div>
          )}
          {notes.length === 0 ? <div className="text-sm text-muted">Not yok.</div> : (
            <ul className="divide-y divide-line">
              {notes.map((n) => (
                <li key={n.id} className="flex items-start gap-3 py-2">
                  <button disabled={!canEdit} onClick={() => toggleNote(n)} className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center ${n.done ? "bg-forest border-forest text-white" : "border-line"}`}>
                    {n.done && <Check size={12} />}
                  </button>
                  <div className="flex-1">
                    <div className={n.done ? "line-through text-muted" : ""}>{n.text}</div>
                    <div className="text-[11px] text-muted">{fmtDateTime(n.created_at)}</div>
                  </div>
                  {canEdit && <button onClick={() => deleteNote(n)} className="text-muted hover:text-oxblood"><Trash2 size={14} /></button>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Müşteri bilgileri">
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
            {[
              ["E-posta", c.email], ["Telefon", c.phone], ["Vergi no", c.tax_number],
              ["Varsayılan döviz", c.default_currency], ["Incoterm", c.preferred_incoterm], ["Vade", `${c.payment_terms_days} gün`],
              ["Ödeme yöntemi", labelOf(PAYMENT_METHODS, c.default_payment_method)],
              ["Ödeme planı", `%${c.default_prepayment_pct} ön · %${c.default_pre_shipment_pct} sevk öncesi · %${c.default_deferred_pct} vadeli`],
              ["Kredi limiti", c.credit_limit ? fmtMoney(c.credit_limit, c.default_currency) : "—"],
              ["Adres", c.address], ["Notlar", c.notes],
            ].map(([k, v]) => (
              <div key={k as string}><dt className="text-[11px] font-bold uppercase text-muted">{k}</dt><dd className="whitespace-pre-wrap">{v || "—"}</dd></div>
            ))}
          </dl>
        </Card>
      </Page>
      {editing && <CustomerFormModal initial={c} existing={data.customers} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
    </>
  );
}
