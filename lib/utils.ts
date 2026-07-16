import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(value ?? 0);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('tr-TR').format(value ?? 0);
}

/** USD tutarını $1,234.56 biçiminde gösterir. */
export function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value ?? 0);
}

/**
 * Excel'den veya metinden yapıştırılan satırları çözer.
 * Desteklenen formatlar (tab, noktalı virgül veya boşlukla ayrılmış):
 *   "KOD ADET"            → { code: 'KOD', quantity: ADET }
 *   "KOD İSİM ... ADET"   → ilk sütun kod, son sütun sayıysa adet, aradakiler yok sayılır
 *   "KOD"                 → adet 1 kabul edilir
 */
export function parsePastedProductLines(text: string): { code: string; quantity: number }[] {
  const result: { code: string; quantity: number }[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    // Önce tab / noktalı virgül dene (Excel yapıştırması), yoksa boşluk
    let parts = line.split(/\t|;/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) parts = line.split(/\s+/).filter(Boolean);
    if (!parts.length) continue;

    const code = parts[0];
    let quantity = 1;
    if (parts.length >= 2) {
      const last = parts[parts.length - 1].replace(',', '.');
      const n = Number(last);
      if (Number.isFinite(n) && n > 0) quantity = Math.round(n);
    }
    result.push({ code, quantity });
  }
  return result;
}

/** Excel hücresinden ISO tarih (YYYY-MM-DD) üretir: Date, Excel seri no, dd.mm.yyyy veya yyyy-mm-dd kabul eder. */
export function excelCellToISODate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' && v > 20000) {
    // Excel serial date (days since 1900-01-01, offset 25569 to Unix epoch)
    return new Date(Math.round((v - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
  }
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s.slice(0, 10) || new Date().toISOString().slice(0, 10);
}
