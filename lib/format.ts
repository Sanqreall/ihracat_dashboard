// Biçimlendirme ve tarih yardımcıları — tüm tarihler Türkiye saatine göre.

const fmtCache = new Map<string, Intl.NumberFormat>();

export function fmtMoney(value: number | string | null | undefined, currency = "USD", digits = 2): string {
  const n = Number(value) || 0;
  const cur = (currency || "USD").toUpperCase();
  const key = `${cur}:${digits}`;
  let f = fmtCache.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat("tr-TR", { style: "currency", currency: cur, minimumFractionDigits: digits, maximumFractionDigits: digits });
    } catch {
      // Geçersiz para birimi kodu çökertmesin
      f = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    }
    fmtCache.set(key, f);
  }
  const s = f.format(n);
  return f.resolvedOptions().style === "currency" ? s : `${s} ${cur}`;
}

export function fmtNum(value: number | string | null | undefined, digits = 2): string {
  const n = Number(value) || 0;
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export function fmtPct(value: number | string | null | undefined): string {
  return `%${fmtNum(value, 2)}`;
}

// "YYYY-MM-DD" → "09.11.2026" (saat dilimi kayması olmadan)
export function fmtDate(d?: string | null): string {
  if (!d) return "—";
  const m = String(d).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(d);
}

export function fmtDateTime(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short" });
}

// Türkiye saatine göre bugün — "YYYY-MM-DD"
export function todayTR(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

// Takvim günü ekleme — saat diliminden bağımsız (UTC üzerinde gün aritmetiği)
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function addMonths(iso: string, n: number): string {
  const [y, m] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const ta = Date.parse(a.slice(0, 10) + "T00:00:00Z");
  const tb = Date.parse(b.slice(0, 10) + "T00:00:00Z");
  return Math.round((tb - ta) / 86400000);
}

export function monthKey(iso?: string | null): string {
  return iso ? iso.slice(0, 7) : "";
}

const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
export function fmtMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return m ? `${AYLAR[m - 1]} ${y}` : key;
}

// Excel/yapıştırma için akıllı sayı okuma: "1.234,56" / "1,234.56" / "1234,56" / "1234.56"
export function parseNumber(input: unknown): number {
  if (typeof input === "number") return isFinite(input) ? input : 0;
  if (input === null || input === undefined) return 0;
  let s = String(input).trim().replace(/[^\d,.\-]/g, "");
  if (!s) return 0;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (hasComma) {
    // TR: virgül ondalıktır ("12,5" → 12.5). Birden çok virgül → EN binlik ("1,250,000").
    s = (s.match(/,/g) || []).length > 1 ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (hasDot) {
    // "1.250" / "1.250.000" (TR binlik) → binlik; "0.125" / "12.5" → ondalık
    if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  }
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().replace(/-/g, "");
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function errMsg(e: unknown): string {
  if (!e) return "Bilinmeyen hata";
  if (typeof e === "string") return e;
  const anyE = e as { message?: string; details?: string; hint?: string; code?: string };
  let m = anyE.message || String(e);
  if (anyE.code === "23503") m = "Bu kayıt başka kayıtlarda kullanılıyor (ör. siparişi olan müşteri). Silinemez.";
  if (anyE.code === "23505") m = "Bu kod/numara zaten kullanılıyor.";
  if (anyE.code === "42501" || /row-level security/i.test(m)) m = "Bu işlem için yetkiniz yok.";
  return m;
}
