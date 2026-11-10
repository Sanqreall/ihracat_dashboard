"use client";
import { useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { Button, Card, ErrorBox, Loading, NumberInput, Page, PageHeader, Table, Td, Th } from "@/components/ui";
import { useAuth, useToast } from "@/components/providers";
import { useData, q } from "@/lib/hooks";
import { supabase } from "@/lib/supabase/client";
import { CURRENCIES } from "@/lib/constants";
import { errMsg, fmtDate, fmtNum, todayTR } from "@/lib/format";
import { updateRatesFromTCMB } from "@/lib/rates";

interface RateRow { currency: string; rate_to_usd: number; rate_date: string; source: string | null }

export default function RatesPage() {
  const { canEdit } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useData(async () => {
    const latest = await q<RateRow[]>(supabase().from("v_latest_rates").select("*"));
    return latest;
  });
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState<Record<string, number>>({});

  const fetchTCMB = async () => {
    setBusy(true);
    try {
      const r = await updateRatesFromTCMB();
      toast(`TCMB kurları kaydedildi (${fmtDate(r.date)})`, "success");
      reload();
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const saveManual = async () => {
    const rows = Object.entries(manual).filter(([, v]) => v > 0).map(([currency, rate_to_usd]) => ({ rate_date: todayTR(), currency, rate_to_usd, source: "Elle" }));
    if (!rows.length) return toast("0'dan büyük bir kur gir", "error");
    const { error } = await supabase().from("exchange_rates").upsert(rows, { onConflict: "rate_date,currency" });
    if (error) return toast(errMsg(error), "error");
    setManual({});
    toast("Kurlar kaydedildi", "success");
    reload();
  };

  const byCur = new Map((data || []).map((r) => [r.currency.trim(), r]));

  return (
    <>
      <PageHeader title="Döviz Kurları" subtitle="USD bazlı: 1 birim döviz = X USD. Geçmiş kurlar saklanır; sevk edilen sipariş ve tahsilatlar kendi günündeki kurla hesaplanır.">
        {canEdit && <Button icon={RefreshCw} loading={busy} onClick={fetchTCMB}>TCMB'den güncelle</Button>}
      </PageHeader>
      <Page>
        {error && <ErrorBox error={error} onRetry={reload} />}
        <Card padded={false} className="max-w-3xl">
          {loading ? <Loading /> : (
            <Table>
              <thead><tr><Th>Döviz</Th><Th className="text-right">1 birim = USD</Th><Th className="text-right">1 USD = birim</Th><Th>Tarih</Th><Th>Kaynak</Th>{canEdit && <Th>Elle gir (bugün)</Th>}</tr></thead>
              <tbody>
                <tr><Td className="font-bold">USD</Td><Td className="text-right">1</Td><Td className="text-right">1</Td><Td>—</Td><Td>sabit</Td>{canEdit && <Td />}</tr>
                {CURRENCIES.filter((c) => c !== "USD").map((c) => {
                  const r = byCur.get(c);
                  return (
                    <tr key={c}>
                      <Td className="font-bold">{c}</Td>
                      <Td className="text-right tabular-nums">{r ? fmtNum(r.rate_to_usd, 6) : <span className="text-oxblood">kur yok</span>}</Td>
                      <Td className="text-right tabular-nums">{r ? fmtNum(1 / Number(r.rate_to_usd), 4) : "—"}</Td>
                      <Td>{fmtDate(r?.rate_date)}</Td>
                      <Td>{r?.source || "—"}</Td>
                      {canEdit && <Td className="w-40"><NumberInput value={manual[c] ?? null} onChange={(n) => setManual((m) => ({ ...m, [c]: n }))} placeholder="ör. 1,08" /></Td>}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
        {canEdit && Object.values(manual).some((v) => v > 0) && <Button icon={Save} onClick={saveManual}>Elle girilen kurları kaydet</Button>}
      </Page>
    </>
  );
}
