"use client";
import { supabase } from "./supabase/client";
import { CURRENCIES } from "./constants";
import { todayTR } from "./format";

export async function updateRatesFromTCMB(): Promise<{ date: string; count: number }> {
  const r = await fetch("/api/tcmb", { cache: "no-store" });
  const j = await r.json();
  if (!r.ok || !j.rates) throw new Error(j.error || "TCMB'den kur alınamadı");
  const date = j.date || todayTR();
  const rows = Object.entries(j.rates as Record<string, number>)
    .filter(([cur, v]) => cur !== "USD" && v > 0 && (CURRENCIES as readonly string[]).includes(cur))
    .map(([currency, rate_to_usd]) => ({ rate_date: date, currency, rate_to_usd, source: "TCMB" }));
  const { error } = await supabase().from("exchange_rates").upsert(rows, { onConflict: "rate_date,currency" });
  if (error) throw error;
  return { date, count: rows.length };
}
