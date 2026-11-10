// TCMB kurlarını sunucu tarafında çeker (tarayıcıdan doğrudan erişim CORS'a takılır).
// Dönen değerler USD bazlıdır: { rates: { EUR: 1.08, TRY: 0.025, ... }, date: "2026-11-09" }
// Hafta sonu / tatilde bugünün dosyası yoksa geriye doğru en fazla 7 gün arar.
import { NextResponse } from "next/server";

export const revalidate = 3600;

function parse(xml: string) {
  const out: Record<string, number> = {};
  const dateMatch = xml.match(/Tarih_Date[^>]*Date="(\d{2})\/(\d{2})\/(\d{4})"/);
  const date = dateMatch ? `${dateMatch[3]}-${dateMatch[1]}-${dateMatch[2]}` : null;
  const blocks = xml.match(/<Currency[^>]*>[\s\S]*?<\/Currency>/g) || [];
  for (const b of blocks) {
    const code = b.match(/CurrencyCode="([A-Z]{3})"/)?.[1];
    if (!code) continue;
    const unit = parseInt(b.match(/<Unit>(\d+)<\/Unit>/)?.[1] || "1", 10) || 1;
    const sell = parseFloat(b.match(/<ForexSelling>([\d.]+)<\/ForexSelling>/)?.[1] || "0");
    const buy = parseFloat(b.match(/<ForexBuying>([\d.]+)<\/ForexBuying>/)?.[1] || "0");
    const avg = sell > 0 && buy > 0 ? (sell + buy) / 2 : sell || buy;
    if (avg > 0) out[code] = avg / unit; // 1 birim = X TRY
  }
  return { tryRates: out, date };
}

function urlFor(d: Date) {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `https://www.tcmb.gov.tr/kurlar/${yyyy}${mm}/${dd}${mm}${yyyy}.xml`;
}

export async function GET() {
  const urls = ["https://www.tcmb.gov.tr/kurlar/today.xml"];
  const now = new Date(Date.now() + 3 * 3600 * 1000); // Türkiye saati
  for (let i = 1; i <= 7; i++) urls.push(urlFor(new Date(now.getTime() - i * 86400000)));

  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 (IhracatYonetim/4.0)" }, cache: "no-store" });
      if (!r.ok) continue;
      const { tryRates, date } = parse(await r.text());
      const usdTry = tryRates.USD;
      if (!usdTry) continue;
      const rates: Record<string, number> = { USD: 1, TRY: 1 / usdTry };
      for (const [code, tr] of Object.entries(tryRates)) {
        if (code !== "USD") rates[code] = tr / usdTry;
      }
      return NextResponse.json({ rates, date, source: "TCMB" });
    } catch {
      // sonraki tarihi dene
    }
  }
  return NextResponse.json({ error: "TCMB'den kur alınamadı" }, { status: 502 });
}
