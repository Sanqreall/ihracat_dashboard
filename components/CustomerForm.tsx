"use client";
import { useState } from "react";
import { Button, Field, Input, Modal, NumberInput, Select, Textarea } from "./ui";
import { CURRENCIES, INCOTERMS, PAYMENT_METHODS } from "@/lib/constants";
import type { Customer } from "@/lib/types";
import { supabase } from "@/lib/supabase/client";
import { errMsg } from "@/lib/format";
import { useToast } from "./providers";

export const blankCustomer = (): Partial<Customer> => ({
  code: "", name: "", contact_person: "", email: "", phone: "", address: "", country: "", tax_number: "", notes: "",
  credit_limit: 0, default_currency: "USD", preferred_incoterm: "", payment_terms_days: 30,
  default_payment_method: "bank_transfer", default_prepayment_pct: 30, default_pre_shipment_pct: 0, default_deferred_pct: 70,
  is_active: true,
});

export function CustomerFormModal({ initial, existing, onClose, onSaved }: {
  initial: Partial<Customer>; existing: Customer[]; onClose: () => void; onSaved: (c: Customer) => void;
}) {
  const toast = useToast();
  const [c, setC] = useState<Partial<Customer>>(initial);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Customer>(k: K, v: Customer[K]) => setC((p) => ({ ...p, [k]: v }));
  const pctSum = (Number(c.default_prepayment_pct) || 0) + (Number(c.default_pre_shipment_pct) || 0) + (Number(c.default_deferred_pct) || 0);

  const nextCode = () => {
    const max = existing.reduce((m, x) => {
      const n = Number((x.code || "").match(/(\d+)$/)?.[1] || 0);
      return Math.max(m, n);
    }, 0);
    return `MST-${String(max + 1).padStart(3, "0")}`;
  };

  const save = async () => {
    if (!c.name?.trim()) return toast("Müşteri adı zorunlu", "error");
    if (Math.abs(pctSum - 100) > 0.001) return toast(`Varsayılan ödeme yüzdeleri toplamı %100 olmalı (şu an %${pctSum})`, "error");
    const code = (c.code || "").trim() || (c.id ? "" : nextCode());
    if (code && existing.some((x) => x.id !== c.id && (x.code || "").toLowerCase() === code.toLowerCase())) {
      return toast(`${code} kodu başka bir müşteride kullanılıyor`, "error");
    }
    setBusy(true);
    const row = { ...c, code: code || null, name: c.name.trim() };
    delete (row as Record<string, unknown>).created_at;
    delete (row as Record<string, unknown>).updated_at;
    const res = c.id
      ? await supabase().from("customers").update(row).eq("id", c.id).select().single()
      : await supabase().from("customers").insert(row).select().single();
    setBusy(false);
    if (res.error) return toast(errMsg(res.error), "error");
    toast("Müşteri kaydedildi", "success");
    onSaved(res.data as Customer);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={c.id ? "Müşteriyi düzenle" : "Yeni müşteri"}
      size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Vazgeç</Button><Button onClick={save} loading={busy}>Kaydet</Button></>}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Müşteri adı" required className="md:col-span-2"><Input value={c.name || ""} onChange={(e) => set("name", e.target.value)} autoFocus /></Field>
        <Field label="Kod" hint={c.id ? undefined : "Boş bırakırsan otomatik verilir"}><Input value={c.code || ""} onChange={(e) => set("code", e.target.value)} /></Field>
        <Field label="Yetkili kişi"><Input value={c.contact_person || ""} onChange={(e) => set("contact_person", e.target.value)} /></Field>
        <Field label="E-posta"><Input value={c.email || ""} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Telefon"><Input value={c.phone || ""} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Ülke"><Input value={c.country || ""} onChange={(e) => set("country", e.target.value)} /></Field>
        <Field label="Vergi no"><Input value={c.tax_number || ""} onChange={(e) => set("tax_number", e.target.value)} /></Field>
        <Field label="Kredi limiti"><NumberInput value={c.credit_limit} onChange={(n) => set("credit_limit", n)} /></Field>
        <Field label="Adres" className="md:col-span-3"><Textarea value={c.address || ""} onChange={(e) => set("address", e.target.value)} /></Field>
      </div>

      <div className="mt-5 mb-2 text-sm font-bold text-ink">Varsayılan sipariş koşulları</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Para birimi">
          <Select value={c.default_currency} onChange={(e) => set("default_currency", e.target.value)}>
            {CURRENCIES.map((x) => <option key={x}>{x}</option>)}
          </Select>
        </Field>
        <Field label="Incoterm">
          <Select value={c.preferred_incoterm || ""} onChange={(e) => set("preferred_incoterm", e.target.value)}>
            <option value="">—</option>
            {INCOTERMS.map((x) => <option key={x.key} value={x.key}>{x.key}</option>)}
          </Select>
        </Field>
        <Field label="Vade (gün)"><NumberInput value={c.payment_terms_days} onChange={(n) => set("payment_terms_days", Math.max(0, Math.round(n)))} /></Field>
        <Field label="Ödeme yöntemi">
          <Select value={c.default_payment_method} onChange={(e) => set("default_payment_method", e.target.value)}>
            {PAYMENT_METHODS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
          </Select>
        </Field>
        <Field label="Ön ödeme %"><NumberInput value={c.default_prepayment_pct} onChange={(n) => set("default_prepayment_pct", n)} /></Field>
        <Field label="Sevk öncesi %"><NumberInput value={c.default_pre_shipment_pct} onChange={(n) => set("default_pre_shipment_pct", n)} /></Field>
        <Field label="Vadeli %"><NumberInput value={c.default_deferred_pct} onChange={(n) => set("default_deferred_pct", n)} /></Field>
        <div className={`self-end pb-2 text-sm font-bold ${Math.abs(pctSum - 100) > 0.001 ? "text-oxblood" : "text-forest"}`}>Toplam %{pctSum}</div>
      </div>
      <Field label="Notlar" className="mt-3"><Textarea value={c.notes || ""} onChange={(e) => set("notes", e.target.value)} /></Field>
    </Modal>
  );
}
