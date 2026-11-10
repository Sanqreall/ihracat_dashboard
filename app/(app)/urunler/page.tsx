"use client";
import { useMemo, useState } from "react";
import { Plus, Search, Trash2, Pencil } from "lucide-react";
import { Button, Card, Empty, ErrorBox, Field, Input, Loading, Modal, NumberInput, Page, PageHeader, Select, Table, Td, Textarea, Th } from "@/components/ui";
import { useAuth, useToast } from "@/components/providers";
import { useData } from "@/lib/hooks";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import { CURRENCIES, UNITS } from "@/lib/constants";
import { errMsg, fmtMoney, newId } from "@/lib/format";
import type { Product, ProductPackage } from "@/lib/types";

const blank = (): Partial<Product> => ({
  product_code: "", manufacturing_code: "", name_tr: "", name_en: "", unit: "adet", category: "", notes: "",
  default_price: 0, default_currency: "USD", packages: [], is_active: true,
});

export default function ProductsPage() {
  const { canEdit } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useData(() => db.products());
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<Product> | null>(null);

  const rows = useMemo(() => {
    const s = search.trim().toLocaleLowerCase("tr");
    return (data || []).filter((p) =>
      !s || [p.product_code, p.manufacturing_code, p.name_tr, p.name_en, p.category].some((v) => (v || "").toLocaleLowerCase("tr").includes(s))
    );
  }, [data, search]);

  const remove = async (p: Product) => {
    if (!confirm(`${p.product_code || p.name_tr} silinsin mi? Eski siparişlerdeki kalemler etkilenmez (ad ve kod siparişte saklı).`)) return;
    const { error } = await supabase().from("products").delete().eq("id", p.id);
    if (error) return toast(errMsg(error), "error");
    toast("Ürün silindi", "success");
    reload();
  };

  return (
    <>
      <PageHeader title="Ürünler" subtitle={data ? `${data.length} ürün` : undefined}>
        {canEdit && <Button icon={Plus} onClick={() => setEditing(blank())}>Yeni ürün</Button>}
      </PageHeader>
      <Page>
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-3 text-muted" />
          <Input className="pl-9" placeholder="Kod, ad, kategori ara…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {error && <ErrorBox error={error} onRetry={reload} />}
        <Card padded={false}>
          {loading ? <Loading /> : rows.length === 0 ? <Empty title="Ürün yok" /> : (
            <Table>
              <thead><tr><Th>Kod</Th><Th>Üretim kodu</Th><Th>Ürün (TR)</Th><Th>Ürün (EN)</Th><Th>Kategori</Th><Th>Birim</Th><Th className="text-right">Fiyat</Th><Th className="text-center">Koli</Th>{canEdit && <Th />}</tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-cream/50">
                    <Td className="font-semibold whitespace-nowrap">{p.product_code}</Td>
                    <Td className="text-muted">{p.manufacturing_code}</Td>
                    <Td>{p.name_tr}</Td>
                    <Td className="text-muted">{p.name_en}</Td>
                    <Td>{p.category}</Td>
                    <Td>{p.unit}</Td>
                    <Td className="text-right tabular-nums whitespace-nowrap">{fmtMoney(p.default_price, p.default_currency)}</Td>
                    <Td className="text-center">{(p.packages || []).length || "—"}</Td>
                    {canEdit && (
                      <Td className="text-right whitespace-nowrap">
                        <button className="p-1.5 text-muted hover:text-navy" onClick={() => setEditing(p)}><Pencil size={15} /></button>
                        <button className="p-1.5 text-muted hover:text-oxblood" onClick={() => remove(p)}><Trash2 size={15} /></button>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </Page>
      {editing && <ProductModal initial={editing} existing={data || []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </>
  );
}

function ProductModal({ initial, existing, onClose, onSaved }: { initial: Partial<Product>; existing: Product[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [p, setP] = useState<Partial<Product>>({ ...initial, packages: initial.packages || [] });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }));
  const setPkg = (i: number, patch: Partial<ProductPackage>) =>
    setP((x) => ({ ...x, packages: (x.packages || []).map((k, j) => (j === i ? { ...k, ...patch } : k)) }));

  const save = async () => {
    if (!p.product_code?.trim() && !p.name_tr?.trim()) return toast("Ürün kodu veya adı zorunlu", "error");
    const code = (p.product_code || "").trim();
    if (code && existing.some((x) => x.id !== p.id && (x.product_code || "").toLowerCase() === code.toLowerCase())) {
      return toast(`${code} kodu başka bir üründe kullanılıyor`, "error");
    }
    setBusy(true);
    const row = { ...p, product_code: code || null };
    delete (row as Record<string, unknown>).created_at;
    delete (row as Record<string, unknown>).updated_at;
    const res = p.id ? await supabase().from("products").update(row).eq("id", p.id) : await supabase().from("products").insert(row);
    setBusy(false);
    if (res.error) return toast(errMsg(res.error), "error");
    toast("Ürün kaydedildi", "success");
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={p.id ? "Ürünü düzenle" : "Yeni ürün"} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Vazgeç</Button><Button onClick={save} loading={busy}>Kaydet</Button></>}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Field label="Ürün kodu"><Input value={p.product_code || ""} onChange={(e) => set("product_code", e.target.value)} autoFocus /></Field>
        <Field label="Üretim kodu"><Input value={p.manufacturing_code || ""} onChange={(e) => set("manufacturing_code", e.target.value)} /></Field>
        <Field label="Kategori"><Input value={p.category || ""} onChange={(e) => set("category", e.target.value)} /></Field>
        <Field label="Birim">
          <Select value={p.unit} onChange={(e) => set("unit", e.target.value)}>{UNITS.map((u) => <option key={u}>{u}</option>)}</Select>
        </Field>
        <Field label="Ürün adı (TR)" className="md:col-span-2"><Input value={p.name_tr || ""} onChange={(e) => set("name_tr", e.target.value)} /></Field>
        <Field label="Ürün adı (EN)" className="md:col-span-2"><Input value={p.name_en || ""} onChange={(e) => set("name_en", e.target.value)} /></Field>
        <Field label="Varsayılan fiyat"><NumberInput value={p.default_price} onChange={(n) => set("default_price", n)} /></Field>
        <Field label="Döviz">
          <Select value={p.default_currency} onChange={(e) => set("default_currency", e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select>
        </Field>
        <Field label="Notlar" className="md:col-span-2"><Textarea value={p.notes || ""} onChange={(e) => set("notes", e.target.value)} className="min-h-[40px]" /></Field>
      </div>

      <div className="flex items-center justify-between mt-5 mb-2">
        <div className="text-sm font-bold">Koliler / paketler</div>
        <Button size="sm" variant="secondary" icon={Plus} onClick={() => set("packages", [...(p.packages || []), { id: newId(), name: "", width: "", depth: "", height: "", grossWeight: "", netWeight: "", quantityPerPackage: 1, notes: "" }])}>Koli ekle</Button>
      </div>
      {(p.packages || []).length === 0 ? <div className="text-sm text-muted">Koli bilgisi yok.</div> : (
        <Table>
          <thead><tr><Th>Koli adı</Th><Th>En</Th><Th>Boy</Th><Th>Yük.</Th><Th>Brüt kg</Th><Th>Net kg</Th><Th>Adet/koli</Th><Th /></tr></thead>
          <tbody>
            {(p.packages || []).map((k, i) => (
              <tr key={k.id}>
                <Td><Input value={k.name} onChange={(e) => setPkg(i, { name: e.target.value })} /></Td>
                {(["width", "depth", "height", "grossWeight", "netWeight"] as const).map((f) => (
                  <Td key={f} className="w-20"><NumberInput value={k[f] === "" ? null : Number(k[f])} onChange={(n) => setPkg(i, { [f]: n } as Partial<ProductPackage>)} /></Td>
                ))}
                <Td className="w-20"><NumberInput value={k.quantityPerPackage} onChange={(n) => setPkg(i, { quantityPerPackage: n || 1 })} /></Td>
                <Td><button className="text-muted hover:text-oxblood" onClick={() => set("packages", (p.packages || []).filter((_, j) => j !== i))}><Trash2 size={15} /></button></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Modal>
  );
}
