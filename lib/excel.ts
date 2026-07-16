import * as XLSX from 'xlsx';

/** Dışa aktarımda içe aktarılabilir kalem sayfasına verdiğimiz ad. */
export const IMPORT_SHEET_NAME = 'Kalemler (İçe Aktarılabilir)';

/**
 * Bir çalışma kitabından içe aktarılacak sayfayı seçer.
 *
 * Dışa aktarım dosyalarımız iki sayfalıdır: ilk sayfa insan-okur özet,
 * ikinci sayfa şablonla birebir aynı kolonlara sahip "içe aktarılabilir"
 * sayfadır. Eskiden import her zaman ilk sayfayı okuduğu için kendi
 * çıktımızı geri yükleyemiyorduk.
 *
 * Sıra:
 *   1. Adı IMPORT_SHEET_NAME olan sayfa
 *   2. Adında "içe aktar" geçen herhangi bir sayfa (küçük/büyük harf duyarsız)
 *   3. Adı "Şablon" olan sayfa
 *   4. Beklenen kolonlardan en az birini içeren ilk sayfa
 *   5. İlk sayfa
 */
export function pickImportSheet(wb: XLSX.WorkBook, expectedHeaders: string[] = []): XLSX.WorkSheet {
  const names = wb.SheetNames;

  const exact = names.find((n) => n === IMPORT_SHEET_NAME);
  if (exact) return wb.Sheets[exact];

  const fuzzy = names.find((n) => n.toLocaleLowerCase('tr').includes('içe aktar'));
  if (fuzzy) return wb.Sheets[fuzzy];

  const template = names.find((n) => n.toLocaleLowerCase('tr') === 'şablon');
  if (template) return wb.Sheets[template];

  if (expectedHeaders.length) {
    const wanted = expectedHeaders.map((h) =>
      h.replace(/\(.*?\)/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr')
    );
    for (const name of names) {
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: null });
      if (!rows.length) continue;
      const headers = Object.keys(rows[0]).map((h) =>
        h.replace(/\(.*?\)/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr')
      );
      if (wanted.some((h) => headers.includes(h))) return wb.Sheets[name];
    }
  }

  return wb.Sheets[names[0]];
}

/** Yüklenen dosyayı okuyup doğru sayfadan satırları döndürür. */
export async function readImportRows(
  file: File,
  expectedHeaders: string[] = []
): Promise<Record<string, any>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: true });
  const sheet = pickImportSheet(wb, expectedHeaders);
  return XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null });
}

/**
 * Başlık adını normalize eder: boşlukları kırpar, küçük harfe indirir,
 * parantez içini ve noktalama işaretlerini atar.
 *   "Emir No (Lot)" → "emir no"
 *   " EMİR NO  "    → "emir no"
 */
function normalizeHeader(header: string): string {
  return header
    .replace(/\(.*?\)/g, ' ')     // parantez içi
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // noktalama
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('tr');
}

/**
 * Bir satırdan alan okur. Verilen adların HERHANGİ biri (normalize edilmiş
 * halde) eşleşirse değeri döndürür. Böylece kullanıcı "Emir No", "Emir No (Lot)"
 * veya "LOT NO" yazmış olsa da aynı alan bulunur.
 */
export function getField(row: Record<string, any>, ...names: string[]): any {
  // Önce birebir eşleşme (hızlı yol)
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') return row[name];
  }
  // Sonra normalize edilmiş eşleşme
  const wanted = names.map(normalizeHeader);
  for (const key of Object.keys(row)) {
    if (wanted.includes(normalizeHeader(key))) {
      const v = row[key];
      if (v !== undefined && v !== null && v !== '') return v;
    }
  }
  return undefined;
}

/** getField'in metin sürümü: kırpılmış string veya undefined. */
export function getText(row: Record<string, any>, ...names: string[]): string | undefined {
  const v = getField(row, ...names);
  if (v === undefined) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

/** getField'in sayı sürümü: geçersizse fallback. */
export function getNumber(row: Record<string, any>, names: string[], fallback = 0): number {
  const v = getField(row, ...names);
  if (v === undefined) return fallback;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}
