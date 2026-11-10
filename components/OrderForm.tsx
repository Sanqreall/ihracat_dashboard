"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ClipboardPaste, Scissors, Wand2, AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import { Button, Card, Field, Input, Modal, NumberInput, Select, Table, Td, Textarea, Th, cx } from "./ui";
import { SearchPicker } from "./Pickers";
import { PlanStatusBadge } from "./badges";
import { useToast } from "./providers";
import { db } from "@/lib/db";
import { calcTotals, lineTotal } from "@/lib/calc";
import { PRESETS, generatePlan, planCheck, templateError, templateFromCustomer } from "@/lib/plan";
import { CURRENCIES, INCOTERMS, ORDER_STATUSES, PAYMENT_METHODS, PLAN_TYPES, SHIPPING_METHODS, UNITS } from "@/lib/constants";
import { addDays, errMsg, fmtMoney, fmtNum, newId, parseNumber, round2, todayTR } from "@/lib/format";
import type { Customer, CostDraft, ItemDraft, OrderDraft, PlanDraft, PlanStatusRow, PlanTemplate, Product, ShipmentDraft } from "@/lib/types";

interface Props {
  initial: OrderDraft;
  customers: Customer[];
  products: Product[];
  rates: Record<string, number>;
  planStatus?: PlanStatusRow[];
}

