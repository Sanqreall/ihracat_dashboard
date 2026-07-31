'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DEJAVU_REGULAR, DEJAVU_BOLD } from './dejavu-font';

/** Gömülü DejaVuSans fontunu jsPDF'e yükler (Türkçe karakterler ı ş ğ İ ö ü ç için). */
function registerFont(doc: jsPDF) {
  doc.addFileToVFS('DejaVuSans.ttf', DEJAVU_REGULAR);
  doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
  doc.addFileToVFS('DejaVuSans-Bold.ttf', DEJAVU_BOLD);
  doc.addFont('DejaVuSans-Bold.ttf', 'DejaVuSans', 'bold');
}

export type ReportColumn = { header: string; align?: 'left' | 'right' | 'center'; width?: number };

export interface PdfReportOptions {
  title: string;
  subtitle?: string;
  columns: ReportColumn[];
  rows: (string | number)[][];
  summary?: string;          // tablo üstünde tek satır özet
  footerNote?: string;       // her sayfa altında not
  orientation?: 'portrait' | 'landscape';
  fileName?: string;         // verilirse otomatik indirir
}

/** Genel amaçlı, Türkçe destekli tablo raporu PDF'i üretir ve indirir. */
export function generateReportPdf(opts: PdfReportOptions) {
  const doc = new jsPDF({ orientation: opts.orientation ?? 'portrait', unit: 'mm', format: 'a4' });
  registerFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  const now = new Date();
  const dateStr = now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  doc.setFont('DejaVuSans', 'bold');
  doc.setFontSize(16);
  doc.text(opts.title, marginX, 18);

  doc.setFont('DejaVuSans', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`${dateStr} ${timeStr}`, pageWidth - marginX, 18, { align: 'right' });

  let cursorY = 24;
  if (opts.subtitle) {
    doc.setFontSize(11);
    doc.setTextColor(60);
    doc.text(opts.subtitle, marginX, cursorY);
    cursorY += 6;
  }
  if (opts.summary) {
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(opts.summary, marginX, cursorY);
    cursorY += 4;
  }
  doc.setTextColor(0);

  const columnStyles: Record<number, any> = {};
  opts.columns.forEach((c, i) => {
    columnStyles[i] = { halign: c.align ?? 'left', ...(c.width ? { cellWidth: c.width } : {}) };
  });

  autoTable(doc, {
    startY: cursorY + 2,
    head: [opts.columns.map((c) => c.header)],
    body: opts.rows.map((r) => r.map((v) => String(v))),
    styles: { font: 'DejaVuSans', fontSize: 9, cellPadding: 2, lineColor: [220, 220, 220], lineWidth: 0.1 },
    headStyles: { font: 'DejaVuSans', fontStyle: 'bold', fillColor: [40, 40, 40], textColor: 255, halign: 'left' },
    alternateRowStyles: { fillColor: [247, 247, 247] },
    columnStyles,
    margin: { left: marginX, right: marginX },
    didDrawPage: () => {
      if (opts.footerNote) {
        const h = doc.internal.pageSize.getHeight();
        doc.setFont('DejaVuSans', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(opts.footerNote, marginX, h - 8);
        doc.setTextColor(0);
      }
    },
  });

  if (opts.fileName) {
    doc.save(opts.fileName.endsWith('.pdf') ? opts.fileName : `${opts.fileName}.pdf`);
  }
  return doc;
}
