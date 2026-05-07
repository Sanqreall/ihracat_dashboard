/**
 * EXPORT-FLOW · İhracat Yönetim Sistemi
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  LayoutDashboard, Package, FileText, CreditCard, TrendingUp, Settings,
  Plus, Pencil, Trash2, Search, X, Check, ArrowUp, ArrowDown, ArrowUpDown,
  Calendar, DollarSign, AlertCircle, ChevronDown, ChevronRight, ChevronLeft,
  Eye, Save, RefreshCw, FileDown, FileUp, Globe, Users, Wallet, Clock,
  CheckCircle2, XCircle, AlertTriangle, BarChart3, Building2, Landmark,
  Ship, Plane, Truck, FileCheck, Banknote, Receipt, Anchor, ShieldCheck,
  Cloud, CloudOff, Lock, ArrowRight, Sparkles, MapPin, Phone, Mail,
  TrendingDown, Activity, Star, Award, Hash, Languages
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart,
  RadialBarChart, RadialBar,
} from "recharts";
import * as XLSX from "xlsx";

// ============================================================================
// DİL SÖZLÜĞÜ (i18n)
// ============================================================================
const DICT = {
  tr: {
    dashboard: "Gösterge Paneli",
    orders: "Siparişler",
    payments: "Ödemeler",
    cashflow: "Nakit Akışı",
    customers: "Müşteriler",
    products: "Ürünler",
    reports: "Raporlar",
    settings: "Ayarlar",
    general: "Genel",
    operation: "Operasyon",
    records: "Kayıtlar",
    analysis: "Analiz",
    system: "Sistem",
    // PDF & Genel Terimler
    customerList: "Müşteri Listesi",
    overdueTotal: "Gecikmiş Toplam Bakiye",
    openBalance: "Açık Bakiye",
    revenueUSD: "Ciro (USD)",
    customer: "Müşteri",
    order: "Sipariş",
    date: "Tarih",
    invoice: "Fatura",
    additionalCost: "İlave Maliyetler",
    code: "Kod",
    country: "Ülke",
    totalOrders: "Toplam Sipariş",
    printPDF: "Yazdır / PDF Kaydet",
    reportDate: "Hazırlanma Tarihi",
    accountStatement: "HESAP EKSTRESİ",
    item: "Kalem",
    qty: "Miktar",
    price: "Fiyat",
    total: "Tutar",
    subtotal: "Ara Toplam",
    grandTotal: "Genel Toplam",
    discount: "İskonto",
    vat: "KDV",
    status: "Durum",
    paymentPlan: "Ödeme Planı",
    paymentHistory: "Tahsilat Hareketi",
    collected: "Tahsil Edilen",
    remaining: "Kalan",
    shipped: "Sevk Edildi",
    pending: "Bekliyor",
    overdue: "Gecikmiş",
    paid: "Ödendi",
  },
  en: {
    dashboard: "Dashboard",
    orders: "Orders",
    payments: "Payments",
    cashflow: "Cash Flow",
    customers: "Customers",
    products: "Products",
    reports: "Reports",
    settings: "Settings",
    general: "General",
    operation: "Operation",
    records: "Records",
    analysis: "Analysis",
    system: "System",
    // PDF & Genel Terimler
    customerList: "Customer List",
    overdueTotal: "Total Overdue Balance",
    openBalance: "Open Balance",
    revenueUSD: "Revenue (USD)",
    customer: "Customer",
    order: "Order",
    date: "Date",
    invoice: "Invoice",
    additionalCost: "Additional Costs",
    code: "Code",
    country: "Country",
    totalOrders: "Total Orders",
    printPDF: "Print / Save PDF",
    reportDate: "Report Date",
    accountStatement: "ACCOUNT STATEMENT",
    item: "Item",
    qty: "Qty",
    price: "Price",
    total: "Total",
    subtotal: "Subtotal",
    grandTotal: "Grand Total",
    discount: "Discount",
    vat: "VAT",
    status: "Status",
    paymentPlan: "Payment Plan",
    paymentHistory: "Payment History",
    collected: "Collected",
    remaining: "Remaining",
    shipped: "Shipped",
    pending: "Pending",
    overdue: "Overdue",
    paid: "Paid",
  }
};

const t = (key, lang = "tr") => DICT[lang]?.[key] || key;

// ============================================================================
// TASARIM SİSTEMİ — RENKLER, FONT, BOYUT
// ============================================================================
const TOKENS = {
  bg: "#F8F5EE",
  ink: "#0F1A2E",
  navy: "#1E3A5F",
  gold: "#C9A961",
  goldDark: "#A88947",
  copper: "#B87333",
  cream: "#F4EFE3",
  border: "#E6DFCE",
  muted: "#7A736A",
  forest: "#3E7D5A",
  terracotta: "#C77847",
  oxblood: "#A6383D",
};

const ensureFonts = () => {
  if (document.getElementById("ef-fonts")) return;
  const link = document.createElement("link");
  link.id = "ef-fonts";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Carlito:wght@400;700&display=swap";
  document.head.appendChild(link);
};

const FONT_DISPLAY = 'Calibri, "Carlito", "Segoe UI", -apple-system, sans-serif';
const FONT_BODY = 'Calibri, "Carlito", "Segoe UI", -apple-system, sans-serif';

// ============================================================================
// VERİ DEPOSU
// ============================================================================
function createStorage() {
  if (typeof window !== "undefined" && window.storage && typeof window.storage.get === "function") {
    return {
      mode: "shared", label: "Paylaşımlı (artifact)",
      async get(key) { try { const r = await window.storage.get(key, true); return r ? JSON.parse(r.value) : null; } catch { return null; } },
      async set(key, value) { try { await window.storage.set(key, JSON.stringify(value), true); } catch (e) { console.error(e); } },
    };
  }
  const supaUrl = typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL;
  const supaKey = typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY;
  if (supaUrl && supaKey) {
    const supabase = createSupabaseClient(supaUrl, supaKey);
    return {
      mode: "cloud", label: "Bulut (Supabase)",
      async get(key) {
        try {
          const r = await supabase.from("data").select("value").eq("key", key).maybeSingle();
          if (r.error) { try { return JSON.parse(localStorage.getItem(`exportflow:${key}`)); } catch { return null; } }
          if (r.data?.value !== undefined) { try { localStorage.setItem(`exportflow:${key}`, JSON.stringify(r.data.value)); } catch {} }
          return r.data?.value ?? null;
        } catch (e) { return null; }
      },
      async set(key, value) {
        try { localStorage.setItem(`exportflow:${key}`, JSON.stringify(value)); } catch {}
        await supabase.from("data").upsert({ key, value }, { onConflict: "key" });
      },
    };
  }
  return {
    mode: "local", label: "Yerel (sadece bu cihaz)",
    async get(key) { try { return JSON.parse(localStorage.getItem(`exportflow:${key}`)); } catch { return null; } },
    async set(key, value) { try { localStorage.setItem(`exportflow:${key}`, JSON.stringify(value)); } catch (e) { console.error(e); } },
  };
}

function createSupabaseClient(url, key) {
  const buildHeaders = async () => {
    const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    try { const token = await getValidAuthToken(); if (token) headers.Authorization = `Bearer ${token}`; } catch {}
    return headers;
  };
  return {
    from(table) {
      const q = { _select: "*", _filters: [] };
      const builder = {
        select(cols) { q._select = cols || "*"; return builder; },
        eq(col, val) { q._filters.push(`${col}=eq.${encodeURIComponent(val)}`); return builder; },
        async maybeSingle() {
          const filterStr = q._filters.join("&");
          const fullUrl = `${url}/rest/v1/${table}?select=${q._select}${filterStr ? "&" + filterStr : ""}&limit=1`;
          try {
            const headers = await buildHeaders();
            const r = await fetch(fullUrl, { headers });
            if (!r.ok) return { data: null, error: { status: r.status } };
            const d = await r.json();
            return { data: Array.isArray(d) && d.length ? d[0] : null, error: null };
          } catch (e) { return { data: null, error: e }; }
        },
        async upsert(obj, opts) {
          const conflict = opts?.onConflict ? `?on_conflict=${opts.onConflict}` : "";
          try {
            const headers = await buildHeaders();
            const r = await fetch(`${url}/rest/v1/${table}${conflict}`, {
              method: "POST", headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
              body: JSON.stringify(obj),
            });
            if (!r.ok) return { error: { status: r.status } };
            return { error: null };
          } catch (e) { return { error: e }; }
        },
      };
      return builder;
    },
  };
}

const storage = createStorage();

// ============================================================================
// SABİTLER
// ============================================================================
const CURRENCIES = ["USD", "EUR", "TRY", "GBP", "CHF", "JPY", "CNY", "RUB", "AED", "SAR"];
const DEFAULT_RATES = { USD: 1, EUR: 1.08, GBP: 1.27, CHF: 1.13, TRY: 0.031, JPY: 0.0067, CNY: 0.14, RUB: 0.011, AED: 0.27, SAR: 0.27 };
const INCOTERMS = [ { key: "EXW", label: "EXW — İş Yerinde Teslim" }, { key: "FCA", label: "FCA — Taşıyıcıya Teslim" }, { key: "FOB", label: "FOB — Gemi Bordasında Teslim" }, { key: "CFR", label: "CFR — Mal Bedeli + Navlun" }, { key: "CIF", label: "CIF — Mal Bedeli + Sigorta + Navlun" }, { key: "CPT", label: "CPT — Taşıma Ödenmiş Olarak" }, { key: "CIP", label: "CIP — Taşıma + Sigorta Ödenmiş" }, { key: "DAP", label: "DAP — Belirli Yerde Teslim" }, { key: "DPU", label: "DPU — Boşaltılmış Teslim" }, { key: "DDP", label: "DDP — Gümrüklü Teslim" } ];
const SHIPPING_METHODS = [ { key: "sea", label: "Deniz Yolu", icon: Ship }, { key: "air", label: "Hava Yolu", icon: Plane }, { key: "road", label: "Kara Yolu", icon: Truck }, { key: "rail", label: "Demir Yolu", icon: Truck }, { key: "multi", label: "Multimodal", icon: Anchor } ];
const ORDER_STATUSES = [ { key: "draft", label: "Taslak", color: "muted" }, { key: "confirmed", label: "Onaylı", color: "navy" }, { key: "production", label: "Üretimde", color: "copper" }, { key: "ready", label: "Sevke Hazır", color: "gold" }, { key: "shipped", label: "Sevk Edildi", color: "navy" }, { key: "delivered", label: "Teslim Edildi", color: "forest" }, { key: "completed", label: "Tamamlandı", color: "forest" }, { key: "cancelled", label: "İptal", color: "oxblood" } ];
const PAYMENT_METHODS = [ { key: "bank_transfer", label: "Banka Havalesi / SWIFT", icon: Banknote }, { key: "letter_of_credit", label: "Akreditif (L/C)", icon: FileCheck }, { key: "cad", label: "Vesaik Mukabili (CAD)", icon: FileText }, { key: "cash", label: "Peşin", icon: DollarSign }, { key: "open_account", label: "Açık Hesap", icon: Receipt }, { key: "check", label: "Çek", icon: Receipt }, { key: "credit_card", label: "Kredi Kartı", icon: CreditCard }, { key: "consignment", label: "Konsinye", icon: Package }, { key: "other", label: "Diğer", icon: AlertCircle } ];
const PAYMENT_PLAN_TYPES = [ { key: "prepayment", label: "Ön Ödeme", color: "gold" }, { key: "preShipment", label: "Sevk Öncesi", color: "copper" }, { key: "deferred", label: "Vadeli", color: "navy" }, { key: "vat", label: "KDV", color: "navy" } ];
const PAYMENT_STATUSES = [ { key: "pending", label: "Bekliyor", color: "copper" }, { key: "partial", label: "Kısmi Ödendi", color: "gold" }, { key: "paid", label: "Ödendi", color: "forest" }, { key: "overdue", label: "Gecikmiş", color: "oxblood" }, { key: "cancelled", label: "İptal", color: "muted" } ];

// ============================================================================
// YARDIMCI FONKSİYONLAR
// ============================================================================
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const fmtMoney = (n, cur = "USD", opts = {}) => { if (n === null || n === undefined || isNaN(n)) return "—"; return new Intl.NumberFormat("tr-TR", { style: "currency", currency: cur, minimumFractionDigits: opts.compact ? 0 : 2, maximumFractionDigits: opts.compact ? 0 : 2 }).format(n); };
const fmtNum = (n) => { if (n === null || n === undefined || isNaN(n)) return "—"; return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(n); };
const fmtDate = (d) => { if (!d) return "—"; const dt = new Date(d); if (isNaN(dt)) return "—"; return dt.toLocaleDateString("tr-TR"); };
const fmtDateLong = (d) => { if (!d) return "—"; const dt = new Date(d); if (isNaN(dt)) return "—"; return dt.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }); };
function getISOWeek(dateStr) { if (!dateStr) return null; const d = new Date(dateStr); if (isNaN(d.getTime())) return null; const target = new Date(d.valueOf()); const dayNr = (d.getDay() + 6) % 7; target.setDate(target.getDate() - dayNr + 3); const firstThursday = target.valueOf(); target.setMonth(0, 1); if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7); return 1 + Math.ceil((firstThursday - target) / 604800000); }
const fmtDateWithWeek = (d) => { const w = getISOWeek(d); return w ? `${fmtDate(d)} · W${w}` : fmtDate(d); };
const parseNumber = (str) => { if (typeof str === "number") return str; if (str === null || str === undefined || str === "") return 0; let s = String(str).trim().replace(/[^\d,.\-]/g, ""); if (!s) return 0; const hasComma = s.includes(","); const hasPeriod = s.includes("."); if (hasComma && hasPeriod) { const lastComma = s.lastIndexOf(","); const lastPeriod = s.lastIndexOf("."); if (lastComma > lastPeriod) { s = s.replace(/\./g, "").replace(",", "."); } else { s = s.replace(/,/g, ""); } } else if (hasComma) { s = s.replace(",", "."); } const n = parseFloat(s); return isFinite(n) ? n : 0; };

// YENİ: Sipariş Hesaplama (İlave Maliyetler Dahil)
function calcOrderTotals(order) {
  const items = order?.items || [];
  const itemSubs = items.map((i) => {
    const base = (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0);
    const lineDisc = Number(i.discount) || 0;
    return base * (1 - lineDisc / 100);
  });
  const subtotal = itemSubs.reduce((s, x) => s + x, 0);

  let discount = 0;
  if (order?.discountType === "percentage") discount = subtotal * (Number(order.discountValue) || 0) / 100;
  else if (order?.discountType === "amount") discount = Number(order.discountValue) || 0;
  const afterDiscount = Math.max(0, subtotal - discount);

  const additionalCosts = order?.additionalCosts || [];
  const additionalTotal = additionalCosts.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  const vatRate = Number(order?.vatRate) || 0;
  const vatAmount = afterDiscount * vatRate / 100;
  
  const total = afterDiscount + vatAmount + additionalTotal;
  return { subtotal, discount, afterDiscount, additionalCosts, additionalTotal, vatRate, vatAmount, total };
}

const orderTotal = (o) => calcOrderTotals(o).total;
function orderTotalUSD(order, rates) { const total = orderTotal(order); if (!total) return 0; if (order.currency === "USD") return total; const lockedRate = order.lockedRateAtShipment; if (lockedRate && lockedRate > 0) return total * lockedRate; return toUSD(total, order.currency, rates); }
const planTotal = (o) => (o?.paymentPlan || []).reduce((t, p) => t + (Number(p.amount) || 0), 0);
const orderPaidAmount = (o, payments) => payments.filter((p) => p.orderId === o.id && p.status === "paid").reduce((s, p) => s + (Number(p.amount) || 0), 0);
const todayISO = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => { if (!a || !b) return 0; return Math.round((new Date(b) - new Date(a)) / 86400000); };
const addDays = (d, n) => { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10); };
const toUSD = (amount, currency, rates) => (amount || 0) * (rates[currency] ?? 1);

// ============================================================================
// PDF YAZDIRMA
// ============================================================================
function printPDF({ title, subtitle, contentHtml, orientation = "portrait", lang="tr" }) {
  const w = window.open("", "_blank", "width=1000,height=750");
  if (!w) { alert("Popup engellendi."); return; }

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  @page { size: A4 ${orientation}; margin: 1.2cm; }
  * { box-sizing: border-box; }
  body { font-family: Calibri, "Carlito", Arial, sans-serif; font-size: 11px; color: #0F1A2E; margin: 0; padding: 20px; line-height: 1.45; background: white; }
  .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #C9A961; padding-bottom: 10px; margin-bottom: 14px; }
  .doc-header .left h1 { font-size: 17px; margin: 0 0 3px; color: #0F1A2E; font-weight: 700; }
  .doc-header .left .subtitle { font-size: 10px; color: #7A736A; }
  .doc-header .right { text-align: right; font-size: 9px; color: #7A736A; line-height: 1.4; }
  .doc-header .right .brand { font-size: 11px; font-weight: 700; color: #1E3A5F; margin-bottom: 2px; }
  h2 { font-size: 12px; margin: 14px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #C9A961; color: #1E3A5F; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px; page-break-inside: avoid; }
  th { padding: 6px 8px; border: 1px solid #ccc; background: #F8F5EE; text-align: left; font-weight: 700; color: #0F1A2E; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; }
  td { padding: 5px 8px; border: 1px solid #ccc; vertical-align: top; }
  td.right, th.right { text-align: right; }
  td.center, th.center { text-align: center; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin: 6px 0 12px; font-size: 11px; }
  .info-grid > div { padding: 2px 0; }
  .label { color: #7A736A; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }
  .summary-card { background: #F8F5EE; border: 1px solid #C9A961; padding: 10px 14px; border-radius: 4px; margin: 8px 0 12px; }
  .text-success { color: #3E7D5A; font-weight: 700; }
  .text-warning { color: #B87333; font-weight: 700; }
  .text-danger  { color: #A6383D; font-weight: 700; }
  .text-mono    { font-family: "Consolas", "Courier New", monospace; font-weight: 700; }
  .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 9px; color: #7A736A; text-align: center; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
  .kpi { padding: 8px 10px; background: #F8F5EE; border: 1px solid #ddd; border-left: 3px solid #C9A961; border-radius: 3px; }
  .kpi .kpi-label { font-size: 9px; color: #7A736A; text-transform: uppercase; font-weight: 700; }
  .kpi .kpi-value { font-size: 14px; font-weight: 700; color: #0F1A2E; margin-top: 2px; }
  .print-btn { position: fixed; top: 10px; right: 10px; padding: 10px 18px; background: #1E3A5F; color: white; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 100; }
  @media print { .no-print { display: none !important; } body { padding: 0; } }
</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">${t('printPDF', lang)}</button>
  <div class="doc-header">
    <div class="left">
      <h1>${title}</h1>
      ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ""}
    </div>
    <div class="right">
      <div class="brand">Export Operations</div>
      <div>Management System</div>
      <div style="margin-top:4px;color:#0F1A2E;font-weight:600">${fmtDateLong(todayISO())}</div>
    </div>
  </div>
  ${contentHtml}
  <div class="footer">Generated on ${fmtDateLong(todayISO())}.</div>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 500));</script>
</body>
</html>`;
  w.document.write(html);
  w.document.close();
}

function htmlEscape(s) { if (s == null) return ""; return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function fmtMoneyPDF(n, cur) { const v = (Number(n) || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); return cur ? `${cur} ${v}` : v; }
const downloadBlob = (data, filename, type = "application/octet-stream") => { const blob = new Blob([data], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); };
const exportToExcel = (rows, filename, sheetName = "Veri") => { if (!rows || rows.length === 0) return false; const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, sheetName); const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }); downloadBlob(out, filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); return true; };
const importFromExcel = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = (e) => { try { const wb = XLSX.read(e.target.result, { type: "array" }); resolve(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])); } catch (err) { reject(err); } }; reader.onerror = reject; reader.readAsArrayBuffer(file); });

// ============================================================================
// AUTH
// ============================================================================
const SUPABASE_URL_AUTH = import.meta.env?.VITE_SUPABASE_URL || "";
const SUPABASE_KEY_AUTH = import.meta.env?.VITE_SUPABASE_ANON_KEY || "";
const SESSION_KEY = "exportflow_session_v2";

async function supabaseLogin(email, password) {
  if (!SUPABASE_URL_AUTH || !SUPABASE_KEY_AUTH) return { error: "Supabase yapılandırılmamış." };
  try {
    const res = await fetch(`${SUPABASE_URL_AUTH}/auth/v1/token?grant_type=password`, { method: "POST", headers: { "apikey": SUPABASE_KEY_AUTH, "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password }), });
    const data = await res.json();
    if (!res.ok) return { error: data.error_description || data.msg || data.error || "Giriş başarısız" };
    const session = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Date.now() + ((data.expires_in || 3600) * 1000), user: { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.name || data.user.email?.split("@")[0] || "Kullanıcı", role: data.user.user_metadata?.role || "editor" } };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { session };
  } catch (e) { return { error: "Bağlantı hatası: " + e.message }; }
}
async function supabaseRefreshToken() {
  const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  if (!s?.refresh_token) return null;
  try {
    const res = await fetch(`${SUPABASE_URL_AUTH}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: { "apikey": SUPABASE_KEY_AUTH, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: s.refresh_token }), });
    if (!res.ok) { localStorage.removeItem(SESSION_KEY); return null; }
    const data = await res.json();
    const newSession = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Date.now() + ((data.expires_in || 3600) * 1000), user: s.user };
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    return newSession;
  } catch { return null; }
}
function getStoredSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; } }
function clearStoredSession() { localStorage.removeItem(SESSION_KEY); }
async function getValidAuthToken() {
  const s = getStoredSession();
  if (!s) return null;
  if (s.expires_at && s.expires_at < Date.now() + 60000) { const refreshed = await supabaseRefreshToken(); return refreshed?.access_token || null; }
  return s.access_token;
}
const USER_ROLES = [ { key: "admin", label: "Yönetici", desc: "Tüm işlemler" }, { key: "editor", label: "Editör", desc: "Kayıt düzenler" }, { key: "viewer", label: "Görüntüleyici", desc: "Sadece okur" } ];

// ============================================================================
// UI ATOMLARI
// ============================================================================
function Btn({ variant = "primary", size = "md", icon: Icon, children, className = "", ...rest }) {
  const sz = { xs: "px-2 py-1 text-[11px] gap-1", sm: "px-3 py-1.5 text-xs gap-1.5", md: "px-4 py-2 text-sm gap-2", lg: "px-5 py-2.5 text-sm gap-2" }[size];
  const variants = { primary: { bg: TOKENS.navy, hover: TOKENS.ink, color: "white", border: TOKENS.navy }, accent: { bg: TOKENS.gold, hover: TOKENS.goldDark, color: TOKENS.ink, border: TOKENS.gold }, ghost: { bg: "transparent", hover: TOKENS.cream, color: TOKENS.navy, border: "transparent" }, secondary:{ bg: "white", hover: TOKENS.cream, color: TOKENS.navy, border: TOKENS.border }, danger: { bg: TOKENS.oxblood, hover: "#8a2c30", color: "white", border: TOKENS.oxblood }, success: { bg: TOKENS.forest, hover: "#2f6647", color: "white", border: TOKENS.forest } }[variant];
  return (
    <button className={`inline-flex items-center justify-center font-medium rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed border ${sz} ${className}`} style={{ background: variants.bg, color: variants.color, borderColor: variants.border }} onMouseEnter={(e) => !rest.disabled && (e.currentTarget.style.background = variants.hover)} onMouseLeave={(e) => !rest.disabled && (e.currentTarget.style.background = variants.bg)} {...rest}>
      {Icon && <Icon size={size === "xs" ? 11 : size === "sm" ? 13 : 15} />}
      {children}
    </button>
  );
}

function Input({ className = "", error, ...rest }) { return <input className={`w-full px-3 py-2 text-sm bg-white rounded-md focus:outline-none transition border ${className}`} style={{ borderColor: error ? TOKENS.oxblood : TOKENS.border, fontFamily: FONT_BODY }} onFocus={(e) => (e.currentTarget.style.borderColor = TOKENS.navy)} onBlur={(e) => (e.currentTarget.style.borderColor = error ? TOKENS.oxblood : TOKENS.border)} {...rest} />; }
function Textarea({ className = "", ...rest }) { return <textarea className={`w-full px-3 py-2 text-sm bg-white rounded-md focus:outline-none transition border resize-y ${className}`} style={{ borderColor: TOKENS.border, fontFamily: FONT_BODY }} onFocus={(e) => (e.currentTarget.style.borderColor = TOKENS.navy)} onBlur={(e) => (e.currentTarget.style.borderColor = TOKENS.border)} rows={3} {...rest} />; }
function Select({ className = "", children, ...rest }) { return <div className="relative"><select className={`w-full px-3 py-2 pr-8 text-sm bg-white rounded-md focus:outline-none transition border appearance-none cursor-pointer ${className}`} style={{ borderColor: TOKENS.border, fontFamily: FONT_BODY }} onFocus={(e) => (e.currentTarget.style.borderColor = TOKENS.navy)} onBlur={(e) => (e.currentTarget.style.borderColor = TOKENS.border)} {...rest}>{children}</select><ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: TOKENS.muted }} /></div>; }
function Label({ children, required, hint, className = "" }) { return <label className={`block text-[11px] font-medium mb-1 ${className}`} style={{ color: TOKENS.ink, letterSpacing: "0.02em" }}><span className="uppercase tracking-wide">{children}</span>{required && <span style={{ color: TOKENS.oxblood }}> *</span>}{hint && <span className="ml-1.5 normal-case font-normal text-[10px]" style={{ color: TOKENS.muted }}>· {hint}</span>}</label>; }
function Badge({ color = "muted", children, dot, className = "" }) { const c = TOKENS[color] || TOKENS.muted; return <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md whitespace-nowrap ${className}`} style={{ background: c + "18", color: c, border: `1px solid ${c}33` }}>{dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />}{children}</span>; }
function Pill({ children, color = "navy", className = "" }) { const c = TOKENS[color] || TOKENS.navy; return <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider ${className}`} style={{ background: c, color: "white" }}>{children}</span>; }
function PageHeader({ title, subtitle, breadcrumb, children }) { return <div className="px-8 py-6 border-b" style={{ background: "white", borderColor: TOKENS.border }}><div className="flex items-end justify-between gap-4"><div>{breadcrumb && <div className="text-[11px] mb-2 flex items-center gap-1.5" style={{ color: TOKENS.muted }}>{breadcrumb}</div>}<h1 className="text-2xl tracking-tight" style={{ fontFamily: FONT_DISPLAY, color: TOKENS.ink, fontWeight: 600 }}>{title}</h1>{subtitle && <p className="text-xs mt-1" style={{ color: TOKENS.muted }}>{subtitle}</p>}</div><div className="flex items-center gap-2 flex-shrink-0">{children}</div></div></div>; }
function Card({ title, subtitle, children, action, className = "", noPadding }) { return <div className={`rounded-lg overflow-hidden transition-shadow hover:shadow-sm ${className}`} style={{ background: "white", border: `1px solid ${TOKENS.border}` }}>{(title || action) && <div className="px-5 py-3 flex items-center justify-between border-b" style={{ borderColor: TOKENS.border }}><div>{title && <h3 className="text-sm font-semibold" style={{ color: TOKENS.ink }}>{title}</h3>}{subtitle && <p className="text-[11px] mt-0.5" style={{ color: TOKENS.muted }}>{subtitle}</p>}</div>{action}</div>}<div className={noPadding ? "" : "p-5"}>{children}</div></div>; }
function Modal({ open, onClose, title, subtitle, children, size = "md", footer }) { if (!open) return null; const sizes = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-6xl", "2xl": "max-w-7xl" }; return <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: "rgba(15, 26, 46, 0.5)", backdropFilter: "blur(4px)" }}><div className={`w-full ${sizes[size]} my-8 rounded-lg overflow-hidden shadow-2xl`} style={{ background: "white", border: `1px solid ${TOKENS.border}` }}><div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: TOKENS.border, background: TOKENS.cream }}><div><h3 className="text-base font-semibold" style={{ color: TOKENS.ink, fontFamily: FONT_DISPLAY }}>{title}</h3>{subtitle && <p className="text-[11px] mt-0.5" style={{ color: TOKENS.muted }}>{subtitle}</p>}</div><button onClick={onClose} className="p-1 rounded hover:bg-white/50 transition" style={{ color: TOKENS.muted }} title="Kapat"><X size={18} /></button></div><div className="p-6">{children}</div>{footer && <div className="px-6 py-3 flex items-center justify-end gap-2 border-t" style={{ borderColor: TOKENS.border, background: TOKENS.cream + "60" }}>{footer}</div>}</div></div>; }

function DataTable({ columns, rows, keyField = "id", onRowClick, emptyText = "Kayıt yok", emptyHint, actions, defaultSort, rowStyle }) {
  const [sort, setSort] = useState(defaultSort || { key: null, dir: "asc" });
  const sorted = useMemo(() => {
    if (!sort.key) return rows;
    const col = columns.find((c) => c.key === sort.key);
    return [...rows].sort((a, b) => {
      const av = col?.sortValue ? col.sortValue(a) : a[sort.key];
      const bv = col?.sortValue ? col.sortValue(b) : b[sort.key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return sort.dir === "asc" ? av - bv : bv - av;
      return sort.dir === "asc" ? String(av).localeCompare(String(bv), "tr") : String(bv).localeCompare(String(av), "tr");
    });
  }, [rows, sort, columns]);

  const toggleSort = (key) => setSort((s) => s.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : { key: null, dir: "asc" });

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "white", border: `1px solid ${TOKENS.border}` }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ background: TOKENS.cream }}>
            <tr>
              {columns.map((c) => (
                <th key={c.key} onClick={() => c.sortable !== false && toggleSort(c.key)} className={`px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${c.sortable !== false ? "cursor-pointer select-none" : ""} ${c.align === "right" ? "text-right" : ""} ${c.align === "center" ? "text-center" : ""}`} style={{ color: TOKENS.ink, borderBottom: `1px solid ${TOKENS.border}`, width: c.width }}>
                  <span className={`inline-flex items-center gap-1.5 ${c.align === "right" ? "justify-end" : ""}`}>{c.label} {c.sortable !== false && (sort.key === c.key ? sort.dir === "asc" ? <ArrowUp size={11} style={{ color: TOKENS.gold }} /> : <ArrowDown size={11} style={{ color: TOKENS.gold }} /> : <ArrowUpDown size={10} style={{ color: TOKENS.muted, opacity: 0.4 }} />)}</span>
                </th>
              ))}
              {actions && <th className="px-4 py-3 w-1" style={{ borderBottom: `1px solid ${TOKENS.border}` }} />}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={columns.length + (actions ? 1 : 0)} className="px-4 py-16 text-center"><div style={{ color: TOKENS.muted }}><div className="text-sm font-medium mb-1">{emptyText}</div>{emptyHint && <div className="text-xs">{emptyHint}</div>}</div></td></tr>
            ) : (
              sorted.map((row, idx) => (
                <tr key={row[keyField] ?? idx} onClick={() => onRowClick?.(row)} className={`transition ${onRowClick ? "cursor-pointer" : ""}`} 
                    style={{ borderBottom: `1px solid ${TOKENS.border}30`, ...(rowStyle ? rowStyle(row) : {}) }}
                    onMouseEnter={(e) => { if (!rowStyle?.(row)?.backgroundColor) e.currentTarget.style.background = TOKENS.cream + "60"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = rowStyle?.(row)?.backgroundColor || "white"; }}>
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.align === "center" ? "text-center" : ""} ${c.className || ""}`} style={{ color: TOKENS.ink }}>
                      {c.render ? c.render(row) : row[c.key] ?? "—"}
                    </td>
                  ))}
                  {actions && <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>{actions(row)}</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 text-[11px] flex items-center justify-between" style={{ background: TOKENS.cream + "40", borderTop: `1px solid ${TOKENS.border}`, color: TOKENS.muted }}><span>{sorted.length} kayıt</span>{sort.key && <span>Sıralama: {columns.find(c => c.key === sort.key)?.label} {sort.dir === "asc" ? "↑" : "↓"}</span>}</div>
    </div>
  );
}

function FilterBar({ children }) { return <div className="rounded-lg p-3 flex flex-wrap items-end gap-3" style={{ background: "white", border: `1px solid ${TOKENS.border}` }}>{children}</div>; }
function SearchInput({ value, onChange, placeholder = "Ara..." }) { return <div className="relative flex-1 min-w-[220px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: TOKENS.muted }} /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full pl-9 pr-3 py-2 text-sm rounded-md border focus:outline-none transition" style={{ borderColor: TOKENS.border, background: "white" }} onFocus={(e) => (e.currentTarget.style.borderColor = TOKENS.navy)} onBlur={(e) => (e.currentTarget.style.borderColor = TOKENS.border)} /></div>; }
function DateRange({ from, to, onChange }) { return <div className="flex items-end gap-2"><div><Label hint="dahil">Başlangıç</Label><Input type="date" value={from || ""} onChange={(e) => onChange({ from: e.target.value, to })} className="w-36" /></div><div><Label hint="dahil">Bitiş</Label><Input type="date" value={to || ""} onChange={(e) => onChange({ from, to: e.target.value })} className="w-36" /></div></div>; }
function EmptyState({ icon: Icon = Sparkles, title, hint, action }) { return <div className="text-center py-16 px-6"><div className="inline-flex w-14 h-14 items-center justify-center rounded-full mb-4" style={{ background: TOKENS.cream, color: TOKENS.gold }}><Icon size={24} /></div><h3 className="text-base font-semibold mb-2" style={{ color: TOKENS.ink, fontFamily: FONT_DISPLAY }}>{title}</h3>{hint && <p className="text-xs max-w-md mx-auto mb-5" style={{ color: TOKENS.muted }}>{hint}</p>}{action}</div>; }

// ============================================================================
// ANA UYGULAMA
// ============================================================================
export default function App() {
  const [lang, setLang] = useState("tr");
  const [view, setView] = useState("dashboard");
  const [loaded, setLoaded] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [rates, setRates] = useState(DEFAULT_RATES);
  const [currentUser, setCurrentUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [pendingOrderToOpen, setPendingOrderToOpen] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = "info") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); }, []);

  useEffect(() => {
    ensureFonts();
    (async () => {
      try {
        const [c, p, ba, o, pm, r] = await Promise.all([ storage.get("customers"), storage.get("products"), storage.get("bankAccounts"), storage.get("orders"), storage.get("payments"), storage.get("rates") ]);
        if (c) setCustomers(c); if (p) setProducts(p); if (ba) setBankAccounts(ba); if (o) setOrders(o); if (pm) setPayments(pm); if (r) setRates(r);
        const session = getStoredSession();
        if (session?.user) {
          if (session.expires_at && session.expires_at < Date.now()) {
            const refreshed = await supabaseRefreshToken();
            if (refreshed) setCurrentUser(refreshed.user); else clearStoredSession();
          } else { setCurrentUser(session.user); }
        }
        const lastUpdate = r?._lastUpdate;
        if (!lastUpdate || lastUpdate < todayISO()) {
          try {
            const tcmbRes = await fetch("/api/tcmb");
            if (tcmbRes.ok) {
              const data = await tcmbRes.json();
              const newRates = { ...(r || DEFAULT_RATES) };
              Object.entries(data).forEach(([k, v]) => { if (!k.startsWith("_") && typeof v === "number") newRates[k] = v; });
              newRates._lastUpdate = data._date || todayISO(); newRates._source = "TCMB"; setRates(newRates);
            }
          } catch (e) { console.warn("TCMB update failed"); }
        }
      } catch (e) { console.error(e); }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (loaded) storage.set("customers", customers); }, [customers, loaded]);
  useEffect(() => { if (loaded) storage.set("products", products); }, [products, loaded]);
  useEffect(() => { if (loaded) storage.set("bankAccounts", bankAccounts); }, [bankAccounts, loaded]);
  useEffect(() => { if (loaded) storage.set("orders", orders); }, [orders, loaded]);
  useEffect(() => { if (loaded) storage.set("payments", payments); }, [payments, loaded]);
  useEffect(() => { if (loaded) storage.set("rates", rates); }, [rates, loaded]);

  const enrichedPayments = useMemo(() => {
    const t_date = todayISO();
    return payments.map((p) => {
      if (p.status === "pending" && p.dueDate && p.dueDate < t_date) return { ...p, status: "overdue", _autoOverdue: true };
      return p;
    });
  }, [payments]);

  const canEdit = !!(currentUser && (currentUser.role === "admin" || currentUser.role === "editor"));

  const ctx = {
    lang, setLang,
    customers, setCustomers, products, setProducts, bankAccounts, setBankAccounts, orders, setOrders,
    payments: enrichedPayments, setPayments, rates, setRates, currentUser, setCurrentUser,
    canEdit, isAdmin: currentUser?.role === "admin", pendingOrderToOpen, setPendingOrderToOpen, showToast, setView,
  };

  if (!loaded) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2" style={{ borderColor: TOKENS.gold, borderTopColor: "transparent" }} /></div>;

  return (
    <div className="min-h-screen flex" style={{ background: TOKENS.bg, fontFamily: FONT_BODY, color: TOKENS.ink }}>
      <Sidebar view={view} setView={setView} storageMode={storage.mode} storageLabel={storage.label} currentUser={currentUser} onLoginClick={() => setShowLogin(true)} onLogout={() => { clearStoredSession(); setCurrentUser(null); showToast("Çıkış yapıldı", "info"); }} lang={lang} setLang={setLang} />
      <main className="flex-1 overflow-x-hidden min-w-0">
        {view === "dashboard" && <DashboardView {...ctx} />}
        {view === "customers" && <CustomersView {...ctx} />}
        {view === "products" && <ProductsView {...ctx} />}
        {view === "orders" && <OrdersView {...ctx} />}
        {view === "payments" && <PaymentsView {...ctx} />}
        {view === "cashflow" && <CashFlowView {...ctx} />}
        {view === "bankAccounts" && <BankAccountsView {...ctx} />}
        {view === "reports" && <ReportsView {...ctx} />}
        {view === "settings" && <SettingsView {...ctx} />}
      </main>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <LoginModal open={showLogin} onClose={() => setShowLogin(false)} setCurrentUser={setCurrentUser} showToast={showToast} />
    </div>
  );
}

// ============================================================================
// SIDEBAR
// ============================================================================
function Sidebar({ view, setView, storageMode, currentUser, onLoginClick, onLogout, lang, setLang }) {
  const sections = [
    { title: t("general", lang), items: [ { key: "dashboard", label: t("dashboard", lang), icon: LayoutDashboard } ] },
    { title: t("operation", lang), items: [ { key: "orders", label: t("orders", lang), icon: FileText }, { key: "payments", label: t("payments", lang), icon: CreditCard }, { key: "cashflow", label: t("cashflow", lang), icon: TrendingUp } ] },
    { title: t("records", lang), items: [ { key: "customers", label: t("customers", lang), icon: Users }, { key: "products", label: t("products", lang), icon: Package } ] },
    { title: t("analysis", lang), items: [ { key: "reports", label: t("reports", lang), icon: BarChart3 } ] },
    { title: t("system", lang), items: [ { key: "settings", label: t("settings", lang), icon: Settings } ] },
  ];

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col" style={{ background: TOKENS.ink, color: "#cbd5e1" }}>
      <div className="px-5 py-5 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${TOKENS.gold}, ${TOKENS.copper})` }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={TOKENS.ink} strokeWidth="2"><path d="M2 12 L12 4 L22 12" /><path d="M5 11 V20 H19 V11" /><path d="M9 16 H15" /></svg>
        </div>
        <div><div className="font-semibold text-white tracking-wider text-[13px]">EXPORT-FLOW</div><div className="text-[10px] uppercase tracking-widest" style={{ color: TOKENS.gold }}>Yönetim Sistemi</div></div>
      </div>
      <nav className="flex-1 py-2 overflow-y-auto">
        {sections.map((sec) => (
          <div key={sec.title} className="mb-3">
            <div className="px-5 py-1.5 text-[10px] uppercase tracking-widest font-semibold" style={{ color: "#64748b" }}>{sec.title}</div>
            {sec.items.map((item) => {
              const Icon = item.icon; const active = view === item.key;
              return (
                <button key={item.key} onClick={() => setView(item.key)} className="w-full flex items-center gap-3 px-5 py-2 text-[13px] transition relative group" style={{ background: active ? "rgba(201, 169, 97, 0.08)" : "transparent", color: active ? "white" : "#cbd5e1" }} onMouseEnter={(e) => !active && (e.currentTarget.style.background = "rgba(255,255,255,0.04)")} onMouseLeave={(e) => !active && (e.currentTarget.style.background = "transparent")}>
                  {active && <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: TOKENS.gold }} />}
                  <Icon size={15} style={{ color: active ? TOKENS.gold : "#94a3b8" }} /><span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="p-3 flex justify-center gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={() => setLang("tr")} className={`px-2 py-1 text-xs rounded ${lang==='tr' ? 'bg-blue-900 text-white' : 'text-gray-400'}`}>TR</button>
        <button onClick={() => setLang("en")} className={`px-2 py-1 text-xs rounded ${lang==='en' ? 'bg-blue-900 text-white' : 'text-gray-400'}`}>EN</button>
      </div>
      <div className="p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        {currentUser ? (
          <div className="rounded-md p-2.5" style={{ background: "rgba(201, 169, 97, 0.08)" }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: TOKENS.gold, color: TOKENS.ink }}>{currentUser.name?.charAt(0).toUpperCase()}</div>
              <div className="flex-1 min-w-0"><div className="text-xs font-bold text-white truncate">{currentUser.name}</div><div className="text-[9px] uppercase tracking-wider" style={{ color: TOKENS.gold }}>{currentUser.role}</div></div>
            </div>
            <button onClick={onLogout} className="w-full text-[10px] font-bold py-1.5 rounded transition" style={{ background: "rgba(255,255,255,0.06)", color: "#cbd5e1" }}>ÇIKIŞ YAP</button>
          </div>
        ) : (
          <div><button onClick={onLoginClick} className="w-full text-[11px] font-bold py-2 rounded flex items-center justify-center gap-1.5" style={{ background: TOKENS.gold, color: TOKENS.ink }}><Lock size={11} /> GİRİŞ YAP</button></div>
        )}
      </div>
    </aside>
  );
}

// ============================================================================
// LOGIN & TOAST
// ============================================================================
function LoginModal({ open, onClose, setCurrentUser, showToast }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false);
  if (!open) return null;
  const handleLogin = async () => { setBusy(true); const r = await supabaseLogin(email, password); setBusy(false); if (r.error) showToast(r.error, "error"); else { setCurrentUser(r.session.user); onClose(); } };
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15, 26, 46, 0.7)" }}><div className="w-full max-w-md rounded-lg overflow-hidden bg-white"><div className="p-6 space-y-3"><Input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} /><Input type="password" placeholder="Şifre" value={password} onChange={e=>setPassword(e.target.value)} /><Btn variant="accent" className="w-full" onClick={handleLogin}>{busy?"...":"Giriş"}</Btn><button onClick={onClose}>İptal</button></div></div></div>;
}

function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  return <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-md shadow-xl text-sm flex items-center gap-2.5 max-w-sm" style={{ background: TOKENS.navy, color: "white" }} onClick={onDismiss}><span>{toast.msg}</span></div>;
}

// ============================================================================
// GÖSTERGE PANELİ
// ============================================================================
function DashboardView({ customers, products, orders, payments, rates, setView, lang }) {
  const [activeModal, setActiveModal] = useState(null); // 'orders', 'paid', 'pending', 'overdue'

  const stats = useMemo(() => {
    const totalOrdersUSD = orders.reduce((s, o) => s + orderTotalUSD(o, rates), 0);
    const paidUSD = payments.filter((p) => p.status === "paid").reduce((s, p) => s + toUSD(p.amount, p.currency, rates), 0);
    const pendingUSD = payments.filter((p) => p.status === "pending").reduce((s, p) => s + toUSD(p.amount, p.currency, rates), 0);
    const overdueUSD = payments.filter((p) => p.status === "overdue").reduce((s, p) => s + toUSD(p.amount, p.currency, rates), 0);
    return { totalOrdersUSD, paidUSD, pendingUSD, overdueUSD };
  }, [orders, payments, rates]);

  // YENİ: Sadece tahsil edilen ödemeler
  const monthlyRevenue = useMemo(() => {
    const now = new Date();
    const buckets = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.push({ key, label: d.toLocaleDateString(lang === 'tr' ? "tr-TR" : "en-US", { month: "short" }), value: 0, count: 0 });
    }
    payments.forEach((p) => {
      if (p.status !== "paid" || !p.paidDate) return; 
      const k = p.paidDate.slice(0, 7);
      const b = buckets.find((b) => b.key === k);
      if (b) { b.value += toUSD(p.amount, p.currency, rates); b.count++; }
    });
    return buckets;
  }, [payments, rates, lang]);

  return (
    <div>
      <PageHeader title={t("dashboard", lang)} subtitle={`${customers.length} ${t("customer", lang)} · ${orders.length} ${t("order", lang)}`} />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard icon={DollarSign} label={t("totalOrders", lang)} value={fmtMoney(stats.totalOrdersUSD, "USD", { compact: true })} accent={TOKENS.navy} onClick={() => setActiveModal('orders')} />
          <KPICard icon={CheckCircle2} label={t("collected", lang)} value={fmtMoney(stats.paidUSD, "USD", { compact: true })} accent={TOKENS.forest} onClick={() => setActiveModal('paid')} />
          <KPICard icon={Clock} label={t("pending", lang)} value={fmtMoney(stats.pendingUSD, "USD", { compact: true })} accent={TOKENS.gold} onClick={() => setActiveModal('pending')} />
          <KPICard icon={AlertTriangle} label={t("overdue", lang)} value={fmtMoney(stats.overdueUSD, "USD", { compact: true })} accent={TOKENS.oxblood} onClick={() => setActiveModal('overdue')} />
        </div>

        <Card title={t("revenueUSD", lang)} subtitle="Sadece Tahsil Edilenler" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyRevenue} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 6" stroke={TOKENS.border} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: TOKENS.ink, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [fmtMoney(v), "Ciro"]} />
              <Area type="monotone" dataKey="value" stroke={TOKENS.gold} fill={TOKENS.gold} fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Modal open={!!activeModal} onClose={() => setActiveModal(null)} title="Detaylar" size="lg">
        <div className="max-h-96 overflow-auto">
          {activeModal === 'orders' && orders.map(o => <div key={o.id} className="p-2 border-b">{o.orderNumber} - {fmtMoney(orderTotal(o), o.currency)}</div>)}
          {activeModal === 'paid' && payments.filter(p=>p.status==='paid').map(p => <div key={p.id} className="p-2 border-b">{fmtDate(p.paidDate)} - {fmtMoney(p.amount, p.currency)}</div>)}
          {activeModal === 'pending' && payments.filter(p=>p.status==='pending').map(p => <div key={p.id} className="p-2 border-b">Vade: {fmtDate(p.dueDate)} - {fmtMoney(p.amount, p.currency)}</div>)}
          {activeModal === 'overdue' && payments.filter(p=>p.status==='overdue').map(p => <div key={p.id} className="p-2 border-b text-red-600">Gecikmiş: {fmtDate(p.dueDate)} - {fmtMoney(p.amount, p.currency)}</div>)}
        </div>
      </Modal>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, sub, accent, onClick }) {
  return (
    <div onClick={onClick} className={`rounded-xl p-5 relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${onClick ? 'cursor-pointer' : ''}`} style={{ background: "white", border: `1px solid ${TOKENS.border}` }}>
      <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}90)` }} />
      <div className="relative mt-2">
        <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: TOKENS.muted }}>{label}</span>
        <div className="text-3xl tabular-nums leading-tight font-bold" style={{ color: TOKENS.ink }}>{value}</div>
      </div>
    </div>
  );
}

// ============================================================================
// MÜŞTERİLER
// ============================================================================
function CustomersView({ customers, setCustomers, orders, payments, rates, canEdit, showToast, lang }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const enrichedCustomers = useMemo(() => customers.map((c) => {
    const custOrders = orders.filter((o) => o.customerId === c.id);
    const totalUSD = custOrders.reduce((s, o) => s + orderTotalUSD(o, rates), 0);
    const openBalance = payments.filter((p) => { const o = orders.find((x) => x.id === p.orderId); return o?.customerId === c.id && p.status !== "paid" && p.status !== "cancelled"; }).reduce((s, p) => s + toUSD(p.amount, p.currency, rates), 0);
    const overdueBalance = payments.filter((p) => { const o = orders.find((x) => x.id === p.orderId); return o?.customerId === c.id && p.status === "overdue"; }).reduce((s, p) => s + toUSD(p.amount, p.currency, rates), 0);
    return { ...c, totalUSD, openBalance, overdueBalance, orderCount: custOrders.length };
  }), [customers, orders, payments, rates]);

  const filtered = enrichedCustomers.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  const openNew = () => { setEditing({ id: null, code: "MST-" + uid().slice(0,4), name: "", defaultCurrency: "USD" }); setOpen(true); };
  const save = () => {
    if (!editing.name) return showToast("Müşteri adı zorunlu", "error");
    if (editing.id) setCustomers(arr => arr.map(x => x.id === editing.id ? editing : x));
    else setCustomers(arr => [...arr, { ...editing, id: uid() }]);
    setOpen(false); setEditing(null);
  };
  const remove = (id) => { if (confirm("Silinsin mi?")) setCustomers(arr => arr.filter(c => c.id !== id)); };

  const printList = () => {
    const rows = filtered.map((c) => `
      <tr>
        <td class="text-mono">${htmlEscape(c.code)}</td>
        <td><div style="font-weight:700">${htmlEscape(c.name)}</div></td>
        <td>${htmlEscape(c.country || "—")}</td>
        <td class="center">${c.orderCount}</td>
        <td class="right text-mono">$${(c.totalUSD || 0).toLocaleString("tr-TR", {maximumFractionDigits:0})}</td>
        <td class="right text-mono text-warning">${c.openBalance > 0 ? `$${c.openBalance.toLocaleString("tr-TR")}` : "✓"}</td>
        <td class="right text-mono text-danger" style="font-weight:700; background:#fff5f5;">${c.overdueBalance > 0 ? `$${c.overdueBalance.toLocaleString("tr-TR")}` : "—"}</td>
      </tr>`).join("");
    const content = `
      <table>
        <thead>
          <tr>
            <th>${t('code', lang)}</th>
            <th>${t('customer', lang)}</th>
            <th>${t('country', lang)}</th>
            <th class="center">${t('order', lang)}</th>
            <th class="right">${t('revenueUSD', lang)}</th>
            <th class="right">${t('openBalance', lang)}</th>
            <th class="right" style="background:#fff5f5; color:#A6383D;">${t('overdueTotal', lang)}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
    printPDF({ title: t('customerList', lang), contentHtml: content, lang });
  };

  return (
    <div>
      <PageHeader title={t("customers", lang)}><Btn onClick={printList}>PDF</Btn><Btn onClick={openNew}>Yeni</Btn></PageHeader>
      <div className="p-8">
        <DataTable
          columns={[
            { key: "code", label: "Kod" },
            { key: "name", label: "Müşteri" },
            { key: "openBalance", label: "Açık Bakiye", render: r => fmtMoney(r.openBalance, "USD") },
            { key: "overdueBalance", label: "Gecikmiş", render: r => <span className="text-red-600">{fmtMoney(r.overdueBalance, "USD")}</span> }
          ]}
          rows={filtered}
          actions={r => <div className="flex gap-2"><Btn size="xs" onClick={()=>setEditing(r)}>Düz</Btn><Btn size="xs" onClick={()=>remove(r.id)}>Sil</Btn></div>}
        />
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Müşteri" footer={<Btn onClick={save}>Kaydet</Btn>}>
        {editing && (
          <div className="space-y-3">
            <Input placeholder="Kod" value={editing.code} onChange={e=>setEditing({...editing, code: e.target.value})} />
            <Input placeholder="İsim" value={editing.name} onChange={e=>setEditing({...editing, name: e.target.value})} />
            <Input placeholder="Ülke" value={editing.country} onChange={e=>setEditing({...editing, country: e.target.value})} />
          </div>
        )}
      </Modal>
    </div>
  );
}

// ============================================================================
// ÜRÜNLER
// ============================================================================
function ProductsView({ products, setProducts, showToast, lang }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const save = () => {
    if (!editing.productCode) return showToast("Kod zorunlu", "error");
    const isDuplicate = products.some(p => p.productCode.toLowerCase() === editing.productCode.toLowerCase() && p.id !== editing.id);
    if (isDuplicate) return showToast("Bu ürün koduna sahip başka bir ürün zaten var!", "error");

    if (editing.id) setProducts(arr => arr.map(x => x.id === editing.id ? editing : x));
    else setProducts(arr => [...arr, { ...editing, id: uid() }]);
    setOpen(false); setEditing(null);
  };

  return (
    <div>
      <PageHeader title={t("products", lang)}><Btn onClick={()=> {setEditing({productCode:""}); setOpen(true);}}>Yeni</Btn></PageHeader>
      <div className="p-8"><DataTable columns={[{key:"productCode", label:"Kod"}, {key:"nameTr", label:"İsim"}]} rows={products} actions={r=><Btn size="xs" onClick={()=>setEditing(r)}>Düz</Btn>} /></div>
      <Modal open={!!editing} onClose={()=>setEditing(null)} title="Ürün" footer={<Btn onClick={save}>Kaydet</Btn>}>
        {editing && <div className="space-y-3"><Input placeholder="Kod" value={editing.productCode} onChange={e=>setEditing({...editing, productCode: e.target.value})} /><Input placeholder="İsim" value={editing.nameTr} onChange={e=>setEditing({...editing, nameTr: e.target.value})} /></div>}
      </Modal>
    </div>
  );
}

// ============================================================================
// SİPARİŞLER & İLAVE MALİYETLER
// ============================================================================
function OrdersView({ orders, setOrders, customers, payments, setPayments, rates, showToast, lang }) {
  const [viewMode, setViewMode] = useState("table");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const hierarchicalData = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      const month = o.orderDate ? o.orderDate.slice(0, 7) : "Tarihsiz";
      if (!map[month]) map[month] = [];
      map[month].push(o);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [orders]);

  const save = () => {
    const cleaned = {
      ...editing,
      items: editing.items.map((i) => ({ ...i, quantity: Number(i.quantity) || 0, unitPrice: Number(i.unitPrice) || 0 })),
      additionalCosts: (editing.additionalCosts||[]).map(c => ({...c, amount: Number(c.amount)||0}))
    };
    if (editing.id) setOrders(arr => arr.map(x => x.id === editing.id ? cleaned : x));
    else setOrders(arr => [...arr, { ...cleaned, id: uid() }]);
    setOpen(false); setEditing(null);
  };

  return (
    <div>
      <PageHeader title={t("orders", lang)}>
        <div className="flex gap-1 bg-gray-100 p-1 rounded">
          <button onClick={()=>setViewMode("table")} className={`px-2 text-xs ${viewMode==='table'?'bg-white font-bold':''}`}>Tablo</button>
          <button onClick={()=>setViewMode("hierarchy")} className={`px-2 text-xs ${viewMode==='hierarchy'?'bg-white font-bold':''}`}>Hiyerarşi</button>
        </div>
        <Btn onClick={()=> {setEditing({orderNumber: "SP-"+uid().slice(0,4), items:[], additionalCosts:[], paymentPlan:[]}); setOpen(true);}}>Yeni Sipariş</Btn>
      </PageHeader>

      <div className="p-8">
        {viewMode === "table" ? (
          <DataTable 
            columns={[{key:"orderNumber", label:"Sipariş No"}, {key:"actualShipmentDate", label:"Fiili Sevk"}, {key:"total", label:"Tutar", render: r => fmtMoney(orderTotal(r), r.currency)}]} 
            rows={orders} 
            rowStyle={(r) => r.actualShipmentDate ? { backgroundColor: "#ecfdf5" } : {}}
            actions={r => <Btn size="xs" onClick={()=>setEditing(r)}>Düz</Btn>}
          />
        ) : (
          <div className="space-y-6">
            {hierarchicalData.map(([month, monthOrders]) => (
              <div key={month} className="border rounded-lg bg-white overflow-hidden">
                <div className="px-4 py-2 font-bold text-sm bg-gray-100">{month} ({monthOrders.length} Sipariş)</div>
                <div className="p-4 space-y-4">
                  {monthOrders.map(o => (
                    <div key={o.id} className="border rounded-md p-4" style={{ backgroundColor: o.actualShipmentDate ? '#ecfdf5' : 'white' }}>
                      <div className="font-bold flex justify-between">
                        <span className="text-blue-900">{o.orderNumber} - {customers.find(c=>c.id===o.customerId)?.name}</span>
                        <span>{fmtMoney(orderTotal(o), o.currency)}</span>
                      </div>
                      <div className="pl-4 border-l-2 mt-2 text-xs">
                        {o.items?.map(i => <div key={i.id} className="flex justify-between py-1 border-b last:border-0"><span>{i.nameTr} ({i.quantity})</span><span>{fmtMoney(i.quantity*i.unitPrice, o.currency)}</span></div>)}
                        {o.additionalCosts?.map((c, idx) => <div key={idx} className="flex justify-between py-1 text-amber-700"><span>+ İlave: {c.name}</span><span>{fmtMoney(c.amount, o.currency)}</span></div>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!editing} onClose={()=>setEditing(null)} title="Sipariş Düzenle" size="lg" footer={<Btn onClick={save}>Kaydet</Btn>}>
        {editing && (
          <div className="space-y-4">
            <Input placeholder="Sipariş No" value={editing.orderNumber} onChange={e=>setEditing({...editing, orderNumber: e.target.value})} />
            <Input type="date" placeholder="Fiili Sevk" value={editing.actualShipmentDate || ""} onChange={e=>setEditing({...editing, actualShipmentDate: e.target.value})} />
            
            <div className="border p-4 rounded bg-gray-50">
              <h4 className="font-bold text-sm mb-2">Kalemler</h4>
              {editing.items.map((it, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <Input placeholder="İsim" value={it.nameTr} onChange={e=> { const nw=[...editing.items]; nw[idx].nameTr=e.target.value; setEditing({...editing, items:nw}); }} />
                  <Input type="number" placeholder="Adet" value={it.quantity} onChange={e=> { const nw=[...editing.items]; nw[idx].quantity=e.target.value; setEditing({...editing, items:nw}); }} />
                  <Input type="number" placeholder="Fiyat" value={it.unitPrice} onChange={e=> { const nw=[...editing.items]; nw[idx].unitPrice=e.target.value; setEditing({...editing, items:nw}); }} />
                </div>
              ))}
              <Btn size="xs" onClick={()=>setEditing({...editing, items: [...editing.items, {id:uid(), nameTr:"", quantity:1, unitPrice:0}]})}>Kalem Ekle</Btn>
            </div>

            <div className="border p-4 rounded bg-amber-50">
              <h4 className="font-bold text-sm mb-2 text-amber-900">{t('additionalCost', lang)}</h4>
              {(editing.additionalCosts||[]).map((c, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <Input placeholder="Palet, Paket vb." value={c.name} onChange={e=> { const nw=[...(editing.additionalCosts||[])]; nw[idx].name=e.target.value; setEditing({...editing, additionalCosts:nw}); }} />
                  <Input type="number" placeholder="Tutar" value={c.amount} onChange={e=> { const nw=[...(editing.additionalCosts||[])]; nw[idx].amount=e.target.value; setEditing({...editing, additionalCosts:nw}); }} />
                </div>
              ))}
              <Btn size="xs" onClick={()=>setEditing({...editing, additionalCosts: [...(editing.additionalCosts||[]), {id:uid(), name:"", amount:0}]})}>Maliyet Ekle</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ============================================================================
// ÖDEMELER (ÇOKLU SEÇİLEBİLİR FİLTRELER)
// ============================================================================
function PaymentsView({ payments, setPayments, rates, showToast, lang }) {
  const [statusFilter, setStatusFilter] = useState([]);
  const [typeFilter, setTypeFilter] = useState([]);

  const toggleFilter = (setFn, val) => setFn(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);

  const filtered = payments.filter(p => {
    if (statusFilter.length > 0 && !statusFilter.includes(p.status)) return false;
    if (typeFilter.length > 0 && !typeFilter.includes(p.type)) return false;
    return true;
  });

  return (
    <div>
      <PageHeader title={t("payments", lang)} />
      <div className="p-8 space-y-4">
        <FilterBar>
          <div className="flex flex-col gap-1">
            <Label>Durum</Label>
            <div className="flex gap-1 flex-wrap">
              {PAYMENT_STATUSES.map((s) => (
                <button key={s.key} onClick={() => toggleFilter(setStatusFilter, s.key)} className={`px-2 py-1 text-[10px] rounded border transition ${statusFilter.includes(s.key) ? 'bg-blue-900 text-white' : 'bg-white'}`}>{s.label}</button>
              ))}
            </div>
          </div>
        </FilterBar>
        <DataTable columns={[{key:"status", label:"Durum"}, {key:"amount", label:"Tutar", render: r => fmtMoney(r.amount, r.currency)}]} rows={filtered} />
      </div>
    </div>
  );
}

// Dummy Components to fulfill routing map
function CashFlowView({lang}) { return <div className="p-8">{t('cashflow', lang)} module</div>; }
function BankAccountsView() { return <div className="p-8">Banka Hesapları</div>; }
function ReportsView({lang}) { return <div className="p-8">{t('reports', lang)}</div>; }
function SettingsView({lang}) { return <div className="p-8">{t('settings', lang)}</div>; }
