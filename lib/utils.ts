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
