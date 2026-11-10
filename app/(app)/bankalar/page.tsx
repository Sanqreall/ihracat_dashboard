"use client";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button, Card, Empty, ErrorBox, Field, Input, Loading, Modal, Page, PageHeader, Select, Table, Td, Textarea, Th } from "@/components/ui";
import { useAuth, useToast } from "@/components/providers";
import { useData } from "@/lib/hooks";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import { CURRENCIES } from "@/lib/constants";
import { errMsg, fmtMoney } from "@/lib/format";
import type { BankAccount } from "@/lib/types";

export default function BanksPage() {
  const { canEdit } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useData(async () => {
    const [banks, cols] = await Promise.all([db.banks(), db.collections()]);
    return { banks, cols };
  });
  const [editing, setEditing] = useState<Partial<BankAccount> | null>(null);

  // Hesaba giren tutarlar — fiilen alınan döviz cinsinden, para birimi bazında ayrı
  const incoming = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    (data?.cols || []).forEach((c) => {
      if (!c.bank_account_id) return;
      const cur = (c.received_currency || c.order_currency || "").trim();
      const inner = m.get(c.bank_account_id) || new Map<string, number>();
      inner.set(cur, (inner.get(cur) || 0) + Number(c.received_amount ?? c.amount));
      m.set(c.bank_account_id, inner);
    });
    return m;
  }, [data]);

  const remove = async (b: BankAccount) => {
    if (!confirm(`${b.name} silinsin mi?`)) return;
    const { error } = await supabase().from("bank_accounts").delete().eq("id", b.id);
    if (error) return toast(error.code === "23503" ? "Bu hesaba kayıtlı tahsilat var, silinemez. Pasife alabilirsin." : errMsg(error), "error");
    reload();
  };

  return (
    <>
      <PageHeader title="Banka Hesapları">
        {canEdit && <Button icon={Plus} onClick={() => setEditing({ name: "", currency: "USD", is_active: true })}>Yeni hesap</Button>}
      </PageHeader>
      <Page>
        {error && <ErrorBox error={error} onRetry={reload} />}
        <Card padded={false}>
          {loading ? <Loading /> : !data?.banks.length ? <Empty title="Banka hesabı yok" /> : (
            <Table>
              <thead><tr><Th>Hesap</Th><Th>Banka</Th><Th>IBAN</Th><Th>SWIFT</Th><Th>Döviz</Th><Th className="text-right">Toplam giriş</Th>{canEdit && <Th />}</tr></thead>
              <tbody>
                {data.banks.map((b) => (
                  <tr key={b.id} className={b.is_active ? "" : "opacity-50"}>
                    <Td className="font-semibold">{b.name}</Td>
                    <Td>{b.bank_name}</Td>
                    <Td className="font-mono text-xs">{b.iban}</Td>
                    <Td className="font-mono text-xs">{b.swift}</Td>
                    <Td>{b.currency}</Td>
                    <Td className="text-right tabular-nums whitespace-nowrap">
                      {[...(incoming.get(b.id)?.entries() || [])].map(([cur, v]) => <div key={cur}>{fmtMoney(v, cur)}</div>)}
                    </Td>
                    {canEdit && (
                      <Td className="text-right whitespace-nowrap">
                        <button className="p-1.5 text-muted hover:text-navy" onClick={() => setEditing(b)}><Pencil size={15} /></button>
                        <button className="p-1.5 text-muted hover:text-oxblood" onClick={() => remove(b)}><Trash2 size={15} /></button>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </Page>
      {editing && <BankModal initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </>
  );
}

function BankModal({ initial, onClose, onSaved }: { initial: Partial<BankAccount>; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [b, setB] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof BankAccount>(k: K, v: BankAccount[K]) => setB((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!b.name?.trim()) return toast("Hesap adı zorunlu", "error");
    setBusy(true);
    const row = { ...b };
    delete (row as Record<string, unknown>).created_at;
    delete (row as Record<string, unknown>).updated_at;
    const res = b.id ? await supabase().from("bank_accounts").update(row).eq("id", b.id) : await supabase().from("bank_accounts").insert(row);
    setBusy(false);
    if (res.error) return toast(errMsg(res.error), "error");
    onSaved();
  };
  return (
    <Modal open onClose={onClose} title={b.id ? "Hesabı düzenle" : "Yeni banka hesabı"}
      footer={<><Button variant="secondary" onClick={onClose}>Vazgeç</Button><Button onClick={save} loading={busy}>Kaydet</Button></>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Hesap adı" required><Input value={b.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="Ziraat EUR" autoFocus /></Field>
        <Field label="Banka"><Input value={b.bank_name || ""} onChange={(e) => set("bank_name", e.target.value)} /></Field>
        <Field label="IBAN"><Input value={b.iban || ""} onChange={(e) => set("iban", e.target.value)} /></Field>
        <Field label="SWIFT"><Input value={b.swift || ""} onChange={(e) => set("swift", e.target.value)} /></Field>
        <Field label="Hesap no"><Input value={b.account_number || ""} onChange={(e) => set("account_number", e.target.value)} /></Field>
        <Field label="Döviz"><Select value={b.currency} onChange={(e) => set("currency", e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Durum"><Select value={b.is_active ? "1" : "0"} onChange={(e) => set("is_active", e.target.value === "1")}><option value="1">Aktif</option><option value="0">Pasif</option></Select></Field>
        <Field label="Notlar" className="md:col-span-2"><Textarea value={b.notes || ""} onChange={(e) => set("notes", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
