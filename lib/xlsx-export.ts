'use client';

import * as XLSX from 'xlsx';

export interface ExcelSheet {
  name: string;
  columns: string[];               // başlık satırı
  rows: (string | number)[][];     // veri satırları
}

/** Bir veya birden çok sayfayı .xlsx olarak dışa aktarır ve indirir. */
export function exportExcel(fileName: string, sheets: ExcelSheet[]) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const aoa = [sheet.columns, ...sheet.rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // basit kolon genişliği
    ws['!cols'] = sheet.columns.map((c) => ({ wch: Math.max(12, c.length + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}