export function OrderForm({ initial, customers, products, rates, planStatus = [] }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [d, setD] = useState<OrderDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const isNew = !d.order.id;

  const customer = customers.find((c) => c.id === d.order.customer_id) || null;
  const tot = useMemo(() => calcTotals(d), [d]);
  const check = useMemo(() => planCheck(d), [d]);
  const tpl = d.order.plan_template;
  const tplErr = templateError(tpl);
  const multi = d.shipments.length > 1;
  const paidByPlan = useMemo(() => new Map(planStatus.map((p) => [p.plan_item_id, p])), [planStatus]);

  // ------------------------------------------------------------ setters
  const setOrder = (patch: Partial<OrderDraft["order"]>) => setD((x) => ({ ...x, order: { ...x.order, ...patch } }));
  const setTpl = (patch: Partial<PlanTemplate>) =>
    setD((x) => ({ ...x, order: { ...x.order, plan_template: { ...(x.order.plan_template || templateFromCustomer(customer)), ...patch } } }));
  const setShip = (i: number, patch: Partial<ShipmentDraft>) => setD((x) => ({ ...x, shipments: x.shipments.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const setItem = (i: number, patch: Partial<ItemDraft>) => setD((x) => ({ ...x, items: x.items.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const setCost = (i: number, patch: Partial<CostDraft>) => setD((x) => ({ ...x, costs: x.costs.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const setPlan = (i: number, patch: Partial<PlanDraft>, manual = true) =>
    setD((x) => ({
      ...x,
      // Elle düzenleme yapılınca otomatik plan kapanır (elle girilen değer ezilmesin)
      order: manual && x.order.plan_template?.auto ? { ...x.order, plan_template: { ...x.order.plan_template, auto: false } } : x.order,
      plan: x.plan.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    }));

  // ------------------------------------------------------------ müşteri seçimi
  const pickCustomer = (id: string) => {
    const c = customers.find((x) => x.id === id);
    setD((x) => ({
      ...x,
      order: {
        ...x.order,
        customer_id: id,
        currency: isNew && c ? c.default_currency.trim() : x.order.currency,
        incoterm: isNew && c?.preferred_incoterm ? c.preferred_incoterm : x.order.incoterm,
        plan_template: isNew || !x.order.plan_template ? templateFromCustomer(c) : x.order.plan_template,
      },
    }));
  };

  // ------------------------------------------------------------ otomatik plan
  const sig = JSON.stringify([
    tot.netGoods, tot.vatAmount, tot.costs, tot.costsVat, d.order.payment_basis, d.order.order_date, tpl,
    d.shipments.map((s) => [s.shipment_no, s.name, s.planned_date, s.actual_date]),
    d.costs.map((c) => [c.id, c.amount, c.vat_rate, c.shipment_no, c.description]),
    tot.shipments.map((s) => round2(s.share * 1e6)),
  ]);
  // Mevcut sipariş açılınca plan hemen yeniden hesaplanmasın; sadece bir şey değişince
  const lastSig = useRef<string>(isNew ? "" : sig);
  useEffect(() => {
    if (!tpl?.auto || tplErr) return;
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    setD((x) => ({ ...x, plan: generatePlan(x, x.order.plan_template!, x.plan) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const regenerate = () => {
    const t = d.order.plan_template || templateFromCustomer(customer);
    const err = templateError(t);
    if (err) return toast(err, "error");
    setD((x) => ({ ...x, order: { ...x.order, plan_template: t }, plan: generatePlan({ ...x, order: { ...x.order, plan_template: t } }, t, x.plan) }));
  };

  // ------------------------------------------------------------ sevkiyat
  const addShipment = () => {
    const no = Math.max(0, ...d.shipments.map((s) => s.shipment_no)) + 1;
    setD((x) => ({ ...x, shipments: [...x.shipments, { id: newId(), shipment_no: no, name: "", planned_date: "", actual_date: "", notes: "" }] }));
  };
  const removeShipment = (i: number) => {
    const s = d.shipments[i];
    if (d.shipments.length === 1) return;
    const first = d.shipments.find((x) => x.shipment_no !== s.shipment_no)!;
    const used = d.items.some((it) => it.shipment_no === s.shipment_no) || d.costs.some((c) => c.shipment_no === s.shipment_no) || d.plan.some((p) => p.shipment_no === s.shipment_no);
    if (used && !confirm(`${s.shipment_no}. sevkiyattaki kalemler, maliyetler ve plan kalemleri ${first.shipment_no}. sevkiyata taşınacak. Devam?`)) return;
    setD((x) => ({
      ...x,
      shipments: x.shipments.filter((_, j) => j !== i),
      items: x.items.map((it) => (it.shipment_no === s.shipment_no ? { ...it, shipment_no: first.shipment_no } : it)),
      costs: x.costs.map((c) => (c.shipment_no === s.shipment_no ? { ...c, shipment_no: first.shipment_no } : c)),
      plan: x.plan.map((p) => (p.shipment_no === s.shipment_no ? { ...p, shipment_no: first.shipment_no } : p)),
      order: x.shipments.length - 1 <= 1 ? { ...x.order, payment_basis: "order" } : x.order,
    }));
  };

  // ------------------------------------------------------------ kalemler
  const convertPrice = (price: number, from: string) => {
    const f = rates[from.trim()] ?? (from.trim() === "USD" ? 1 : 0);
    const t = rates[d.order.currency.trim()] ?? (d.order.currency.trim() === "USD" ? 1 : 0);
    if (!f || !t || from.trim() === d.order.currency.trim()) return price;
    return round2((price * f) / t);
  };
  const blankItem = (): ItemDraft => ({
    id: newId(), shipment_no: d.shipments[0]?.shipment_no || 1, product_id: null, product_code: "", manufacturing_code: "",
    name_tr: "", name_en: "", unit: "adet", quantity: 1, unit_price: 0, discount_pct: 0,
  });
  const pickProduct = (i: number, p: Product) => {
    const converted = convertPrice(Number(p.default_price) || 0, p.default_currency);
    setItem(i, {
      product_id: p.id, product_code: p.product_code || "", manufacturing_code: p.manufacturing_code || "",
      name_tr: p.name_tr || "", name_en: p.name_en || "", unit: p.unit || "adet", unit_price: converted,
    });
    if (p.default_currency.trim() !== d.order.currency.trim() && converted !== Number(p.default_price)) {
      toast(`Fiyat ${fmtMoney(p.default_price, p.default_currency)} → ${fmtMoney(converted, d.order.currency)} çevrildi`, "info");
    }
  };
  const splitItem = (i: number) => {
    const it = d.items[i];
    const input = prompt(`${it.name_tr || it.product_code}: toplam ${fmtNum(it.quantity)} ${it.unit}. Ayrılacak miktar?`);
    if (!input) return;
    const part = parseNumber(input);
    if (!(part > 0 && part < it.quantity)) return toast("Miktar 0'dan büyük ve toplamdan küçük olmalı", "error");
    const nextShip = d.shipments.find((s) => s.shipment_no > it.shipment_no)?.shipment_no ?? it.shipment_no;
    setD((x) => {
      const items = [...x.items];
      items[i] = { ...it, quantity: round2(it.quantity - part) };
      items.splice(i + 1, 0, { ...it, id: newId(), quantity: part, shipment_no: nextShip });
      return { ...x, items };
    });
  };
  const applyPaste = (text: string) => {
    const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim());
    const added: ItemDraft[] = [];
    for (const line of lines) {
      const cols = line.split("\t").map((c) => c.trim()); // boş hücreler korunur → sütun kaymaz
      const code = cols[0] || "";
      const prod = products.find((p) => (p.product_code || "").toLowerCase() === code.toLowerCase());
      const base = blankItem();
      // Biçim: Kod | Ad | Adet | Birim fiyat  (ad boşsa ürün kartından gelir; fiyat boşsa ürün fiyatı)
      const qty = cols[2] !== undefined && cols[2] !== "" ? parseNumber(cols[2]) : 1;
      const price = cols[3] !== undefined && cols[3] !== "" ? parseNumber(cols[3]) : prod ? convertPrice(Number(prod.default_price) || 0, prod.default_currency) : 0;
      added.push({
        ...base, product_id: prod?.id || null, product_code: code, manufacturing_code: prod?.manufacturing_code || "",
        name_tr: cols[1] || prod?.name_tr || "", name_en: prod?.name_en || "", unit: prod?.unit || "adet",
        quantity: qty, unit_price: price,
      });
    }
    setD((x) => ({ ...x, items: [...x.items, ...added] }));
    setPasteOpen(false);
    toast(`${added.length} kalem eklendi`, "success");
  };

  // ------------------------------------------------------------ kaydet
  const save = async () => {
    if (!d.order.customer_id) return toast("Müşteri seç", "error");
    if (!d.order.order_date) return toast("Sipariş tarihi gir", "error");
    if (d.items.some((it) => !it.product_code && !it.name_tr)) return toast("Kodu ve adı boş kalem var", "error");
    if (tpl?.auto && tplErr) return toast(tplErr, "error");
    for (const p of d.plan) {
      const st = paidByPlan.get(p.id);
      if (st && p.amount + 0.005 < st.paid) {
        if (!confirm(`Bir plan kaleminin tutarı (${fmtMoney(p.amount, d.order.currency)}) o kaleme sayılan tahsilattan (${fmtMoney(st.paid, d.order.currency)}) düşük. Fazla kısım sonraki kalemlere sayılacak. Devam?`)) return;
        break;
      }
    }
    if (!check.ok && !confirm(`Ödeme planı toplamı sipariş toplamından ${fmtMoney(check.diff, d.order.currency)} farklı. Yine de kaydedilsin mi?`)) return;
    setBusy(true);
    try {
      const id = await db.saveOrder(d);
      toast("Sipariş kaydedildi", "success");
      router.push(`/siparisler/${id}`);
      router.refresh();
    } catch (e) {
      toast(errMsg(e), "error");
      setBusy(false);
    }
  };

  const cur = d.order.currency;

  return (
    <div className="space-y-4 pb-24">
      {/* ------------------------------------------------ GENEL */}
      <Card title="Genel bilgiler">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Field label="Müşteri" required className="md:col-span-2">
            <SearchPicker items={customers.filter((c) => c.is_active || c.id === d.order.customer_id)} value={d.order.customer_id}
              onChange={(id) => pickCustomer(id)} getKey={(c) => c.id} getLabel={(c) => c.name}
              getSub={(c) => [c.code, c.country].filter(Boolean).join(" · ")} placeholder="Müşteri seç…" />
          </Field>
          <Field label="Sipariş no" hint={isNew ? "Boş bırakırsan otomatik verilir" : undefined}>
            <Input value={d.order.order_number} onChange={(e) => setOrder({ order_number: e.target.value })} placeholder="SP-…" />
          </Field>
          <Field label="Durum">
            <Select value={d.order.status} onChange={(e) => setOrder({ status: e.target.value as OrderDraft["order"]["status"] })}>
              {ORDER_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Sipariş tarihi" required><Input type="date" value={d.order.order_date} onChange={(e) => setOrder({ order_date: e.target.value })} /></Field>
          <Field label="Para birimi" hint={!isNew ? "Değişirse tutarlar çevrilmez, sadece döviz değişir" : undefined}>
            <Select value={cur} onChange={(e) => {
              if (!isNew && !confirm("Para birimini değiştirmek tutarları çevirmez; kalem fiyatları ve tahsilatlar yeni döviz cinsinden sayılır. Devam?")) return;
              setOrder({ currency: e.target.value });
            }}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Incoterm">
            <Select value={d.order.incoterm} onChange={(e) => setOrder({ incoterm: e.target.value })}>
              <option value="">—</option>{INCOTERMS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
            </Select>
          </Field>
          <Field label="Taşıma şekli">
            <Select value={d.order.shipping_method} onChange={(e) => setOrder({ shipping_method: e.target.value })}>
              <option value="">—</option>{SHIPPING_METHODS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
            </Select>
          </Field>
          <Field label="Yükleme limanı"><Input value={d.order.port_of_loading} onChange={(e) => setOrder({ port_of_loading: e.target.value })} /></Field>
          <Field label="Varış limanı"><Input value={d.order.port_of_discharge} onChange={(e) => setOrder({ port_of_discharge: e.target.value })} /></Field>
          <Field label="Konşimento (B/L)"><Input value={d.order.bill_of_lading} onChange={(e) => setOrder({ bill_of_lading: e.target.value })} /></Field>
          <Field label="Fatura no"><Input value={d.order.invoice_number} onChange={(e) => setOrder({ invoice_number: e.target.value })} /></Field>
          <Field label="Notlar" className="md:col-span-4"><Textarea value={d.order.notes} onChange={(e) => setOrder({ notes: e.target.value })} className="min-h-[44px]" /></Field>
        </div>
      </Card>

      {/* ------------------------------------------------ SEVKİYATLAR */}
      <Card title="Sevkiyatlar" action={<Button size="sm" variant="secondary" icon={Plus} onClick={addShipment}>Sevkiyat ekle</Button>}>
        <Table>
          <thead><tr><Th>No</Th><Th>Ad</Th><Th>Planlanan sevk</Th><Th>Fiili sevk</Th><Th className="text-right">Tutar</Th><Th>Kur</Th><Th /></tr></thead>
          <tbody>
            {d.shipments.map((s, i) => {
              const sc = tot.shipments.find((x) => x.shipment_no === s.shipment_no);
              return (
                <tr key={s.id}>
                  <Td className="font-bold">{s.shipment_no}</Td>
                  <Td><Input value={s.name} onChange={(e) => setShip(i, { name: e.target.value })} placeholder={`${s.shipment_no}. Sevkiyat`} /></Td>
                  <Td className="w-44"><Input type="date" value={s.planned_date} onChange={(e) => setShip(i, { planned_date: e.target.value })} /></Td>
                  <Td className="w-44"><Input type="date" value={s.actual_date} onChange={(e) => setShip(i, { actual_date: e.target.value })} /></Td>
                  <Td className="text-right tabular-nums whitespace-nowrap">{fmtMoney(sc?.total || 0, cur)}</Td>
                  <Td className="text-xs text-muted whitespace-nowrap">
                    {s.locked_rate_to_usd ? <span className="inline-flex items-center gap-1"><Lock size={11} /> 1 {cur} = {fmtNum(s.locked_rate_to_usd, 4)} USD</span> : s.actual_date ? "kaydedince kilitlenir" : "—"}
                  </Td>
                  <Td>{d.shipments.length > 1 && <button className="text-muted hover:text-oxblood" onClick={() => removeShipment(i)}><Trash2 size={15} /></button>}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <p className="text-[12px] text-muted mt-2">Fiili sevk tarihi girilince o günün kuru kilitlenir; siparişin USD değeri sonradan kur değişse de sabit kalır.</p>
      </Card>

      {/* ------------------------------------------------ KALEMLER */}
      <Card title={`Kalemler (${d.items.length})`} action={
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" icon={ClipboardPaste} onClick={() => setPasteOpen(true)}>Excel'den yapıştır</Button>
          <Button size="sm" icon={Plus} onClick={() => setD((x) => ({ ...x, items: [...x.items, blankItem()] }))}>Kalem ekle</Button>
        </div>
      } padded={false}>
        <Table>
          <thead>
            <tr>
              {multi && <Th>Sevk.</Th>}<Th className="min-w-[220px]">Ürün</Th><Th className="min-w-[160px]">Ad (TR)</Th><Th className="min-w-[140px]">Ad (EN)</Th>
              <Th>Birim</Th><Th className="text-right">Miktar</Th><Th className="text-right">Birim fiyat</Th><Th className="text-right">İsk.%</Th><Th className="text-right">Tutar</Th><Th />
            </tr>
          </thead>
          <tbody>
            {d.items.map((it, i) => (
              <tr key={it.id}>
                {multi && (
                  <Td className="min-w-[84px]">
                    <Select value={it.shipment_no} onChange={(e) => setItem(i, { shipment_no: Number(e.target.value) })}>
                      {d.shipments.map((s) => <option key={s.id} value={s.shipment_no}>{s.shipment_no}</option>)}
                    </Select>
                  </Td>
                )}
                <Td>
                  <SearchPicker items={products} value={it.product_id} onChange={(_, p) => pickProduct(i, p)}
                    getKey={(p) => p.id} getLabel={(p) => `${p.product_code || ""} ${p.name_tr || ""}`.trim()}
                    getSub={(p) => [p.manufacturing_code, fmtMoney(p.default_price, p.default_currency)].filter(Boolean).join(" · ")}
                    renderValue={() => it.product_code || "Ürün seç / kod yaz…"} />
                  <Input className="mt-1 h-8" value={it.product_code} onChange={(e) => setItem(i, { product_code: e.target.value })} placeholder="Kod" />
                </Td>
                <Td><Input value={it.name_tr} onChange={(e) => setItem(i, { name_tr: e.target.value })} /></Td>
                <Td><Input value={it.name_en} onChange={(e) => setItem(i, { name_en: e.target.value })} /></Td>
                <Td className="min-w-[110px]"><Select value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })}>{[...new Set([it.unit, ...UNITS])].map((u) => <option key={u}>{u}</option>)}</Select></Td>
                <Td className="w-24"><NumberInput value={it.quantity} onChange={(n) => setItem(i, { quantity: n })} /></Td>
                <Td className="w-28"><NumberInput value={it.unit_price} onChange={(n) => setItem(i, { unit_price: n })} /></Td>
                <Td className="w-20"><NumberInput value={it.discount_pct} onChange={(n) => setItem(i, { discount_pct: Math.min(100, Math.max(0, n)) })} /></Td>
                <Td className="text-right tabular-nums whitespace-nowrap font-semibold">{fmtMoney(lineTotal(it.quantity, it.unit_price, it.discount_pct), cur)}</Td>
                <Td className="whitespace-nowrap">
                  {multi && <button title="Sevkiyatlara böl" className="p-1 text-muted hover:text-navy" onClick={() => splitItem(i)}><Scissors size={15} /></button>}
                  <button className="p-1 text-muted hover:text-oxblood" onClick={() => setD((x) => ({ ...x, items: x.items.filter((_, j) => j !== i) }))}><Trash2 size={15} /></button>
                </Td>
              </tr>
            ))}
            {d.items.length === 0 && <tr><Td colSpan={10} className="text-center text-muted py-6">Kalem yok — "Kalem ekle" veya "Excel'den yapıştır".</Td></tr>}
          </tbody>
        </Table>
      </Card>

      {/* ------------------------------------------------ KDV / İSKONTO / MALİYET / TOPLAM */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card title="İskonto ve KDV">
          <div className="grid grid-cols-2 gap-3">
            <Field label="İskonto tipi">
              <Select value={d.order.discount_type} onChange={(e) => setOrder({ discount_type: e.target.value as OrderDraft["order"]["discount_type"] })}>
                <option value="none">Yok</option><option value="percentage">Yüzde (%)</option><option value="amount">Tutar</option>
              </Select>
            </Field>
            <Field label={d.order.discount_type === "percentage" ? "İskonto %" : "İskonto tutarı"}>
              <NumberInput value={d.order.discount_value} disabled={d.order.discount_type === "none"} onChange={(n) => setOrder({ discount_value: Math.max(0, n) })} />
            </Field>
            <Field label="KDV %" hint="İhracatta genelde 0"><NumberInput value={d.order.vat_rate} onChange={(n) => setOrder({ vat_rate: Math.max(0, n) })} /></Field>
          </div>
        </Card>

        <Card title="Ek maliyetler" action={<Button size="sm" variant="secondary" icon={Plus} onClick={() => setD((x) => ({ ...x, costs: [...x.costs, { id: newId(), shipment_no: null, description: "", amount: 0, vat_rate: 0 }] }))}>Ekle</Button>}>
          {d.costs.length === 0 ? <div className="text-sm text-muted">Palet, navlun, sigorta vb. yoksa boş bırak.</div> : (
            <div className="space-y-2">
              {d.costs.map((c, i) => (
                <div key={c.id} className="grid grid-cols-12 gap-2 items-center">
                  <Input className="col-span-5" value={c.description} onChange={(e) => setCost(i, { description: e.target.value })} placeholder="Açıklama" />
                  <NumberInput className="col-span-3" value={c.amount} onChange={(n) => setCost(i, { amount: Math.max(0, n) })} />
                  <div className="col-span-3 flex items-center gap-1"><NumberInput value={c.vat_rate} onChange={(n) => setCost(i, { vat_rate: Math.max(0, n) })} /><span className="text-xs text-muted">%KDV</span></div>
                  <button className="col-span-1 text-muted hover:text-oxblood" onClick={() => setD((x) => ({ ...x, costs: x.costs.filter((_, j) => j !== i), plan: x.plan.map((p) => (p.cost_id === c.id ? { ...p, cost_id: null } : p)) }))}><Trash2 size={15} /></button>
                  {multi && (
                    <Select className="col-span-12" selectClassName="py-1 text-xs" value={c.shipment_no ?? ""} onChange={(e) => setCost(i, { shipment_no: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">Sipariş geneli</option>
                      {d.shipments.map((s) => <option key={s.id} value={s.shipment_no}>{s.shipment_no}. sevkiyat</option>)}
                    </Select>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Toplam">
          <dl className="text-sm space-y-1.5">
            <Row k="Ara toplam" v={fmtMoney(tot.subtotal, cur)} />
            {tot.discount > 0 && <Row k="İskonto" v={`− ${fmtMoney(tot.discount, cur)}`} />}
            <Row k="Mal bedeli" v={fmtMoney(tot.netGoods, cur)} />
            {tot.vatAmount > 0 && <Row k={`KDV (%${fmtNum(d.order.vat_rate)})`} v={fmtMoney(tot.vatAmount, cur)} />}
            {tot.costs > 0 && <Row k="Ek maliyet" v={fmtMoney(tot.costs, cur)} />}
            {tot.costsVat > 0 && <Row k="Ek maliyet KDV" v={fmtMoney(tot.costsVat, cur)} />}
            <div className="border-t border-line pt-2 mt-2 flex justify-between text-lg font-bold"><span>Genel toplam</span><span className="tabular-nums">{fmtMoney(tot.total, cur)}</span></div>
          </dl>
        </Card>
      </div>

      {/* ------------------------------------------------ ÖDEME PLANI */}
      <Card title="Ödeme planı" action={
        <div className={cx("flex items-center gap-1.5 text-sm font-bold", check.ok ? "text-forest" : "text-oxblood")}>
          {check.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {check.ok ? "Plan sipariş toplamıyla uyumlu" : `Fark: ${fmtMoney(check.diff, cur)}`}
        </div>
      }>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3 items-end">
          {multi && (
            <Field label="Plan tipi" className="col-span-2">
              <Select value={d.order.payment_basis} onChange={(e) => setOrder({ payment_basis: e.target.value as "order" | "shipment" })}>
                <option value="order">Sipariş bazlı</option><option value="shipment">Sevkiyat bazlı</option>
              </Select>
            </Field>
          )}
          <Field label="Ön ödeme %"><NumberInput value={tpl?.prepPct ?? null} onChange={(n) => setTpl({ prepPct: n })} /></Field>
          <Field label="Sevk öncesi %"><NumberInput value={tpl?.preShipPct ?? null} onChange={(n) => setTpl({ preShipPct: n })} /></Field>
          <Field label="Vadeli %"><NumberInput value={tpl?.defPct ?? null} onChange={(n) => setTpl({ defPct: n })} /></Field>
          <Field label="Vade (gün)"><NumberInput value={tpl?.termDays ?? null} onChange={(n) => setTpl({ termDays: Math.max(0, Math.round(n)) })} /></Field>
          <Field label="Yöntem">
            <Select value={tpl?.method || "bank_transfer"} onChange={(e) => setTpl({ method: e.target.value })}>
              {PAYMENT_METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </Select>
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" onClick={() => setTpl({ ...p.t })}
              className="text-[12px] px-2 py-1 rounded border border-line hover:bg-cream">{p.label}</button>
          ))}
        </div>
        {tplErr && <div className="text-sm text-oxblood font-bold mt-2">{tplErr}</div>}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <Button size="sm" icon={Wand2} onClick={regenerate}>Planı oluştur / yenile</Button>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!tpl?.auto} onChange={(e) => setTpl({ auto: e.target.checked })} />
            Sipariş değişince planı otomatik güncelle
          </label>
          <span className="text-[12px] text-muted">Tahsil edilmiş tutarlar plan değişse de korunur; vadesi en eski kalemden başlayarak yeniden dağıtılır.</span>
        </div>

        <Table className="mt-4">
          <thead>
            <tr><Th>Tip</Th>{multi && <Th>Sevk.</Th>}<Th className="text-right">%</Th><Th className="text-right">Tutar</Th><Th>Vade</Th><Th>Yöntem</Th><Th>Açıklama</Th>{!isNew && <Th>Tahsilat</Th>}<Th /></tr>
          </thead>
          <tbody>
            {d.plan.map((p, i) => {
              const st = paidByPlan.get(p.id);
              return (
                <tr key={p.id}>
                  <Td className="w-44">
                    <Select value={p.type} onChange={(e) => setPlan(i, { type: e.target.value as PlanDraft["type"] })}>
                      {PLAN_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </Select>
                  </Td>
                  {multi && (
                    <Td className="min-w-[104px]">
                      <Select value={p.shipment_no ?? ""} onChange={(e) => setPlan(i, { shipment_no: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">Genel</option>
                        {d.shipments.map((s) => <option key={s.id} value={s.shipment_no}>{s.shipment_no}</option>)}
                      </Select>
                    </Td>
                  )}
                  <Td className="w-24 text-right tabular-nums text-muted">{p.percentage != null ? `%${fmtNum(p.percentage)}` : "—"}</Td>
                  <Td className="w-32"><NumberInput value={p.amount} onChange={(n) => setPlan(i, { amount: Math.max(0, round2(n)), percentage: null })} /></Td>
                  <Td className="w-40"><Input type="date" value={p.due_date} onChange={(e) => setPlan(i, { due_date: e.target.value })} /></Td>
                  <Td className="w-44">
                    <Select value={p.method} onChange={(e) => setPlan(i, { method: e.target.value })}>
                      {PAYMENT_METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </Select>
                  </Td>
                  <Td><Input value={p.notes} onChange={(e) => setPlan(i, { notes: e.target.value })} /></Td>
                  {!isNew && <Td className="whitespace-nowrap text-xs">{st ? <div className="flex flex-col gap-0.5"><PlanStatusBadge status={st.status} /><span className="text-muted">{fmtMoney(st.paid, cur)} tahsil</span></div> : <span className="text-muted">yeni</span>}</Td>}
                  <Td><button className="text-muted hover:text-oxblood" onClick={() => setD((x) => ({ ...x, order: x.order.plan_template ? { ...x.order, plan_template: { ...x.order.plan_template, auto: false } } : x.order, plan: x.plan.filter((_, j) => j !== i) }))}><Trash2 size={15} /></button></Td>
                </tr>
              );
            })}
            {d.plan.length === 0 && <tr><Td colSpan={9} className="text-center text-muted py-6">Plan yok — yüzdeleri girip "Planı oluştur"a bas.</Td></tr>}
          </tbody>
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
          <Button size="sm" variant="secondary" icon={Plus} onClick={() => setD((x) => ({
            ...x,
            order: x.order.plan_template ? { ...x.order, plan_template: { ...x.order.plan_template, auto: false } } : x.order,
            plan: [...x.plan, { id: newId(), type: "other", shipment_no: null, cost_id: null, percentage: null, amount: Math.max(0, check.diff), due_date: addDays(todayTR(), 30), method: tpl?.method || "bank_transfer", notes: "" }],
          }))}>Elle kalem ekle</Button>
          <div className="text-sm text-muted">
            Plan: mal {fmtMoney(check.goods, cur)}{check.vat ? ` · KDV ${fmtMoney(check.vat, cur)}` : ""}{check.cost ? ` · maliyet ${fmtMoney(check.cost, cur)}` : ""} · <b className="text-ink">toplam {fmtMoney(check.all, cur)}</b>
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------ KAYDET ÇUBUĞU */}
      <div className="fixed bottom-0 left-0 md:left-[var(--sb-w,248px)] right-0 z-30 bg-white/95 backdrop-blur border-t border-line px-4 md:px-8 py-3 flex items-center justify-between gap-3">
        <div className="text-sm">
          <b>{customer?.name || "Müşteri seçilmedi"}</b> · {fmtMoney(tot.total, cur)}
          {!check.ok && <span className="text-oxblood font-bold"> · plan farkı {fmtMoney(check.diff, cur)}</span>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => router.back()}>Vazgeç</Button>
          <Button onClick={save} loading={busy}>Kaydet</Button>
        </div>
      </div>

      {pasteOpen && <PasteModal onClose={() => setPasteOpen(false)} onApply={applyPaste} />}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><dt className="text-muted">{k}</dt><dd className="tabular-nums">{v}</dd></div>;
}

function PasteModal({ onClose, onApply }: { onClose: () => void; onApply: (t: string) => void }) {
  const [text, setText] = useState("");
  return (
    <Modal open onClose={onClose} title="Excel'den kalem yapıştır"
      footer={<><Button variant="secondary" onClick={onClose}>Vazgeç</Button><Button onClick={() => onApply(text)} disabled={!text.trim()}>Ekle</Button></>}>
      <p className="text-sm text-muted mb-2">
        Excel'de şu sırayla 4 sütun seçip kopyala ve buraya yapıştır: <b>Ürün kodu · Ürün adı · Miktar · Birim fiyat</b>.
        Ad veya fiyat boşsa ürün kartındaki değer kullanılır. Sayılarda "1.250,50" ve "1250.50" ikisi de olur.
      </p>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[220px] font-mono text-xs" placeholder={"MS-001\tMasa\t10\t250\nSN-002\t\t40\t"} />
    </Modal>
  );
}
