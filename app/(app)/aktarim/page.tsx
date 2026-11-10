"use client";
import { useMemo, useState } from "react";
import { Database, Download, Lock, RefreshCw, Trash2, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { Badge, Button, Card, ErrorBox, Field, Input, Loading, Page, PageHeader, Table, Td, Th, cx } from "@/components/ui";
import { useAuth, useToast } from "@/components/providers";
import { useData, q } from "@/lib/hooks";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import { errMsg, fmtMoney, todayTR } from "@/lib/format";
import {
  IMPORT_ORDER, backupToOld, oldOrderFigures, transform,
  type NewData, type OldData, type OldOrderFigures, type TransformResult,
} from "@/lib/migrate";
import type { OrderSummary } from "@/lib/types";

const OLD_TABLES: (keyof OldData)[] = [
  "customers", "products", "bank_accounts", "exchange_rates", "orders", "order_items", "order_shipments",
  "order_additional_costs", "payment_plan_items", "payments", "customer_notes",
];
const TABLE_LABEL: Record<string, string> = {
  exchange_rates: "Kurlar", bank_accounts: "Banka hesapları", customers: "Müşteriler", products: "Ürünler", orders: "Siparişler",
  order_shipments: "Sevkiyatlar", order_items: "Sipariş kalemleri", order_costs: "Ek maliyetler", plan_items: "Ödeme planı kalemleri",
  collections: "Tahsilatlar", customer_notes: "Müşteri notları",
};

async function readOld(url: string, key: string, email: string, password: string, onProgress: (t: string) => void): Promise<OldData> {
  const base = url.replace(/\/+$/, "");
  let bearer = key;
  if (email && password) {
    const r = await fetch(`${base}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error("Eski sisteme giriş yapılamadı: " + (j.error_description || j.msg || r.status));
    bearer = j.access_token;
  }
  const out = {} as OldData;
  for (const t of OLD_TABLES) {
    onProgress(`Okunuyor: ${t}`);
    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; ; offset += 1000) {
      const orderCol = t === "exchange_rates" ? "currency" : "id";
      const r = await fetch(`${base}/rest/v1/${t}?select=*&order=${orderCol}&limit=1000&offset=${offset}`, {
        headers: { apikey: key, Authorization: `Bearer ${bearer}` },
      });
      if (!r.ok) {
        // Bazı eski kurulumlarda customer_notes yok — boş geç
        if (t === "customer_notes" || t === "order_shipments" || t === "order_additional_costs") break;
        throw new Error(`Eski tablo okunamadı (${t}): ${r.status} ${await r.text()}`);
      }
      const page = (await r.json()) as Record<string, unknown>[];
      rows.push(...page);
      if (page.length < 1000) break;
    }
    out[t] = rows;
  }
  return out;
}

interface Recon {
  key: string; customer: string; currency: string;
  oldTotal: number; newTotal: number; oldPaid: number; newPaid: number; oldOpen: number; newOpen: number;
}

export default function MigrationPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [old, setOld] = useState<OldData | null>(null);
  const [result, setResult] = useState<TransformResult | null>(null);
  const [newSums, setNewSums] = useState<OrderSummary[] | null>(null);
  const [showAllWarn, setShowAllWarn] = useState(false);

  const status = useData(async () => {
    const sb = supabase();
    const count = async (t: string) => (await sb.from(t).select("*", { count: "exact", head: true })).count || 0;
    const [customers, orders, collections, lock] = await Promise.all([
      count("customers"), count("orders"), count("collections"),
      q<{ value: unknown }[]>(sb.from("app_settings").select("value").eq("key", "migration_locked")),
    ]);
    return { customers, orders, collections, locked: String(lock[0]?.value) === "true" };
  });

  if (!isAdmin) return <Page><ErrorBox error="Bu sayfa sadece yöneticiler içindir." /></Page>;
  const st = status.data;
  const newEmpty = st ? st.customers + st.orders + st.collections === 0 : false;

  const prepare = (o: OldData) => {
    setOld(o);
    setResult(transform(o, todayTR()));
    setNewSums(null);
  };

  const connect = async () => {
    if (!url || !key) return toast("Eski Supabase adresi ve anon key gerekli", "error");
    setBusy("Bağlanılıyor…");
    try {
      prepare(await readOld(url.trim(), key.trim(), email.trim(), password, setBusy));
      toast("Eski veriler okundu", "success");
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setBusy(null);
    }
  };

  const loadFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      prepare(backupToOld(JSON.parse(await f.text())));
      toast("Yedek dosyası okundu", "success");
    } catch (e) {
      toast("Dosya okunamadı: " + errMsg(e), "error");
    }
  };

  const reset = async () => {
    const t = prompt("Yeni sistemdeki TÜM müşteri, sipariş, tahsilat verisi silinecek (kullanıcılar kalır). Onaylamak için SIFIRLA yaz:");
    if (t !== "SIFIRLA") return;
    setBusy("Sıfırlanıyor…");
    const { error } = await supabase().rpc("migrate_reset", { p_confirm: "SIFIRLA" });
    setBusy(null);
    if (error) return toast(errMsg(error), "error");
    toast("Yeni sistem sıfırlandı", "success");
    setNewSums(null);
    status.reload();
  };

  const runImport = async () => {
    if (!result) return;
    if (!newEmpty) return toast("Yeni sistem boş değil. Önce sıfırla.", "error");
    if (!confirm("Aktarım başlasın mı? Eski sisteme dokunulmaz, sadece okunur.")) return;
    try {
      for (const t of IMPORT_ORDER) {
        const rows = result.data[t as keyof NewData];
        for (let i = 0; i < rows.length; i += 400) {
          setBusy(`Aktarılıyor: ${TABLE_LABEL[t]} ${Math.min(i + 400, rows.length)}/${rows.length}`);
          const { error } = await supabase().rpc("migrate_import", { p_table: t, p_rows: rows.slice(i, i + 400) });
          if (error) throw new Error(`${TABLE_LABEL[t]}: ${error.message}`);
        }
      }
      setBusy("Karşılaştırma hazırlanıyor…");
      setNewSums(await db.orderSummaries());
      toast("Aktarım tamamlandı", "success");
      status.reload();
    } catch (e) {
      toast(errMsg(e) + " — Yeni sistemi sıfırlayıp tekrar deneyebilirsin.", "error");
    } finally {
      setBusy(null);
    }
  };

  const compare = async () => {
    setBusy("Karşılaştırma hazırlanıyor…");
    try { setNewSums(await db.orderSummaries()); } catch (e) { toast(errMsg(e), "error"); }
    setBusy(null);
  };

  const lock = async () => {
    if (!confirm("Aktarım kilitlensin mi? Kilitlendikten sonra sıfırlama ve yeniden aktarım yapılamaz (yanlışlıkla veri silinmesini önler).")) return;
    const { error } = await supabase().from("app_settings").update({ value: true }).eq("key", "migration_locked");
    if (error) return toast(errMsg(error), "error");
    toast("Aktarım kilitlendi", "success");
    status.reload();
  };

  return (
    <>
      <PageHeader title="Veri Aktarımı" subtitle="Eski ihracat sisteminden verileri okur ve yeni sisteme aktarır. Eski sistemde hiçbir şey değişmez." />
      <Page>
        {busy && <div className="sticky top-0 z-20"><Loading text={busy} /></div>}

        <Card title="Yeni sistemin durumu" action={<Button size="sm" variant="secondary" icon={RefreshCw} onClick={status.reload}>Yenile</Button>}>
          {!st ? <Loading /> : (
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span>Müşteri <b>{st.customers}</b></span>
              <span>Sipariş <b>{st.orders}</b></span>
              <span>Tahsilat <b>{st.collections}</b></span>
              {st.locked ? <Badge tone="forest"><Lock size={11} /> Aktarım kilitli</Badge> : newEmpty ? <Badge tone="navy">Boş — aktarıma hazır</Badge> : <Badge tone="copper">Veri var</Badge>}
              {!st.locked && !newEmpty && <Button size="sm" variant="danger" icon={Trash2} onClick={reset}>Yeni sistemi sıfırla</Button>}
              {!st.locked && !newEmpty && <Button size="sm" icon={Lock} onClick={lock}>Aktarımı kilitle</Button>}
            </div>
          )}
        </Card>

        {st?.locked ? (
          <Card><div className="text-sm">Aktarım tamamlanıp kilitlendi. Bu ekranla artık bir işlem yapılamaz. Karşılaştırmayı tekrar görmek istersen eski verileri okuyup "Karşılaştır"a basabilirsin.</div></Card>
        ) : null}

        <Card title="1 · Eski sistemden oku">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Eski Supabase adresi" hint="Eski Vercel projesi → Settings → Environment Variables → VITE_SUPABASE_URL">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
            </Field>
            <Field label="Eski anon key" hint="Aynı yerde: VITE_SUPABASE_ANON_KEY">
              <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGc…" />
            </Field>
            <Field label="Eski sistem e-posta (isteğe bağlı)" hint="Eski veritabanı giriş olmadan okumaya izin vermiyorsa doldur">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Eski sistem şifre (isteğe bağlı)">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <Button icon={Database} onClick={connect} disabled={!!busy}>Bağlan ve oku</Button>
            <span className="text-sm text-muted">veya</span>
            <label className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-line bg-white text-sm font-semibold cursor-pointer hover:bg-cream">
              <Upload size={16} /> Yedek dosyası yükle (.json)
              <input type="file" accept=".json" className="hidden" onChange={(e) => { loadFile(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </div>
          <p className="text-[12px] text-muted mt-2">Önerilen yol "Bağlan ve oku"dur: veriler eski veritabanından ham haliyle okunur. Yedek dosyası, ödemelerin döviz bilgisini eski ekranın gösterdiği haliyle içerir.</p>
        </Card>

        {result && old && (
          <Card title="2 · Önizleme">
            <Table>
              <thead><tr><Th>Tablo</Th><Th className="text-right">Aktarılacak</Th></tr></thead>
              <tbody>
                {IMPORT_ORDER.map((t) => (
                  <tr key={t}><Td>{TABLE_LABEL[t]}</Td><Td className="text-right tabular-nums">{result.data[t as keyof NewData].length}</Td></tr>
                ))}
              </tbody>
            </Table>
            <div className="mt-3 rounded-md bg-cream/70 border border-line px-3 py-2 text-sm space-y-1">
              <div><b>{old.payments.filter((p) => p.status === "paid").length}</b> ödenmiş eski kayıt → tahsilat olarak aktarılacak.</div>
              <div><b>{result.pending.count}</b> "bekleyen" eski kayıt aktarılmayacak ({Object.entries(result.pending.byCurrency).map(([c, v]) => fmtMoney(v, c)).join(", ") || "—"}). Yeni sistemde bekleyen tutar plan − tahsilat olarak hesaplanır; eski sistemdeki çift ön ödeme gibi hatalı kayıtlar böylece temizlenir.</div>
              {result.cancelledPayments > 0 && <div><b>{result.cancelledPayments}</b> iptal edilmiş ödeme kaydı aktarılmayacak.</div>}
            </div>
            {result.warnings.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center gap-2 text-sm font-bold text-copper"><AlertTriangle size={15} /> {result.warnings.length} uyarı (aktarımı engellemez)</div>
                <ul className="mt-1 text-sm list-disc list-inside space-y-0.5">
                  {(showAllWarn ? result.warnings : result.warnings.slice(0, 15)).map((w, i) => <li key={i}><b>{w.kind}:</b> {w.text}</li>)}
                </ul>
                {result.warnings.length > 15 && <button className="text-sm text-navy underline mt-1" onClick={() => setShowAllWarn((x) => !x)}>{showAllWarn ? "Daha az göster" : "Tümünü göster"}</button>}
              </div>
            )}
            {!st?.locked && (
              <div className="flex flex-wrap gap-2 mt-4">
                <Button icon={Database} onClick={runImport} disabled={!!busy || !newEmpty}>3 · Yeni sisteme aktar</Button>
                {!newEmpty && <Button variant="secondary" onClick={compare} disabled={!!busy}>Karşılaştır (aktarılmış veriyle)</Button>}
                {!newEmpty && <span className="text-sm text-muted self-center">Yeni sistemde veri var: tekrar aktarmak için önce sıfırla.</span>}
              </div>
            )}
            {st?.locked && <Button className="mt-4" variant="secondary" onClick={compare} disabled={!!busy}>Karşılaştır</Button>}
          </Card>
        )}

        {old && newSums && <Reconciliation old={oldOrderFigures(old)} sums={newSums} customers={old.customers} />}
      </Page>
    </>
  );
}

function Reconciliation({ old, sums, customers }: { old: OldOrderFigures[]; sums: OrderSummary[]; customers: Record<string, unknown>[] }) {
  const custName = useMemo(() => new Map(customers.map((c) => [String(c.id), String(c.name || "")])), [customers]);
  const newById = useMemo(() => new Map(sums.map((s) => [s.order_id, s])), [sums]);

  const { rows, orderDiffs } = useMemo(() => {
    const m = new Map<string, Recon>();
    const orderDiffs: { o: OldOrderFigures; n?: OrderSummary; dTotal: number; dPaid: number; dOpen: number }[] = [];
    for (const o of old) {
      const n = newById.get(o.order_id);
      const cancelled = o.status === "cancelled";
      const k = `${o.customer_id}|${o.currency}`;
      const r = m.get(k) || { key: k, customer: custName.get(o.customer_id) || n?.customer_name || "?", currency: o.currency, oldTotal: 0, newTotal: 0, oldPaid: 0, newPaid: 0, oldOpen: 0, newOpen: 0 };
      if (!cancelled) { r.oldTotal += o.total; r.newTotal += Number(n?.total || 0); }
      r.oldPaid += o.paid; r.newPaid += Number(n?.collected || 0);
      if (!cancelled) { r.oldOpen += o.open; r.newOpen += Number(n?.open_amount || 0); }
      m.set(k, r);
      const dTotal = Number(n?.total || 0) - o.total, dPaid = Number(n?.collected || 0) - o.paid;
      const dOpen = cancelled ? 0 : Number(n?.open_amount || 0) - o.open;
      if (!n || Math.abs(dTotal) > 0.01 || Math.abs(dPaid) > 0.01 || Math.abs(dOpen) > 0.01) orderDiffs.push({ o, n, dTotal, dPaid, dOpen });
    }
    return { rows: [...m.values()].sort((a, b) => a.customer.localeCompare(b.customer, "tr")), orderDiffs };
  }, [old, newById, custName]);

  const okTotals = rows.every((r) => Math.abs(r.oldTotal - r.newTotal) < 0.02);
  const okPaid = rows.every((r) => Math.abs(r.oldPaid - r.newPaid) < 0.02);

  const downloadCsv = () => {
    const head = "Sipariş;Müşteri;Döviz;Eski toplam;Yeni toplam;Eski tahsil;Yeni tahsil;Eski bekleyen;Yeni bekleyen\n";
    const body = orderDiffs.map(({ o, n }) => [o.order_number, custName.get(o.customer_id) || "", o.currency, o.total, n?.total ?? "", o.paid, n?.collected ?? "", o.open, n?.open_amount ?? ""].join(";")).join("\n");
    const blob = new Blob(["﻿" + head + body], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `aktarim_farklar_${todayTR()}.csv`;
    a.click();
  };

  const cell = (a: number, b: number, cur: string) => (
    <Td className={cx("text-right tabular-nums whitespace-nowrap", Math.abs(a - b) > 0.01 && "bg-[#FBEAEB] text-oxblood font-bold")}>{fmtMoney(b, cur)}</Td>
  );

  return (
    <>
      <Card title="4 · Karşılaştırma (müşteri × döviz)" padded={false} action={
        <div className="flex items-center gap-3 text-sm">
          <span className={okTotals ? "text-forest" : "text-oxblood"}>{okTotals ? <CheckCircle2 size={14} className="inline" /> : <AlertTriangle size={14} className="inline" />} Ciro</span>
          <span className={okPaid ? "text-forest" : "text-oxblood"}>{okPaid ? <CheckCircle2 size={14} className="inline" /> : <AlertTriangle size={14} className="inline" />} Tahsilat</span>
        </div>
      }>
        <div className="px-4 py-3 text-sm text-muted border-b border-line">
          <b>Ciro</b> ve <b>tahsilat</b> sütunları eski sistemle birebir aynı olmalı. <b>Bekleyen</b> sütununda fark olabilir: eski sistemdeki çift/yetim bekleyen kayıtlar yeni sistemde yok, kalan alacak plan − tahsilat olarak hesaplanıyor. Kırmızı hücreleri kontrol et.
        </div>
        <Table>
          <thead><tr><Th>Müşteri</Th><Th>Döviz</Th><Th className="text-right">Eski ciro</Th><Th className="text-right">Yeni ciro</Th><Th className="text-right">Eski tahsil</Th><Th className="text-right">Yeni tahsil</Th><Th className="text-right">Eski bekleyen</Th><Th className="text-right">Yeni bekleyen</Th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <Td className="font-semibold">{r.customer}</Td><Td>{r.currency}</Td>
                <Td className="text-right tabular-nums whitespace-nowrap">{fmtMoney(r.oldTotal, r.currency)}</Td>{cell(r.oldTotal, r.newTotal, r.currency)}
                <Td className="text-right tabular-nums whitespace-nowrap">{fmtMoney(r.oldPaid, r.currency)}</Td>{cell(r.oldPaid, r.newPaid, r.currency)}
                <Td className="text-right tabular-nums whitespace-nowrap">{fmtMoney(r.oldOpen, r.currency)}</Td>{cell(r.oldOpen, r.newOpen, r.currency)}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card title={`Farklı çıkan siparişler (${orderDiffs.length})`} padded={false} action={orderDiffs.length ? <Button size="sm" variant="secondary" icon={Download} onClick={downloadCsv}>CSV indir</Button> : undefined}>
        {orderDiffs.length === 0 ? <div className="p-4 text-sm text-forest font-bold">Tüm siparişler eski sistemle birebir aynı.</div> : (
          <Table>
            <thead><tr><Th>Sipariş</Th><Th>Müşteri</Th><Th className="text-right">Toplam farkı</Th><Th className="text-right">Tahsilat farkı</Th><Th className="text-right">Eski bekleyen</Th><Th className="text-right">Yeni bekleyen</Th><Th>Olası sebep</Th></tr></thead>
            <tbody>
              {orderDiffs.map(({ o, n, dTotal, dPaid, dOpen }) => (
                <tr key={o.order_id}>
                  <Td className="whitespace-nowrap">{n ? <a className="text-navy font-semibold hover:underline" href={`/siparisler/${o.order_id}`}>{n.order_number}</a> : o.order_number}</Td>
                  <Td>{custName.get(o.customer_id) || n?.customer_name}</Td>
                  <Td className={cx("text-right tabular-nums", Math.abs(dTotal) > 0.01 && "text-oxblood font-bold")}>{fmtMoney(dTotal, o.currency)}</Td>
                  <Td className={cx("text-right tabular-nums", Math.abs(dPaid) > 0.01 && "text-oxblood font-bold")}>{fmtMoney(dPaid, o.currency)}</Td>
                  <Td className="text-right tabular-nums">{fmtMoney(o.open, o.currency)}</Td>
                  <Td className="text-right tabular-nums">{fmtMoney(n?.open_amount || 0, o.currency)}</Td>
                  <Td className="text-xs text-muted">
                    {!n ? "Aktarılmadı" : Math.abs(dTotal) > 0.01 ? "Sipariş toplamı farklı — kalemleri kontrol et" : Math.abs(dPaid) > 0.01 ? "Bir tahsilat atlandı (uyarılara bak)" :
                      dOpen < 0 ? "Eski sistemde fazladan bekleyen kayıt vardı (çift/yetim)" : "Eski sistemde planla eşleşmeyen bekleyen tutar vardı"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
