"use client";
import { useEffect, useMemo, useState } from "react";
import { Button, Field, Input, Modal, NumberInput, Select, Textarea } from "./ui";
import { SearchPicker } from "./Pickers";
import { planTypeLabel } from "./badges";
import { useToast } from "./providers";
import { supabase } from "@/lib/supabase/client";
import { db } from "@/lib/db";
import { CURRENCIES, PAYMENT_METHODS } from "@/lib/constants";
import { errMsg, fmtDate, fmtMoney, todayTR } from "@/lib/format";
import type { BankAccount, Collection, OrderSummary, PlanStatusRow } from "@/lib/types";

export function CollectionModal({ initial, orders, banks, fixedOrderId, onClose, onSaved }: {
  initial?: Partial<Collection> | null;
  orders: OrderSummary[];
  banks: BankAccount[];
  fixedOrderId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [c, setC] = useState<Partial<Collection>>(() => ({
    received_date: todayTR(), method: "bank_transfer", plan_item_id: null, ...initial,
    order_id: initial?.order_id || fixedOrderId || "",
  }));
  const [plan, setPlan] = useState<PlanStatusRow[]>([]);
  const [busy, setBusy] = useState(false);
  const order = orders.find((o) => o.order_id === c.order_id);
  const cur = order?.currency?.trim() || "USD";
  const [otherCur, setOtherCur] = useState(!!(initial?.received_currency && initial.received_currency.trim() !== (order?.currency || "").trim()));
  const set = <K extends keyof Collection>(k: K, v: Collection[K]) => setC((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!c.order_id) { setPlan([]); return; }
    db.planStatus(c.order_id).then(setPlan).catch(() => setPlan([]));
  }, [c.order_id]);

  const open = useMemo(() => plan.filter((p) => p.status !== "paid" && p.status !== "cancelled"), [plan]);
  const firstOpen = open[0];

  // Hesaba yatan döviz: sipariş dövizi ise hesap dövizine uyan bankaları üste al
  const sortedBanks = useMemo(() => [...banks.filter((b) => b.is_active || b.id === c.bank_account_id)]
    .sort((a, b) => Number(b.currency.trim() === (otherCur ? c.received_currency : cur)) - Number(a.currency.trim() === (otherCur ? c.received_currency : cur))),
  [banks, cur, otherCur, c.received_currency, c.bank_account_id]);

  const save = async () => {
    if (!c.order_id) return toast("Sipariş seç", "error");
    if (!c.received_date) return toast("Tarih gir", "error");
    if (!(Number(c.amount) > 0)) return toast(`Tutar (${cur}) 0'dan büyük olmalı`, "error");
    if (otherCur && !(Number(c.received_amount) > 0)) return toast("Hesaba giren tutarı gir", "error");
    setBusy(true);
    const row = {
      order_id: c.order_id,
      plan_item_id: c.plan_item_id || null,
      received_date: c.received_date,
      amount: Number(c.amount),
      received_currency: otherCur ? c.received_currency : cur,
      received_amount: otherCur ? Number(c.received_amount) : Number(c.amount),
      bank_account_id: c.bank_account_id || null,
      method: c.method || "bank_transfer",
      reference: c.reference || null,
      notes: c.notes || null,
      // Tarih veya sipariş değiştiyse kur yeniden hesaplansın
      ...(c.id && (c.received_date !== initial?.received_date || c.order_id !== initial?.order_id) ? { rate_to_usd: null } : {}),
    };
    const res = c.id
      ? await supabase().from("collections").update(row).eq("id", c.id)
      : await supabase().from("collections").insert(row);
    setBusy(false);
    if (res.error) return toast(errMsg(res.error), "error");
    toast("Tahsilat kaydedildi", "success");
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={c.id ? "Tahsilatı düzenle" : "Tahsilat ekle"}
      footer={<><Button variant="secondary" onClick={onClose}>Vazgeç</Button><Button onClick={save} loading={busy}>Kaydet</Button></>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Sipariş" required className="md:col-span-2">
          <SearchPicker items={orders} value={c.order_id} disabled={!!fixedOrderId}
            onChange={(id) => setC((x) => ({ ...x, order_id: id, plan_item_id: null }))}
            getKey={(o) => o.order_id} getLabel={(o) => `${o.order_number} · ${o.customer_name}`}
            getSub={(o) => `Bakiye ${fmtMoney(o.balance, o.currency)} · Toplam ${fmtMoney(o.total, o.currency)}`}
            placeholder="Sipariş seç…" />
        </Field>

        {order && (
          <div className="md:col-span-2 rounded-md bg-cream/70 border border-line px-3 py-2 text-sm">
            <div className="flex flex-wrap gap-x-4">
              <span>Toplam <b>{fmtMoney(order.total, cur)}</b></span>
              <span>Tahsil <b>{fmtMoney(order.collected, cur)}</b></span>
              <span>Bakiye <b>{fmtMoney(order.balance, cur)}</b></span>
            </div>
            {firstOpen && <div className="text-muted text-[12px] mt-1">Sıradaki: {planTypeLabel(firstOpen.type)} · {fmtDate(firstOpen.due_date)} · kalan {fmtMoney(firstOpen.remaining, cur)}</div>}
          </div>
        )}

        <Field label="Tahsilat tarihi" required><Input type="date" value={c.received_date || ""} onChange={(e) => set("received_date", e.target.value)} /></Field>
        <Field label={`Tutar (${cur})`} required hint="Siparişe sayılacak tutar">
          <div className="flex gap-2">
            <NumberInput value={c.amount ?? null} onChange={(n) => set("amount", n)} />
            {firstOpen && !c.amount && <Button size="sm" variant="secondary" className="h-10" onClick={() => set("amount", Number(firstOpen.remaining))}>Sıradaki</Button>}
          </div>
        </Field>

        <label className="md:col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={otherCur} onChange={(e) => { setOtherCur(e.target.checked); if (e.target.checked && !c.received_currency) set("received_currency", "EUR"); }} />
          Müşteri farklı bir dövizle ödedi
        </label>
        {otherCur && (
          <>
            <Field label="Hesaba giren döviz">
              <Select value={c.received_currency || ""} onChange={(e) => set("received_currency", e.target.value)}>
                {CURRENCIES.map((x) => <option key={x}>{x}</option>)}
              </Select>
            </Field>
            <Field label="Hesaba giren tutar"><NumberInput value={c.received_amount ?? null} onChange={(n) => set("received_amount", n)} /></Field>
          </>
        )}

        <Field label="Banka hesabı">
          <Select value={c.bank_account_id || ""} onChange={(e) => set("bank_account_id", e.target.value || null)}>
            <option value="">—</option>
            {sortedBanks.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.currency})</option>)}
          </Select>
        </Field>
        <Field label="Yöntem">
          <Select value={c.method} onChange={(e) => set("method", e.target.value)}>
            {PAYMENT_METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </Select>
        </Field>
        <Field label="Referans / SWIFT no"><Input value={c.reference || ""} onChange={(e) => set("reference", e.target.value)} /></Field>
        <Field label="Plan kalemi" hint="Boş = vadesi en eski kalemden başlayarak otomatik">
          <Select value={c.plan_item_id || ""} onChange={(e) => set("plan_item_id", e.target.value || null)}>
            <option value="">Otomatik dağıt</option>
            {plan.map((p) => (
              <option key={p.plan_item_id} value={p.plan_item_id}>
                {planTypeLabel(p.type)}{p.shipment_no ? ` S${p.shipment_no}` : ""} · {fmtDate(p.due_date)} · {fmtMoney(p.amount, cur)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Not" className="md:col-span-2"><Textarea value={c.notes || ""} onChange={(e) => set("notes", e.target.value)} className="min-h-[44px]" /></Field>
      </div>
    </Modal>
  );
}
