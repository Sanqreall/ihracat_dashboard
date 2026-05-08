/**
 * EXPORT-FLOW · İhracat Yönetim Sistemi
 * ─────────────────────────────────────────────────────────────────────────────
 * Bu tek dosya, sistemin tüm mantığını barındırır. Modüller arası geçişler
 * "view" state'i ile yönetilir; veriler "storage" objesi üzerinden saklanır.
 *
 * VERİ MODELİ (özet):
 *   customers     → Müşteri kartları (kod, ülke, kredi limiti, vade vs.)
 *   products      → Ürün katalog (ürün kodu, mamul kodu, TR/EN isim)
 *   bankAccounts  → Banka hesapları (ödemenin geldiği yeri bilmek için)
 *   orders        → Siparişler (müşteriye bağlı, kalemler ve ödeme planı içerir)
 *   payments      → Ödeme kayıtları (sipariş + plan kalemine bağlı)
 *   rates         → Manuel döviz kurları (USD bazında, raporlar için)
 *a
 * STORAGE: İki mod destekler:
 *   1. Yerel mod (localStorage): tek kullanıcı, tarayıcı yerel
 *   2. Bulut mod (Supabase):    paylaşımlı, çoklu kullanıcı, gerçek zamanlı
 *   Hangisinin kullanılacağı dosyanın altında "createStorage()" fonksiyonunda
 *   otomatik tespit edilir. Supabase için sadece API anahtarlarını .env'e
 *   yapıştırmak yeterlidir; geri kalan kod aynıdır.
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
  TrendingDown, Activity, Star, Award, Hash,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart,
  RadialBarChart, RadialBar,
} from "recharts";
import * as XLSX from "xlsx";

// ============================================================================
// TASARIM SİSTEMİ — RENKLER, FONT, BOYUT
// ============================================================================
// Anadolu / boutique ihracat estetiği: derin lacivert + sıcak altın + krem.
// Generic SaaS pastelinden uzak durmak için sıcak terracotta/oxblood seçildi.

// ============================================================================
// İ18N — DİL DESTEĞİ (TR / EN)
// ============================================================================
// Pragmatik bir çeviri sistemi: kritik UI metinleri her iki dilde tutulur,
// localStorage'dan tercih okunur. PDF çıktıları da aynı dictionary'i kullanır.

const LANG_KEY = "exportflow_lang";

const TRANSLATIONS = {
  tr: {
    // Sidebar / Genel
    dashboard: "Gösterge Paneli",
    customers: "Müşteriler",
    products: "Ürünler",
    orders: "Siparişler",
    payments: "Ödemeler",
    cashflow: "Nakit Akışı",
    reports: "Raporlar",
    settings: "Ayarlar",
    bankAccounts: "Banka Hesapları",
    records: "Kayıtlar",
    operations: "Operasyon",
    analysis: "Analiz",
    system: "Sistem",
    // Buttons
    save: "Kaydet",
    cancel: "İptal",
    close: "Kapat",
    delete: "Sil",
    edit: "Düzenle",
    new: "Yeni",
    search: "Ara",
    filter: "Filtre",
    clear: "Temizle",
    confirm: "Onayla",
    back: "Geri",
    next: "İleri",
    print: "Yazdır",
    export: "Dışa Aktar",
    import: "İçe Aktar",
    template: "Şablon",
    download: "İndir",
    upload: "Yükle",
    pdf: "PDF",
    excel: "Excel",
    yes: "Evet",
    no: "Hayır",
    add: "Ekle",
    remove: "Kaldır",
    view: "Görüntüle",
    detail: "Detay",
    actions: "İşlemler",
    // Müşteri form
    customerCode: "Müşteri Kodu",
    customerName: "Müşteri Adı",
    contactPerson: "Yetkili Kişi",
    email: "E-posta",
    phone: "Telefon",
    country: "Ülke",
    address: "Adres",
    taxNumber: "Vergi No",
    notes: "Notlar",
    defaultCurrency: "Varsayılan Para Birimi",
    paymentTerms: "Vade (gün)",
    // Sipariş
    orderNumber: "Sipariş No",
    orderDate: "Sipariş Tarihi",
    shipmentDate: "Planlanan Sevk",
    actualShipmentDate: "Fiili Sevk",
    deliveryDate: "Teslim Tarihi",
    customer: "Müşteri",
    items: "Kalemler",
    item: "Kalem",
    quantity: "Adet",
    unitPrice: "Birim Fiyat",
    discount: "İskonto",
    subtotal: "Ara Toplam",
    vat: "KDV",
    total: "Toplam",
    grandTotal: "Genel Toplam",
    additionalCosts: "İlave Maliyetler",
    paymentPlan: "Ödeme Planı",
    incoterms: "Incoterms",
    shippingMethod: "Sevk Yöntemi",
    portOfLoading: "Yükleme Limanı",
    portOfDischarge: "Boşaltma Limanı",
    invoiceNumber: "Fatura No",
    billOfLading: "Konşimento",
    status: "Durum",
    currency: "Para Birimi",
    amount: "Tutar",
    // Ödeme
    dueDate: "Vade Tarihi",
    paidDate: "Tahsil Tarihi",
    paymentMethod: "Ödeme Yöntemi",
    bankAccount: "Banka Hesabı",
    referenceNumber: "Referans No",
    paymentType: "Tip",
    // Dashboard
    totalOrderVolume: "Toplam Sipariş Hacmi",
    totalReceived: "Tahsil Edilen",
    pendingPayments: "Bekleyen Tahsilat",
    overduePayments: "Gecikmiş",
    monthlyCollection: "Aylık Tahsilat",
    last12Months: "Son 12 ay",
    paid: "Tahsil Edilen",
    pending: "Bekleyen",
    overdue: "Gecikmiş",
    cancelled: "İptal Edildi",
    partial: "Kısmi",
    // KPI
    totalOrders: "Toplam Sipariş",
    activeOrders: "Aktif Sipariş",
    shippedOrders: "Sevk Edilen",
    totalCustomers: "Toplam Müşteri",
    totalRevenue: "Toplam Ciro",
    openBalance: "Açık Bakiye",
    overdueBalance: "Gecikmiş Bakiye",
    overdueTotalBalance: "Gecikmiş Toplam Bakiye",
    // Misafir
    guestMode: "MİSAFİR — SADECE OKUMA",
    loginToEdit: "Düzenleme için giriş yap",
    login: "GİRİŞ YAP",
    logout: "ÇIKIŞ YAP",
    // PDF başlıkları
    pdfOrderTitle: "Sipariş",
    pdfOrderListTitle: "Sipariş Listesi",
    pdfCustomerListTitle: "Müşteri Listesi · Alacak/Verecek Özeti",
    pdfProductCatalogTitle: "Ürün Kataloğu",
    pdfPaymentListTitle: "Ödeme Listesi",
    pdfCashflowTitle: "Nakit Akışı Projeksiyonu",
    pdfStatementTitle: "HESAP EKSTRESİ",
    pdfSummaryTitle: "Özet Rapor",
    pdfCreatedAt: "Hazırlanma Tarihi",
    pdfPrintBtn: "Yazdır / PDF Kaydet",
    pdfFilters: "Filtreler",
    pdfFooter: "Bu rapor İhracat Operasyonları sisteminden otomatik oluşturulmuştur.",
    pdfShipmentInfo: "Sevkiyat Bilgileri",
    pdfCustomerInfo: "Müşteri Bilgileri",
    pdfPaymentMovements: "Ödeme Hareketi",
    pdfOrderList: "Sipariş Listesi",
    pdfCurrencySummary: "Para Birimi Bazında Bakiye Özeti",
    pdfTopCustomers: "En Yüksek Cirolu Müşteriler",
    pdfTopCountries: "Ülke Bazlı Ciro",
    pdfTopProducts: "En Çok Satan Ürünler",
    pdfSummaryMetrics: "Özet Metrikler",
    pdfMonthlyProjection: "Aylık Tahsilat Projeksiyonu",
    pdfDetailedList: "Detaylı Liste (Vade Tarihine Göre)",
    receivable: "ALACAK",
    noBalance: "BAKİYE YOK",
    daysOverdue: "gün gecikti",
    daysToGo: "gün sonra",
    today: "bugün",
    waiting: "Bekliyor",
    collected: "Tahsil",
    // Sipariş durumları
    statusDraft: "Taslak",
    statusConfirmed: "Onaylı",
    statusProduction: "Üretimde",
    statusReady: "Sevke Hazır",
    statusShipped: "Sevk Edildi",
    statusDelivered: "Teslim Edildi",
    statusCompleted: "Tamamlandı",
    statusCancelled: "İptal",
    // Ödeme durumları
    payStatusPending: "Bekliyor",
    payStatusPartial: "Kısmi Ödendi",
    payStatusPaid: "Ödendi",
    payStatusOverdue: "Gecikmiş",
    payStatusCancelled: "İptal",
    // Ödeme planı tipleri
    payTypePrepayment: "Ön Ödeme",
    payTypePreShipment: "Sevk Öncesi",
    payTypeDeferred: "Vadeli",
    payTypeVat: "KDV",
    // Ödeme yöntemleri
    methodBankTransfer: "Banka Havalesi / SWIFT",
    methodLC: "Akreditif (L/C)",
    methodCAD: "Vesaik Mukabili (CAD)",
    methodCash: "Peşin",
    methodOpenAccount: "Açık Hesap",
    methodCheck: "Çek",
    methodCreditCard: "Kredi Kartı",
    methodConsignment: "Konsinye",
    methodOther: "Diğer",
    // PageHeader subtitle vb
    customersSubtitle: "müşteri kaydı · Açık bakiye otomatik hesaplanır",
    productsSubtitle: "ürün · Sipariş kalemlerinde otomatik tamamlama yapar",
    ordersSubtitle: "sipariş · Sipariş içinde kalemler ve ödeme planı birlikte yönetilir",
    paymentsSubtitle: "ödeme kaydı · Sipariş ödeme planından otomatik oluşur",
    cashflowSubtitle: "Yaklaşan tahsilatların net tarih listesi · Gecikmişler her zaman gösterilir",
    // Buton metinleri
    newCustomer: "Yeni Müşteri",
    newProduct: "Yeni Ürün",
    newOrder: "Yeni Sipariş",
    newPayment: "Yeni Ödeme",
    listView: "Liste",
    calendarView: "Ay / Hafta",
    // Filtre
    allCustomers: "Tüm Müşteriler",
    allCurrencies: "Tüm Para Birimleri",
    allStatuses: "Tüm Durumlar",
    show: "Göster",
    onlyOverdue: "Sadece Gecikmiş",
    onlyPending: "Sadece Bekleyen",
    all: "Tümü",
    clearFilters: "Filtreleri Temizle",
    searchPlaceholder: "Ara...",
    // Sipariş kart
    weekShort: "W",
    plannedShipment: "Plan. Sevk",
    received: "Tahsil",
    // Diğer
    language: "Dil",
    turkish: "Türkçe",
    english: "İngilizce",
    // Sayfa başlıkları (subtitle)
    customersSubtitle: "müşteri kaydı · Açık bakiye otomatik hesaplanır",
    productsSubtitle: "ürün · Sipariş kalemlerinde otomatik tamamlama yapar",
    ordersSubtitle: "sipariş · Sipariş içinde kalemler ve ödeme planı birlikte yönetilir",
    paymentsSubtitle: "ödeme kaydı · Sipariş ödeme planından otomatik oluşur",
    cashflowSubtitle: "Yaklaşan tahsilatların net tarih listesi · Gecikmişler her zaman gösterilir",
    bankAccountsSubtitle: "Tahsilatların geleceği hesaplar — akreditif ve havale takibi için",
    reportsSubtitle: "Tarih aralığı, müşteri, ülke, ürün ve durum bazlı analizler",
    // Yeni X butonları
    newCustomer: "Yeni Müşteri",
    newProduct: "Yeni Ürün",
    newOrder: "Yeni Sipariş",
    newAccount: "Yeni Hesap",
    // Sipariş durumları
    statusDraft: "Taslak",
    statusConfirmed: "Onaylandı",
    statusInProduction: "Üretimde",
    statusReadyToShip: "Sevke Hazır",
    statusShipped: "Sevk Edildi",
    statusDelivered: "Teslim Edildi",
    statusCompleted: "Tamamlandı",
    statusCancelled: "İptal",
    // Görünüm modu
    list: "Liste",
    monthWeek: "Ay / Hafta",
    byOrder: "Sipariş Bazlı",
    // Ortak
    showing: "Göster",
    all: "Tümü",
    onlyOverdue: "Sadece Gecikmiş",
    onlyPending: "Sadece Bekleyen",
    allCustomers: "Tüm Müşteriler",
    searchOrderNo: "Sipariş no ara...",
    clearFilters: "Filtreleri Temizle",
    days: "gün",
    year: "yıl",
    months30: "30 gün",
    months60: "60 gün",
    months90: "90 gün",
    months180: "180 gün",
    year1: "1 yıl",
    daily: "Gün bazlı",
    weekly: "Hafta bazlı",
    monthly: "Ay bazlı",
    period: "Dönem",
    // Tablo başlıkları
    tableItems: "Klm",
    tableTotalPaid: "Tutar / Ödenen",
    tableUSD: "USD",
    tableCollect: "Tahsil",
    // Sayfa subtitle ek
    upcoming: "Yaklaşan",
    upcomingPayments: "Yaklaşan Tahsilatlar",
    nextMonth: "Önümüzdeki",
    addCost: "Maliyet Ekle",
    additionalCostsSubtitle: "palet, paketleme, navlun vb. KDV'ye dahil edilir",
    noAdditionalCosts: "Henüz ek maliyet yok. \"Maliyet Ekle\" ile ekle.",
    description: "Açıklama",
    additionalCostTotal: "İlave Maliyet Toplamı",
    // KDV/iskonto
    orderDiscount: "Sipariş İskontosu",
    customerInfo: "Müşteri Bilgileri",
    shippingInfo: "Sevkiyat Bilgileri",
    orderItems: "Sipariş Kalemleri",
    paymentMovements: "Tahsilat Hareketi",
  },
  en: {
    dashboard: "Dashboard",
    customers: "Customers",
    products: "Products",
    orders: "Orders",
    payments: "Payments",
    cashflow: "Cash Flow",
    reports: "Reports",
    settings: "Settings",
    bankAccounts: "Bank Accounts",
    records: "Records",
    operations: "Operations",
    analysis: "Analytics",
    system: "System",
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    delete: "Delete",
    edit: "Edit",
    new: "New",
    search: "Search",
    filter: "Filter",
    clear: "Clear",
    confirm: "Confirm",
    back: "Back",
    next: "Next",
    print: "Print",
    export: "Export",
    import: "Import",
    template: "Template",
    download: "Download",
    upload: "Upload",
    pdf: "PDF",
    excel: "Excel",
    yes: "Yes",
    no: "No",
    add: "Add",
    remove: "Remove",
    view: "View",
    detail: "Detail",
    actions: "Actions",
    customerCode: "Customer Code",
    customerName: "Customer Name",
    contactPerson: "Contact Person",
    email: "Email",
    phone: "Phone",
    country: "Country",
    address: "Address",
    taxNumber: "Tax Number",
    notes: "Notes",
    defaultCurrency: "Default Currency",
    paymentTerms: "Payment Terms (days)",
    orderNumber: "Order No.",
    orderDate: "Order Date",
    shipmentDate: "Planned Shipment",
    actualShipmentDate: "Actual Shipment",
    deliveryDate: "Delivery Date",
    customer: "Customer",
    items: "Items",
    item: "Item",
    quantity: "Quantity",
    unitPrice: "Unit Price",
    discount: "Discount",
    subtotal: "Subtotal",
    vat: "VAT",
    total: "Total",
    grandTotal: "Grand Total",
    additionalCosts: "Additional Costs",
    paymentPlan: "Payment Plan",
    incoterms: "Incoterms",
    shippingMethod: "Shipping Method",
    portOfLoading: "Port of Loading",
    portOfDischarge: "Port of Discharge",
    invoiceNumber: "Invoice No.",
    billOfLading: "Bill of Lading",
    status: "Status",
    currency: "Currency",
    amount: "Amount",
    dueDate: "Due Date",
    paidDate: "Payment Date",
    paymentMethod: "Payment Method",
    bankAccount: "Bank Account",
    referenceNumber: "Reference No.",
    paymentType: "Type",
    totalOrderVolume: "Total Order Volume",
    totalReceived: "Received",
    pendingPayments: "Pending Payments",
    overduePayments: "Overdue",
    monthlyCollection: "Monthly Collection",
    last12Months: "Last 12 months",
    paid: "Paid",
    pending: "Pending",
    overdue: "Overdue",
    cancelled: "Cancelled",
    partial: "Partial",
    totalOrders: "Total Orders",
    activeOrders: "Active Orders",
    shippedOrders: "Shipped",
    totalCustomers: "Total Customers",
    totalRevenue: "Total Revenue",
    openBalance: "Open Balance",
    overdueBalance: "Overdue Balance",
    overdueTotalBalance: "Total Overdue Balance",
    guestMode: "GUEST — READ ONLY",
    loginToEdit: "Log in to edit",
    login: "LOG IN",
    logout: "LOG OUT",
    pdfOrderTitle: "Order",
    pdfOrderListTitle: "Order List",
    pdfCustomerListTitle: "Customer List · Receivables Summary",
    pdfProductCatalogTitle: "Product Catalog",
    pdfPaymentListTitle: "Payment List",
    pdfCashflowTitle: "Cash Flow Projection",
    pdfStatementTitle: "ACCOUNT STATEMENT",
    pdfSummaryTitle: "Summary Report",
    pdfCreatedAt: "Generated On",
    pdfPrintBtn: "Print / Save as PDF",
    pdfFilters: "Filters",
    pdfFooter: "This report was automatically generated by the Export Operations system.",
    pdfShipmentInfo: "Shipment Information",
    pdfCustomerInfo: "Customer Information",
    pdfPaymentMovements: "Payment Movements",
    pdfOrderList: "Order List",
    pdfCurrencySummary: "Balance Summary by Currency",
    pdfTopCustomers: "Top Customers by Revenue",
    pdfTopCountries: "Revenue by Country",
    pdfTopProducts: "Top Selling Products",
    pdfSummaryMetrics: "Summary Metrics",
    pdfMonthlyProjection: "Monthly Collection Projection",
    pdfDetailedList: "Detailed List (by Due Date)",
    receivable: "RECEIVABLE",
    noBalance: "NO BALANCE",
    daysOverdue: "days overdue",
    daysToGo: "days to go",
    today: "today",
    waiting: "Waiting",
    collected: "Paid",
    // Order statuses
    statusDraft: "Draft",
    statusConfirmed: "Confirmed",
    statusProduction: "In Production",
    statusReady: "Ready to Ship",
    statusShipped: "Shipped",
    statusDelivered: "Delivered",
    statusCompleted: "Completed",
    statusCancelled: "Cancelled",
    // Payment statuses
    payStatusPending: "Pending",
    payStatusPartial: "Partially Paid",
    payStatusPaid: "Paid",
    payStatusOverdue: "Overdue",
    payStatusCancelled: "Cancelled",
    // Payment plan types
    payTypePrepayment: "Down Payment",
    payTypePreShipment: "Pre-Shipment",
    payTypeDeferred: "Deferred",
    payTypeVat: "VAT",
    // Payment methods
    methodBankTransfer: "Bank Transfer / SWIFT",
    methodLC: "Letter of Credit (L/C)",
    methodCAD: "Cash Against Documents (CAD)",
    methodCash: "Cash",
    methodOpenAccount: "Open Account",
    methodCheck: "Check",
    methodCreditCard: "Credit Card",
    methodConsignment: "Consignment",
    methodOther: "Other",
    // PageHeader subtitles
    customersSubtitle: "customer records · Open balances calculated automatically",
    productsSubtitle: "products · Auto-complete in order items",
    ordersSubtitle: "orders · Items and payment plan managed together",
    paymentsSubtitle: "payment records · Auto-generated from order payment plans",
    cashflowSubtitle: "Net date list of upcoming receivables · Overdue always shown",
    // Buttons
    newCustomer: "New Customer",
    newProduct: "New Product",
    newOrder: "New Order",
    newPayment: "New Payment",
    listView: "List",
    calendarView: "Month / Week",
    // Filters
    allCustomers: "All Customers",
    allCurrencies: "All Currencies",
    allStatuses: "All Statuses",
    show: "Show",
    onlyOverdue: "Overdue Only",
    onlyPending: "Pending Only",
    all: "All",
    clearFilters: "Clear Filters",
    searchPlaceholder: "Search...",
    weekShort: "W",
    plannedShipment: "Planned Ship.",
    received: "Received",
    language: "Language",
    turkish: "Turkish",
    english: "English",
    customersSubtitle: "customer records · Open balance is calculated automatically",
    productsSubtitle: "products · Auto-complete in order line items",
    ordersSubtitle: "orders · Items and payment plan managed together",
    paymentsSubtitle: "payment records · Auto-created from order payment plan",
    cashflowSubtitle: "Net date list of upcoming receivables · Overdue always shown",
    bankAccountsSubtitle: "Accounts where receivables go — for L/C and wire tracking",
    reportsSubtitle: "Date range, customer, country, product and status analyses",
    newCustomer: "New Customer",
    newProduct: "New Product",
    newOrder: "New Order",
    newAccount: "New Account",
    statusDraft: "Draft",
    statusConfirmed: "Confirmed",
    statusInProduction: "In Production",
    statusReadyToShip: "Ready to Ship",
    statusShipped: "Shipped",
    statusDelivered: "Delivered",
    statusCompleted: "Completed",
    statusCancelled: "Cancelled",
    list: "List",
    monthWeek: "Month / Week",
    byOrder: "By Order",
    showing: "Show",
    all: "All",
    onlyOverdue: "Overdue Only",
    onlyPending: "Pending Only",
    allCustomers: "All Customers",
    searchOrderNo: "Search order no...",
    clearFilters: "Clear Filters",
    days: "days",
    year: "year",
    months30: "30 days",
    months60: "60 days",
    months90: "90 days",
    months180: "180 days",
    year1: "1 year",
    daily: "By day",
    weekly: "By week",
    monthly: "By month",
    period: "Period",
    tableItems: "Itm",
    tableTotalPaid: "Total / Paid",
    tableUSD: "USD",
    tableCollect: "Paid %",
    upcoming: "Upcoming",
    upcomingPayments: "Upcoming Payments",
    nextMonth: "Next",
    addCost: "Add Cost",
    additionalCostsSubtitle: "pallet, packaging, freight etc. — included in VAT base",
    noAdditionalCosts: "No additional costs yet. Click \"Add Cost\" to add.",
    description: "Description",
    additionalCostTotal: "Additional Costs Total",
    orderDiscount: "Order Discount",
    customerInfo: "Customer Information",
    shippingInfo: "Shipping Information",
    orderItems: "Order Items",
    paymentMovements: "Payment Movements",
  },
};

// Aktif dil ve değiştirme yardımcıları
function getStoredLang() {
  try {
    return localStorage.getItem(LANG_KEY) || "tr";
  } catch { return "tr"; }
}
function setStoredLang(l) {
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {}
}

// Çeviri fonksiyonu — fallback Türkçe'ye
function tr(lang, key) {
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.tr[key] || key;
}

// Status / tip etiketlerini dile göre döndüren helper'lar
function getOrderStatusLabel(key, lang) {
  const map = { draft: "statusDraft", confirmed: "statusConfirmed", production: "statusProduction", ready: "statusReady", shipped: "statusShipped", delivered: "statusDelivered", completed: "statusCompleted", cancelled: "statusCancelled" };
  return tr(lang, map[key] || key);
}
function getPayStatusLabel(key, lang) {
  const map = { pending: "payStatusPending", partial: "payStatusPartial", paid: "payStatusPaid", overdue: "payStatusOverdue", cancelled: "payStatusCancelled" };
  return tr(lang, map[key] || key);
}
function getPayTypeLabel(key, lang) {
  const map = { prepayment: "payTypePrepayment", preShipment: "payTypePreShipment", deferred: "payTypeDeferred", vat: "payTypeVat" };
  return tr(lang, map[key] || key);
}
function getPayMethodLabel(key, lang) {
  const map = { bank_transfer: "methodBankTransfer", letter_of_credit: "methodLC", cad: "methodCAD", cash: "methodCash", open_account: "methodOpenAccount", check: "methodCheck", credit_card: "methodCreditCard", consignment: "methodConsignment", other: "methodOther" };
  return tr(lang, map[key] || key);
}


const TOKENS = {
  bg: "#F8F5EE",         // krem arka plan
  ink: "#0F1A2E",        // derin gece mavisi (sidebar)
  navy: "#1E3A5F",       // birincil lacivert
  gold: "#C9A961",       // sıcak altın (vurgu)
  goldDark: "#A88947",   // koyu altın
  copper: "#B87333",     // bakır
  cream: "#F4EFE3",      // açık krem (hover/zebra)
  border: "#E6DFCE",     // sınır
  muted: "#7A736A",      // ikincil metin
  forest: "#3E7D5A",     // başarı (orman)
  terracotta: "#C77847", // uyarı (sıcak)
  oxblood: "#A6383D",    // tehlike
};

// Google Fonts'tan Carlito yüklenir (Calibri'nin metric-compatible alternatifi).
// Windows/Office kullanıcıları Calibri görecek, diğerleri Carlito (görünüş aynı).
const ensureFonts = () => {
  if (document.getElementById("ef-fonts")) return;
  const link = document.createElement("link");
  link.id = "ef-fonts";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Carlito:wght@400;700&display=swap";
  document.head.appendChild(link);
};

// Calibri (Windows'ta var) → Carlito (web font, Calibri ile aynı genişlikte) → sistem font
const FONT_DISPLAY = 'Calibri, "Carlito", "Segoe UI", -apple-system, sans-serif';
const FONT_BODY = 'Calibri, "Carlito", "Segoe UI", -apple-system, sans-serif';

// ============================================================================
// VERİ DEPOSU — localStorage / Supabase otomatik seçim
// ============================================================================
// Önemli: kodun hiçbir yerinde direkt localStorage veya supabase çağrılmaz,
// her zaman bu "storage" üzerinden geçer. Backend değiştirmek bu satırların
// dışında bir değişiklik gerektirmez.

function createStorage() {
  // window.storage Claude artifact ortamında otomatik mevcut. Bu blok artifact
  // önizlemesinde aynı verinin tüm test kullanıcılarınca görülmesini sağlar.
  if (typeof window !== "undefined" && window.storage && typeof window.storage.get === "function") {
    return {
      mode: "shared",
      label: "Paylaşımlı (artifact)",
      async get(key) {
        try { const r = await window.storage.get(key, true); return r ? JSON.parse(r.value) : null; }
        catch { return null; }
      },
      async set(key, value) {
        try { await window.storage.set(key, JSON.stringify(value), true); } catch (e) { console.error(e); }
      },
    };
  }

  // Vite ortamında Supabase anahtarları .env'de varsa onu kullan, yoksa lokal
  const supaUrl = typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL;
  const supaKey = typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY;

  if (supaUrl && supaKey) {
    // Supabase modu — gerçek paylaşımlı çoklu kullanıcı için.
    // Burada lazım olan tablo: data(key text primary key, value jsonb)
    const supabase = createSupabaseClient(supaUrl, supaKey);
    return {
      mode: "cloud",
      label: "Bulut (Supabase) — Paylaşımlı",
      async get(key) {
        try {
          const r = await supabase.from("data").select("value").eq("key", key).maybeSingle();
          if (r.error) {
            console.warn(`[storage.get] Supabase hatası "${key}":`, r.error);
            // Fallback: localStorage'dan oku
            try { return JSON.parse(localStorage.getItem(`exportflow:${key}`)); } catch { return null; }
          }
          // Bulut'tan geleni cache'le ki offline olunca da görünsün
          if (r.data?.value !== undefined) {
            try { localStorage.setItem(`exportflow:${key}`, JSON.stringify(r.data.value)); } catch {}
          }
          return r.data?.value ?? null;
        } catch (e) {
          console.error("[storage.get] Beklenmeyen hata:", e);
          return null;
        }
      },
      async set(key, value) {
        // Önce yerel cache'e yaz (anlık tepki için)
        try { localStorage.setItem(`exportflow:${key}`, JSON.stringify(value)); } catch {}
        // Sonra buluta gönder
        const r = await supabase.from("data").upsert({ key, value }, { onConflict: "key" });
        if (r.error) {
          console.error(`[storage.set] Bulut kaydı başarısız "${key}":`, r.error);
        }
      },
    };
  }

  // Lokal mod — tek tarayıcı, hızlı başlangıç için
  return {
    mode: "local",
    label: "Yerel (sadece bu cihaz)",
    async get(key) {
      try { return JSON.parse(localStorage.getItem(`exportflow:${key}`)); } catch { return null; }
    },
    async set(key, value) {
      try { localStorage.setItem(`exportflow:${key}`, JSON.stringify(value)); } catch (e) { console.error(e); }
    },
  };
}

// Supabase istemcisi — fetch tabanlı, harici paket gerektirmez.
// ÖNEMLI: select() SENKRON dönmeli; aksi halde .eq() ve .maybeSingle() chain'i kırılır.
// Auth token varsa onu kullanır (yazma işlemleri authenticated user gerektirir),
// yoksa anon key (sadece okuma için).
function createSupabaseClient(url, key) {
  // Header'ları her istekte tazele (token yenilenmiş olabilir)
  const buildHeaders = async () => {
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    };
    // Eğer kullanıcı giriş yapmışsa token'ı kullan
    try {
      const token = await getValidAuthToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch {}
    return headers;
  };
  return {
    from(table) {
      const q = { _select: "*", _filters: [] };
      const builder = {
        select(cols) {
          q._select = cols || "*";
          return builder;
        },
        eq(col, val) {
          q._filters.push(`${col}=eq.${encodeURIComponent(val)}`);
          return builder;
        },
        async maybeSingle() {
          const filterStr = q._filters.join("&");
          const fullUrl = `${url}/rest/v1/${table}?select=${q._select}${filterStr ? "&" + filterStr : ""}&limit=1`;
          try {
            const headers = await buildHeaders();
            const r = await fetch(fullUrl, { headers });
            if (!r.ok) {
              console.error("Supabase select hatası:", r.status, await r.text());
              return { data: null, error: { status: r.status } };
            }
            const d = await r.json();
            return { data: Array.isArray(d) && d.length ? d[0] : null, error: null };
          } catch (e) {
            console.error("Supabase fetch hatası:", e);
            return { data: null, error: e };
          }
        },
        async upsert(obj, opts) {
          const conflict = opts?.onConflict ? `?on_conflict=${opts.onConflict}` : "";
          try {
            const headers = await buildHeaders();
            const r = await fetch(`${url}/rest/v1/${table}${conflict}`, {
              method: "POST",
              headers: {
                ...headers,
                Prefer: "resolution=merge-duplicates,return=minimal",
              },
              body: JSON.stringify(obj),
            });
            if (!r.ok) {
              const errText = await r.text();
              console.error("Supabase upsert hatası:", r.status, errText);
              return { error: { status: r.status, message: errText } };
            }
            return { error: null };
          } catch (e) {
            console.error("Supabase fetch hatası:", e);
            return { error: e };
          }
        },
      };
      return builder;
    },
  };
}

const storage = createStorage();

// ============================================================================
// SABİTLER — İHRACAT İŞ TERMİNOLOJİSİ
// ============================================================================

const CURRENCIES = ["USD", "EUR", "TRY", "GBP", "CHF", "JPY", "CNY", "RUB", "AED", "SAR"];

const DEFAULT_RATES = {
  USD: 1, EUR: 1.08, GBP: 1.27, CHF: 1.13, TRY: 0.031,
  JPY: 0.0067, CNY: 0.14, RUB: 0.011, AED: 0.27, SAR: 0.27,
};

// İhracatta yaygın Incoterms — siparişin teslim/risk koşulunu belirler
const INCOTERMS = [
  { key: "EXW", label: "EXW — İş Yerinde Teslim" },
  { key: "FCA", label: "FCA — Taşıyıcıya Teslim" },
  { key: "FOB", label: "FOB — Gemi Bordasında Teslim" },
  { key: "CFR", label: "CFR — Mal Bedeli + Navlun" },
  { key: "CIF", label: "CIF — Mal Bedeli + Sigorta + Navlun" },
  { key: "CPT", label: "CPT — Taşıma Ödenmiş Olarak" },
  { key: "CIP", label: "CIP — Taşıma + Sigorta Ödenmiş" },
  { key: "DAP", label: "DAP — Belirli Yerde Teslim" },
  { key: "DPU", label: "DPU — Boşaltılmış Teslim" },
  { key: "DDP", label: "DDP — Gümrüklü Teslim" },
];

const SHIPPING_METHODS = [
  { key: "sea", label: "Deniz Yolu", icon: Ship },
  { key: "air", label: "Hava Yolu", icon: Plane },
  { key: "road", label: "Kara Yolu", icon: Truck },
  { key: "rail", label: "Demir Yolu", icon: Truck },
  { key: "multi", label: "Multimodal", icon: Anchor },
];

// Sipariş yaşam döngüsü — tipik bir ihracat akışı
const ORDER_STATUSES = [
  { key: "draft",      label: "Taslak",        color: "muted",      desc: "Kayıt aşaması" },
  { key: "confirmed",  label: "Onaylı",        color: "navy",       desc: "Müşteri onayladı" },
  { key: "production", label: "Üretimde",      color: "copper",     desc: "Üretim/hazırlık devam ediyor" },
  { key: "ready",      label: "Sevke Hazır",   color: "gold",       desc: "Sevkiyat bekliyor" },
  { key: "shipped",    label: "Sevk Edildi",   color: "navy",       desc: "Yola çıktı" },
  { key: "delivered",  label: "Teslim Edildi", color: "forest",     desc: "Müşteri aldı" },
  { key: "completed",  label: "Tamamlandı",    color: "forest",     desc: "Tüm ödemeler alındı" },
  { key: "cancelled",  label: "İptal",         color: "oxblood",    desc: "İptal edildi" },
];

// İhracatta kritik — ödemenin geldiği yöntem nakit akışını ve riski belirler
const PAYMENT_METHODS = [
  { key: "bank_transfer",   label: "Banka Havalesi / SWIFT",  icon: Banknote, risk: "low",    desc: "En yaygın yöntem" },
  { key: "letter_of_credit",label: "Akreditif (L/C)",          icon: FileCheck, risk: "lowest",desc: "Banka garantili, evrak şartlı" },
  { key: "cad",             label: "Vesaik Mukabili (CAD)",   icon: FileText, risk: "medium", desc: "Belge karşılığı tahsilat" },
  { key: "cash",            label: "Peşin",                    icon: DollarSign, risk: "lowest",desc: "Mal sevkten önce nakit" },
  { key: "open_account",    label: "Açık Hesap",               icon: Receipt, risk: "high",    desc: "Vadeli, güven esaslı" },
  { key: "check",           label: "Çek",                      icon: Receipt, risk: "high",    desc: "" },
  { key: "credit_card",     label: "Kredi Kartı",              icon: CreditCard, risk: "low",  desc: "" },
  { key: "consignment",     label: "Konsinye",                 icon: Package, risk: "high",   desc: "Satılınca ödeme" },
  { key: "other",           label: "Diğer",                    icon: AlertCircle, risk: "medium", desc: "" },
];

// Ödeme planı kalemi tipi — bir siparişin ödemesi bu üç ana parçadan oluşur
const PAYMENT_PLAN_TYPES = [
  { key: "prepayment",  label: "Ön Ödeme",      desc: "Sipariş onayında alınan", color: "gold" },
  { key: "preShipment", label: "Sevk Öncesi",   desc: "Sevkiyattan önce alınan", color: "copper" },
  { key: "deferred",    label: "Vadeli",        desc: "Sevkten sonra X gün",     color: "navy" },
  { key: "vat",         label: "KDV",           desc: "Mal bedeli üzerine ayrı KDV ödemesi", color: "navy" },
];

// Ödeme durumu — sistem tarafından otomatik güncellenir (vade geçince "overdue")
const PAYMENT_STATUSES = [
  { key: "pending",   label: "Bekliyor",   color: "copper" },
  { key: "partial",   label: "Kısmi Ödendi", color: "gold" },
  { key: "paid",      label: "Ödendi",     color: "forest" },
  { key: "overdue",   label: "Gecikmiş",   color: "oxblood" },
  { key: "cancelled", label: "İptal",      color: "muted" },
];

// ============================================================================
// YARDIMCI FONKSİYONLAR
// ============================================================================

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const fmtMoney = (n, cur = "USD", opts = {}) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: cur,
    minimumFractionDigits: opts.compact ? 0 : 2,
    maximumFractionDigits: opts.compact ? 0 : 2,
  }).format(n);
};

const fmtNum = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(n);
};

const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return "—";
  return dt.toLocaleDateString("tr-TR");
};

const fmtDateLong = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return "—";
  return dt.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
};

// ISO 8601 hafta numarası — "W15" gibi gösterilir
function getISOWeek(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target) / 604800000);
}

const fmtDateWithWeek = (d) => {
  if (!d) return "—";
  const w = getISOWeek(d);
  return w ? `${fmtDate(d)} · W${w}` : fmtDate(d);
};

// ============================================================================
// PDF YAZDIRMA — Tek pencere, ortak stil
// ============================================================================
// Yeni pencere açar, A4 sayfa stiliyle render eder, otomatik yazdırma diyaloğu açar.
// Kullanıcı "PDF olarak kaydet" seçeneğini seçebilir.

function printPDF({ title, subtitle, contentHtml, orientation = "portrait", lang }) {
  const w = window.open("", "_blank", "width=1000,height=750");
  // Eğer lang parametresi verilmediyse localStorage'dan otomatik oku
  const activeLang = lang || getStoredLang();
  if (!w) { alert(activeLang === "en" ? "Popup blocked. Please allow popups for this site." : "Popup engellendi. Tarayıcı ayarlarından bu site için popup'a izin ver."); return; }

  const t = (key) => tr(activeLang, key);
  const brandTitle = activeLang === "en" ? "Export Operations" : "İhracat Operasyonları";
  const brandSub = activeLang === "en" ? "Management System" : "Yönetim Sistemi";

  const html = `<!DOCTYPE html>
<html lang="tr">
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
  h3 { font-size: 11px; margin: 10px 0 4px; color: #0F1A2E; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px; page-break-inside: avoid; }
  th { padding: 6px 8px; border: 1px solid #ccc; background: #F8F5EE; text-align: left; font-weight: 700; color: #0F1A2E; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; }
  td { padding: 5px 8px; border: 1px solid #ccc; vertical-align: top; }
  td.right, th.right { text-align: right; }
  td.center, th.center { text-align: center; }
  td.label { color: #7A736A; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin: 6px 0 12px; font-size: 11px; }
  .info-grid > div { padding: 2px 0; }
  .label { color: #7A736A; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }
  .summary-card { background: #F8F5EE; border: 1px solid #C9A961; padding: 10px 14px; border-radius: 4px; margin: 8px 0 12px; }
  .badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
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
  .print-btn:hover { background: #0F1A2E; }
  @media print {
    .no-print { display: none !important; }
    body { padding: 0; }
    h2 { page-break-after: avoid; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">${t("pdfPrintBtn")}</button>
  <div class="doc-header">
    <div class="left">
      <h1>${title}</h1>
      ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ""}
    </div>
    <div class="right">
      <div class="brand">${brandTitle}</div>
      <div>${brandSub}</div>
      <div style="margin-top:4px;color:#0F1A2E;font-weight:600">${fmtDateLong(todayISO())}</div>
    </div>
  </div>
  ${contentHtml}
  <div class="footer">
    ${t("pdfFooter")} · ${fmtDateLong(todayISO())}
  </div>
  <script>
    // Otomatik yazdırma kaldırıldı — kullanıcı 'Yazdır / PDF Kaydet' butonuna basarak başlatır
  </script>
</body>
</html>`;

  w.document.write(html);
  w.document.close();
}

// HTML escape — XSS koruma + karakter sorunlarını engeller
function htmlEscape(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Sayı formatı PDF için (Türkçe)
function fmtMoneyPDF(n, cur) {
  const v = (Number(n) || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cur ? `${cur} ${v}` : v;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const daysBetween = (a, b) => {
  if (!a || !b) return 0;
  return Math.round((new Date(b) - new Date(a)) / 86400000);
};

const addDays = (d, n) => {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
};

const toUSD = (amount, currency, rates) => (amount || 0) * (rates[currency] ?? 1);

const downloadBlob = (data, filename, type = "application/octet-stream") => {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

// ============================================================================
// AUTH — Supabase Auth ile entegre
// ============================================================================
// Kullanıcılar Supabase Dashboard üzerinden tanımlanır (Authentication → Users).
// Misafir kullanıcı sadece görüntüler, giriş yapan düzenler.
// Token otomatik yenilenir.

const SUPABASE_URL_AUTH = import.meta.env?.VITE_SUPABASE_URL || "";
const SUPABASE_KEY_AUTH = import.meta.env?.VITE_SUPABASE_ANON_KEY || "";
const SESSION_KEY = "exportflow_session_v2";

async function supabaseLogin(email, password) {
  if (!SUPABASE_URL_AUTH || !SUPABASE_KEY_AUTH) {
    return { error: "Supabase yapılandırılmamış. Vercel'de VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanımlı mı?" };
  }
  try {
    const res = await fetch(`${SUPABASE_URL_AUTH}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY_AUTH, "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data.error_description || data.msg || data.error || "Giriş başarısız" };
    }
    const session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + ((data.expires_in || 3600) * 1000),
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || data.user.email?.split("@")[0] || "Kullanıcı",
        role: data.user.user_metadata?.role || "editor", // varsayılan editor
      },
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { session };
  } catch (e) {
    return { error: "Bağlantı hatası: " + e.message };
  }
}

async function supabaseRefreshToken() {
  const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  if (!s?.refresh_token) return null;
  try {
    const res = await fetch(`${SUPABASE_URL_AUTH}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY_AUTH, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    });
    if (!res.ok) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    const data = await res.json();
    const newSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + ((data.expires_in || 3600) * 1000),
      user: s.user,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    return newSession;
  } catch {
    return null;
  }
}

function getStoredSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (!s) return null;
    return s;
  } catch { return null; }
}

function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY);
}

// Auth token al — geçerliyse direkt, süresi dolmuşsa refresh dene
async function getValidAuthToken() {
  const s = getStoredSession();
  if (!s) return null;
  // Token süresi dolmuşsa refresh
  if (s.expires_at && s.expires_at < Date.now() + 60000) { // 1 dk önce yenile
    const refreshed = await supabaseRefreshToken();
    return refreshed?.access_token || null;
  }
  return s.access_token;
}

const USER_ROLES = [
  { key: "admin",  label: "Yönetici",     desc: "Tüm işlemler + kullanıcı yönetimi" },
  { key: "editor", label: "Editör",       desc: "Tüm kayıtları düzenler" },
  { key: "viewer", label: "Görüntüleyici", desc: "Sadece okur" },
];


// Akıllı sayı parser — Excel'den yapıştırma için TR/EN formatını otomatik tanır
// "1.234,56" → 1234.56 (TR), "1,234.56" → 1234.56 (EN), "1234,56" → 1234.56, "1234.56" → 1234.56
const parseNumber = (str) => {
  if (typeof str === "number") return str;
  if (str === null || str === undefined || str === "") return 0;
  let s = String(str).trim();
  // Para birimi simgelerini ve harfleri at
  s = s.replace(/[^\d,.\-]/g, "");
  if (!s) return 0;
  const hasComma = s.includes(",");
  const hasPeriod = s.includes(".");
  if (hasComma && hasPeriod) {
    // İkisi de var: SONUNCU olan ondalık ayraçtır, diğeri binlik
    const lastComma = s.lastIndexOf(",");
    const lastPeriod = s.lastIndexOf(".");
    if (lastComma > lastPeriod) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Sadece virgül → ondalık say
    s = s.replace(",", ".");
  }
  // Sadece nokta veya hiçbiri → parseFloat zaten düzgün okur
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
};

// Sipariş toplam hesaplaması — KDV ve iskonto destekli
// Geri uyumlu: vatRate, discountType, discountValue, item.discount eski siparişlerde
// olmadığında 0 sayılır (varsayılan davranış değişmez).
function calcOrderTotals(order) {
  const items = order?.items || [];
  // Her kalem için indirim sonrası satır toplamı
  const itemSubs = items.map((i) => {
    const base = (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0);
    const lineDisc = Number(i.discount) || 0; // %
    return base * (1 - lineDisc / 100);
  });
  const subtotal = itemSubs.reduce((s, x) => s + x, 0);

  // Sipariş seviyesi iskonto
  let discount = 0;
  if (order?.discountType === "percentage") {
    discount = subtotal * (Number(order.discountValue) || 0) / 100;
  } else if (order?.discountType === "amount") {
    discount = Number(order.discountValue) || 0;
  }
  const afterDiscount = Math.max(0, subtotal - discount);

  // İlave maliyetler (palet, paket, navlun vb) - KDV'ye dahil olur
  const additionalCosts = (order?.additionalCosts || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const baseForVat = afterDiscount + additionalCosts;

  // KDV
  const vatRate = Number(order?.vatRate) || 0;
  const vatAmount = baseForVat * vatRate / 100;
  const total = baseForVat + vatAmount;

  return { subtotal, discount, afterDiscount, additionalCosts, baseForVat, vatRate, vatAmount, total };
}

const orderTotal = (o) => calcOrderTotals(o).total;

// Sipariş USD karşılığı — eğer fiili sevk tarihinde kur kilitlenmişse onu kullan,
// değilse mevcut kur. Bu sayede sevk edilmiş siparişlerin USD ciro değeri,
// TCMB güncellemesinden sonra değişmez.
function orderTotalUSD(order, rates) {
  const total = orderTotal(order);
  if (!total) return 0;
  // Sipariş kuru zaten USD'yse direkt
  if (order.currency === "USD") return total;
  // Kilitli kur var mı?
  const lockedRate = order.lockedRateAtShipment;
  if (lockedRate && lockedRate > 0) return total * lockedRate;
  // Aksi halde mevcut kur
  return toUSD(total, order.currency, rates);
}

const planTotal = (o) => (o?.paymentPlan || []).reduce((t, p) => t + (Number(p.amount) || 0), 0);

const orderPaidAmount = (o, payments) =>
  payments.filter((p) => p.orderId === o.id && p.status === "paid").reduce((s, p) => s + (Number(p.amount) || 0), 0);

// Excel
const exportToExcel = (rows, filename, sheetName = "Veri") => {
  if (!rows || rows.length === 0) return false;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(out, filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  return true;
};

const importFromExcel = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: "array" });
      resolve(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]));
    } catch (err) { reject(err); }
  };
  reader.onerror = reject;
  reader.readAsArrayBuffer(file);
});

// ============================================================================
// UI ATOMLARI — TUTARLI BİLEŞENLER
// ============================================================================

// Buton — variant'lar arası net hiyerarşi: primary (lacivert) > accent (altın)
function Btn({ variant = "primary", size = "md", icon: Icon, children, className = "", ...rest }) {
  const sz = {
    xs: "px-2 py-1 text-[11px] gap-1",
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-sm gap-2",
  }[size];

  const variants = {
    primary: { bg: TOKENS.navy, hover: TOKENS.ink, color: "white", border: TOKENS.navy },
    accent:  { bg: TOKENS.gold, hover: TOKENS.goldDark, color: TOKENS.ink, border: TOKENS.gold },
    ghost:   { bg: "transparent", hover: TOKENS.cream, color: TOKENS.navy, border: "transparent" },
    secondary:{ bg: "white", hover: TOKENS.cream, color: TOKENS.navy, border: TOKENS.border },
    danger:  { bg: TOKENS.oxblood, hover: "#8a2c30", color: "white", border: TOKENS.oxblood },
    success: { bg: TOKENS.forest, hover: "#2f6647", color: "white", border: TOKENS.forest },
  }[variant];

  return (
    <button
      className={`inline-flex items-center justify-center font-medium rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed border ${sz} ${className}`}
      style={{ background: variants.bg, color: variants.color, borderColor: variants.border }}
      onMouseEnter={(e) => !rest.disabled && (e.currentTarget.style.background = variants.hover)}
      onMouseLeave={(e) => !rest.disabled && (e.currentTarget.style.background = variants.bg)}
      {...rest}
    >
      {Icon && <Icon size={size === "xs" ? 11 : size === "sm" ? 13 : 15} />}
      {children}
    </button>
  );
}

function Input({ className = "", error, ...rest }) {
  return (
    <input
      className={`w-full px-3 py-2 text-sm bg-white rounded-md focus:outline-none transition border ${className}`}
      style={{
        borderColor: error ? TOKENS.oxblood : TOKENS.border,
        fontFamily: FONT_BODY,
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = TOKENS.navy)}
      onBlur={(e) => (e.currentTarget.style.borderColor = error ? TOKENS.oxblood : TOKENS.border)}
      {...rest}
    />
  );
}

function Textarea({ className = "", ...rest }) {
  return (
    <textarea
      className={`w-full px-3 py-2 text-sm bg-white rounded-md focus:outline-none transition border resize-y ${className}`}
      style={{ borderColor: TOKENS.border, fontFamily: FONT_BODY }}
      onFocus={(e) => (e.currentTarget.style.borderColor = TOKENS.navy)}
      onBlur={(e) => (e.currentTarget.style.borderColor = TOKENS.border)}
      rows={3}
      {...rest}
    />
  );
}

function Select({ className = "", children, ...rest }) {
  return (
    <div className="relative">
      <select
        className={`w-full px-3 py-2 pr-8 text-sm bg-white rounded-md focus:outline-none transition border appearance-none cursor-pointer ${className}`}
        style={{ borderColor: TOKENS.border, fontFamily: FONT_BODY }}
        onFocus={(e) => (e.currentTarget.style.borderColor = TOKENS.navy)}
        onBlur={(e) => (e.currentTarget.style.borderColor = TOKENS.border)}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: TOKENS.muted }} />
    </div>
  );
}

function Label({ children, required, hint, className = "" }) {
  return (
    <label className={`block text-[11px] font-medium mb-1 ${className}`} style={{ color: TOKENS.ink, letterSpacing: "0.02em" }}>
      <span className="uppercase tracking-wide">{children}</span>
      {required && <span style={{ color: TOKENS.oxblood }}> *</span>}
      {hint && <span className="ml-1.5 normal-case font-normal text-[10px]" style={{ color: TOKENS.muted }}>· {hint}</span>}
    </label>
  );
}

function Badge({ color = "muted", children, dot, className = "" }) {
  const c = TOKENS[color] || TOKENS.muted;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md whitespace-nowrap ${className}`}
      style={{ background: c + "18", color: c, border: `1px solid ${c}33` }}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />}
      {children}
    </span>
  );
}

function Pill({ children, color = "navy", className = "" }) {
  const c = TOKENS[color] || TOKENS.navy;
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider ${className}`}
      style={{ background: c, color: "white" }}>
      {children}
    </span>
  );
}

// Sayfa başlığı — modüller arası tutarlı görünüm
function PageHeader({ title, subtitle, breadcrumb, children }) {
  return (
    <div className="px-8 py-6 border-b" style={{ background: "white", borderColor: TOKENS.border }}>
      <div className="flex items-end justify-between gap-4">
        <div>
          {breadcrumb && (
            <div className="text-[11px] mb-2 flex items-center gap-1.5" style={{ color: TOKENS.muted }}>
              {breadcrumb}
            </div>
          )}
          <h1 className="text-2xl tracking-tight" style={{ fontFamily: FONT_DISPLAY, color: TOKENS.ink, fontWeight: 600 }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs mt-1" style={{ color: TOKENS.muted }}>{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">{children}</div>
      </div>
    </div>
  );
}

// Kart — tüm modüllerde panel için
function Card({ title, subtitle, children, action, className = "", noPadding }) {
  return (
    <div
      className={`rounded-lg overflow-hidden transition-shadow hover:shadow-sm ${className}`}
      style={{ background: "white", border: `1px solid ${TOKENS.border}` }}
    >
      {(title || action) && (
        <div className="px-5 py-3 flex items-center justify-between border-b" style={{ borderColor: TOKENS.border }}>
          <div>
            {title && <h3 className="text-sm font-semibold" style={{ color: TOKENS.ink }}>{title}</h3>}
            {subtitle && <p className="text-[11px] mt-0.5" style={{ color: TOKENS.muted }}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={noPadding ? "" : "p-5"}>{children}</div>
    </div>
  );
}

// Modal — sayfayı kaydırmadan açılır
function Modal({ open, onClose, title, subtitle, children, size = "md", footer }) {
  // ESC tuşu kapatmaz — yanlışlıkla kapanmayı önler. Sadece X butonu veya
  // İptal/Kaydet butonları ile kapatılabilir.
  if (!open) return null;

  const sizes = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-6xl", "2xl": "max-w-7xl" };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: "rgba(15, 26, 46, 0.5)", backdropFilter: "blur(4px)" }}>
      <div
        className={`w-full ${sizes[size]} my-8 rounded-lg overflow-hidden shadow-2xl`}
        style={{ background: "white", border: `1px solid ${TOKENS.border}` }}
      >
        <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: TOKENS.border, background: TOKENS.cream }}>
          <div>
            <h3 className="text-base font-semibold" style={{ color: TOKENS.ink, fontFamily: FONT_DISPLAY }}>{title}</h3>
            {subtitle && <p className="text-[11px] mt-0.5" style={{ color: TOKENS.muted }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/50 transition" style={{ color: TOKENS.muted }} title="Kapat">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
        {footer && (
          <div className="px-6 py-3 flex items-center justify-end gap-2 border-t" style={{ borderColor: TOKENS.border, background: TOKENS.cream + "60" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// Tablo — sıralama, satır tıklama, eylem sütunu
function DataTable({ columns, rows, keyField = "id", onRowClick, emptyText = "Kayıt yok", emptyHint, actions, defaultSort, rowStyle }) {
  const [sort, setSort] = useState(defaultSort || { key: null, dir: "asc" });

  const sorted = useMemo(() => {
    if (!sort.key) return rows;
    const col = columns.find((c) => c.key === sort.key);
    return [...rows].sort((a, b) => {
      const av = col?.sortValue ? col.sortValue(a) : a[sort.key];
      const bv = col?.sortValue ? col.sortValue(b) : b[sort.key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return sort.dir === "asc" ? av - bv : bv - av;
      return sort.dir === "asc"
        ? String(av).localeCompare(String(bv), "tr")
        : String(bv).localeCompare(String(av), "tr");
    });
  }, [rows, sort, columns]);

  const toggleSort = (key) => {
    setSort((s) => {
      if (s.key !== key) return { key, dir: "asc" };
      if (s.dir === "asc") return { key, dir: "desc" };
      return { key: null, dir: "asc" };
    });
  };

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "white", border: `1px solid ${TOKENS.border}` }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ background: TOKENS.cream }}>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => c.sortable !== false && toggleSort(c.key)}
                  className={`px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${
                    c.sortable !== false ? "cursor-pointer select-none" : ""
                  } ${c.align === "right" ? "text-right" : ""} ${c.align === "center" ? "text-center" : ""}`}
                  style={{ color: TOKENS.ink, borderBottom: `1px solid ${TOKENS.border}`, width: c.width }}
                >
                  <span className={`inline-flex items-center gap-1.5 ${c.align === "right" ? "justify-end" : ""}`}>
                    {c.label}
                    {c.sortable !== false && (
                      sort.key === c.key
                        ? sort.dir === "asc" ? <ArrowUp size={11} style={{ color: TOKENS.gold }} /> : <ArrowDown size={11} style={{ color: TOKENS.gold }} />
                        : <ArrowUpDown size={10} style={{ color: TOKENS.muted, opacity: 0.4 }} />
                    )}
                  </span>
                </th>
              ))}
              {actions && <th className="px-4 py-3 w-1" style={{ borderBottom: `1px solid ${TOKENS.border}` }} />}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="px-4 py-16 text-center">
                  <div style={{ color: TOKENS.muted }}>
                    <div className="text-sm font-medium mb-1">{emptyText}</div>
                    {emptyHint && <div className="text-xs">{emptyHint}</div>}
                  </div>
                </td>
              </tr>
            ) : (
              sorted.map((row, idx) => {
                const customStyle = rowStyle ? rowStyle(row) : null;
                const baseBg = customStyle?.background || "white";
                const hoverBg = customStyle?.hoverBackground || (TOKENS.cream + "60");
                return (
                <tr
                  key={row[keyField] ?? idx}
                  onClick={() => onRowClick?.(row)}
                  className={`transition ${onRowClick ? "cursor-pointer" : ""}`}
                  style={{ borderBottom: `1px solid ${TOKENS.border}30`, background: baseBg }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = baseBg)}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-4 py-3 ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.align === "center" ? "text-center" : ""} ${c.className || ""}`}
                      style={{ color: TOKENS.ink }}
                    >
                      {c.render ? c.render(row) : row[c.key] ?? "—"}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {actions(row)}
                    </td>
                  )}
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 text-[11px] flex items-center justify-between" style={{ background: TOKENS.cream + "40", borderTop: `1px solid ${TOKENS.border}`, color: TOKENS.muted }}>
        <span>{sorted.length} kayıt</span>
        {sort.key && <span>Sıralama: {columns.find(c => c.key === sort.key)?.label} {sort.dir === "asc" ? "↑" : "↓"}</span>}
      </div>
    </div>
  );
}

// Filtre çubuğu — modüller arasında ortak
function FilterBar({ children }) {
  return (
    <div className="rounded-lg p-3 flex flex-wrap items-end gap-3" style={{ background: "white", border: `1px solid ${TOKENS.border}` }}>
      {children}
    </div>
  );
}

// MULTI-SELECT — birden fazla değer seçilebilen dropdown
// values: array of string (seçili değerler)
// onChange: (newArray) => void
// options: [{ value, label, sub? }]
function MultiSelect({ values = [], onChange, options = [], placeholder = "Tümü", className = "", maxLabels = 2 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (v) => {
    if (values.includes(v)) {
      onChange(values.filter((x) => x !== v));
    } else {
      onChange([...values, v]);
    }
  };

  const clearAll = (e) => { e.stopPropagation(); onChange([]); };

  // Görünen etiket
  let displayLabel;
  if (values.length === 0) {
    displayLabel = placeholder;
  } else if (values.length <= maxLabels) {
    displayLabel = values
      .map((v) => options.find((o) => o.value === v)?.label || v)
      .join(", ");
  } else {
    displayLabel = `${values.length} seçili`;
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 text-xs font-bold rounded-md text-left flex items-center justify-between gap-2 transition"
        style={{
          background: "white",
          border: `1px solid ${values.length > 0 ? TOKENS.gold : TOKENS.border}`,
          color: values.length > 0 ? TOKENS.ink : TOKENS.muted,
          minHeight: "36px",
        }}
      >
        <span className="truncate flex-1">{displayLabel}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {values.length > 0 && (
            <span
              role="button"
              onClick={clearAll}
              className="p-0.5 rounded transition flex items-center justify-center"
              style={{ color: TOKENS.muted, cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = TOKENS.oxblood + "15"; e.currentTarget.style.color = TOKENS.oxblood; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TOKENS.muted; }}
              title="Temizle"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={12} style={{ color: TOKENS.muted, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </div>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 overflow-auto rounded-md shadow-lg" style={{ background: "white", border: `1px solid ${TOKENS.border}`, minWidth: "100%" }}>
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs" style={{ color: TOKENS.muted }}>Seçenek yok</div>
          ) : (
            options.map((opt) => {
              const checked = values.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  onClick={() => toggle(opt.value)}
                  className="px-3 py-2 text-xs cursor-pointer flex items-center gap-2 transition"
                  style={{ background: checked ? TOKENS.gold + "12" : "transparent" }}
                  onMouseEnter={(e) => { if (!checked) e.currentTarget.style.background = TOKENS.cream; }}
                  onMouseLeave={(e) => { if (!checked) e.currentTarget.style.background = "transparent"; }}
                >
                  <div className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0" style={{ background: checked ? TOKENS.gold : "white", border: `1px solid ${checked ? TOKENS.gold : TOKENS.border}` }}>
                    {checked && <Check size={10} style={{ color: TOKENS.ink }} strokeWidth={3} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate" style={{ color: TOKENS.ink }}>{opt.label}</div>
                    {opt.sub && <div className="text-[10px] truncate" style={{ color: TOKENS.muted }}>{opt.sub}</div>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function SearchInput({ value, onChange, placeholder = "Ara..." }) {
  return (
    <div className="relative flex-1 min-w-[220px]">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: TOKENS.muted }} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 text-sm rounded-md border focus:outline-none transition"
        style={{ borderColor: TOKENS.border, background: "white" }}
        onFocus={(e) => (e.currentTarget.style.borderColor = TOKENS.navy)}
        onBlur={(e) => (e.currentTarget.style.borderColor = TOKENS.border)}
      />
    </div>
  );
}

function DateRange({ from, to, onChange }) {
  return (
    <div className="flex items-end gap-2">
      <div>
        <Label hint="dahil">Başlangıç</Label>
        <Input type="date" value={from || ""} onChange={(e) => onChange({ from: e.target.value, to })} className="w-36" />
      </div>
      <div>
        <Label hint="dahil">Bitiş</Label>
        <Input type="date" value={to || ""} onChange={(e) => onChange({ from, to: e.target.value })} className="w-36" />
      </div>
    </div>
  );
}

// Boş durum — anlamlı mesaj + eyleme yönlendirme
function EmptyState({ icon: Icon = Sparkles, title, hint, action }) {
  return (
    <div className="text-center py-16 px-6">
      <div className="inline-flex w-14 h-14 items-center justify-center rounded-full mb-4" style={{ background: TOKENS.cream, color: TOKENS.gold }}>
        <Icon size={24} />
      </div>
      <h3 className="text-base font-semibold mb-2" style={{ color: TOKENS.ink, fontFamily: FONT_DISPLAY }}>{title}</h3>
      {hint && <p className="text-xs max-w-md mx-auto mb-5" style={{ color: TOKENS.muted }}>{hint}</p>}
      {action}
    </div>
  );
}

// ============================================================================
// ANA UYGULAMA
// ============================================================================

export default function App() {
  // ----- Veri durumları -----
  const [view, setView] = useState("dashboard");
  const [loaded, setLoaded] = useState(false);

  // Yeni veri modeli — eskisinden farklı: customers ve bankAccounts eklendi
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [rates, setRates] = useState(DEFAULT_RATES);
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [pendingOrderToOpen, setPendingOrderToOpen] = useState(null);
  const [lang, setLangState] = useState(getStoredLang());
  const setLang = (l) => { setStoredLang(l); setLangState(l); };
  const t = useCallback((key) => tr(lang, key), [lang]);

  const [toast, setToast] = useState(null);
  const showToast = useCallback((msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ----- İlk yükleme -----
  useEffect(() => {
    ensureFonts();
    (async () => {
      try {
        const [c, p, ba, o, pm, r] = await Promise.all([
          storage.get("customers"), storage.get("products"), storage.get("bankAccounts"),
          storage.get("orders"), storage.get("payments"), storage.get("rates"),
        ]);
        if (c) setCustomers(c);
        if (p) setProducts(p);
        if (ba) setBankAccounts(ba);
        if (o) setOrders(o);
        if (pm) setPayments(pm);
        if (r) setRates(r);

        // Supabase oturum kontrolü
        const session = getStoredSession();
        if (session?.user) {
          // Token süresi dolmuşsa refresh dene
          if (session.expires_at && session.expires_at < Date.now()) {
            const refreshed = await supabaseRefreshToken();
            if (refreshed) setCurrentUser(refreshed.user);
            else clearStoredSession();
          } else {
            setCurrentUser(session.user);
          }
        }
        setAuthReady(true);

        // TCMB kurlarını günde bir kez otomatik güncelle
        const lastUpdate = r?._lastUpdate;
        if (!lastUpdate || lastUpdate < todayISO()) {
          try {
            const tcmbRes = await fetch("/api/tcmb");
            if (tcmbRes.ok) {
              const data = await tcmbRes.json();
              const newRates = { ...(r || DEFAULT_RATES) };
              Object.entries(data).forEach(([k, v]) => {
                if (k.startsWith("_")) return;
                if (typeof v === "number") newRates[k] = v;
              });
              newRates._lastUpdate = data._date || todayISO();
              newRates._source = "TCMB";
              setRates(newRates);
              console.log("[TCMB] Kurlar otomatik güncellendi:", data._date);
            }
          } catch (e) {
            console.warn("[TCMB] Otomatik güncelleme başarısız (manuel kurlar kullanılacak):", e.message);
          }
        }
      } catch (e) { console.error(e); }
      setLoaded(true);
    })();
  }, []);

  // ----- Otomatik kayıt — değişiklik olunca storage'a yaz -----
  useEffect(() => { if (loaded) storage.set("customers", customers); }, [customers, loaded]);
  useEffect(() => { if (loaded) storage.set("products", products); }, [products, loaded]);
  useEffect(() => { if (loaded) storage.set("bankAccounts", bankAccounts); }, [bankAccounts, loaded]);
  useEffect(() => { if (loaded) storage.set("orders", orders); }, [orders, loaded]);
  useEffect(() => { if (loaded) storage.set("payments", payments); }, [payments, loaded]);
  useEffect(() => { if (loaded) storage.set("rates", rates); }, [rates, loaded]);

  // ----- Vade geçmiş ödemeleri otomatik "gecikmiş" işaretle -----
  // Not: Bu, raporlama içindir; ödeme kaydının statusunu kalıcı değiştirmez.
  // Ödeme tamamen ödenmiş olarak işaretlenmedikçe ve vade geçtikçe gecikmiş gösterilir.
  const enrichedPayments = useMemo(() => {
    const t = todayISO();
    return payments.map((p) => {
      if (p.status === "pending" && p.dueDate && p.dueDate < t) {
        return { ...p, status: "overdue", _autoOverdue: true };
      }
      return p;
    });
  }, [payments]);

  // ----- Tüm modüllere geçilen context -----
  // ----- Auth durumu — düzenleme yetkisi -----
  const canEdit = !!(currentUser && (currentUser.role === "admin" || currentUser.role === "editor"));
  const isAdmin = currentUser?.role === "admin";

  const ctx = {
    customers, setCustomers,
    products, setProducts,
    bankAccounts, setBankAccounts,
    orders, setOrders,
    payments: enrichedPayments, setPayments,
    rates, setRates,
    currentUser, setCurrentUser,
    canEdit, isAdmin,
    pendingOrderToOpen, setPendingOrderToOpen,
    showToast,
    setView,
    lang, setLang, t,
  };

  // ----- Yükleniyor ekranı -----
  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: TOKENS.bg, fontFamily: FONT_BODY }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 mb-3" style={{ borderColor: TOKENS.gold, borderTopColor: "transparent" }} />
          <div className="text-sm" style={{ color: TOKENS.muted }}>Veriler yükleniyor…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: TOKENS.bg, fontFamily: FONT_BODY, color: TOKENS.ink }}>
      <Sidebar
        view={view}
        setView={setView}
        storageMode={storage.mode}
        storageLabel={storage.label}
        currentUser={currentUser}
        onLoginClick={() => setShowLogin(true)}
        onLogout={() => { clearStoredSession(); setCurrentUser(null); showToast("Çıkış yapıldı", "info"); }}
        lang={lang}
        setLang={setLang}
        t={t}
      />
      <main className="flex-1 overflow-x-hidden min-w-0">
        {view === "dashboard"     && <DashboardView {...ctx} />}
        {view === "customers"     && <CustomersView {...ctx} />}
        {view === "products"      && <ProductsView {...ctx} />}
        {view === "orders"        && <OrdersView {...ctx} />}
        {view === "payments"      && <PaymentsView {...ctx} />}
        {view === "cashflow"      && <CashFlowView {...ctx} />}
        {view === "bankAccounts"  && <BankAccountsView {...ctx} />}
        {view === "reports"       && <ReportsView {...ctx} />}
        {view === "settings"      && <SettingsView {...ctx} />}
      </main>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <LoginModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        setCurrentUser={setCurrentUser}
        showToast={showToast}
      />
    </div>
  );
}

// ============================================================================
// SIDEBAR — sol menü
// ============================================================================

function Sidebar({ view, setView, storageMode, storageLabel, currentUser, onLoginClick, onLogout, lang, setLang, t }) {
  const sections = [
    {
      title: t("dashboard"),
      items: [
        { key: "dashboard", label: t("dashboard"), icon: LayoutDashboard },
      ],
    },
    {
      title: t("operations"),
      items: [
        { key: "orders",    label: t("orders"),    icon: FileText },
        { key: "payments",  label: t("payments"),  icon: CreditCard },
        { key: "cashflow",  label: t("cashflow"),  icon: TrendingUp },
      ],
    },
    {
      title: t("records"),
      items: [
        { key: "customers", label: t("customers"), icon: Users },
        { key: "products",  label: t("products"),  icon: Package },
      ],
    },
    {
      title: t("analysis"),
      items: [
        { key: "reports",  label: t("reports"),  icon: BarChart3 },
      ],
    },
    {
      title: t("system"),
      items: [
        { key: "settings", label: t("settings"),  icon: Settings },
      ],
    },
  ];

  const storageBadge = {
    cloud:  { color: TOKENS.forest, icon: Cloud,    text: "Bulut · Paylaşımlı" },
    shared: { color: TOKENS.gold,   icon: Cloud,    text: "Paylaşımlı (Test)" },
    local:  { color: TOKENS.muted,  icon: CloudOff, text: "Yerel · Tek Cihaz" },
  }[storageMode] || { color: TOKENS.muted, icon: CloudOff, text: "Yerel" };

  const SBIcon = storageBadge.icon;

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col" style={{ background: TOKENS.ink, color: "#cbd5e1" }}>
      {/* LOGO */}
      <div className="px-5 py-5 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${TOKENS.gold}, ${TOKENS.copper})` }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={TOKENS.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12 L12 4 L22 12" />
            <path d="M5 11 V20 H19 V11" />
            <path d="M9 16 H15" />
          </svg>
        </div>
        <div>
          <div className="font-semibold text-white tracking-wider text-[13px]" style={{ fontFamily: FONT_DISPLAY, letterSpacing: "0.05em" }}>İHRACAT OPERASYONLARI</div>
          <div className="text-[10px] uppercase tracking-widest" style={{ color: TOKENS.gold }}>Yönetim Sistemi</div>
        </div>
      </div>

      {/* MENÜ */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {sections.map((sec) => (
          <div key={sec.title} className="mb-3">
            <div className="px-5 py-1.5 text-[10px] uppercase tracking-widest font-semibold" style={{ color: "#64748b" }}>
              {sec.title}
            </div>
            {sec.items.map((item) => {
              const Icon = item.icon;
              const active = view === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className="w-full flex items-center gap-3 px-5 py-2 text-[13px] transition relative group"
                  style={{
                    background: active ? "rgba(201, 169, 97, 0.08)" : "transparent",
                    color: active ? "white" : "#cbd5e1",
                  }}
                  onMouseEnter={(e) => !active && (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                  onMouseLeave={(e) => !active && (e.currentTarget.style.background = "transparent")}
                >
                  {active && <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: TOKENS.gold }} />}
                  <Icon size={15} style={{ color: active ? TOKENS.gold : "#94a3b8" }} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* KULLANICI KARTI */}
      <div className="p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        {currentUser ? (
          <div className="rounded-md p-2.5" style={{ background: "rgba(201, 169, 97, 0.08)" }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: TOKENS.gold, color: TOKENS.ink }}>
                {currentUser.name?.charAt(0).toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
                <div className="text-[9px] uppercase tracking-wider" style={{ color: TOKENS.gold }}>
                  {USER_ROLES.find((r) => r.key === currentUser.role)?.label || currentUser.role}
                </div>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="w-full text-[10px] font-bold py-1.5 rounded transition flex items-center justify-center gap-1"
              style={{ background: "rgba(255,255,255,0.06)", color: "#cbd5e1", border: "none" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
            >
              {t("logout")}
            </button>
          </div>
        ) : (
          <div>
            <div className="rounded-md p-2.5 mb-2" style={{ background: "rgba(166, 56, 61, 0.12)", border: "1px solid rgba(166, 56, 61, 0.3)" }}>
              <div className="text-[10px] font-bold mb-1" style={{ color: "#fca5a5" }}>👁 {t("guestMode")}</div>
              <div className="text-[10px]" style={{ color: "#94a3b8" }}>{t("loginToEdit")}</div>
            </div>
            <button
              onClick={onLoginClick}
              className="w-full text-[11px] font-bold py-2 rounded transition flex items-center justify-center gap-1.5"
              style={{ background: TOKENS.gold, color: TOKENS.ink, border: "none" }}
            >
              <Lock size={11} /> {t("login")}
            </button>
          </div>
        )}
      </div>

      {/* DİL SEÇİCİ */}
      <div className="p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-[9px] uppercase tracking-wider font-bold mb-1.5" style={{ color: "#64748b" }}>{t("language")}</div>
        <div className="flex gap-1 rounded-md p-0.5" style={{ background: "rgba(255,255,255,0.04)" }}>
          {[
            { key: "tr", label: "TR", full: t("turkish") },
            { key: "en", label: "EN", full: t("english") },
          ].map((l) => (
            <button
              key={l.key}
              onClick={() => setLang(l.key)}
              title={l.full}
              className="flex-1 px-2 py-1 text-[10px] font-bold rounded transition"
              style={{
                background: lang === l.key ? TOKENS.gold : "transparent",
                color: lang === l.key ? TOKENS.ink : "#94a3b8",
                border: "none",
                cursor: "pointer",
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* DEPOLAMA DURUMU */}
      <div className="p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2 mb-1">
          <SBIcon size={11} style={{ color: storageBadge.color }} />
          <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: storageBadge.color }}>
            {storageBadge.text}
          </span>
        </div>
      </div>
    </aside>
  );
}

// ============================================================================
// LOGIN MODAL — ilk kullanıcı kurulumu + normal giriş
// ============================================================================

function LoginModal({ open, onClose, setCurrentUser, showToast }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setEmail(""); setPassword(""); }
  }, [open]);

  if (!open) return null;

  const handleLogin = async () => {
    if (!email.trim() || !password) return showToast("Email ve şifre gerekli", "error");
    setBusy(true);
    const result = await supabaseLogin(email, password);
    setBusy(false);
    if (result.error) {
      return showToast(result.error, "error");
    }
    setCurrentUser(result.session.user);
    showToast(`Hoş geldin ${result.session.user.name}`, "success");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15, 26, 46, 0.7)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-md rounded-lg overflow-hidden shadow-2xl" style={{ background: "white", border: `1px solid ${TOKENS.border}` }}>
        <div className="px-6 py-5" style={{ background: TOKENS.ink, borderBottom: `2px solid ${TOKENS.gold}` }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: TOKENS.gold }}>
              <Lock size={15} style={{ color: TOKENS.ink }} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">GİRİŞ YAP</h3>
              <div className="text-[10px]" style={{ color: TOKENS.gold }}>İhracat Operasyonları</div>
            </div>
          </div>
          <p className="text-[11px]" style={{ color: "#94a3b8" }}>
            Düzenleme yapmak için giriş yap. Misafirler sadece görüntüleyebilir.
          </p>
        </div>

        <div className="p-6 space-y-3">
          <div>
            <Label required>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} autoFocus placeholder="email@firma.com" />
          </div>
          <div>
            <Label required>Şifre</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
          </div>
          <Btn variant="accent" size="lg" onClick={handleLogin} disabled={busy} className="w-full">
            {busy ? "Giriş yapılıyor..." : "Giriş Yap"}
          </Btn>
          <div className="text-center pt-2">
            <button onClick={onClose} className="text-[11px] underline font-semibold" style={{ color: TOKENS.muted, background: "transparent", border: "none", cursor: "pointer" }}>
              Misafir olarak devam et (sadece görüntüleme)
            </button>
          </div>
          <div className="text-[10px] p-2 rounded mt-3" style={{ background: TOKENS.gold + "12", color: TOKENS.ink, border: `1px solid ${TOKENS.gold}40` }}>
            💡 <strong>Kullanıcı yönetimi:</strong> Yeni kullanıcılar Supabase Dashboard'dan eklenir. Authentication → Users → Add user.
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TOAST — anlık bildirim
// ============================================================================

function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  const cfg = {
    success: { bg: TOKENS.forest, icon: CheckCircle2 },
    error:   { bg: TOKENS.oxblood, icon: XCircle },
    warning: { bg: TOKENS.terracotta, icon: AlertTriangle },
    info:    { bg: TOKENS.navy, icon: AlertCircle },
  }[toast.type] || { bg: TOKENS.navy, icon: AlertCircle };
  const Icon = cfg.icon;
  return (
    <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-md shadow-xl text-sm flex items-center gap-2.5 max-w-sm"
      style={{ background: cfg.bg, color: "white", animation: "slideIn 0.2s ease-out" }}
      onClick={onDismiss}
    >
      <Icon size={16} />
      <span>{toast.msg}</span>
    </div>
  );
}

// ============================================================================
// GÖSTERGE PANELİ — özet, KPI'lar, grafikler, önemli listeler
// ============================================================================

function DashboardView({ customers, products, orders, payments, rates, setView, t = (k) => k, lang = "tr" }) {
  const [kpiDetail, setKpiDetail] = useState(null); // null | "orders" | "paid" | "pending" | "overdue"
  // Tüm hesaplamalar burada yapılır, alt bileşenlere geçilir
  const stats = useMemo(() => {
    const totalOrdersUSD = orders.reduce((s, o) => s + orderTotalUSD(o, rates), 0);
    const paidUSD    = payments.filter((p) => p.status === "paid").reduce((s, p) => s + toUSD(p.amount, p.currency, rates), 0);
    const pendingUSD = payments.filter((p) => p.status === "pending").reduce((s, p) => s + toUSD(p.amount, p.currency, rates), 0);
    const overdueUSD = payments.filter((p) => p.status === "overdue").reduce((s, p) => s + toUSD(p.amount, p.currency, rates), 0);
    const activeOrders = orders.filter((o) => !["completed", "cancelled"].includes(o.status)).length;
    return { totalOrdersUSD, paidUSD, pendingUSD, overdueUSD, activeOrders };
  }, [orders, payments, rates]);

  // Aylık tahsilat — son 12 ay · sadece tahsil edilen ödemeler · USD
  const monthlyRevenue = useMemo(() => {
    const now = new Date();
    const buckets = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.push({ key, label: d.toLocaleDateString("tr-TR", { month: "short" }), value: 0, count: 0 });
    }
    payments.forEach((p) => {
      if (p.status !== "paid" || !p.paidDate) return;
      const k = p.paidDate.slice(0, 7);
      const b = buckets.find((b) => b.key === k);
      if (b) {
        b.value += toUSD(Number(p.amount) || 0, p.currency, rates);
        b.count++;
      }
    });
    return buckets;
  }, [payments, rates]);

  // Top 5 müşteri (USD ciroya göre)
  const topCustomers = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const c = customers.find((x) => x.id === o.customerId);
      const name = c?.name || o.customerName || "—";
      if (!map[name]) map[name] = { name, country: c?.country, total: 0, count: 0 };
      map[name].total += orderTotalUSD(o, rates);
      map[name].count++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [orders, customers, rates]);

  // Yaklaşan tahsilatlar (30 gün)
  const upcomingPayments = useMemo(() => {
    return payments
      .filter((p) => p.status !== "paid" && p.status !== "cancelled")
      .map((p) => ({ ...p, daysLeft: p.dueDate ? daysBetween(todayISO(), p.dueDate) : null }))
      .filter((p) => p.daysLeft !== null && p.daysLeft <= 30)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 6);
  }, [payments]);

  // Para birimi dağılımı (ciroya göre)
  const currencyDist = useMemo(() => {
    const m = {};
    orders.forEach((o) => {
      m[o.currency] = (m[o.currency] || 0) + orderTotalUSD(o, rates);
    });
    return Object.entries(m).map(([name, value]) => ({ name, value })).filter((x) => x.value > 0);
  }, [orders, rates]);

  const PIE_COLORS = [TOKENS.navy, TOKENS.gold, TOKENS.copper, TOKENS.forest, TOKENS.terracotta, TOKENS.oxblood, "#5b7da4", "#8a5a3a"];

  // İlk kullanım — boş ise
  if (orders.length === 0 && customers.length === 0 && products.length === 0) {
    return (
      <div>
        <PageHeader title="Hoş geldin" subtitle="Henüz veri yok. Aşağıdaki adımlardan biriyle başlayabilirsin." />
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl">
            <QuickStartCard
              icon={Sparkles}
              title="Demo Verileri Yükle"
              desc="3 müşteri, 4 ürün ve örnek siparişlerle sistemi anında dolu görmek için. Test ettikten sonra silebilirsin."
              cta="Demo'ya Başla"
              onClick={() => setView("settings")}
            />
            <QuickStartCard
              icon={Users}
              title="Müşterilerinle Başla"
              desc="Önce müşterilerini gir. Sipariş kaydederken müşteri seçeceksin, ülke ve para birimi otomatik gelir."
              cta="Müşteri Ekle"
              onClick={() => setView("customers")}
            />
            <QuickStartCard
              icon={Package}
              title="Ürün Kataloğunu Hazırla"
              desc="Ürün kodu, mamul kodu, TR/EN isimler ve varsayılan fiyat. Sipariş kalemlerinde otomatik tamamlama yapar."
              cta="Ürün Ekle"
              onClick={() => setView("products")}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Gösterge Paneli"
        subtitle={`${customers.length} müşteri · ${products.length} ürün · ${orders.length} sipariş · ${payments.length} ödeme kaydı`}
      />

      <div className="p-8 space-y-6">
        {/* ALARM SATIRI — gecikmiş ödeme varsa */}
        {stats.overdueUSD > 0 && (
          <div className="rounded-lg p-4 flex items-center gap-3" style={{ background: TOKENS.oxblood + "10", border: `1px solid ${TOKENS.oxblood}40` }}>
            <AlertTriangle size={18} style={{ color: TOKENS.oxblood }} />
            <div className="flex-1 text-sm" style={{ color: TOKENS.oxblood }}>
              <strong>{fmtMoney(stats.overdueUSD)}</strong> tutarında <strong>{payments.filter(p => p.status === "overdue").length}</strong> gecikmiş ödeme var. Acil takip gerekli.
            </div>
            <Btn variant="ghost" size="sm" onClick={() => setView("payments")}>İncele <ArrowRight size={12} /></Btn>
          </div>
        )}

        {/* KPI KARTLARI — tıklanabilir */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard icon={DollarSign}    label={t("totalOrderVolume")} value={fmtMoney(stats.totalOrdersUSD, "USD", { compact: true })} sub={`${orders.length} ${t("orders").toLowerCase()}`}                   accent={TOKENS.navy}    onClick={() => setKpiDetail("orders")} />
          <KPICard icon={CheckCircle2}  label={t("totalReceived")}    value={fmtMoney(stats.paidUSD, "USD", { compact: true })}        sub={`${payments.filter(p => p.status === "paid").length} ${t("payments").toLowerCase()}`}    accent={TOKENS.forest}  onClick={() => setKpiDetail("paid")} />
          <KPICard icon={Clock}         label={t("pendingPayments")}  value={fmtMoney(stats.pendingUSD, "USD", { compact: true })}     sub={`${payments.filter(p => p.status === "pending").length}`} accent={TOKENS.gold}    onClick={() => setKpiDetail("pending")} />
          <KPICard icon={AlertTriangle} label={t("overduePayments")}  value={fmtMoney(stats.overdueUSD, "USD", { compact: true })}     sub={`${payments.filter(p => p.status === "overdue").length}`} accent={TOKENS.oxblood} onClick={() => setKpiDetail("overdue")} />
        </div>

        {/* GRAFİKLER */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card title={t("monthlyCollection")} subtitle={`${t("last12Months")} · ${t("paid")} · USD`} className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyRevenue} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={TOKENS.forest} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={TOKENS.forest} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="revStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"   stopColor={TOKENS.forest} />
                    <stop offset="100%" stopColor={TOKENS.gold} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke={TOKENS.border} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: TOKENS.ink, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: TOKENS.muted, fontWeight: 500 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const v = payload[0]?.value || 0;
                    const c = payload[0]?.payload?.count || 0;
                    return (
                      <div style={{ background: "white", border: `1px solid ${TOKENS.border}`, borderRadius: 6, padding: "8px 12px", fontSize: 13, fontWeight: 600 }}>
                        <div style={{ color: TOKENS.ink, marginBottom: 4 }}>{label}</div>
                        <div style={{ color: TOKENS.forest }}>{t("paid")}: {fmtMoney(v)}</div>
                        <div style={{ color: TOKENS.muted, marginTop: 3, fontWeight: 400, fontSize: 11 }}>{c} {t("payments").toLowerCase()}</div>
                      </div>
                    );
                  }}
                  cursor={{ stroke: TOKENS.gold, strokeWidth: 1, strokeDasharray: "3 3" }}
                />
                <Area type="monotone" dataKey="value" stroke="url(#revStroke)" strokeWidth={3} fill="url(#revGrad)" dot={{ r: 4, fill: TOKENS.forest, strokeWidth: 2, stroke: "white" }} activeDot={{ r: 6, fill: TOKENS.forest, strokeWidth: 2, stroke: "white" }} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Para Birimi Dağılımı" subtitle="USD karşılığı">
            {currencyDist.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-xs" style={{ color: TOKENS.muted }}>Henüz veri yok</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={currencyDist} dataKey="value" nameKey="name" outerRadius={75} innerRadius={45} paddingAngle={2}>
                    {currencyDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* TOP MÜŞTERİ + YAKLAŞAN ÖDEMELER */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="En Değerli Müşteriler" subtitle="USD cirosuna göre"
            action={<Btn variant="ghost" size="xs" onClick={() => setView("reports")}>Tümü <ChevronRight size={11} /></Btn>}
            noPadding
          >
            {topCustomers.length === 0 ? (
              <div className="p-6 text-center text-xs" style={{ color: TOKENS.muted }}>Henüz veri yok</div>
            ) : (
              <div>
                {topCustomers.map((c, i) => (
                  <div key={c.name} className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: i < topCustomers.length - 1 ? `1px solid ${TOKENS.border}` : "none" }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                      style={{ background: i === 0 ? TOKENS.gold : TOKENS.cream, color: i === 0 ? TOKENS.ink : TOKENS.muted }}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: TOKENS.ink }}>{c.name}</div>
                      <div className="text-[11px]" style={{ color: TOKENS.muted }}>{c.country || "—"} · {c.count} sipariş</div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums" style={{ color: TOKENS.ink }}>{fmtMoney(c.total, "USD", { compact: true })}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Yaklaşan Tahsilatlar" subtitle="Önümüzdeki 30 gün"
            action={<Btn variant="ghost" size="xs" onClick={() => setView("cashflow")}>Nakit Akışı <ChevronRight size={11} /></Btn>}
            noPadding
          >
            {upcomingPayments.length === 0 ? (
              <div className="p-6 text-center text-xs" style={{ color: TOKENS.muted }}>30 gün içinde vadesi gelen tahsilat yok</div>
            ) : (
              <div>
                {upcomingPayments.map((p, i) => {
                  const order = orders.find((o) => o.id === p.orderId);
                  const customer = customers.find((c) => c.id === order?.customerId);
                  const tp = PAYMENT_PLAN_TYPES.find((t) => t.key === p.type);
                  const dayColor = p.daysLeft < 0 ? TOKENS.oxblood : p.daysLeft <= 7 ? TOKENS.terracotta : TOKENS.muted;
                  return (
                    <div key={p.id} className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: i < upcomingPayments.length - 1 ? `1px solid ${TOKENS.border}` : "none" }}>
                      <div className="text-center flex-shrink-0 w-12">
                        <div className="text-base font-bold leading-tight" style={{ color: dayColor }}>
                          {p.daysLeft < 0 ? `-${Math.abs(p.daysLeft)}` : p.daysLeft}
                        </div>
                        <div className="text-[9px] uppercase tracking-wider" style={{ color: TOKENS.muted }}>
                          {p.daysLeft < 0 ? "geçti" : p.daysLeft === 0 ? "bugün" : "gün"}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: TOKENS.ink }}>
                          {customer?.name || order?.customerName || "—"}
                        </div>
                        <div className="text-[11px] flex items-center gap-1.5" style={{ color: TOKENS.muted }}>
                          <span className="font-mono">{order?.orderNumber}</span> · {tp?.label}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-semibold" style={{ color: TOKENS.ink }}>{fmtMoney(p.amount, p.currency, { compact: true })}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* KPI DETAY MODAL — kart tıklamasıyla açılır */}
      <KPIDetailModal
        kind={kpiDetail}
        onClose={() => setKpiDetail(null)}
        orders={orders}
        customers={customers}
        payments={payments}
        rates={rates}
        setView={setView}
        t={t}
        lang={lang}
      />
    </div>
  );
}

// KPI detay modali — Toplam Sipariş / Tahsil / Bekleyen / Gecikmiş kartlarına basınca
function KPIDetailModal({ kind, onClose, orders, customers, payments, rates, setView, t = (k) => k, lang = "tr" }) {
  if (!kind) return null;

  const config = {
    orders: {
      title: t("totalOrderVolume"),
      subtitle: `${orders.length} ${t("orders").toLowerCase()} · ${lang === "en" ? "USD equivalent" : "USD karşılığı"}`,
      color: TOKENS.navy,
      icon: DollarSign,
    },
    paid: {
      title: lang === "en" ? "Paid Payments" : "Tahsil Edilen Ödemeler",
      subtitle: `${payments.filter(p => p.status === "paid").length} ${lang === "en" ? "records" : "kayıt"}`,
      color: TOKENS.forest,
      icon: CheckCircle2,
    },
    pending: {
      title: t("pendingPayments"),
      subtitle: `${payments.filter(p => p.status === "pending").length} ${lang === "en" ? "records" : "kayıt"}`,
      color: TOKENS.gold,
      icon: Clock,
    },
    overdue: {
      title: lang === "en" ? "Overdue Payments" : "Gecikmiş Tahsilat",
      subtitle: `${payments.filter(p => p.status === "overdue").length} ${lang === "en" ? "records" : "kayıt"}`,
      color: TOKENS.oxblood,
      icon: AlertTriangle,
    },
  };
  const cfg = config[kind];

  // İçerik — siparişler veya ödemeler
  let rows = null;
  let total = 0;
  if (kind === "orders") {
    const sorted = [...orders].sort((a, b) => (b.orderDate || "").localeCompare(a.orderDate || ""));
    total = sorted.reduce((s, o) => s + orderTotalUSD(o, rates), 0);
    rows = sorted.map((o) => {
      const c = customers.find((x) => x.id === o.customerId);
      const t = orderTotal(o);
      const usd = orderTotalUSD(o, rates);
      const st = ORDER_STATUSES.find((s) => s.key === o.status);
      return (
        <tr key={o.id} className="cursor-pointer transition" style={{ borderTop: `1px solid ${TOKENS.border}` }}
          onClick={() => { setView("orders"); onClose(); }}
          onMouseEnter={(e) => (e.currentTarget.style.background = TOKENS.cream)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <td className="px-3 py-2 font-mono text-xs font-bold" style={{ color: TOKENS.navy }}>{o.orderNumber}</td>
          <td className="px-3 py-2 text-xs"><div className="font-bold">{c?.name || "—"}</div><div className="text-[10px]" style={{ color: TOKENS.muted }}>{c?.country || ""}</div></td>
          <td className="px-3 py-2 text-xs">{fmtDate(o.orderDate)}</td>
          <td className="px-3 py-2 text-right text-xs font-bold tabular-nums">{fmtMoney(t, o.currency)}</td>
          <td className="px-3 py-2 text-right text-xs tabular-nums" style={{ color: TOKENS.muted }}>{fmtMoney(usd, "USD", { compact: true })}</td>
          <td className="px-3 py-2"><Badge color={st?.color}>{st?.label}</Badge></td>
        </tr>
      );
    });
  } else {
    const filtered = payments.filter((p) => p.status === kind);
    const sorted = [...filtered].sort((a, b) => (b.dueDate || "").localeCompare(a.dueDate || ""));
    total = sorted.reduce((s, p) => s + toUSD(Number(p.amount) || 0, p.currency, rates), 0);
    rows = sorted.map((p) => {
      const order = orders.find((o) => o.id === p.orderId);
      const cust = customers.find((c) => c.id === order?.customerId);
      const tp = PAYMENT_PLAN_TYPES.find((t) => t.key === p.type);
      const usd = toUSD(Number(p.amount) || 0, p.currency, rates);
      return (
        <tr key={p.id} className="cursor-pointer transition" style={{ borderTop: `1px solid ${TOKENS.border}` }}
          onClick={() => { setView("payments"); onClose(); }}
          onMouseEnter={(e) => (e.currentTarget.style.background = TOKENS.cream)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <td className="px-3 py-2 font-mono text-xs font-bold" style={{ color: TOKENS.navy }}>{order?.orderNumber || "—"}</td>
          <td className="px-3 py-2 text-xs"><div className="font-bold">{cust?.name || "—"}</div><div className="text-[10px]" style={{ color: TOKENS.muted }}>{cust?.country || ""}</div></td>
          <td className="px-3 py-2 text-xs">{tp?.label || p.type}</td>
          <td className="px-3 py-2 text-right text-xs font-bold tabular-nums">{fmtMoney(p.amount, p.currency)}</td>
          <td className="px-3 py-2 text-right text-xs tabular-nums" style={{ color: TOKENS.muted }}>{fmtMoney(usd, "USD", { compact: true })}</td>
          <td className="px-3 py-2 text-xs">{p.dueDate ? fmtDate(p.dueDate) : "—"}</td>
          {kind === "paid" && <td className="px-3 py-2 text-xs text-success" style={{ color: TOKENS.forest }}>{p.paidDate ? fmtDate(p.paidDate) : "—"}</td>}
        </tr>
      );
    });
  }

  // PDF yazdırma
  const printPDFList = () => {
    const isOrders = kind === "orders";
    let tableHtml;
    if (isOrders) {
      const sorted = [...orders].sort((a, b) => (b.orderDate || "").localeCompare(a.orderDate || ""));
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th>${t("orderNumber")}</th>
              <th>${t("customer")}</th>
              <th>${t("orderDate")}</th>
              <th class="right">${t("amount")}</th>
              <th class="right">USD</th>
              <th>${t("status")}</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map((o) => {
              const c = customers.find((x) => x.id === o.customerId);
              const ot = orderTotal(o);
              const usd = orderTotalUSD(o, rates);
              const st = ORDER_STATUSES.find((s) => s.key === o.status);
              return `
                <tr>
                  <td class="text-mono">${htmlEscape(o.orderNumber)}</td>
                  <td><div style="font-weight:700">${htmlEscape(c?.name || "—")}</div><div style="font-size:9px;color:#7A736A">${htmlEscape(c?.country || "")}</div></td>
                  <td>${fmtDate(o.orderDate)}</td>
                  <td class="right text-mono" style="font-weight:700">${fmtMoneyPDF(ot, o.currency)}</td>
                  <td class="right text-mono" style="color:#7A736A">$${(usd || 0).toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</td>
                  <td>${st?.label || o.status}</td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>`;
    } else {
      const filtered = payments.filter((p) => p.status === kind);
      const sorted = [...filtered].sort((a, b) => (b.dueDate || "").localeCompare(a.dueDate || ""));
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th>${t("orderNumber")}</th>
              <th>${t("customer")}</th>
              <th>${t("paymentType")}</th>
              <th class="right">${t("amount")}</th>
              <th class="right">USD</th>
              <th>${t("dueDate")}</th>
              ${kind === "paid" ? `<th>${t("paidDate")}</th>` : ""}
            </tr>
          </thead>
          <tbody>
            ${sorted.map((p) => {
              const order = orders.find((o) => o.id === p.orderId);
              const cust = customers.find((c) => c.id === order?.customerId);
              const tp = PAYMENT_PLAN_TYPES.find((x) => x.key === p.type);
              const usd = toUSD(Number(p.amount) || 0, p.currency, rates);
              return `
                <tr>
                  <td class="text-mono">${htmlEscape(order?.orderNumber || "—")}</td>
                  <td><div style="font-weight:700">${htmlEscape(cust?.name || "—")}</div><div style="font-size:9px;color:#7A736A">${htmlEscape(cust?.country || "")}</div></td>
                  <td>${tp?.label || p.type}</td>
                  <td class="right text-mono" style="font-weight:700">${fmtMoneyPDF(p.amount, p.currency)}</td>
                  <td class="right text-mono" style="color:#7A736A">$${usd.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</td>
                  <td>${p.dueDate ? fmtDate(p.dueDate) : "—"}</td>
                  ${kind === "paid" ? `<td class="text-success">${p.paidDate ? fmtDate(p.paidDate) : "—"}</td>` : ""}
                </tr>`;
            }).join("")}
          </tbody>
        </table>`;
    }

    const content = `
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">${cfg.title}</div><div class="kpi-value" style="color:${cfg.color}">$${total.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
        <div class="kpi"><div class="kpi-label">${lang === "en" ? "Records" : "Kayıt"}</div><div class="kpi-value">${rows.length}</div></div>
      </div>
      ${tableHtml}
    `;

    printPDF({
      title: cfg.title,
      subtitle: cfg.subtitle,
      contentHtml: content,
      orientation: "landscape",
      lang,
    });
  };

  return (
    <Modal open={!!kind} onClose={onClose} title={cfg.title} subtitle={cfg.subtitle} size="2xl"
      footer={<>
        {rows.length > 0 && <Btn variant="secondary" size="sm" icon={FileDown} onClick={printPDFList}>{t("pdf")}</Btn>}
        <Btn variant="ghost" size="sm" onClick={onClose}>{t("close")}</Btn>
      </>}>
      <div className="space-y-4">
        <div className="rounded-md p-4 flex items-center justify-between" style={{ background: cfg.color + "10", border: `1px solid ${cfg.color}40` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: cfg.color + "25" }}>
              <cfg.icon size={20} style={{ color: cfg.color }} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: TOKENS.muted }}>{lang === "en" ? "Total (USD)" : "Toplam (USD)"}</div>
              <div className="text-xl font-bold tabular-nums" style={{ color: cfg.color }}>{fmtMoney(total, "USD")}</div>
            </div>
          </div>
          <div className="text-xs" style={{ color: TOKENS.muted }}>
            {rows.length === 0 ? (lang === "en" ? "No records" : "Kayıt yok") : `${rows.length} ${lang === "en" ? "records · click to view detail" : "kayıt · Tıklayarak detaya git"}`}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: TOKENS.muted }}>{lang === "en" ? "No records in this category." : "Bu kategoride kayıt bulunmuyor."}</div>
        ) : (
          <div className="rounded-md overflow-hidden" style={{ border: `1px solid ${TOKENS.border}`, maxHeight: "60vh", overflowY: "auto" }}>
            <table className="w-full text-xs">
              <thead style={{ background: TOKENS.cream, position: "sticky", top: 0, zIndex: 1 }}>
                {kind === "orders" ? (
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold">Sipariş No</th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold">Müşteri</th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold">Tarih</th>
                    <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold">Tutar</th>
                    <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold">USD</th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold">Durum</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold">Sipariş</th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold">Müşteri</th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold">Tip</th>
                    <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold">Tutar</th>
                    <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold">USD</th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold">Vade</th>
                    {kind === "paid" && <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold">Tahsil</th>}
                  </tr>
                )}
              </thead>
              <tbody>{rows}</tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

function KPICard({ icon: Icon, label, value, sub, accent, onClick }) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      onClick={onClick}
      className={`rounded-xl p-5 relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${onClick ? "cursor-pointer text-left w-full" : ""}`}
      style={{ background: "white", border: `1px solid ${TOKENS.border}`, boxShadow: "0 1px 3px rgba(15, 26, 46, 0.04)" }}
    >
      {/* Üstteki renkli aksent şerit */}
      <div className="absolute top-0 left-0 right-0 h-1.5"
        style={{ background: `linear-gradient(90deg, ${accent}, ${accent}90)` }} />
      {/* Sağ üstteki büyük şeffaf icon */}
      <div className="absolute top-3 right-3 opacity-[0.07]" style={{ color: accent }}>
        <Icon size={70} strokeWidth={1.5} />
      </div>
      <div className="relative">
        <div className="flex items-center gap-2 mb-3 mt-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: accent + "18" }}>
            <Icon size={15} style={{ color: accent }} strokeWidth={2.2} />
          </div>
          <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: TOKENS.muted }}>{label}</span>
          {onClick && <ChevronRight size={12} className="ml-auto" style={{ color: TOKENS.muted }} />}
        </div>
        <div className="text-3xl tabular-nums leading-tight" style={{ color: TOKENS.ink, fontWeight: 700, letterSpacing: "-0.02em" }}>
          {value}
        </div>
        <div className="text-xs mt-1.5 font-semibold" style={{ color: TOKENS.muted }}>{sub}</div>
      </div>
    </Component>
  );
}

function QuickStartCard({ icon: Icon, title, desc, cta, onClick }) {
  return (
    <button onClick={onClick} className="text-left rounded-lg p-6 transition-all hover:shadow-md hover:-translate-y-0.5" style={{ background: "white", border: `1px solid ${TOKENS.border}` }}>
      <div className="w-10 h-10 rounded-md flex items-center justify-center mb-4" style={{ background: TOKENS.cream, color: TOKENS.gold }}>
        <Icon size={18} />
      </div>
      <h3 className="text-base font-semibold mb-2" style={{ color: TOKENS.ink, fontFamily: FONT_DISPLAY }}>{title}</h3>
      <p className="text-xs mb-4" style={{ color: TOKENS.muted }}>{desc}</p>
      <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: TOKENS.gold }}>{cta} <ArrowRight size={12} /></span>
    </button>
  );
}

// ============================================================================
// MÜŞTERİLER — yeni modül
// ============================================================================
// Neden müşteri kredisi var: Açık hesap satışta her müşteriye ne kadar açık
// hesap riskimiz var bilmek hayati. Bekleyen + gecikmiş ödemeleri toplayıp
// kredi limitiyle karşılaştırırız.

function CustomersView({ customers, setCustomers, orders, payments, bankAccounts, rates, canEdit, showToast, setView, setPendingOrderToOpen, t = (k) => k, lang = "tr" }) {
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);

  // Her müşteriye otomatik metrikler ekle (ciro, açık bakiye, risk durumu)
  // Hem USD bazlı toplamlar (tüm para birimleri çevrilmiş) hem de orijinal para birimi bazlı kırılım
  const enrichedCustomers = useMemo(() => customers.map((c) => {
    const custOrders = orders.filter((o) => o.customerId === c.id);
    const totalUSD = custOrders.reduce((s, o) => s + orderTotalUSD(o, rates), 0);
    const openBalance = payments.filter((p) => {
      const o = orders.find((x) => x.id === p.orderId);
      return o?.customerId === c.id && p.status !== "paid" && p.status !== "cancelled";
    }).reduce((s, p) => s + toUSD(p.amount, p.currency, rates), 0);
    const overdueBalance = payments.filter((p) => {
      const o = orders.find((x) => x.id === p.orderId);
      return o?.customerId === c.id && p.status === "overdue";
    }).reduce((s, p) => s + toUSD(p.amount, p.currency, rates), 0);

    // Para birimi bazlı kırılım — orijinal döviz cinsinde
    const totalsByCurrency = {};
    custOrders.forEach((o) => {
      const cur = o.currency;
      if (!totalsByCurrency[cur]) totalsByCurrency[cur] = 0;
      totalsByCurrency[cur] += orderTotal(o);
    });
    const openByCurrency = {};
    payments.filter((p) => {
      const o = orders.find((x) => x.id === p.orderId);
      return o?.customerId === c.id && p.status !== "paid" && p.status !== "cancelled";
    }).forEach((p) => {
      if (!openByCurrency[p.currency]) openByCurrency[p.currency] = 0;
      openByCurrency[p.currency] += Number(p.amount) || 0;
    });
    const paidByCurrency = {};
    payments.filter((p) => {
      const o = orders.find((x) => x.id === p.orderId);
      return o?.customerId === c.id && p.status === "paid";
    }).forEach((p) => {
      if (!paidByCurrency[p.currency]) paidByCurrency[p.currency] = 0;
      paidByCurrency[p.currency] += Number(p.amount) || 0;
    });
    // Gecikmiş bakiye — döviz cinsi bazlı
    const overdueByCurrency = {};
    payments.filter((p) => {
      const o = orders.find((x) => x.id === p.orderId);
      return o?.customerId === c.id && p.status === "overdue";
    }).forEach((p) => {
      if (!overdueByCurrency[p.currency]) overdueByCurrency[p.currency] = 0;
      overdueByCurrency[p.currency] += Number(p.amount) || 0;
    });

    return { ...c, totalUSD, openBalance, overdueBalance, orderCount: custOrders.length, totalsByCurrency, openByCurrency, paidByCurrency, overdueByCurrency };
  }), [customers, orders, payments, rates]);

  const countries = useMemo(() => [...new Set(customers.map((c) => c.country).filter(Boolean))].sort(), [customers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return enrichedCustomers.filter((c) => {
      if (countryFilter && c.country !== countryFilter) return false;
      if (!q) return true;
      return [c.code, c.name, c.contactPerson, c.email, c.country, c.notes].filter(Boolean).some((v) => v.toLowerCase().includes(q));
    });
  }, [enrichedCustomers, search, countryFilter]);

  const openNew = () => {
    setEditing({
      id: null,
      code: "MST-" + String(customers.length + 1).padStart(3, "0"),
      name: "", contactPerson: "", email: "", phone: "",
      country: "", address: "", taxNumber: "",
      defaultCurrency: "USD",
      defaultPaymentTerms: 30, // gün (sevk tarihinden itibaren)
      preferredIncoterm: "FOB",
      // Varsayılan ödeme planı yapısı (sipariş açılınca otomatik gelir)
      defaultPaymentMethod: "bank_transfer",
      defaultPrepaymentPct: 30,    // ön ödeme %
      defaultPreShipmentPct: 40,   // sevk öncesi %
      defaultDeferredPct: 30,      // vadeli %
      notes: "",
    });
    setOpen(true);
  };

  const openEdit = (c) => {
    setEditing({
      defaultPaymentMethod: "bank_transfer",
      defaultPrepaymentPct: 30,
      defaultPreShipmentPct: 40,
      defaultDeferredPct: 30,
      ...c, // Mevcut değerler varsayılanları üzerine yazar
    });
    setOpen(true);
  };

  const save = () => {
    if (!editing.name?.trim()) return showToast("Müşteri adı zorunlu", "error");
    if (!editing.code?.trim()) return showToast("Müşteri kodu zorunlu", "error");
    const cleaned = {
      ...editing,
      defaultPaymentTerms: Number(editing.defaultPaymentTerms) || 0,
    };
    if (editing.id) {
      setCustomers((arr) => arr.map((x) => x.id === editing.id ? cleaned : x));
      showToast("Müşteri güncellendi", "success");
    } else {
      setCustomers((arr) => [...arr, { ...cleaned, id: uid(), createdAt: todayISO() }]);
      showToast("Müşteri eklendi", "success");
    }
    setOpen(false); setEditing(null);
  };

  const remove = (id) => {
    const hasOrders = orders.some((o) => o.customerId === id);
    if (hasOrders) {
      if (!confirm("Bu müşteriye ait siparişler var. Yine de silmek istiyor musun? Siparişler silinmeyecek ama müşteri bilgisini kaybedersin.")) return;
    } else {
      if (!confirm("Bu müşteri silinsin mi?")) return;
    }
    setCustomers((arr) => arr.filter((c) => c.id !== id));
    showToast("Müşteri silindi", "success");
  };

  // Müşteri listesini PDF yazdır — alacak/verecek özeti
  const printList = () => {
    if (!enrichedCustomers.length) return showToast("Yazdırılacak müşteri yok", "error");

    const filteredList = enrichedCustomers.filter((c) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (c.code || "").toLowerCase().includes(q) ||
             (c.name || "").toLowerCase().includes(q) ||
             (c.country || "").toLowerCase().includes(q) ||
             (c.contactPerson || "").toLowerCase().includes(q) ||
             (c.email || "").toLowerCase().includes(q);
    });

    const rows = filteredList.map((c) => {
      // Toplam ciro - döviz cinsi bazlı
      const totalsCurStr = Object.entries(c.totalsByCurrency || {})
        .filter(([, v]) => Math.abs(v) > 0.01)
        .map(([cur, v]) => `${cur} ${v.toLocaleString("tr-TR", {minimumFractionDigits:0, maximumFractionDigits:0})}`)
        .join("<br/>");
      // Açık bakiye - döviz cinsi bazlı
      const openCurStr = Object.entries(c.openByCurrency || {})
        .filter(([, v]) => Math.abs(v) > 0.01)
        .map(([cur, v]) => `${cur} ${v.toLocaleString("tr-TR", {minimumFractionDigits:0, maximumFractionDigits:0})}`)
        .join("<br/>");
      // Gecikmiş - döviz cinsi bazlı
      const overdueCurStr = Object.entries(c.overdueByCurrency || {})
        .filter(([, v]) => Math.abs(v) > 0.01)
        .map(([cur, v]) => `${cur} ${v.toLocaleString("tr-TR", {minimumFractionDigits:0, maximumFractionDigits:0})}`)
        .join("<br/>");
      return `
        <tr>
          <td class="text-mono">${htmlEscape(c.code)}</td>
          <td><div style="font-weight:700">${htmlEscape(c.name)}</div>${c.contactPerson ? `<div style="font-size:9px;color:#7A736A">${htmlEscape(c.contactPerson)}</div>` : ""}</td>
          <td>${htmlEscape(c.country || "—")}</td>
          <td class="center">${c.orderCount}</td>
          <td class="right text-mono" style="font-size:9px">${totalsCurStr || "—"}</td>
          <td class="right text-mono" style="color:#7A736A">$${(c.totalUSD || 0).toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</td>
          <td class="right text-mono ${c.openBalance > 0 ? 'text-warning' : ''}" style="font-size:9px;font-weight:700">${openCurStr || "✓"}</td>
          <td class="right text-mono ${c.openBalance > 0 ? 'text-warning' : 'text-success'}" style="color:#7A736A">${c.openBalance > 0.01 ? `$${c.openBalance.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}` : "✓"}</td>
          <td class="right text-mono ${c.overdueBalance > 0 ? 'text-danger' : ''}" style="font-size:9px;font-weight:700">${overdueCurStr || "—"}</td>
          <td class="right text-mono ${c.overdueBalance > 0 ? 'text-danger' : ''}" style="color:#7A736A">${c.overdueBalance > 0.01 ? `$${c.overdueBalance.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}` : "—"}</td>
        </tr>`;
    }).join("");

    // KPI'lar
    const totalUSD = filteredList.reduce((s, c) => s + (c.totalUSD || 0), 0);
    const totalOpen = filteredList.reduce((s, c) => s + (c.openBalance || 0), 0);
    const totalOverdue = filteredList.reduce((s, c) => s + (c.overdueBalance || 0), 0);
    const overdueCount = filteredList.filter((c) => c.overdueBalance > 0).length;

    const content = `
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">${lang === "en" ? "Total Customers" : "Toplam Müşteri"}</div><div class="kpi-value">${filteredList.length}</div></div>
        <div class="kpi"><div class="kpi-label">${lang === "en" ? "Total Revenue (USD)" : "Toplam Ciro (USD)"}</div><div class="kpi-value">$${totalUSD.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
        <div class="kpi"><div class="kpi-label">${lang === "en" ? "Total Receivable (USD)" : "Toplam Alacak (USD)"}</div><div class="kpi-value" style="color:#B87333">$${totalOpen.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
        <div class="kpi"><div class="kpi-label">${lang === "en" ? "Overdue Receivable (USD)" : "Gecikmiş Alacak (USD)"}</div><div class="kpi-value" style="color:#A6383D">$${totalOverdue.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
      </div>
      ${overdueCount > 0 ? `<div style="font-size:10px;padding:6px 10px;background:#A6383D15;border-left:3px solid #A6383D;margin-bottom:8px"><strong style="color:#A6383D">⚠ ${overdueCount} ${lang === "en" ? `customer(s) have overdue receivables. Total overdue` : `müşteride gecikmiş alacak var. Toplam gecikmiş tutar`}: $${totalOverdue.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</strong></div>` : ""}
      <table>
        <thead>
          <tr>
            <th>${lang === "en" ? "Code" : "Kod"}</th>
            <th>${lang === "en" ? "Customer" : "Müşteri"}</th>
            <th>${lang === "en" ? "Country" : "Ülke"}</th>
            <th class="center">${lang === "en" ? "Orders" : "Sipariş"}</th>
            <th class="right">${lang === "en" ? "Revenue (Currency)" : "Ciro (Döviz)"}</th>
            <th class="right">${lang === "en" ? "Revenue USD" : "Ciro USD"}</th>
            <th class="right">${lang === "en" ? "Open Balance (Currency)" : "Açık Bakiye (Döviz)"}</th>
            <th class="right">${lang === "en" ? "Open USD" : "Açık USD"}</th>
            <th class="right">${lang === "en" ? "Overdue (Currency)" : "Gecikmiş (Döviz)"}</th>
            <th class="right">${lang === "en" ? "Overdue USD" : "Gecikmiş USD"}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    printPDF({
      title: lang === "en" ? "Customer List · Receivables Summary" : "Müşteri Listesi · Alacak/Verecek Özeti",
      subtitle: `${filteredList.length} ${lang === "en" ? "customers" : "müşteri"}${search ? (lang === "en" ? ` · search: "${search}"` : ` · arama: "${search}"`) : ""}`,
      contentHtml: content,
      orientation: "landscape",
      lang,
    });
  };

  const handleExport = () => {
    if (!customers.length) return showToast("Aktarılacak müşteri yok", "error");
    const rows = enrichedCustomers.map((c) => ({
      "Kod": c.code, "Müşteri Adı": c.name, "Yetkili Kişi": c.contactPerson || "",
      "Email": c.email || "", "Telefon": c.phone || "",
      "Ülke": c.country || "", "Adres": c.address || "", "Vergi No": c.taxNumber || "",
      "Varsayılan Para Birimi": c.defaultCurrency, "Vade (gün)": c.defaultPaymentTerms,
      "Tercih Incoterm": c.preferredIncoterm || "",
      "Toplam Sipariş Sayısı": c.orderCount,
      "Toplam Ciro (USD)": c.totalUSD.toFixed(2),
      "Açık Bakiye (USD)": c.openBalance.toFixed(2),
      "Gecikmiş (USD)": c.overdueBalance.toFixed(2),
      "Notlar": c.notes || "",
    }));
    exportToExcel(rows, `musteriler_${todayISO()}.xlsx`, "Müşteriler");
    showToast("Excel'e aktarıldı", "success");
  };

  const handleImport = async (file) => {
    if (!file) return;
    try {
      const rows = await importFromExcel(file);
      const added = rows.map((r) => ({
        id: uid(),
        code: String(r["Kod"] || r.code || "").trim() || "MST-" + uid().slice(0, 4),
        name: String(r["Müşteri Adı"] || r.name || "").trim(),
        contactPerson: String(r["Yetkili Kişi"] || ""),
        email: String(r["Email"] || ""),
        phone: String(r["Telefon"] || ""),
        country: String(r["Ülke"] || ""),
        address: String(r["Adres"] || ""),
        taxNumber: String(r["Vergi No"] || ""),
        defaultCurrency: String(r["Varsayılan Para Birimi"] || "USD").toUpperCase(),
        defaultPaymentTerms: Number(r["Vade (gün)"] || 30),
        preferredIncoterm: String(r["Tercih Incoterm"] || "FOB"),
        notes: String(r["Notlar"] || ""),
        createdAt: todayISO(),
      })).filter((c) => c.name);
      setCustomers((arr) => [...arr, ...added]);
      showToast(`${added.length} müşteri içe aktarıldı`, "success");
    } catch (e) { showToast("İçe aktarma hatası: " + e.message, "error"); }
  };

  const downloadTemplate = () => {
    exportToExcel([{
      "Kod": "MST-001", "Müşteri Adı": "Örnek GmbH", "Yetkili Kişi": "John Doe",
      "Email": "info@ornek.com", "Telefon": "+49...", "Ülke": "Almanya",
      "Adres": "...", "Vergi No": "DE...",
      "Varsayılan Para Birimi": "EUR", "Vade (gün)": 60,
    }], "musteri_sablonu.xlsx", "Şablon");
  };

  const columns = [
    { key: "code", label: "Kod", render: (r) => <span className="font-mono text-xs font-semibold" style={{ color: TOKENS.navy }}>{r.code}</span>, width: "100px" },
    { key: "name", label: "Müşteri", render: (r) => (
      <div>
        <div className="font-medium" style={{ color: TOKENS.ink }}>{r.name}</div>
        {r.contactPerson && <div className="text-[11px]" style={{ color: TOKENS.muted }}>{r.contactPerson}</div>}
      </div>
    )},
    { key: "country", label: lang === "en" ? "Country" : "Ülke", render: (r) => r.country ? <span className="text-xs">📍 {r.country}</span> : "—" },
    { key: "orderCount", label: lang === "en" ? "Orders" : "Sipariş", align: "right", render: (r) => <span className="text-sm">{r.orderCount}</span> },
    { key: "totalUSD", label: lang === "en" ? "Total Revenue" : "Toplam Ciro", align: "right", sortValue: (r) => r.totalUSD, render: (r) => {
      // Her döviz cinsinden ayrı + USD karşılığı
      const currencies = Object.keys(r.totalsByCurrency || {});
      return (
        <div className="text-right">
          {currencies.length === 0 ? (
            <span className="text-xs" style={{ color: TOKENS.muted }}>—</span>
          ) : (
            <>
              {currencies.slice(0, 2).map((cur) => (
                <div key={cur} className="text-[11px] font-semibold tabular-nums" style={{ color: TOKENS.ink }}>
                  {fmtMoney(r.totalsByCurrency[cur], cur, { compact: true })}
                </div>
              ))}
              {currencies.length > 2 && <div className="text-[9px]" style={{ color: TOKENS.muted }}>+{currencies.length - 2} {lang === "en" ? "more" : "daha"}</div>}
              <div className="text-[10px] tabular-nums mt-0.5" style={{ color: TOKENS.muted }}>
                ≈ {fmtMoney(r.totalUSD, "USD", { compact: true })}
              </div>
            </>
          )}
        </div>
      );
    }},
    { key: "openBalance", label: lang === "en" ? "Open Balance" : "Açık Bakiye", align: "right", sortValue: (r) => r.openBalance, render: (r) => {
      const currencies = Object.keys(r.openByCurrency || {}).filter((cur) => (r.openByCurrency[cur] || 0) > 0.01);
      return (
        <div className="text-right">
          {r.openBalance < 0.01 ? (
            <span className="text-xs" style={{ color: TOKENS.muted }}>✓</span>
          ) : (
            <>
              {currencies.slice(0, 2).map((cur) => (
                <div key={cur} className="text-[11px] font-semibold tabular-nums" style={{ color: TOKENS.copper }}>
                  {fmtMoney(r.openByCurrency[cur], cur, { compact: true })}
                </div>
              ))}
              {currencies.length > 2 && <div className="text-[9px]" style={{ color: TOKENS.muted }}>+{currencies.length - 2}</div>}
              <div className="text-[10px] tabular-nums" style={{ color: TOKENS.muted }}>
                ≈ {fmtMoney(r.openBalance, "USD", { compact: true })}
              </div>
              {r.overdueBalance > 0 && (
                <div className="text-[10px] tabular-nums mt-0.5" style={{ color: TOKENS.oxblood, fontWeight: 700 }}>
                  ⚠ {fmtMoney(r.overdueBalance, "USD", { compact: true })} {lang === "en" ? "overdue" : "geç"}
                </div>
              )}
            </>
          )}
        </div>
      );
    }},
  ];

  return (
    <div>
      <PageHeader title={t("customers")} subtitle={`${customers.length} ${t("customersSubtitle")}`}>
        <input id="cust-import" type="file" accept=".xlsx,.xls" onChange={(e) => handleImport(e.target.files[0])} className="hidden" />
        <Btn variant="ghost" size="sm" icon={FileDown} onClick={printList}>PDF</Btn>
        <Btn variant="secondary" size="sm" icon={FileDown} onClick={handleExport}>{t("export")}</Btn>
        {canEdit && <>
          <Btn variant="ghost" size="sm" icon={FileDown} onClick={downloadTemplate}>{t("template")}</Btn>
          <Btn variant="secondary" size="sm" icon={FileUp} onClick={() => document.getElementById("cust-import").click()}>{t("import")}</Btn>
          <Btn variant="primary" size="sm" icon={Plus} onClick={openNew}>{t("newCustomer")}</Btn>
        </>}
      </PageHeader>

      <div className="p-8 space-y-4">
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Müşteri kodu, isim, ülke, email..." />
          <div className="w-44">
            <Label>Ülke</Label>
            <Select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
              <option value="">Tümü ({countries.length})</option>
              {countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          {(search || countryFilter) && <Btn variant="ghost" size="sm" icon={X} onClick={() => { setSearch(""); setCountryFilter(""); }}>Temizle</Btn>}
        </FilterBar>

        {customers.length === 0 ? (
          <Card><EmptyState icon={Users} title="Henüz müşteri yok" hint="İhracat yaptığın firmaları kaydet. Sipariş girerken bu listeden seçeceksin; ülke ve tercih edilen para birimi otomatik gelecek." action={canEdit ? <Btn variant="primary" size="sm" icon={Plus} onClick={openNew}>İlk Müşteriyi Ekle</Btn> : null} /></Card>
        ) : (
          <DataTable
            columns={columns}
            rows={filtered}
            onRowClick={(r) => setViewing(r)}
            emptyText="Filtreyle eşleşen müşteri yok"
            actions={(r) => (
              <div className="flex items-center justify-end gap-1">
                <button onClick={() => setViewing(r)} className="p-1.5 rounded transition" style={{ color: TOKENS.muted }} onMouseEnter={(e) => { e.currentTarget.style.background = TOKENS.cream; e.currentTarget.style.color = TOKENS.navy; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TOKENS.muted; }}><Eye size={14} /></button>
                {canEdit && <button onClick={() => openEdit(r)} className="p-1.5 rounded transition" style={{ color: TOKENS.muted }} onMouseEnter={(e) => { e.currentTarget.style.background = TOKENS.cream; e.currentTarget.style.color = TOKENS.navy; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TOKENS.muted; }}><Pencil size={14} /></button>}
                {canEdit && <button onClick={() => remove(r.id)} className="p-1.5 rounded transition" style={{ color: TOKENS.muted }} onMouseEnter={(e) => { e.currentTarget.style.background = TOKENS.oxblood + "15"; e.currentTarget.style.color = TOKENS.oxblood; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TOKENS.muted; }}><Trash2 size={14} /></button>}
              </div>
            )}
          />
        )}
      </div>

      {/* Düzenle modal */}
      <Modal
        open={open && !!editing}
        onClose={() => { setOpen(false); setEditing(null); }}
        title={editing?.id ? "Müşteriyi Düzenle" : "Yeni Müşteri"}
        subtitle="Burada tanımladıkların sipariş giriş ekranında otomatik kullanılır"
        size="lg"
        footer={
          <>
            <Btn variant="ghost" onClick={() => { setOpen(false); setEditing(null); }}>İptal</Btn>
            <Btn variant="primary" icon={Save} onClick={save}>Kaydet</Btn>
          </>
        }
      >
        {editing && (
          <div className="space-y-5">
            <div>
              <SectionTitle>Temel Bilgiler</SectionTitle>
              <div className="grid grid-cols-3 gap-3">
                <div><Label required>Müşteri Kodu</Label><Input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="MST-001" /></div>
                <div className="col-span-2"><Label required>Firma Adı</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                <div><Label>Yetkili Kişi</Label><Input value={editing.contactPerson} onChange={(e) => setEditing({ ...editing, contactPerson: e.target.value })} /></div>
                <div><Label>Email</Label><Input type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
                <div><Label>Telefon</Label><Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
                <div><Label>Ülke</Label><Input value={editing.country} onChange={(e) => setEditing({ ...editing, country: e.target.value })} placeholder="Almanya" /></div>
                <div><Label>Vergi No</Label><Input value={editing.taxNumber} onChange={(e) => setEditing({ ...editing, taxNumber: e.target.value })} /></div>
                <div className="col-span-3"><Label>Adres</Label><Input value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></div>
              </div>
            </div>

            <div>
              <SectionTitle>Ticari Tercihler <span className="font-normal text-[10px] normal-case" style={{ color: TOKENS.muted }}>· Sipariş ekranında varsayılan olarak gelir</span></SectionTitle>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label hint="USD/EUR vs.">Para Birimi</Label>
                  <Select value={editing.defaultCurrency} onChange={(e) => setEditing({ ...editing, defaultCurrency: e.target.value })}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
                <div>
                  <Label hint="sevk tarihinden itibaren">Standart Vade (gün)</Label>
                  <Input type="number" value={editing.defaultPaymentTerms} onChange={(e) => setEditing({ ...editing, defaultPaymentTerms: e.target.value })} />
                </div>
                <div>
                  <Label>Tercih Incoterm</Label>
                  <Select value={editing.preferredIncoterm} onChange={(e) => setEditing({ ...editing, preferredIncoterm: e.target.value })}>
                    {INCOTERMS.map((i) => <option key={i.key} value={i.key}>{i.key}</option>)}
                  </Select>
                </div>
              </div>
            </div>

            <div>
              <SectionTitle>Varsayılan Ödeme Yapısı <span className="font-normal text-[10px] normal-case" style={{ color: TOKENS.muted }}>· Toplamı %100 olmalı · Yeni siparişte otomatik gelir, sipariş içinde değiştirilebilir</span></SectionTitle>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label hint="sipariş onayında">Ön Ödeme %</Label>
                  <Input type="number" min="0" max="100" value={editing.defaultPrepaymentPct ?? 0} onChange={(e) => setEditing({ ...editing, defaultPrepaymentPct: Number(e.target.value) })} />
                </div>
                <div>
                  <Label hint="sevk öncesi">Sevk Öncesi %</Label>
                  <Input type="number" min="0" max="100" value={editing.defaultPreShipmentPct ?? 0} onChange={(e) => setEditing({ ...editing, defaultPreShipmentPct: Number(e.target.value) })} />
                </div>
                <div>
                  <Label hint="sevk sonrası vadeli">Vadeli %</Label>
                  <Input type="number" min="0" max="100" value={editing.defaultDeferredPct ?? 0} onChange={(e) => setEditing({ ...editing, defaultDeferredPct: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Ödeme Yöntemi</Label>
                  <Select value={editing.defaultPaymentMethod || "bank_transfer"} onChange={(e) => setEditing({ ...editing, defaultPaymentMethod: e.target.value })}>
                    {PAYMENT_METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </Select>
                </div>
              </div>
              {(() => {
                const total = (Number(editing.defaultPrepaymentPct) || 0) + (Number(editing.defaultPreShipmentPct) || 0) + (Number(editing.defaultDeferredPct) || 0);
                if (total === 0) return null;
                if (Math.abs(total - 100) < 0.01) {
                  return <div className="mt-2 text-[11px]" style={{ color: TOKENS.forest }}>✓ Toplam %100</div>;
                }
                return <div className="mt-2 text-[11px]" style={{ color: TOKENS.terracotta }}>⚠ Toplam %{total} (sipariş ekranında düzeltebilirsin, kayıt yine de olur)</div>;
              })()}
            </div>

            <div>
              <Label>Notlar</Label>
              <Textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} placeholder="Müşteri ile ilgili özel notlar, fiyat anlaşmaları, dikkat edilmesi gerekenler..." />
            </div>
          </div>
        )}
      </Modal>

      {/* Detay görünüm */}
      <CustomerDetailModal customer={viewing} onClose={() => setViewing(null)} orders={orders} payments={payments} bankAccounts={bankAccounts} rates={rates} setView={setView} setPendingOrderToOpen={setPendingOrderToOpen} t={t} lang={lang} />
    </div>
  );
}

function CustomerDetailModal({ customer, onClose, orders, payments, bankAccounts, rates, setView, setPendingOrderToOpen, t = (k) => k, lang = "tr" }) {
  if (!customer) return null;
  const custOrders = orders.filter((o) => o.customerId === customer.id).sort((a, b) => (b.orderDate || "").localeCompare(a.orderDate || ""));
  const custPayments = payments.filter((p) => custOrders.some((o) => o.id === p.orderId));

  // Hesap ekstresi yazdır — yeni pencere aç, HTML render et, kullanıcı PDF'e kaydetsin
  const printStatement = () => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { alert("Popup engellendi. Tarayıcı ayarlarından bu site için popup'a izin ver."); return; }

    // Para birimi bazında ödeme detayları (gecikmiş, toplam vs)
    // overduePayments: status=overdue olan ödemelerin müşteriye ait olanları
    const overdueByCurrency = {};
    custPayments.forEach((p) => {
      if (p.status === "overdue") {
        if (!overdueByCurrency[p.currency]) overdueByCurrency[p.currency] = 0;
        overdueByCurrency[p.currency] += Number(p.amount) || 0;
      }
    });

    // Para birimi bazında özet
    const curRows = Object.keys(customer.totalsByCurrency || {}).map((cur) => {
      const total = customer.totalsByCurrency[cur] || 0;
      const paid = customer.paidByCurrency?.[cur] || 0;
      const open = customer.openByCurrency?.[cur] || 0;
      const overdue = overdueByCurrency[cur] || 0;
      return `
        <tr>
          <td style="padding:8px;border:1px solid #ccc;font-weight:bold">${cur}</td>
          <td style="padding:8px;border:1px solid #ccc;text-align:right">${total.toLocaleString("tr-TR", {minimumFractionDigits:2,maximumFractionDigits:2})}</td>
          <td style="padding:8px;border:1px solid #ccc;text-align:right;color:#3E7D5A">${paid.toLocaleString("tr-TR", {minimumFractionDigits:2,maximumFractionDigits:2})}</td>
          <td style="padding:8px;border:1px solid #ccc;text-align:right;color:#B87333;font-weight:bold">${open.toLocaleString("tr-TR", {minimumFractionDigits:2,maximumFractionDigits:2})}</td>
          <td style="padding:8px;border:1px solid #ccc;text-align:right;color:${overdue > 0 ? '#A6383D' : '#7A736A'};font-weight:${overdue > 0 ? 'bold' : 'normal'}">${overdue > 0 ? overdue.toLocaleString("tr-TR", {minimumFractionDigits:2,maximumFractionDigits:2}) : "—"}</td>
        </tr>`;
    }).join("");

    // Toplam gecikmiş USD karşılığı
    const totalOverdueUSD = Object.entries(overdueByCurrency).reduce((s, [cur, amt]) => s + toUSD(amt, cur, rates), 0);

    // Sipariş listesi
    const orderRows = custOrders.map((o) => {
      const t = orderTotal(o);
      const paid = orderPaidAmount(o, payments);
      const remaining = t - paid;
      const st = ORDER_STATUSES.find((s) => s.key === o.status);
      return `
        <tr>
          <td style="padding:6px 8px;border:1px solid #ccc;font-family:monospace;font-weight:bold">${o.orderNumber}</td>
          <td style="padding:6px 8px;border:1px solid #ccc">${fmtDate(o.orderDate)}</td>
          <td style="padding:6px 8px;border:1px solid #ccc">${o.actualShipmentDate ? fmtDate(o.actualShipmentDate) : (o.shipmentDate ? fmtDate(o.shipmentDate) + " (plan)" : "—")}</td>
          <td style="padding:6px 8px;border:1px solid #ccc">${st?.label || o.status}</td>
          <td style="padding:6px 8px;border:1px solid #ccc;text-align:right">${o.currency} ${t.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
          <td style="padding:6px 8px;border:1px solid #ccc;text-align:right;color:#3E7D5A">${o.currency} ${paid.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
          <td style="padding:6px 8px;border:1px solid #ccc;text-align:right;color:${remaining > 0.01 ? "#B87333" : "#3E7D5A"};font-weight:bold">${o.currency} ${remaining.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
        </tr>`;
    }).join("");

    // Tahsilat hareketi
    const paymentRows = custPayments
      .sort((a, b) => (b.paidDate || b.dueDate || "").localeCompare(a.paidDate || a.dueDate || ""))
      .map((p) => {
        const o = custOrders.find((x) => x.id === p.orderId);
        const tp = PAYMENT_PLAN_TYPES.find((t) => t.key === p.type);
        const st = PAYMENT_STATUSES.find((s) => s.key === p.status);
        return `
          <tr>
            <td style="padding:6px 8px;border:1px solid #ccc;font-family:monospace">${o?.orderNumber || "—"}</td>
            <td style="padding:6px 8px;border:1px solid #ccc">${tp?.label || p.type}</td>
            <td style="padding:6px 8px;border:1px solid #ccc">${p.dueDate ? fmtDate(p.dueDate) : "—"}</td>
            <td style="padding:6px 8px;border:1px solid #ccc">${p.paidDate ? fmtDate(p.paidDate) : "—"}</td>
            <td style="padding:6px 8px;border:1px solid #ccc;text-align:right">${p.currency} ${(Number(p.amount)||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
            <td style="padding:6px 8px;border:1px solid #ccc;color:${p.status==='paid'?'#3E7D5A':p.status==='overdue'?'#A6383D':'#7A736A'};font-weight:bold">${st?.label || p.status}</td>
          </tr>`;
      }).join("");

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>Hesap Ekstresi - ${customer.name}</title>
<style>
  @page { size: A4; margin: 1.5cm; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 11px; color: #0F1A2E; margin: 0; padding: 20px; line-height: 1.4; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #C9A961; padding-bottom: 12px; margin-bottom: 16px; }
  h1 { font-size: 18px; margin: 0 0 4px; color: #0F1A2E; }
  h2 { font-size: 13px; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #C9A961; color: #1E3A5F; }
  .subtitle { font-size: 10px; color: #7A736A; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 12px; font-size: 11px; }
  .info-grid div { padding: 3px 0; }
  .label { color: #7A736A; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
  th { padding: 8px; border: 1px solid #ccc; background: #F8F5EE; text-align: left; font-weight: bold; color: #0F1A2E; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; }
  .summary-card { background: #F8F5EE; border: 1px solid #C9A961; padding: 12px 16px; border-radius: 4px; margin: 8px 0 16px; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 9px; color: #7A736A; text-align: center; }
  @media print { .no-print { display: none; } body { padding: 0; } }
  .print-btn { position: fixed; top: 10px; right: 10px; padding: 10px 20px; background: #1E3A5F; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px; }
</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨️ Yazdır / PDF Kaydet</button>
  <div class="header">
    <div>
      <h1>HESAP EKSTRESİ</h1>
      <div class="subtitle">İhracat Operasyonları · Hesap Hareketi</div>
    </div>
    <div style="text-align:right;font-size:10px;color:#7A736A">
      <div>Hazırlanma Tarihi:</div>
      <div style="font-weight:bold;color:#0F1A2E;font-size:11px">${fmtDateLong(todayISO())}</div>
    </div>
  </div>

  <h2>Müşteri Bilgileri</h2>
  <div class="info-grid">
    <div><div class="label">Müşteri Kodu</div><div style="font-family:monospace;font-weight:bold">${customer.code || "—"}</div></div>
    <div><div class="label">Müşteri Adı</div><div style="font-weight:bold">${customer.name}</div></div>
    <div><div class="label">Ülke</div><div>${customer.country || "—"}</div></div>
    <div><div class="label">Yetkili Kişi</div><div>${customer.contactPerson || "—"}</div></div>
    <div><div class="label">E-posta</div><div>${customer.email || "—"}</div></div>
    <div><div class="label">Telefon</div><div>${customer.phone || "—"}</div></div>
    ${customer.address ? `<div style="grid-column:span 2"><div class="label">Adres</div><div>${customer.address}</div></div>` : ""}
    ${customer.taxNumber ? `<div><div class="label">Vergi No</div><div style="font-family:monospace">${customer.taxNumber}</div></div>` : ""}
  </div>

  <h2>Para Birimi Bazında Bakiye Özeti</h2>
  ${curRows ? `
  <table>
    <thead>
      <tr>
        <th>Para Birimi</th>
        <th style="text-align:right">Toplam Ciro</th>
        <th style="text-align:right">Tahsil Edilen</th>
        <th style="text-align:right">Açık Bakiye (Alacak)</th>
        <th style="text-align:right">Gecikmiş Bakiye</th>
      </tr>
    </thead>
    <tbody>${curRows}</tbody>
  </table>
  ` : '<div style="color:#7A736A;font-style:italic">Bu müşteri için henüz işlem yok.</div>'}

  <div class="summary-card">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px">
      <div style="flex:1">
        <div class="label">${lang === "en" ? "Total Open Balance" : "Toplam Açık Bakiye"}</div>
        ${Object.entries(customer.openByCurrency || {}).filter(([, v]) => v > 0.01).map(([cur, v]) => `
          <div style="font-size:14px;font-weight:bold;color:#B87333;margin-top:2px">
            ${cur} ${v.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})}
          </div>
        `).join("")}
        <div style="font-size:11px;color:#7A736A;margin-top:6px;padding-top:4px;border-top:1px dashed #ccc">
          ${lang === "en" ? "USD equivalent" : "USD karşılığı"}: <strong style="color:${customer.openBalance > 0 ? '#B87333' : '#3E7D5A'};font-size:13px">$${(customer.openBalance || 0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong>
        </div>
        ${customer.openBalance < 0.01 ? `<div style="font-size:14px;font-weight:bold;color:#3E7D5A;margin-top:4px">${lang === "en" ? "NO BALANCE" : "BAKİYE YOK"}</div>` : ""}
      </div>
      ${totalOverdueUSD > 0 ? `
      <div style="flex:1;border-left:1px solid #ddd;padding-left:16px">
        <div class="label" style="color:#A6383D">⚠ ${lang === "en" ? "Overdue Total Balance" : "Gecikmiş Toplam Bakiye"}</div>
        ${Object.entries(overdueByCurrency).filter(([, v]) => v > 0.01).map(([cur, v]) => `
          <div style="font-size:14px;font-weight:bold;color:#A6383D;margin-top:2px">
            ${cur} ${v.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})}
          </div>
        `).join("")}
        <div style="font-size:11px;color:#7A736A;margin-top:6px;padding-top:4px;border-top:1px dashed #ccc">
          ${lang === "en" ? "USD equivalent" : "USD karşılığı"}: <strong style="color:#A6383D;font-size:13px">$${totalOverdueUSD.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong>
        </div>
        <div style="font-size:10px;color:#7A736A;margin-top:2px">${custPayments.filter(p => p.status === "overdue").length} ${lang === "en" ? "overdue payment(s)" : "gecikmiş ödeme"}</div>
      </div>
      ` : ""}
      <div style="text-align:right;font-size:10px;color:#7A736A">
        <div>${lang === "en" ? "Total Orders" : "Toplam Sipariş"}: <strong style="color:#0F1A2E">${custOrders.length}</strong></div>
        <div>${lang === "en" ? "Total Revenue (USD)" : "Toplam Ciro (USD)"}: <strong style="color:#0F1A2E">$${(customer.totalUSD || 0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div>
      </div>
    </div>
  </div>

  <h2>Sipariş Listesi (${custOrders.length})</h2>
  ${custOrders.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th>Sipariş No</th>
        <th>Tarih</th>
        <th>Sevk</th>
        <th>Durum</th>
        <th style="text-align:right">Tutar</th>
        <th style="text-align:right">Tahsil</th>
        <th style="text-align:right">Kalan</th>
      </tr>
    </thead>
    <tbody>${orderRows}</tbody>
  </table>
  ` : '<div style="color:#7A736A;font-style:italic">Sipariş yok.</div>'}

  <h2>Ödeme Hareketi (${custPayments.length})</h2>
  ${custPayments.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th>Sipariş</th>
        <th>Tip</th>
        <th>Vade</th>
        <th>Tahsil Tarihi</th>
        <th style="text-align:right">Tutar</th>
        <th>Durum</th>
      </tr>
    </thead>
    <tbody>${paymentRows}</tbody>
  </table>
  ` : '<div style="color:#7A736A;font-style:italic">Ödeme kaydı yok.</div>'}

  ${customer.notes ? `
  <h2>Notlar</h2>
  <div style="padding:10px;background:#F8F5EE;border-left:3px solid #C9A961">${customer.notes}</div>
  ` : ""}

  <div class="footer">
    Bu ekstre İhracat Operasyonları sisteminden ${fmtDateLong(todayISO())} tarihinde otomatik oluşturulmuştur.
  </div>

  <script>
    // Sayfa yüklenince yazdırma diyalogunu otomatik aç
    // Otomatik yazdırma kaldırıldı — kullanıcı 'Yazdır / PDF Kaydet' butonuna basarak başlatır
  </script>
</body>
</html>`;

    w.document.write(html);
    w.document.close();
  };

  return (
    <Modal open={!!customer} onClose={onClose} title={customer.name} subtitle={`${customer.code} · ${customer.country || "—"}`} size="xl"
      footer={<>
        <Btn variant="secondary" size="sm" icon={FileDown} onClick={printStatement}>PDF Hesap Ekstresi</Btn>
        <Btn variant="ghost" size="sm" onClick={onClose}>Kapat</Btn>
      </>}
    >
      <div className="space-y-5">
        {/* Üst metrikler */}
        <div className="grid grid-cols-4 gap-3">
          <MetricBox label="Toplam Sipariş" value={custOrders.length} accent={TOKENS.navy} />
          <MetricBox label="Ciro (USD)" value={fmtMoney(customer.totalUSD, "USD", { compact: true })} accent={TOKENS.gold} />
          <MetricBox label="Açık Bakiye" value={fmtMoney(customer.openBalance, "USD", { compact: true })} accent={customer.openBalance > 0 ? TOKENS.copper : TOKENS.muted} />
        </div>

        {/* Para Birimi Bazlı */}
        {customer.totalsByCurrency && Object.keys(customer.totalsByCurrency).length > 0 && (
          <Card title="Para Birimi Bazında Toplam" subtitle="Müşterinin gerçek döviz cinsinden bakiyesi" noPadding>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.min(4, Object.keys(customer.totalsByCurrency).length)}, 1fr)` }}>
              {Object.keys(customer.totalsByCurrency).map((cur, i, arr) => {
                const total = customer.totalsByCurrency[cur] || 0;
                const open = customer.openByCurrency?.[cur] || 0;
                const paid = customer.paidByCurrency?.[cur] || 0;
                return (
                  <div key={cur} className="px-5 py-4" style={{ borderRight: i < arr.length - 1 ? `1px solid ${TOKENS.border}` : "none" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Pill color="gold">{cur}</Pill>
                    </div>
                    <div className="space-y-1.5">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: TOKENS.muted }}>Toplam Ciro</div>
                        <div className="text-base font-bold tabular-nums" style={{ color: TOKENS.ink }}>{fmtMoney(total, cur)}</div>
                      </div>
                      {paid > 0 && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: TOKENS.muted }}>Tahsil Edilen</div>
                          <div className="text-sm font-bold tabular-nums" style={{ color: TOKENS.forest }}>{fmtMoney(paid, cur)}</div>
                        </div>
                      )}
                      {open > 0 && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: TOKENS.muted }}>Açık Bakiye</div>
                          <div className="text-sm font-bold tabular-nums" style={{ color: TOKENS.copper }}>{fmtMoney(open, cur)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* İletişim */}
        <Card title="İletişim Bilgileri" noPadding>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 p-5">
            <DetailRow icon={Users} label="Yetkili Kişi" value={customer.contactPerson || "—"} />
            <DetailRow icon={Mail} label="Email" value={customer.email || "—"} />
            <DetailRow icon={Phone} label="Telefon" value={customer.phone || "—"} />
            <DetailRow icon={MapPin} label="Ülke" value={customer.country || "—"} />
            <DetailRow icon={Hash} label="Vergi No" value={customer.taxNumber || "—"} />
            <DetailRow icon={DollarSign} label="Tercih Para Br." value={customer.defaultCurrency} />
          </div>
        </Card>

        {/* Sipariş geçmişi */}
        <Card title={`Sipariş Geçmişi (${custOrders.length})`} noPadding>
          {custOrders.length === 0 ? (
            <div className="p-6 text-center text-xs" style={{ color: TOKENS.muted }}>Henüz sipariş yok</div>
          ) : (
            <table className="w-full text-xs">
              <thead style={{ background: TOKENS.cream }}>
                <tr>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-[10px]">Sipariş No</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-[10px]">Tarih</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-[10px]">Durum</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider text-[10px]">Tutar</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider text-[10px]">USD</th>
                </tr>
              </thead>
              <tbody>
                {custOrders.map((o) => {
                  const st = ORDER_STATUSES.find((s) => s.key === o.status);
                  const total = orderTotal(o);
                  return (
                    <tr key={o.id} className="cursor-pointer transition" style={{ borderTop: `1px solid ${TOKENS.border}` }}
                      onClick={() => {
                        // Müşteri modal'ını kapat → Siparişler sayfasına git → bu siparişi aç
                        if (setPendingOrderToOpen) setPendingOrderToOpen(o.id);
                        if (setView) setView("orders");
                        onClose();
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = TOKENS.cream)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      title="Siparişler sayfasında detay aç"
                    >
                      <td className="px-3 py-2 font-mono font-bold" style={{ color: TOKENS.navy }}>{o.orderNumber}</td>
                      <td className="px-3 py-2">{fmtDate(o.orderDate)}</td>
                      <td className="px-3 py-2"><Badge color={st?.color}>{st?.label}</Badge></td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold">{fmtMoney(total, o.currency)}</td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: TOKENS.muted }}>{fmtMoney(toUSD(total, o.currency, rates))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        {customer.notes && (
          <div className="rounded-md p-4" style={{ background: TOKENS.gold + "10", border: `1px solid ${TOKENS.gold}40` }}>
            <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: TOKENS.goldDark }}>Notlar</div>
            <div className="text-sm" style={{ color: TOKENS.ink }}>{customer.notes}</div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function MetricBox({ label, value, accent }) {
  return (
    <div className="rounded-md p-3" style={{ background: TOKENS.cream, border: `1px solid ${TOKENS.border}` }}>
      <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: TOKENS.muted }}>{label}</div>
      <div className="text-base font-semibold tabular-nums" style={{ color: accent || TOKENS.ink }}>{value}</div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={14} style={{ color: TOKENS.muted }} />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider" style={{ color: TOKENS.muted }}>{label}</div>
        <div className="text-sm truncate" style={{ color: TOKENS.ink }}>{value}</div>
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="text-[11px] uppercase tracking-widest font-semibold pb-2 mb-3" style={{ color: TOKENS.gold, borderBottom: `1px solid ${TOKENS.border}` }}>
      {children}
    </div>
  );
}

// ============================================================================
// ÜRÜNLER
// ============================================================================

function ProductsView({ products, setProducts, orders, rates, canEdit, showToast, t = (k) => k, lang = "tr" }) {
  const [search, setSearch] = useState("");
  const [curFilter, setCurFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  // Her ürüne kullanım istatistiği ekle (kaç siparişte yer aldı, toplam adet)
  const enriched = useMemo(() => products.map((p) => {
    let totalQty = 0, orderCount = 0, totalUSD = 0;
    orders.forEach((o) => {
      const items = (o.items || []).filter((i) => i.productId === p.id || i.productCode === p.productCode);
      if (items.length) {
        orderCount++;
        items.forEach((i) => {
          totalQty += Number(i.quantity) || 0;
          totalUSD += toUSD((Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), o.currency, rates);
        });
      }
    });
    return { ...p, totalQty, orderCount, totalUSD };
  }), [products, orders, rates]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return enriched.filter((p) => {
      if (curFilter && p.defaultCurrency !== curFilter) return false;
      if (!q) return true;
      return [p.productCode, p.manufacturingCode, p.nameTr, p.nameEn].filter(Boolean).some((v) => v.toLowerCase().includes(q));
    });
  }, [enriched, search, curFilter]);

  const openNew = () => {
    setEditing({ id: null, productCode: "", manufacturingCode: "", nameTr: "", nameEn: "", category: "",
      unit: "adet", defaultPrice: 0, defaultCurrency: "USD", notes: "" });
    setOpen(true);
  };

  const openEdit = (p) => { setEditing({ ...p }); setOpen(true); };

  const save = () => {
    if (!editing.productCode?.trim()) return showToast("Ürün kodu zorunlu", "error");
    if (!editing.nameTr?.trim() && !editing.nameEn?.trim()) return showToast("En az bir isim girin", "error");
    // Aynı ürün kodu kontrolü (case-insensitive)
    const codeNormalized = editing.productCode.trim().toLowerCase();
    const duplicate = products.find((p) => p.productCode?.trim().toLowerCase() === codeNormalized && p.id !== editing.id);
    if (duplicate) return showToast(`Bu ürün kodu zaten kayıtlı: ${duplicate.productCode} - ${duplicate.nameTr || duplicate.nameEn}`, "error");
    const cleaned = { ...editing, productCode: editing.productCode.trim(), defaultPrice: Number(editing.defaultPrice) || 0 };
    if (editing.id) {
      setProducts((arr) => arr.map((x) => x.id === editing.id ? cleaned : x));
      showToast("Ürün güncellendi", "success");
    } else {
      setProducts((arr) => [...arr, { ...cleaned, id: uid(), createdAt: todayISO() }]);
      showToast("Ürün eklendi", "success");
    }
    setOpen(false); setEditing(null);
  };

  const remove = (id) => {
    if (!confirm("Bu ürün silinsin mi? Mevcut sipariş kalemleri etkilenmez.")) return;
    setProducts((arr) => arr.filter((p) => p.id !== id));
    showToast("Ürün silindi", "success");
  };

  const handleExport = () => {
    if (!products.length) return showToast("Aktarılacak ürün yok", "error");
    exportToExcel(enriched.map((p) => ({
      "Ürün Kodu": p.productCode, "Mamul Kodu": p.manufacturingCode || "",
      "Türkçe İsim": p.nameTr || "", "İngilizce İsim": p.nameEn || "",
      "Kategori": p.category || "", "Birim": p.unit || "adet",
      "Varsayılan Fiyat": p.defaultPrice, "Para Birimi": p.defaultCurrency,
      "Toplam Satış Adedi": p.totalQty, "Sipariş Sayısı": p.orderCount,
      "Toplam Ciro (USD)": p.totalUSD.toFixed(2), "Notlar": p.notes || "",
    })), `urunler_${todayISO()}.xlsx`, "Ürünler");
    showToast("Excel'e aktarıldı", "success");
  };

  const handleImport = async (file) => {
    if (!file) return;
    try {
      const rows = await importFromExcel(file);
      const added = rows.map((r) => ({
        id: uid(),
        productCode: String(r["Ürün Kodu"] || "").trim(),
        manufacturingCode: String(r["Mamul Kodu"] || ""),
        nameTr: String(r["Türkçe İsim"] || ""),
        nameEn: String(r["İngilizce İsim"] || ""),
        category: String(r["Kategori"] || ""),
        unit: String(r["Birim"] || "adet"),
        defaultPrice: Number(r["Varsayılan Fiyat"] || 0),
        defaultCurrency: String(r["Para Birimi"] || "USD").toUpperCase(),
        notes: String(r["Notlar"] || ""),
        createdAt: todayISO(),
      })).filter((p) => p.productCode);
      setProducts((arr) => [...arr, ...added]);
      showToast(`${added.length} ürün içe aktarıldı`, "success");
    } catch (e) { showToast("Hata: " + e.message, "error"); }
  };

  const downloadTemplate = () => exportToExcel([{
    "Ürün Kodu": "PRD-001", "Mamul Kodu": "MM-A1", "Türkçe İsim": "Örnek", "İngilizce İsim": "Sample",
    "Kategori": "Tekstil", "Birim": "adet", "Varsayılan Fiyat": 100, "Para Birimi": "USD", "Notlar": "",
  }], "urun_sablonu.xlsx", "Şablon");

  const columns = [
    { key: "productCode", label: "Ürün Kodu", render: (r) => <span className="font-mono text-xs font-semibold" style={{ color: TOKENS.navy }}>{r.productCode}</span> },
    { key: "manufacturingCode", label: "Mamul", render: (r) => <span className="font-mono text-xs" style={{ color: TOKENS.muted }}>{r.manufacturingCode || "—"}</span> },
    { key: "name", label: "İsim", sortValue: (r) => r.nameTr || r.nameEn, render: (r) => (
      <div>
        <div style={{ color: TOKENS.ink }}>{r.nameTr || "—"}</div>
        {r.nameEn && <div className="text-[11px] italic" style={{ color: TOKENS.muted }}>{r.nameEn}</div>}
      </div>
    )},
    { key: "category", label: "Kategori", render: (r) => r.category ? <Badge color="navy">{r.category}</Badge> : "—" },
    { key: "defaultPrice", label: "Fiyat", align: "right", render: (r) => fmtMoney(r.defaultPrice, r.defaultCurrency) },
    { key: "totalQty", label: "Toplam Satış", align: "right", render: (r) => <span style={{ color: r.totalQty > 0 ? TOKENS.ink : TOKENS.muted }}>{fmtNum(r.totalQty)} {r.unit}</span> },
    { key: "totalUSD", label: "Ciro", align: "right", render: (r) => <span style={{ color: TOKENS.muted }}>{fmtMoney(r.totalUSD, "USD", { compact: true })}</span> },
  ];

  // Ürün katalog PDF
  const printList = () => {
    if (!enrichedProducts.length) return showToast(lang === "en" ? "No products to print" : "Yazdırılacak ürün yok", "error");

    const list = enrichedProducts.filter((p) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (p.productCode || "").toLowerCase().includes(q) ||
             (p.manufacturingCode || "").toLowerCase().includes(q) ||
             (p.nameTr || "").toLowerCase().includes(q) ||
             (p.nameEn || "").toLowerCase().includes(q) ||
             (p.category || "").toLowerCase().includes(q);
    });

    const rows = list.map((p) => `
      <tr>
        <td class="text-mono">${htmlEscape(p.productCode)}</td>
        <td class="text-mono" style="color:#7A736A">${htmlEscape(p.manufacturingCode || "—")}</td>
        <td><div style="font-weight:700">${htmlEscape(p.nameTr || "—")}</div>${p.nameEn ? `<div style="font-style:italic;font-size:9px;color:#7A736A">${htmlEscape(p.nameEn)}</div>` : ""}</td>
        <td>${htmlEscape(p.category || "—")}</td>
        <td class="center">${htmlEscape(p.unit || "—")}</td>
        <td class="right text-mono" style="font-weight:700">${fmtMoneyPDF(p.defaultPrice, p.defaultCurrency)}</td>
        <td class="right text-mono">${(p.totalQty || 0).toLocaleString("tr-TR")} ${htmlEscape(p.unit || "")}</td>
        <td class="right text-mono" style="color:#7A736A">$${(p.totalUSD || 0).toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</td>
      </tr>`).join("");

    const totalCiro = list.reduce((s, p) => s + (p.totalUSD || 0), 0);
    const cats = [...new Set(list.map((p) => p.category).filter(Boolean))].length;

    const content = `
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">${lang === "en" ? "Total Products" : "Toplam Ürün"}</div><div class="kpi-value">${list.length}</div></div>
        <div class="kpi"><div class="kpi-label">${lang === "en" ? "Categories" : "Kategori"}</div><div class="kpi-value">${cats}</div></div>
        <div class="kpi"><div class="kpi-label">${lang === "en" ? "Total Revenue (USD)" : "Toplam Ciro (USD)"}</div><div class="kpi-value">$${totalCiro.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
        <div class="kpi"><div class="kpi-label">${lang === "en" ? "Active Products" : "Aktif Ürün"}</div><div class="kpi-value">${list.filter((p) => p.totalQty > 0).length}</div></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>${lang === "en" ? "Product Code" : "Ürün Kodu"}</th>
            <th>${lang === "en" ? "Mfg Code" : "Mamul Kodu"}</th>
            <th>${lang === "en" ? "Name" : "İsim"}</th>
            <th>${lang === "en" ? "Category" : "Kategori"}</th>
            <th class="center">${lang === "en" ? "Unit" : "Birim"}</th>
            <th class="right">${lang === "en" ? "Price" : "Fiyat"}</th>
            <th class="right">${lang === "en" ? "Total Sold" : "Toplam Satış"}</th>
            <th class="right">${lang === "en" ? "Revenue (USD)" : "Ciro (USD)"}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    printPDF({
      title: lang === "en" ? "Product Catalog" : "Ürün Kataloğu",
      subtitle: `${list.length} ${lang === "en" ? "products" : "ürün"}${search ? (lang === "en" ? ` · search: "${search}"` : ` · arama: "${search}"`) : ""}`,
      contentHtml: content,
      orientation: "landscape",
      lang,
    });
  };

  return (
    <div>
      <PageHeader title={t("products")} subtitle={`${products.length} ${t("productsSubtitle")}`}>
        <input id="prod-import" type="file" accept=".xlsx,.xls" onChange={(e) => handleImport(e.target.files[0])} className="hidden" />
        <Btn variant="ghost" size="sm" icon={FileDown} onClick={printList}>PDF</Btn>
        <Btn variant="secondary" size="sm" icon={FileDown} onClick={handleExport}>{t("export")}</Btn>
        {canEdit && <>
          <Btn variant="ghost" size="sm" icon={FileDown} onClick={downloadTemplate}>{t("template")}</Btn>
          <Btn variant="secondary" size="sm" icon={FileUp} onClick={() => document.getElementById("prod-import").click()}>{t("import")}</Btn>
          <Btn variant="primary" size="sm" icon={Plus} onClick={openNew}>{t("newProduct")}</Btn>
        </>}
      </PageHeader>

      <div className="p-8 space-y-4">
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Ürün kodu, mamul kodu, isim..." />
          <div className="w-32"><Label>Para Br.</Label>
            <Select value={curFilter} onChange={(e) => setCurFilter(e.target.value)}>
              <option value="">Tümü</option>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          {(search || curFilter) && <Btn variant="ghost" size="sm" icon={X} onClick={() => { setSearch(""); setCurFilter(""); }}>Temizle</Btn>}
        </FilterBar>

        {products.length === 0 ? (
          <Card><EmptyState icon={Package} title="Ürün kataloğu boş" hint="Sattığın ürünleri ürün kodu, mamul kodu ve TR/EN isimleriyle tanımla. Sipariş girerken bu listeden seçebileceksin." action={canEdit ? <Btn variant="primary" size="sm" icon={Plus} onClick={openNew}>İlk Ürünü Ekle</Btn> : null} /></Card>
        ) : (
          <DataTable columns={columns} rows={filtered} emptyText="Eşleşen ürün yok" actions={canEdit ? (r) => (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => openEdit(r)} className="p-1.5 rounded transition" style={{ color: TOKENS.muted }} onMouseEnter={(e) => { e.currentTarget.style.background = TOKENS.cream; e.currentTarget.style.color = TOKENS.navy; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TOKENS.muted; }}><Pencil size={14} /></button>
              <button onClick={() => remove(r.id)} className="p-1.5 rounded transition" style={{ color: TOKENS.muted }} onMouseEnter={(e) => { e.currentTarget.style.background = TOKENS.oxblood + "15"; e.currentTarget.style.color = TOKENS.oxblood; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TOKENS.muted; }}><Trash2 size={14} /></button>
            </div>
          ) : undefined} />
        )}
      </div>

      <Modal open={open && !!editing} onClose={() => { setOpen(false); setEditing(null); }} title={editing?.id ? "Ürünü Düzenle" : "Yeni Ürün"} size="md"
        footer={<><Btn variant="ghost" onClick={() => { setOpen(false); setEditing(null); }}>İptal</Btn><Btn variant="primary" icon={Save} onClick={save}>Kaydet</Btn></>}
      >
        {editing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label required>Ürün Kodu</Label><Input value={editing.productCode} onChange={(e) => setEditing({ ...editing, productCode: e.target.value })} placeholder="PRD-001" /></div>
              <div><Label hint="üretim/ambar kodu">Mamul Kodu</Label><Input value={editing.manufacturingCode} onChange={(e) => setEditing({ ...editing, manufacturingCode: e.target.value })} placeholder="MM-A1" /></div>
              <div><Label>Türkçe İsim</Label><Input value={editing.nameTr} onChange={(e) => setEditing({ ...editing, nameTr: e.target.value })} /></div>
              <div><Label>İngilizce İsim</Label><Input value={editing.nameEn} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })} /></div>
              <div><Label>Kategori</Label><Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="Tekstil, Mermer..." /></div>
              <div><Label>Birim</Label><Select value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value })}><option>adet</option><option>kg</option><option>ton</option><option>m²</option><option>m³</option><option>litre</option><option>paket</option><option>palet</option></Select></div>
              <div><Label>Varsayılan Fiyat</Label><Input type="number" step="0.01" value={editing.defaultPrice} onChange={(e) => setEditing({ ...editing, defaultPrice: e.target.value })} /></div>
              <div><Label>Para Birimi</Label><Select value={editing.defaultCurrency} onChange={(e) => setEditing({ ...editing, defaultCurrency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></div>
            </div>
            <div><Label>Notlar</Label><Textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ============================================================================
// BANKA HESAPLARI — yeni modül
// ============================================================================
// Neden lazım: Ödeme kaydederken hangi hesaba geldiğini seçeceğiz. Bu sayede:
// - Hesap bakiyesi takibi yapılabilir (her hesabın kendi para birimine göre)
// - Akreditif geliyorsa hangi banka olduğunu kayıt edebiliriz
// - Hesap bazlı tahsilat raporu çıkar

function BankAccountsView({ bankAccounts, setBankAccounts, payments, rates, canEdit, showToast, t = (k) => k, lang = "tr" }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  // Her hesaba toplam giriş ekle
  const enriched = useMemo(() => bankAccounts.map((b) => {
    const accPayments = payments.filter((p) => p.bankAccountId === b.id && p.status === "paid");
    const totalIncoming = accPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return { ...b, totalIncoming, paymentCount: accPayments.length };
  }), [bankAccounts, payments]);

  const openNew = () => {
    setEditing({ id: null, name: "", bankName: "", currency: "USD", iban: "", swift: "", accountNumber: "", branch: "", notes: "" });
    setOpen(true);
  };

  const openEdit = (b) => { setEditing({ ...b }); setOpen(true); };

  const save = () => {
    if (!editing.name?.trim()) return showToast("Hesap adı zorunlu", "error");
    if (!editing.bankName?.trim()) return showToast("Banka adı zorunlu", "error");
    if (editing.id) {
      setBankAccounts((arr) => arr.map((x) => x.id === editing.id ? editing : x));
      showToast("Hesap güncellendi", "success");
    } else {
      setBankAccounts((arr) => [...arr, { ...editing, id: uid(), createdAt: todayISO() }]);
      showToast("Hesap eklendi", "success");
    }
    setOpen(false); setEditing(null);
  };

  const remove = (id) => {
    const inUse = payments.some((p) => p.bankAccountId === id);
    if (inUse) return showToast("Bu hesaba bağlı ödeme kayıtları var, silinemez", "error");
    if (!confirm("Hesap silinsin mi?")) return;
    setBankAccounts((arr) => arr.filter((b) => b.id !== id));
    showToast("Hesap silindi", "success");
  };

  const handleExport = () => {
    if (!bankAccounts.length) return showToast("Aktarılacak hesap yok", "error");
    exportToExcel(bankAccounts.map((b) => ({
      "Hesap Adı": b.name, "Banka": b.bankName, "Para Birimi": b.currency,
      "IBAN": b.iban || "", "SWIFT/BIC": b.swift || "", "Hesap No": b.accountNumber || "",
      "Şube": b.branch || "", "Notlar": b.notes || "",
    })), `banka_hesaplari_${todayISO()}.xlsx`, "Banka Hesapları");
    showToast("Excel'e aktarıldı", "success");
  };

  const handleImport = async (file) => {
    if (!file) return;
    try {
      const rows = await importFromExcel(file);
      const added = rows.map((r) => ({
        id: uid(),
        name: String(r["Hesap Adı"] || "").trim(),
        bankName: String(r["Banka"] || "").trim(),
        currency: String(r["Para Birimi"] || "USD").toUpperCase(),
        iban: String(r["IBAN"] || ""),
        swift: String(r["SWIFT/BIC"] || ""),
        accountNumber: String(r["Hesap No"] || ""),
        branch: String(r["Şube"] || ""),
        notes: String(r["Notlar"] || ""),
        createdAt: todayISO(),
      })).filter((b) => b.name && b.bankName);
      setBankAccounts((arr) => [...arr, ...added]);
      showToast(`${added.length} hesap içe aktarıldı`, "success");
    } catch (e) { showToast("Hata: " + e.message, "error"); }
  };

  const downloadTemplate = () => exportToExcel([{
    "Hesap Adı": "Garanti USD", "Banka": "Garanti BBVA", "Para Birimi": "USD",
    "IBAN": "TR00 0006 2000 0000 0000 0000 01", "SWIFT/BIC": "TGBATRIS",
    "Hesap No": "1234567", "Şube": "Denizli", "Notlar": "",
  }], "banka_sablonu.xlsx", "Şablon");

  return (
    <div>
      <PageHeader title={t("bankAccounts")} subtitle={t("bankAccountsSubtitle")}>
        <input id="bank-import" type="file" accept=".xlsx,.xls" onChange={(e) => { handleImport(e.target.files[0]); e.target.value = ""; }} className="hidden" />
        <Btn variant="secondary" size="sm" icon={FileDown} onClick={handleExport}>{t("export")}</Btn>
        {canEdit && <>
          <Btn variant="ghost" size="sm" icon={FileDown} onClick={downloadTemplate}>{t("template")}</Btn>
          <Btn variant="secondary" size="sm" icon={FileUp} onClick={() => document.getElementById("bank-import").click()}>{t("import")}</Btn>
          <Btn variant="primary" size="sm" icon={Plus} onClick={openNew}>{t("new")}</Btn>
        </>}
      </PageHeader>

      <div className="p-8 space-y-4">
        {bankAccounts.length === 0 ? (
          <Card>
            <EmptyState
              icon={Landmark}
              title="Henüz banka hesabı yok"
              hint="Tahsilatlarının geldiği banka hesaplarını para birimi bazında kaydet. Ödeme girişinde hangi hesaba geldi seçeceksin — böylece her hesabın bakiyesini takip edersin."
              action={canEdit ? <Btn variant="primary" size="sm" icon={Plus} onClick={openNew}>İlk Hesabı Ekle</Btn> : null}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {enriched.map((b) => (
              <div key={b.id} className="rounded-lg p-5 transition-shadow hover:shadow-sm" style={{ background: "white", border: `1px solid ${TOKENS.border}` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background: TOKENS.cream }}>
                      <Landmark size={16} style={{ color: TOKENS.gold }} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: TOKENS.ink }}>{b.name}</div>
                      <div className="text-[11px]" style={{ color: TOKENS.muted }}>{b.bankName}</div>
                    </div>
                  </div>
                  <Pill color="gold">{b.currency}</Pill>
                </div>
                <div className="space-y-1.5 text-xs mb-4" style={{ color: TOKENS.muted }}>
                  {b.iban && <div className="flex gap-2"><span className="font-medium w-12">IBAN</span><span className="font-mono truncate">{b.iban}</span></div>}
                  {b.swift && <div className="flex gap-2"><span className="font-medium w-12">SWIFT</span><span className="font-mono">{b.swift}</span></div>}
                  {b.branch && <div className="flex gap-2"><span className="font-medium w-12">Şube</span><span>{b.branch}</span></div>}
                </div>
                <div className="pt-3 flex items-end justify-between" style={{ borderTop: `1px solid ${TOKENS.border}` }}>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: TOKENS.muted }}>Toplam Tahsilat</div>
                    <div className="text-base font-semibold" style={{ color: TOKENS.forest }}>{fmtMoney(b.totalIncoming, b.currency)}</div>
                    <div className="text-[10px]" style={{ color: TOKENS.muted }}>{b.paymentCount} ödeme</div>
                  </div>
                  <div className="flex gap-1">
                    {canEdit && <button onClick={() => openEdit(b)} className="p-1.5 rounded transition" style={{ color: TOKENS.muted }} onMouseEnter={(e) => { e.currentTarget.style.background = TOKENS.cream; e.currentTarget.style.color = TOKENS.navy; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TOKENS.muted; }}><Pencil size={14} /></button>}
                    {canEdit && <button onClick={() => remove(b.id)} className="p-1.5 rounded transition" style={{ color: TOKENS.muted }} onMouseEnter={(e) => { e.currentTarget.style.background = TOKENS.oxblood + "15"; e.currentTarget.style.color = TOKENS.oxblood; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TOKENS.muted; }}><Trash2 size={14} /></button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={open && !!editing} onClose={() => { setOpen(false); setEditing(null); }} title={editing?.id ? "Hesabı Düzenle" : "Yeni Banka Hesabı"} size="md"
        footer={<><Btn variant="ghost" onClick={() => { setOpen(false); setEditing(null); }}>İptal</Btn><Btn variant="primary" icon={Save} onClick={save}>Kaydet</Btn></>}
      >
        {editing && (
          <div className="grid grid-cols-2 gap-3">
            <div><Label required>Hesap Adı</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Garanti USD Hesabı" /></div>
            <div><Label required>Banka</Label><Input value={editing.bankName} onChange={(e) => setEditing({ ...editing, bankName: e.target.value })} placeholder="Garanti BBVA" /></div>
            <div><Label required>Para Birimi</Label><Select value={editing.currency} onChange={(e) => setEditing({ ...editing, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></div>
            <div><Label>Şube</Label><Input value={editing.branch} onChange={(e) => setEditing({ ...editing, branch: e.target.value })} /></div>
            <div className="col-span-2"><Label hint="uluslararası transfer için">IBAN</Label><Input value={editing.iban} onChange={(e) => setEditing({ ...editing, iban: e.target.value })} className="font-mono" placeholder="TR..." /></div>
            <div><Label>SWIFT/BIC</Label><Input value={editing.swift} onChange={(e) => setEditing({ ...editing, swift: e.target.value })} className="font-mono" /></div>
            <div><Label>Hesap No</Label><Input value={editing.accountNumber} onChange={(e) => setEditing({ ...editing, accountNumber: e.target.value })} className="font-mono" /></div>
            <div className="col-span-2"><Label>Notlar</Label><Textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ============================================================================
// SİPARİŞLER — en kapsamlı modül
// ============================================================================
// Yapı:
//   - Sipariş üst bilgisi (müşteri, tarih, durum, incoterms, sevkiyat...)
//   - Kalemler (ürün bazlı satırlar)        → adet × birim fiyat
//   - Ödeme Planı (sipariş bazlı taksitler) → ön ödeme + sevk öncesi + vadeli
// "Ödeme Planı" sipariş kaydında oluşturulur ve "Ödemeler" modülünde her
// taksitin tahsilatı ayrı ayrı kaydedilir.

function OrdersView({ customers, products, orders, setOrders, payments, setPayments, bankAccounts, rates, canEdit, showToast, setView, pendingOrderToOpen, setPendingOrderToOpen, t = (k) => k, lang = "tr" }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState([]); // multi-select
  const [customerFilter, setCustomerFilter] = useState([]); // multi-select
  const [curFilter, setCurFilter] = useState([]); // multi-select
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [viewMode, setViewMode] = useState("list");

  // Müşteri sayfasından "siparişi aç" yönlendirmesi geldiyse, otomatik aç
  useEffect(() => {
    if (pendingOrderToOpen) {
      const o = orders.find((x) => x.id === pendingOrderToOpen);
      if (o) setViewing(o);
      if (setPendingOrderToOpen) setPendingOrderToOpen(null);
    }
  }, [pendingOrderToOpen, orders, setPendingOrderToOpen]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return orders.filter((o) => {
      if (statusFilter.length > 0 && !statusFilter.includes(o.status)) return false;
      if (customerFilter.length > 0 && !customerFilter.includes(o.customerId)) return false;
      if (curFilter.length > 0 && !curFilter.includes(o.currency)) return false;
      if (dateRange.from && (o.orderDate || "") < dateRange.from) return false;
      if (dateRange.to && (o.orderDate || "") > dateRange.to) return false;
      if (!q) return true;
      const customer = customers.find((c) => c.id === o.customerId);
      const itemsText = (o.items || []).map((i) => `${i.productCode} ${i.nameTr} ${i.nameEn}`).join(" ");
      return [o.orderNumber, customer?.name, customer?.country, o.notes, o.invoiceNumber, o.billOfLading, itemsText]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [orders, customers, search, statusFilter, customerFilter, curFilter, dateRange]);

  // Yeni sipariş otomatik numaralandırma: SP-YIL-XXXX
  const nextOrderNumber = () => {
    const year = new Date().getFullYear();
    const yearOrders = orders.filter((o) => o.orderNumber?.includes(`SP-${year}`));
    return `SP-${year}-${String(yearOrders.length + 1).padStart(4, "0")}`;
  };

  const openNew = () => {
    setEditing({
      id: null,
      orderNumber: nextOrderNumber(),
      customerId: customers[0]?.id || "",
      orderDate: todayISO(),
      shipmentDate: "",
      actualShipmentDate: "",
      currency: customers[0]?.defaultCurrency || "USD",
      status: "draft",
      incoterms: customers[0]?.preferredIncoterm || "FOB",
      shippingMethod: "sea",
      portOfLoading: "",
      portOfDischarge: "",
      invoiceNumber: "",
      billOfLading: "",
      items: [],
      paymentPlan: [], // Sipariş kaydında oluşturulan taksit planı
      notes: "",
    });
    setOpen(true);
  };

  const openEdit = (o) => {
    setEditing({
      ...o,
      items: [...(o.items || [])],
      paymentPlan: [...(o.paymentPlan || [])],
    });
    setOpen(true);
  };

  const save = () => {
    if (!editing.orderNumber?.trim()) return showToast("Sipariş no zorunlu", "error");
    if (!editing.customerId) return showToast("Müşteri seçin", "error");
    if ((editing.items || []).length === 0) return showToast("En az bir kalem ekleyin", "error");

    const cleaned = {
      ...editing,
      items: editing.items.map((i) => ({ ...i, quantity: Number(i.quantity) || 0, unitPrice: Number(i.unitPrice) || 0, discount: Number(i.discount) || 0 })),
      paymentPlan: (editing.paymentPlan || []).map((p) => ({ ...p, percentage: Number(p.percentage) || 0, amount: Number(p.amount) || 0 })),
      vatRate: Number(editing.vatRate) || 0,
      discountValue: Number(editing.discountValue) || 0,
    };

    // Fiili sevk tarihi ilk kez girildiyse o günkü kuru kilitle
    // Böylece TCMB güncellemesi ile sevk edilmiş siparişin USD değeri değişmez
    const oldOrderForRate = editing.id ? orders.find((o) => o.id === editing.id) : null;
    const wasShipped = !!(oldOrderForRate?.actualShipmentDate);
    const isShipped = !!cleaned.actualShipmentDate;
    if (isShipped && !wasShipped && cleaned.currency !== "USD") {
      // İlk kez sevk işaretlendi → kuru kaydet
      const currentRate = rates[cleaned.currency];
      if (currentRate && currentRate > 0) {
        cleaned.lockedRateAtShipment = currentRate;
        cleaned.lockedAt = todayISO();
      }
    } else if (!isShipped && oldOrderForRate?.lockedRateAtShipment) {
      // Sevk geri alındı → kilidi de geri al
      delete cleaned.lockedRateAtShipment;
      delete cleaned.lockedAt;
    } else if (oldOrderForRate?.lockedRateAtShipment) {
      // Sevk durumu değişmedi, kilidi koru
      cleaned.lockedRateAtShipment = oldOrderForRate.lockedRateAtShipment;
      cleaned.lockedAt = oldOrderForRate.lockedAt;
    }

    if (editing.id) {
      // Mevcut sipariş — plan değişmiş mi ve tahsilatlar var mı kontrol et
      const oldOrder = orders.find((o) => o.id === editing.id);
      const oldPlanIds = new Set((oldOrder?.paymentPlan || []).map((p) => p.id));
      const newPlanIds = new Set((cleaned.paymentPlan || []).map((p) => p.id));
      // Plan değişti mi: kaleme göre ID veya tutar farkı
      const planChanged =
        oldOrder?.paymentPlan?.length !== cleaned.paymentPlan?.length ||
        (oldOrder?.paymentPlan || []).some((op) => {
          const np = cleaned.paymentPlan.find((x) => x.id === op.id);
          return !np || Math.abs((Number(np.amount) || 0) - (Number(op.amount) || 0)) > 0.01 || np.dueDate !== op.dueDate || np.type !== op.type;
        });
      // Bu siparişe ait tahsil edilmiş ödemeler
      const paidPayments = payments.filter((p) => p.orderId === editing.id && p.status === "paid");

      if (planChanged && paidPayments.length > 0) {
        const ok = confirm(
          `Bu sipariş için zaten ${paidPayments.length} tahsil edilmiş ödeme kaydı var.\n\nÖdeme planı değişikliği bu tahsilatları SİLECEK ve plan baştan oluşturulacak.\n\nDevam edilsin mi?`
        );
        if (!ok) return;
        // Tahsilatları temizle
        setPayments((arr) => arr.filter((p) => p.orderId !== editing.id));
        // Sonra yeniden oluştur
        setTimeout(() => syncPaymentsFromPlan(cleaned, [], setPayments), 0);
      } else {
        syncPaymentsFromPlan(cleaned, payments, setPayments);
      }
      setOrders((arr) => arr.map((x) => x.id === editing.id ? cleaned : x));
      showToast("Sipariş güncellendi", "success");
    } else {
      const newOrder = { ...cleaned, id: uid(), createdAt: todayISO() };
      setOrders((arr) => [...arr, newOrder]);
      syncPaymentsFromPlan(newOrder, payments, setPayments);
      showToast("Sipariş eklendi · Ödeme planı kalemleri Ödemeler modülünde", "success");
    }
    setOpen(false); setEditing(null);
  };

  const remove = (id) => {
    if (!confirm("Bu sipariş silinsin mi? İlişkili ödeme kayıtları da silinir.")) return;
    setOrders((arr) => arr.filter((o) => o.id !== id));
    setPayments((arr) => arr.filter((p) => p.orderId !== id));
    showToast("Sipariş silindi", "success");
  };

  // Filtreli sipariş listesini PDF olarak yazdır
  const printList = () => {
    if (!filtered.length) return showToast("Yazdırılacak sipariş yok", "error");

    const rows = filtered.map((o) => {
      const c = customers.find((x) => x.id === o.customerId);
      const t = orderTotal(o);
      const paid = orderPaidAmount(o, payments);
      const remaining = t - paid;
      const st = ORDER_STATUSES.find((s) => s.key === o.status);
      const usd = orderTotalUSD ? orderTotalUSD(o, rates) : toUSD(t, o.currency, rates);
      return `
        <tr>
          <td class="text-mono">${htmlEscape(o.orderNumber)}</td>
          <td><div style="font-weight:700">${htmlEscape(c?.name || "—")}</div><div style="font-size:9px;color:#7A736A">${htmlEscape(c?.country || "")}</div></td>
          <td>${fmtDate(o.orderDate)}<div style="font-size:9px;color:#7A736A">W${getISOWeek(o.orderDate) || "—"}</div></td>
          <td>${o.shipmentDate ? fmtDate(o.shipmentDate) : "—"}${o.shipmentDate ? `<div style="font-size:9px;color:#7A736A">W${getISOWeek(o.shipmentDate)}</div>` : ""}</td>
          <td>${o.actualShipmentDate ? `<span class="text-success">${fmtDate(o.actualShipmentDate)}</span><div style="font-size:9px;color:#3E7D5A">W${getISOWeek(o.actualShipmentDate)}</div>` : "—"}</td>
          <td class="center">${(o.items || []).length}</td>
          <td class="right text-mono" style="font-weight:700">${fmtMoneyPDF(t, o.currency)}</td>
          <td class="right text-mono text-success">${paid > 0 ? fmtMoneyPDF(paid, o.currency) : "—"}</td>
          <td class="right text-mono ${remaining > 0.01 ? 'text-warning' : 'text-success'}">${remaining > 0.01 ? fmtMoneyPDF(remaining, o.currency) : "✓"}</td>
          <td class="right text-mono" style="color:#7A736A">$${(usd || 0).toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</td>
          <td>${st?.label || o.status}</td>
        </tr>`;
    }).join("");

    // KPI'lar
    const totalUSD = filtered.reduce((s, o) => s + (orderTotalUSD ? orderTotalUSD(o, rates) : toUSD(orderTotal(o), o.currency, rates)), 0);
    const totalPaidUSD = filtered.reduce((s, o) => s + toUSD(orderPaidAmount(o, payments), o.currency, rates), 0);
    const shipped = filtered.filter((o) => o.actualShipmentDate).length;

    // Filtre özeti
    const filters = [];
    if (search) filters.push(`${lang === "en" ? "Search" : "Arama"}: "${search}"`);
    if (statusFilter.length > 0) filters.push(`${t("status")}: ${statusFilter.map((s) => ORDER_STATUSES.find((x) => x.key === s)?.label || s).join(", ")}`);
    if (customerFilter.length > 0) filters.push(`${t("customer")}: ${customerFilter.map((id) => customers.find((c) => c.id === id)?.name || id).join(", ")}`);
    if (curFilter.length > 0) filters.push(`${lang === "en" ? "Currency" : "Para Birimi"}: ${curFilter.join(", ")}`);
    if (dateRange.from || dateRange.to) filters.push(`${lang === "en" ? "Date" : "Tarih"}: ${dateRange.from || "..."} → ${dateRange.to || "..."}`);

    const content = `
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">Toplam Sipariş</div><div class="kpi-value">${filtered.length}</div></div>
        <div class="kpi"><div class="kpi-label">Sevk Edilen</div><div class="kpi-value">${shipped}</div></div>
        <div class="kpi"><div class="kpi-label">Toplam Ciro (USD)</div><div class="kpi-value">$${totalUSD.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
        <div class="kpi"><div class="kpi-label">Tahsil (USD)</div><div class="kpi-value" style="color:#3E7D5A">$${totalPaidUSD.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
      </div>
      ${filters.length ? `<div style="font-size:10px;padding:6px 10px;background:#F8F5EE;border-radius:3px;margin-bottom:8px"><strong>Filtreler:</strong> ${filters.join(" · ")}</div>` : ""}
      <table>
        <thead>
          <tr>
            <th>Sipariş No</th>
            <th>Müşteri</th>
            <th>Sipariş</th>
            <th>Plan. Sevk</th>
            <th>Fiili Sevk</th>
            <th class="center">Klm</th>
            <th class="right">Tutar</th>
            <th class="right">Tahsil</th>
            <th class="right">Kalan</th>
            <th class="right">USD</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    printPDF({
      title: lang === "en" ? "Order List" : "Sipariş Listesi",
      subtitle: `${filtered.length} ${lang === "en" ? "orders" : "sipariş"}${filters.length ? (lang === "en" ? " · filtered" : " · filtreli") : ""}`,
      contentHtml: content,
      orientation: "landscape",
      lang,
    });
  };

  // Ay/Hafta görünümü için PDF — accordion mantığında
  // Aylar başlık, içlerinde sipariş satırları + altlarında kalemler
  const printCalendar = () => {
    if (!filtered.length) return showToast(lang === "en" ? "No orders to print" : "Yazdırılacak sipariş yok", "error");

    // Ay bazında grupla — sevk tarihine göre (calendar view ile aynı mantık)
    const grouped = {};
    filtered.forEach((o) => {
      const d = o.actualShipmentDate || o.shipmentDate || o.orderDate || o.createdAt;
      if (!d) return;
      const key = d.slice(0, 7);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(o);
    });
    Object.keys(grouped).forEach((k) => grouped[k].sort((a, b) => {
      const da = a.actualShipmentDate || a.shipmentDate || a.orderDate || "";
      const db = b.actualShipmentDate || b.shipmentDate || b.orderDate || "";
      return db.localeCompare(da);
    }));
    const sortedMonths = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

    const monthLabel = (key) => {
      const [y, m] = key.split("-");
      const d = new Date(Number(y), Number(m) - 1, 1);
      return d.toLocaleDateString(lang === "en" ? "en-US" : "tr-TR", { month: "long", year: "numeric" }).toUpperCase();
    };

    const monthBlocks = sortedMonths.map((monthKey) => {
      const monthOrders = grouped[monthKey];
      const monthTotal = monthOrders.reduce((s, o) => s + orderTotalUSD(o, rates), 0);
      const shippedCount = monthOrders.filter((o) => o.actualShipmentDate).length;

      const orderBlocks = monthOrders.map((o) => {
        const c = customers.find((x) => x.id === o.customerId);
        const t = orderTotal(o);
        const paid = orderPaidAmount(o, payments);
        const remaining = t - paid;
        const totals = calcOrderTotals(o);
        const st = ORDER_STATUSES.find((s) => s.key === o.status);
        const isShipped = !!o.actualShipmentDate;

        const itemRows = (o.items || []).map((it) => {
          const baseT = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
          const lineDisc = Number(it.discount) || 0;
          const lineT = baseT * (1 - lineDisc / 100);
          return `
            <tr>
              <td class="text-mono" style="font-size:10px;font-weight:700;color:#1E3A5F">${htmlEscape(it.productCode)}</td>
              <td style="font-size:10px"><strong>${htmlEscape(it.nameTr || "—")}</strong>${it.nameEn ? `<br/><span style="color:#7A736A;font-style:italic;font-size:9px">${htmlEscape(it.nameEn)}</span>` : ""}</td>
              <td class="right text-mono" style="font-size:10px">${fmtNum(it.quantity)} ${it.unit || ""}</td>
              <td class="right text-mono" style="font-size:10px">${fmtMoneyPDF(it.unitPrice, o.currency)}</td>
              <td class="right" style="font-size:10px;color:${lineDisc > 0 ? '#B87333' : '#7A736A'}">${lineDisc > 0 ? "%" + lineDisc : "—"}</td>
              <td class="right text-mono" style="font-size:10px;font-weight:700">${fmtMoneyPDF(lineT, o.currency)}</td>
            </tr>`;
        }).join("");

        const totalsRows = `
          ${totals.discount > 0 || totals.vatRate > 0 || (o.additionalCosts || []).length > 0 ? `<tr><td colspan="5" class="right" style="font-size:10px;color:#7A736A">${lang === "en" ? "Subtotal" : "Ara Toplam"}</td><td class="right text-mono" style="font-size:10px;font-weight:700">${fmtMoneyPDF(totals.subtotal, o.currency)}</td></tr>` : ""}
          ${totals.discount > 0 ? `<tr><td colspan="5" class="right" style="font-size:10px;color:#B87333">${lang === "en" ? "Discount" : "İskonto"}</td><td class="right text-mono" style="font-size:10px;color:#B87333">− ${fmtMoneyPDF(totals.discount, o.currency)}</td></tr>` : ""}
          ${(o.additionalCosts || []).map((cc) => `<tr><td colspan="5" class="right" style="font-size:10px;color:#B87333">+ ${htmlEscape(cc.description || "İlave")}</td><td class="right text-mono" style="font-size:10px;color:#B87333">+ ${fmtMoneyPDF(cc.amount, o.currency)}</td></tr>`).join("")}
          ${totals.vatRate > 0 ? `<tr><td colspan="5" class="right" style="font-size:10px;color:#7A736A">${lang === "en" ? "VAT" : "KDV"} (%${totals.vatRate})</td><td class="right text-mono" style="font-size:10px">+ ${fmtMoneyPDF(totals.vatAmount, o.currency)}</td></tr>` : ""}
          <tr style="background:#C9A96120;border-top:2px solid #C9A961">
            <td colspan="5" class="right" style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">${lang === "en" ? "Grand Total" : "Genel Toplam"}</td>
            <td class="right text-mono" style="font-size:11px;font-weight:700">${fmtMoneyPDF(totals.total, o.currency)}</td>
          </tr>
        `;

        return `
          <div style="margin-bottom:14px;page-break-inside:avoid;border:1px solid #E8E2D6;border-radius:6px;overflow:hidden;${isShipped ? 'background:#3E7D5A0A' : 'background:white'}">
            <div style="padding:8px 12px;background:${isShipped ? '#3E7D5A15' : '#F8F5EE'};border-bottom:1px solid #E8E2D6;display:flex;justify-content:space-between;align-items:center;gap:12px">
              <div style="display:flex;align-items:center;gap:12px;flex:1">
                <strong style="font-family:'Courier New',monospace;color:#1E3A5F;font-size:11px">${htmlEscape(o.orderNumber)}</strong>
                <div>
                  <div style="font-weight:700;font-size:11px">${htmlEscape(c?.name || "—")}</div>
                  <div style="font-size:9px;color:#7A736A">
                    ${fmtDate(o.orderDate)} · W${getISOWeek(o.orderDate) || "—"}
                    ${o.shipmentDate ? ` · ${lang === "en" ? "Plan. Ship" : "Plan. Sevk"}: ${fmtDate(o.shipmentDate)}` : ""}
                    ${o.actualShipmentDate ? ` · <span style="color:#3E7D5A;font-weight:700">${lang === "en" ? "Actual Ship" : "Fiili Sevk"}: ${fmtDate(o.actualShipmentDate)}</span>` : ""}
                  </div>
                </div>
              </div>
              <div style="text-align:right">
                <div style="font-size:11px;font-weight:700">${fmtMoneyPDF(t, o.currency)}</div>
                ${paid > 0 ? `<div style="font-size:9px;color:#3E7D5A">✓ ${fmtMoneyPDF(paid, o.currency)}</div>` : ""}
                <div style="font-size:9px;color:#7A736A">${st?.label || o.status}</div>
              </div>
            </div>
            ${(o.items || []).length > 0 ? `
              <table style="margin:0;border:none;font-size:10px">
                <thead style="background:#F8F5EE">
                  <tr>
                    <th style="font-size:9px;padding:5px 8px">${lang === "en" ? "Code" : "Kod"}</th>
                    <th style="font-size:9px;padding:5px 8px">${lang === "en" ? "Product" : "Ürün"}</th>
                    <th class="right" style="font-size:9px;padding:5px 8px">${lang === "en" ? "Qty" : "Adet"}</th>
                    <th class="right" style="font-size:9px;padding:5px 8px">${lang === "en" ? "Unit Price" : "Birim Fiyat"}</th>
                    <th class="right" style="font-size:9px;padding:5px 8px">${lang === "en" ? "Disc" : "İsk"}</th>
                    <th class="right" style="font-size:9px;padding:5px 8px">${lang === "en" ? "Line Total" : "Toplam"}</th>
                  </tr>
                </thead>
                <tbody>${itemRows}</tbody>
                <tfoot>${totalsRows}</tfoot>
              </table>
            ` : `<div style="padding:10px;text-align:center;color:#7A736A;font-style:italic;font-size:10px">${lang === "en" ? "No items" : "Kalem yok"}</div>`}
          </div>
        `;
      }).join("");

      return `
        <div style="margin-bottom:24px;page-break-inside:avoid">
          <div style="background:#0F1A2E;color:white;padding:10px 14px;border-radius:6px 6px 0 0;display:flex;justify-content:space-between;align-items:center">
            <div style="display:flex;align-items:center;gap:10px">
              <strong style="font-size:13px;letter-spacing:0.05em">${monthLabel(monthKey)}</strong>
              <span style="font-size:10px;background:#C9A96130;color:#C9A961;padding:2px 8px;border-radius:3px;font-weight:700">
                ${monthOrders.length} ${lang === "en" ? "orders" : "sipariş"}
              </span>
              ${shippedCount > 0 ? `<span style="font-size:10px;background:#3E7D5A30;color:#86efac;padding:2px 8px;border-radius:3px;font-weight:700">${shippedCount} ${lang === "en" ? "shipped" : "sevk edildi"}</span>` : ""}
            </div>
            <div style="font-size:12px;color:#C9A961;font-weight:700">
              $${monthTotal.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
          </div>
          <div style="padding:8px 8px 0">
            ${orderBlocks}
          </div>
        </div>
      `;
    }).join("");

    // Filtre özeti
    const filterParts = [];
    if (search) filterParts.push(`${lang === "en" ? "Search" : "Arama"}: "${search}"`);
    if (statusFilter.length > 0) filterParts.push(`${t("status")}: ${statusFilter.map((s) => ORDER_STATUSES.find((x) => x.key === s)?.label || s).join(", ")}`);
    if (customerFilter.length > 0) filterParts.push(`${t("customer")}: ${customerFilter.map((id) => customers.find((c) => c.id === id)?.name || id).join(", ")}`);
    if (curFilter.length > 0) filterParts.push(`${lang === "en" ? "Currency" : "Para Birimi"}: ${curFilter.join(", ")}`);

    const totalRevenue = filtered.reduce((s, o) => s + orderTotalUSD(o, rates), 0);
    const totalShipped = filtered.filter((o) => o.actualShipmentDate).length;

    const content = `
      ${filterParts.length > 0 ? `<div style="font-size:10px;padding:6px 10px;background:#FFF8E7;border-left:3px solid #C9A961;margin-bottom:10px"><strong>${lang === "en" ? "Filters" : "Filtreler"}:</strong> ${filterParts.join(" · ")}</div>` : ""}
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">${lang === "en" ? "Total Orders" : "Toplam Sipariş"}</div><div class="kpi-value">${filtered.length}</div></div>
        <div class="kpi"><div class="kpi-label">${lang === "en" ? "Shipped" : "Sevk Edilen"}</div><div class="kpi-value" style="color:#3E7D5A">${totalShipped}</div></div>
        <div class="kpi"><div class="kpi-label">${lang === "en" ? "Months" : "Ay Sayısı"}</div><div class="kpi-value">${sortedMonths.length}</div></div>
        <div class="kpi"><div class="kpi-label">${lang === "en" ? "Total Volume (USD)" : "Toplam Hacim (USD)"}</div><div class="kpi-value">$${totalRevenue.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
      </div>
      ${monthBlocks}
    `;

    printPDF({
      title: lang === "en" ? "Order List · Month/Week View" : "Sipariş Listesi · Ay/Hafta Görünümü",
      subtitle: `${filtered.length} ${lang === "en" ? "orders" : "sipariş"} · ${sortedMonths.length} ${lang === "en" ? "months" : "ay"}${filterParts.length ? (lang === "en" ? " · filtered" : " · filtreli") : ""}`,
      contentHtml: content,
      orientation: "portrait",
      lang,
    });
  };

  const handleExport = () => {
    if (!orders.length) return showToast("Aktarılacak sipariş yok", "error");
    const rows = orders.flatMap((o) => {
      const customer = customers.find((c) => c.id === o.customerId);
      const total = orderTotal(o);
      if ((o.items || []).length === 0) return [];
      return o.items.map((i) => ({
        "Sipariş No": o.orderNumber,
        "Müşteri": customer?.name || "—",
        "Ülke": customer?.country || "",
        "Sipariş Tarihi": o.orderDate || "",
        "Sevk Tarihi": o.shipmentDate || "",
        "Durum": ORDER_STATUSES.find((s) => s.key === o.status)?.label || o.status,
        "Incoterms": o.incoterms || "",
        "Para Birimi": o.currency,
        "Ürün Kodu": i.productCode,
        "Mamul Kodu": i.manufacturingCode || "",
        "Türkçe İsim": i.nameTr || "",
        "İngilizce İsim": i.nameEn || "",
        "Adet": i.quantity, "Birim": i.unit || "adet", "Birim Fiyat": i.unitPrice,
        "Kalem Toplamı": (i.quantity || 0) * (i.unitPrice || 0),
        "Sipariş Toplamı": total,
        "Fatura No": o.invoiceNumber || "",
        "Konşimento No": o.billOfLading || "",
        "Notlar": o.notes || "",
      }));
    });
    exportToExcel(rows, `siparisler_${todayISO()}.xlsx`, "Siparişler");
    showToast("Excel'e aktarıldı", "success");
  };

  // Excel'den sipariş içe aktar — her satır bir kalem, sipariş no'lara göre gruplanır
  const handleImport = async (file) => {
    if (!file) return;
    try {
      const rows = await importFromExcel(file);
      // Sipariş no'ya göre grupla
      const ordersByNumber = {};
      rows.forEach((r) => {
        const no = String(r["Sipariş No"] || "").trim();
        if (!no) return;
        const customerName = String(r["Müşteri"] || "").trim();
        const customer = customers.find((c) => c.name === customerName);
        if (!ordersByNumber[no]) {
          ordersByNumber[no] = {
            orderNumber: no,
            customerId: customer?.id || customers[0]?.id || "",
            orderDate: r["Sipariş Tarihi"] || todayISO(),
            shipmentDate: r["Sevk Tarihi"] || "",
            status: "draft",
            incoterms: r["Incoterms"] || "FOB",
            currency: String(r["Para Birimi"] || "USD").toUpperCase(),
            invoiceNumber: r["Fatura No"] || "",
            billOfLading: r["Konşimento No"] || "",
            notes: r["Notlar"] || "",
            items: [],
            paymentPlan: [],
          };
        }
        ordersByNumber[no].items.push({
          id: uid(),
          productCode: String(r["Ürün Kodu"] || ""),
          manufacturingCode: String(r["Mamul Kodu"] || ""),
          nameTr: String(r["Türkçe İsim"] || ""),
          nameEn: String(r["İngilizce İsim"] || ""),
          unit: String(r["Birim"] || "adet"),
          quantity: Number(r["Adet"]) || 0,
          unitPrice: Number(r["Birim Fiyat"]) || 0,
        });
      });
      const newOrders = Object.values(ordersByNumber).map((o) => ({ ...o, id: uid(), createdAt: todayISO() }));
      setOrders((arr) => [...arr, ...newOrders]);
      showToast(`${newOrders.length} sipariş içe aktarıldı`, "success");
    } catch (e) { showToast("Hata: " + e.message, "error"); }
  };

  const downloadTemplate = () => {
    exportToExcel([{
      "Sipariş No": "SP-2026-0001",
      "Müşteri": "Örnek Müşteri Adı",
      "Ülke": "Almanya",
      "Sipariş Tarihi": todayISO(),
      "Sevk Tarihi": "",
      "Durum": "Taslak",
      "Incoterms": "FOB",
      "Para Birimi": "USD",
      "Ürün Kodu": "PRD-001",
      "Mamul Kodu": "",
      "Türkçe İsim": "Ürün Adı",
      "İngilizce İsim": "Product Name",
      "Adet": 100,
      "Birim": "adet",
      "Birim Fiyat": 25,
      "Fatura No": "",
      "Konşimento No": "",
      "Notlar": "",
    }], "siparis_sablonu.xlsx", "Şablon");
  };


  const total = (o) => orderTotal(o);

  const columns = [
    { key: "orderNumber", label: "Sipariş No", render: (r) => <span className="font-mono text-xs font-bold" style={{ color: TOKENS.navy }}>{r.orderNumber}</span> },
    { key: "customer", label: "Müşteri", sortValue: (r) => customers.find((c) => c.id === r.customerId)?.name || "", render: (r) => {
      const c = customers.find((x) => x.id === r.customerId);
      return (
        <div>
          <div className="font-bold text-xs" style={{ color: TOKENS.ink }}>{c?.name || "—"}</div>
          <div className="text-[10px] font-semibold" style={{ color: TOKENS.muted }}>{c?.country || ""}</div>
        </div>
      );
    }},
    { key: "orderDate", label: "Sipariş", sortValue: (r) => r.orderDate || "", render: (r) => (
      <div>
        <div className="text-xs font-semibold">{fmtDate(r.orderDate)}</div>
        <div className="text-[10px] font-bold" style={{ color: TOKENS.muted }}>W{getISOWeek(r.orderDate) || "—"}</div>
      </div>
    )},
    { key: "shipmentDate", label: "Plan. Sevk", sortValue: (r) => r.shipmentDate || "", render: (r) => r.shipmentDate ? (
      <div>
        <div className="text-xs font-semibold">{fmtDate(r.shipmentDate)}</div>
        <div className="text-[10px] font-bold" style={{ color: TOKENS.muted }}>W{getISOWeek(r.shipmentDate)}</div>
      </div>
    ) : <span style={{ color: TOKENS.muted }}>—</span> },
    { key: "actualShipmentDate", label: "Fiili Sevk", sortValue: (r) => r.actualShipmentDate || "", render: (r) => r.actualShipmentDate ? (
      <div>
        <div className="text-xs font-bold" style={{ color: TOKENS.forest }}>{fmtDate(r.actualShipmentDate)}</div>
        <div className="text-[10px] font-bold" style={{ color: TOKENS.forest + "cc" }}>W{getISOWeek(r.actualShipmentDate)}</div>
      </div>
    ) : <span style={{ color: TOKENS.muted }}>—</span> },
    { key: "items", label: "Klm", align: "center", sortValue: (r) => (r.items || []).length, render: (r) => <span className="font-bold">{(r.items || []).length}</span> },
    { key: "total", label: "Tutar / Ödenen", align: "right", sortValue: (r) => total(r), render: (r) => {
      const t = total(r);
      const paid = orderPaidAmount(r, payments);
      const remaining = t - paid;
      return (
        <div className="text-right">
          <div className="text-xs font-bold tabular-nums" style={{ color: TOKENS.ink }}>{fmtMoney(t, r.currency)}</div>
          {paid > 0 ? (
            <div className="text-[10px] font-semibold tabular-nums" style={{ color: TOKENS.forest }}>
              ✓ {fmtMoney(paid, r.currency)}
            </div>
          ) : (
            <div className="text-[10px] font-semibold" style={{ color: TOKENS.muted }}>—</div>
          )}
          {remaining > 0.01 && paid > 0 && (
            <div className="text-[10px] font-semibold tabular-nums" style={{ color: TOKENS.copper }}>
              {fmtMoney(remaining, r.currency)} kaldı
            </div>
          )}
        </div>
      );
    }},
    { key: "totalUSD", label: "USD", align: "right", sortValue: (r) => orderTotalUSD ? orderTotalUSD(r, rates) : toUSD(total(r), r.currency, rates), render: (r) => <span className="text-[11px] font-semibold" style={{ color: TOKENS.muted }}>{fmtMoney(orderTotalUSD ? orderTotalUSD(r, rates) : toUSD(total(r), r.currency, rates), "USD", { compact: true })}</span> },
    { key: "paid", label: "Tahsil", align: "right", sortValue: (r) => orderPaidAmount(r, payments) / (total(r) || 1), render: (r) => {
      const t = total(r);
      const paid = orderPaidAmount(r, payments);
      const pct = t > 0 ? Math.round((paid / t) * 100) : 0;
      const color = pct === 100 ? TOKENS.forest : pct >= 50 ? TOKENS.gold : pct > 0 ? TOKENS.copper : TOKENS.muted;
      return (
        <div className="inline-flex flex-col items-end">
          <div className="text-xs font-bold tabular-nums" style={{ color }}>%{pct}</div>
          <div className="w-12 h-1 rounded-full overflow-hidden mt-0.5" style={{ background: TOKENS.cream }}>
            <div className="h-full" style={{ width: `${pct}%`, background: color }} />
          </div>
        </div>
      );
    }},
    { key: "status", label: "Durum", render: (r) => { const s = ORDER_STATUSES.find((x) => x.key === r.status); return <Badge color={s?.color} dot>{s?.label}</Badge>; } },
  ];

  return (
    <div>
      <PageHeader title={t("orders")} subtitle={`${orders.length} ${t("ordersSubtitle")}`}>
        <input id="order-import" type="file" accept=".xlsx,.xls" onChange={(e) => { handleImport(e.target.files[0]); e.target.value = ""; }} className="hidden" />
        <div className="flex gap-1 rounded-md p-0.5" style={{ background: TOKENS.cream, border: `1px solid ${TOKENS.border}` }}>
          <button onClick={() => setViewMode("list")} className="px-3 py-1.5 text-xs font-bold rounded transition" style={{ background: viewMode === "list" ? "white" : "transparent", color: viewMode === "list" ? TOKENS.ink : TOKENS.muted, boxShadow: viewMode === "list" ? "0 1px 2px rgba(0,0,0,0.05)" : "none" }}>{t("list")}</button>
          <button onClick={() => setViewMode("calendar")} className="px-3 py-1.5 text-xs font-bold rounded transition" style={{ background: viewMode === "calendar" ? "white" : "transparent", color: viewMode === "calendar" ? TOKENS.ink : TOKENS.muted, boxShadow: viewMode === "calendar" ? "0 1px 2px rgba(0,0,0,0.05)" : "none" }}>{t("monthWeek")}</button>
        </div>
        <Btn variant="ghost" size="sm" icon={FileDown} onClick={printList}>PDF {lang === "en" ? "List" : "Liste"}</Btn>
        <Btn variant="ghost" size="sm" icon={FileDown} onClick={printCalendar}>PDF {lang === "en" ? "Month/Week" : "Ay/Hafta"}</Btn>
        <Btn variant="secondary" size="sm" icon={FileDown} onClick={handleExport}>{t("export")}</Btn>
        {canEdit && <>
          <Btn variant="ghost" size="sm" icon={FileDown} onClick={downloadTemplate}>{t("template")}</Btn>
          <Btn variant="secondary" size="sm" icon={FileUp} onClick={() => document.getElementById("order-import").click()}>{t("import")}</Btn>
          <Btn variant="primary" size="sm" icon={Plus} onClick={openNew} disabled={customers.length === 0}>{t("newOrder")}</Btn>
        </>}
      </PageHeader>

      <div className="p-8 space-y-4">
        {customers.length === 0 ? (
          <Card>
            <EmptyState icon={Users} title="Önce müşteri eklemelisin" hint="Sipariş bir müşteriye ait olmalı. Müşteri kaydı yapmadan sipariş oluşturamazsın." action={<Btn variant="primary" size="sm" onClick={() => setView("customers")}>Müşterilere Git</Btn>} />
          </Card>
        ) : (
          <>
            <FilterBar>
              <SearchInput value={search} onChange={setSearch} placeholder={lang === "en" ? "Order no, customer, product, invoice..." : "Sipariş no, müşteri, ürün, fatura no..."} />
              <div className="w-44"><Label>{t("status")}</Label>
                <MultiSelect
                  values={statusFilter}
                  onChange={setStatusFilter}
                  options={ORDER_STATUSES.map((s) => ({ value: s.key, label: s.label }))}
                  placeholder={t("all")}
                />
              </div>
              <div className="w-56"><Label>{t("customer")}</Label>
                <MultiSelect
                  values={customerFilter}
                  onChange={setCustomerFilter}
                  options={customers.map((c) => ({ value: c.id, label: c.name, sub: c.code }))}
                  placeholder={t("all")}
                />
              </div>
              <div className="w-28"><Label>{lang === "en" ? "Currency" : "Para Br."}</Label>
                <MultiSelect
                  values={curFilter}
                  onChange={setCurFilter}
                  options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                  placeholder={t("all")}
                />
              </div>
              <DateRange from={dateRange.from} to={dateRange.to} onChange={setDateRange} />
              {(search || statusFilter.length > 0 || customerFilter.length > 0 || curFilter.length > 0 || dateRange.from || dateRange.to) && (
                <Btn variant="ghost" size="sm" icon={X} onClick={() => { setSearch(""); setStatusFilter([]); setCustomerFilter([]); setCurFilter([]); setDateRange({ from: "", to: "" }); }}>{t("clear")}</Btn>
              )}
            </FilterBar>

            {orders.length === 0 ? (
              <Card>
                <EmptyState icon={FileText} title="Henüz sipariş yok" hint="İlk siparişini oluştur. Sipariş kaydederken hem kalemleri (satır bazlı) hem de ödeme planını (ön ödeme/sevk öncesi/vadeli) birlikte tanımlayacaksın." action={canEdit ? <Btn variant="primary" size="sm" icon={Plus} onClick={openNew}>İlk Siparişi Oluştur</Btn> : null} />
              </Card>
            ) : viewMode === "list" ? (
              <DataTable columns={columns} rows={filtered} onRowClick={(r) => setViewing(r)}
                emptyText="Filtreyle eşleşen sipariş yok"
                rowStyle={(r) => r.actualShipmentDate
                  ? { background: "#3E7D5A14", hoverBackground: "#3E7D5A22" }
                  : null}
                actions={(r) => (
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => setViewing(r)} className="p-1.5 rounded transition" style={{ color: TOKENS.muted }} onMouseEnter={(e) => { e.currentTarget.style.background = TOKENS.cream; e.currentTarget.style.color = TOKENS.navy; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TOKENS.muted; }}><Eye size={14} /></button>
                  {canEdit && <button onClick={() => openEdit(r)} className="p-1.5 rounded transition" style={{ color: TOKENS.muted }} onMouseEnter={(e) => { e.currentTarget.style.background = TOKENS.cream; e.currentTarget.style.color = TOKENS.navy; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TOKENS.muted; }}><Pencil size={14} /></button>}
                  {canEdit && <button onClick={() => remove(r.id)} className="p-1.5 rounded transition" style={{ color: TOKENS.muted }} onMouseEnter={(e) => { e.currentTarget.style.background = TOKENS.oxblood + "15"; e.currentTarget.style.color = TOKENS.oxblood; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TOKENS.muted; }}><Trash2 size={14} /></button>}
                </div>
              )} />
            ) : (
              <OrdersCalendarView
                orders={filtered}
                customers={customers}
                rates={rates}
                payments={payments}
                onView={(o) => setViewing(o)}
                onEdit={canEdit ? (o) => openEdit(o) : null}
                onDelete={canEdit ? (id) => remove(id) : null}
                t={t}
                lang={lang}
              />
            )}
          </>
        )}
      </div>

      <OrderEditModal open={open} onClose={() => { setOpen(false); setEditing(null); }} editing={editing} setEditing={setEditing} customers={customers} products={products} onSave={save} />
      <OrderDetailModal
        order={viewing}
        onClose={() => setViewing(null)}
        customers={customers}
        payments={payments}
        bankAccounts={bankAccounts}
        rates={rates}
        setView={setView}
        canEdit={canEdit}
        onEdit={(o) => { setEditing({ ...o }); setOpen(true); }}
        t={t}
        lang={lang}
      />
    </div>
  );
}

// Plan kalemleri → Ödemeler tablosuna otomatik kayıt
// Bu sayede sipariş kaydederken bir kez plan girersin, ödemeler modülünde
// her kalem ayrı satır olarak takip edilir.
function syncPaymentsFromPlan(order, currentPayments, setPayments) {
  const existingForOrder = currentPayments.filter((p) => p.orderId === order.id);
  const orderPlanIds = new Set((order.paymentPlan || []).map((p) => p.id));

  // Bir plan kalemine ait HERHANGİ bir kayıt varsa (paid veya pending), yeni oluşturma
  // Bu sayede kısmi tahsilat sonrası oluşturulan "kalan" pending kayıtlar korunur
  const newPayments = (order.paymentPlan || []).map((plan) => {
    const hasAny = existingForOrder.some((p) => p.planItemId === plan.id);
    if (hasAny) return null;
    return {
      id: uid(),
      orderId: order.id,
      planItemId: plan.id,
      type: plan.type,
      method: plan.method || "bank_transfer",
      amount: plan.amount,
      currency: order.currency,
      dueDate: plan.dueDate,
      paidDate: "",
      status: "pending",
      bankAccountId: "",
      referenceNumber: "",
      notes: plan.notes || "",
      createdAt: todayISO(),
    };
  }).filter(Boolean);

  setPayments((arr) => {
    // Mevcutlardan: bu siparişe ait olmayanlar veya paid olanlar veya planı hâlâ var olanlar kalır
    const filtered = arr.filter((p) => {
      if (p.orderId !== order.id) return true;
      if (!p.planItemId) return true; // Manuel kayıt, koru
      if (p.status === "paid") return true; // Tahsil edilmiş, asla silme
      // Pending: plan kalemi hâlâ var ise koru, yoksa sil
      return orderPlanIds.has(p.planItemId);
    });
    return [...filtered, ...newPayments];
  });
}

// ============================================================================
// SİPARİŞ DÜZENLEME MODALI — kalemler + ödeme planı bir arada
// ============================================================================

// ============================================================================
// SİPARİŞ AY/HAFTA GÖRÜNÜMÜ — Accordion: Ay → Sipariş → Kalemler
// ============================================================================
// Mayıs ayı altında o ayın siparişleri (sipariş no), her sipariş genişletilince
// kalemleri görünür. Salt görüntüleme için ek bir mod.

function OrdersCalendarView({ orders, customers, rates, payments, onView, onEdit, onDelete, t = (k) => k, lang = "tr" }) {
  const [openMonths, setOpenMonths] = useState({}); // { "2026-05": true }
  const [openOrders, setOpenOrders] = useState({}); // { orderId: true }

  // Ay bazında grupla — eğer siparişin shipments[] varsa her sevkiyatın kendi ayına dağıtılır
  // Aksi halde order'ın aktif tarihi (fiili sevk > planlanan > sipariş) kullanılır
  const grouped = useMemo(() => {
    const m = {};
    orders.forEach((o) => {
      const shipments = o.shipments || [];
      if (shipments.length > 0) {
        // Birden fazla sevkiyat varsa her birini ayrı satır olarak ekle
        shipments.forEach((sh) => {
          const d = sh.actualShipmentDate || sh.shipmentDate;
          if (!d) {
            // Sevkiyat tarihi yoksa sipariş tarihine fall back
            const fallback = o.orderDate || o.createdAt;
            if (!fallback) return;
            const key = fallback.slice(0, 7);
            if (!m[key]) m[key] = [];
            m[key].push({ ...o, _shipment: sh });
            return;
          }
          const key = d.slice(0, 7);
          if (!m[key]) m[key] = [];
          m[key].push({ ...o, _shipment: sh });
        });
      } else {
        // Tek sevkiyatlı eski format
        const d = o.actualShipmentDate || o.shipmentDate || o.orderDate || o.createdAt;
        if (!d) return;
        const key = d.slice(0, 7);
        if (!m[key]) m[key] = [];
        m[key].push({ ...o, _shipment: null });
      }
    });
    Object.keys(m).forEach((k) => m[k].sort((a, b) => {
      const sa = a._shipment;
      const sb = b._shipment;
      const da = (sa ? (sa.actualShipmentDate || sa.shipmentDate) : null) || a.actualShipmentDate || a.shipmentDate || a.orderDate || "";
      const db = (sb ? (sb.actualShipmentDate || sb.shipmentDate) : null) || b.actualShipmentDate || b.shipmentDate || b.orderDate || "";
      return db.localeCompare(da);
    }));
    return Object.entries(m).sort(([a], [b]) => b.localeCompare(a));
  }, [orders]);

  // Tümünü açık mı? (varsayılan açık olduğu için: hiçbiri false değilse açık sayılır)
  const allOpen = grouped.length > 0 && grouped.every(([k]) => openMonths[k] !== false);
  const expandAll = () => {
    const obj = {};
    grouped.forEach(([k]) => { obj[k] = true; });
    setOpenMonths(obj);
  };
  const collapseAll = () => {
    const obj = {};
    grouped.forEach(([k]) => { obj[k] = false; });
    setOpenMonths(obj);
  };

  if (grouped.length === 0) {
    return (
      <Card>
        <div className="text-center py-12 text-sm" style={{ color: TOKENS.muted }}>
          {lang === "en" ? "No orders match the filter" : "Filtreyle eşleşen sipariş yok"}
        </div>
      </Card>
    );
  }

  const toggleMonth = (k) => setOpenMonths((s) => ({ ...s, [k]: !s[k] }));
  const toggleOrder = (id) => setOpenOrders((s) => ({ ...s, [id]: !s[id] }));

  const monthLabel = (key) => {
    const [y, m] = key.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString(lang === "en" ? "en-US" : "tr-TR", { month: "long", year: "numeric" }).toUpperCase();
  };

  return (
    <div className="space-y-2">
      {/* Toplu aç/kapat butonu */}
      <div className="flex justify-end">
        <button
          onClick={allOpen ? collapseAll : expandAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded transition"
          style={{ background: "white", color: TOKENS.ink, border: `1px solid ${TOKENS.border}` }}
          onMouseEnter={(e) => (e.currentTarget.style.background = TOKENS.cream)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
          title={allOpen ? (lang === "en" ? "Collapse all months" : "Tüm ayları kapat") : (lang === "en" ? "Expand all months" : "Tüm ayları aç")}
        >
          {allOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {allOpen
            ? (lang === "en" ? "Collapse All" : "Tümünü Kapat")
            : (lang === "en" ? "Expand All" : "Tümünü Aç")}
        </button>
      </div>

      {grouped.map(([monthKey, monthOrders]) => {
        const isMonthOpen = openMonths[monthKey] !== false; // varsayılan açık
        const monthTotal = monthOrders.reduce((s, o) => s + orderTotalUSD(o, rates), 0);
        const shippedCount = monthOrders.filter((o) => o.actualShipmentDate).length;
        return (
          <div key={monthKey} className="rounded-lg overflow-hidden" style={{ background: "white", border: `1px solid ${TOKENS.border}` }}>
            {/* AY BAŞLIĞI */}
            <button
              onClick={() => toggleMonth(monthKey)}
              className="w-full px-4 py-3 flex items-center justify-between transition"
              style={{ background: TOKENS.navy, color: "white", border: "none", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = TOKENS.ink)}
              onMouseLeave={(e) => (e.currentTarget.style.background = TOKENS.navy)}
            >
              <div className="flex items-center gap-3">
                {isMonthOpen ? <ChevronDown size={18} style={{ color: TOKENS.gold }} /> : <ChevronRight size={18} style={{ color: TOKENS.gold }} />}
                <span className="text-sm font-bold tracking-wide">{monthLabel(monthKey)}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: TOKENS.gold + "30", color: TOKENS.gold }}>
                  {monthOrders.length} sipariş
                </span>
                {shippedCount > 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: TOKENS.forest + "30", color: "#86efac" }}>
                    {shippedCount} sevk edildi
                  </span>
                )}
              </div>
              <div className="text-sm font-bold tabular-nums" style={{ color: TOKENS.gold }}>
                ${monthTotal.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </button>

            {/* SİPARİŞLER */}
            {isMonthOpen && (
              <div>
                {monthOrders.map((o) => {
                  const isOpen = openOrders[o._shipment ? `${o.id}-${o._shipment.id}` : o.id];
                  const c = customers.find((x) => x.id === o.customerId);
                  const t = orderTotal(o);
                  const paid = orderPaidAmount(o, payments);
                  const remaining = t - paid;
                  const totals = calcOrderTotals(o);
                  const st = ORDER_STATUSES.find((s) => s.key === o.status);
                  const sh = o._shipment;
                  // Sevkiyat varsa onu kullan, yoksa order seviyesini
                  const effectiveShipDate = sh ? sh.shipmentDate : o.shipmentDate;
                  const effectiveActualDate = sh ? sh.actualShipmentDate : o.actualShipmentDate;
                  const isShipped = !!effectiveActualDate;
                  // Sevkiyatla ilgili kalemler
                  const shipItems = sh ? (o.items || []).filter((it) => (it.shipmentNo || 1) === sh.no) : (o.items || []);
                  const shipTotal = sh ? shipItems.reduce((s, it) => s + ((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)) * (1 - (Number(it.discount) || 0) / 100), 0) : t;
                  return (
                    <div key={sh ? `${o.id}-${sh.id}` : o.id} style={{ borderTop: `1px solid ${TOKENS.border}` }}>
                      {/* SİPARİŞ / SEVKİYAT SATIRI */}
                      <div
                        className="px-4 py-2.5 flex items-center gap-3 transition cursor-pointer"
                        style={{ background: isShipped ? "#3E7D5A14" : "white" }}
                        onClick={() => toggleOrder(sh ? `${o.id}-${sh.id}` : o.id)}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isShipped ? "#3E7D5A22" : TOKENS.cream)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = isShipped ? "#3E7D5A14" : "white")}
                      >
                        {isOpen ? <ChevronDown size={14} style={{ color: TOKENS.gold }} /> : <ChevronRight size={14} style={{ color: TOKENS.muted }} />}
                        <div className="font-mono text-xs font-bold w-32 flex-shrink-0" style={{ color: TOKENS.navy }}>
                          {o.orderNumber}
                          {sh && <div className="text-[9px] font-semibold flex items-center gap-1 mt-0.5" style={{ color: TOKENS.goldDark }}>
                            <Truck size={9} /> {sh.name}
                          </div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold truncate" style={{ color: TOKENS.ink }}>{c?.name || "—"}</div>
                          <div className="text-[10px] font-semibold" style={{ color: TOKENS.muted }}>
                            {fmtDate(o.orderDate)} · W{getISOWeek(o.orderDate) || "—"}
                            {effectiveShipDate && ` · Plan. Sevk: W${getISOWeek(effectiveShipDate)}`}
                            {effectiveActualDate && <span style={{ color: TOKENS.forest }}> · Fiili Sevk: W{getISOWeek(effectiveActualDate)}</span>}
                          </div>
                        </div>
                        <div className="w-24 text-right">
                          <div className="text-xs font-bold tabular-nums">{fmtMoney(sh ? shipTotal : t, o.currency)}</div>
                          {sh ? (
                            <div className="text-[10px] font-semibold" style={{ color: TOKENS.muted }}>{shipItems.length} kalem</div>
                          ) : (
                            <>
                              {paid > 0 && <div className="text-[10px] font-semibold tabular-nums" style={{ color: TOKENS.forest }}>✓ {fmtMoney(paid, o.currency)}</div>}
                              {remaining > 0.01 && paid > 0 && <div className="text-[10px] font-semibold tabular-nums" style={{ color: TOKENS.copper }}>{fmtMoney(remaining, o.currency)}</div>}
                            </>
                          )}
                        </div>
                        <div className="w-20 text-right">
                          <Badge color={st?.color}>{st?.label}</Badge>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => onView(o)} className="p-1 rounded transition" style={{ color: TOKENS.muted }} onMouseEnter={(e) => { e.currentTarget.style.background = TOKENS.cream; e.currentTarget.style.color = TOKENS.navy; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TOKENS.muted; }} title="Detayı gör"><Eye size={13} /></button>
                          {onEdit && <button onClick={() => onEdit(o)} className="p-1 rounded transition" style={{ color: TOKENS.muted }} onMouseEnter={(e) => { e.currentTarget.style.background = TOKENS.cream; e.currentTarget.style.color = TOKENS.navy; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TOKENS.muted; }} title="Düzenle"><Pencil size={13} /></button>}
                          {onDelete && <button onClick={() => onDelete(o.id)} className="p-1 rounded transition" style={{ color: TOKENS.muted }} onMouseEnter={(e) => { e.currentTarget.style.background = TOKENS.oxblood + "15"; e.currentTarget.style.color = TOKENS.oxblood; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TOKENS.muted; }} title="Sil"><Trash2 size={13} /></button>}
                        </div>
                      </div>

                      {/* KALEMLER */}
                      {isOpen && (
                        <div style={{ background: TOKENS.cream + "60", borderTop: `1px solid ${TOKENS.border}` }}>
                          <table className="w-full text-xs">
                            <thead>
                              <tr style={{ background: TOKENS.cream }}>
                                <th className="px-3 py-1.5 text-left text-[10px] uppercase tracking-wider font-bold" style={{ color: TOKENS.muted }}>Ürün</th>
                                <th className="px-3 py-1.5 text-left text-[10px] uppercase tracking-wider font-bold" style={{ color: TOKENS.muted }}>İsim</th>
                                <th className="px-3 py-1.5 text-right text-[10px] uppercase tracking-wider font-bold" style={{ color: TOKENS.muted }}>Adet</th>
                                <th className="px-3 py-1.5 text-right text-[10px] uppercase tracking-wider font-bold" style={{ color: TOKENS.muted }}>Birim Fiyat</th>
                                <th className="px-3 py-1.5 text-right text-[10px] uppercase tracking-wider font-bold" style={{ color: TOKENS.muted }}>İsk %</th>
                                <th className="px-3 py-1.5 text-right text-[10px] uppercase tracking-wider font-bold" style={{ color: TOKENS.muted }}>Toplam</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(() => { const displayItems = sh ? (o.items || []).filter((it) => (it.shipmentNo || 1) === sh.no) : (o.items || []); return displayItems.length === 0 ? (
                                <tr><td colSpan="6" className="px-3 py-3 text-center text-[11px] italic" style={{ color: TOKENS.muted }}>{sh ? "Bu sevkiyatta kalem yok" : "Bu siparişte kalem yok"}</td></tr>
                              ) : displayItems.map((it) => {
                                const baseT = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
                                const lineDisc = Number(it.discount) || 0;
                                const lineT = baseT * (1 - lineDisc / 100);
                                return (
                                  <tr key={it.id} style={{ borderTop: `1px solid ${TOKENS.border}30` }}>
                                    <td className="px-3 py-1.5 font-mono font-bold text-[11px]" style={{ color: TOKENS.navy }}>{it.productCode}</td>
                                    <td className="px-3 py-1.5 text-[11px]"><div className="font-bold">{it.nameTr || "—"}</div>{it.nameEn && <div className="text-[10px] italic" style={{ color: TOKENS.muted }}>{it.nameEn}</div>}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-[11px]">{fmtNum(it.quantity)} {it.unit}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums text-[11px]">{fmtMoney(it.unitPrice, o.currency)}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums text-[11px]" style={{ color: lineDisc > 0 ? TOKENS.copper : TOKENS.muted }}>{lineDisc > 0 ? `%${lineDisc}` : "—"}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums font-bold text-[11px]">{fmtMoney(lineT, o.currency)}</td>
                                  </tr>
                                );
                              }); })()}
                              {/* Totals - sadece tek sevkiyat / sevkiyatsız siparişlerde göster */}
                              {!sh && (totals.discount > 0 || totals.vatRate > 0 || (o.additionalCosts || []).length > 0) && (
                                <tr style={{ borderTop: `1px solid ${TOKENS.border}` }}>
                                  <td colSpan="5" className="px-3 py-1 text-right text-[10px] font-semibold" style={{ color: TOKENS.muted }}>Ara Toplam</td>
                                  <td className="px-3 py-1 text-right tabular-nums font-bold text-[10px]">{fmtMoney(totals.subtotal, o.currency)}</td>
                                </tr>
                              )}
                              {!sh && totals.discount > 0 && (
                                <tr><td colSpan="5" className="px-3 py-1 text-right text-[10px] font-semibold" style={{ color: TOKENS.copper }}>İskonto</td><td className="px-3 py-1 text-right tabular-nums font-bold text-[10px]" style={{ color: TOKENS.copper }}>− {fmtMoney(totals.discount, o.currency)}</td></tr>
                              )}
                              {!sh && (o.additionalCosts || []).map((c, ix) => (
                                <tr key={c.id || ix}><td colSpan="5" className="px-3 py-1 text-right text-[10px] font-semibold" style={{ color: TOKENS.copper }}>+ {c.description || "İlave Maliyet"}</td><td className="px-3 py-1 text-right tabular-nums font-bold text-[10px]" style={{ color: TOKENS.copper }}>+ {fmtMoney(c.amount, o.currency)}</td></tr>
                              ))}
                              {!sh && totals.vatRate > 0 && (
                                <tr><td colSpan="5" className="px-3 py-1 text-right text-[10px] font-semibold" style={{ color: TOKENS.muted }}>KDV (%{totals.vatRate})</td><td className="px-3 py-1 text-right tabular-nums font-bold text-[10px]">+ {fmtMoney(totals.vatAmount, o.currency)}</td></tr>
                              )}
                              {!sh && (
                                <tr style={{ background: TOKENS.gold + "20", borderTop: `2px solid ${TOKENS.gold}` }}>
                                  <td colSpan="5" className="px-3 py-1.5 text-right font-bold text-[11px] uppercase tracking-wider" style={{ color: TOKENS.ink }}>Genel Toplam</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums font-bold text-xs" style={{ color: TOKENS.ink }}>{fmtMoney(totals.total, o.currency)}</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


function OrderEditModal({ open, onClose, editing, setEditing, customers, products, onSave }) {
  if (!editing) return null;

  // Müşteri seçildiğinde varsayılanları getir
  const onCustomerChange = (id) => {
    const c = customers.find((x) => x.id === id);
    setEditing({
      ...editing,
      customerId: id,
      currency: editing.currency || c?.defaultCurrency || "USD",
      incoterms: editing.incoterms || c?.preferredIncoterm || "FOB",
    });
  };

  // KALEM yönetimi
  const addItem = () => {
    setEditing({
      ...editing,
      items: [...(editing.items || []), { id: uid(), productId: "", productCode: "", manufacturingCode: "", nameTr: "", nameEn: "", unit: "adet", quantity: 1, unitPrice: 0, discount: 0 }],
    });
  };

  const removeItem = (idx) => {
    const items = [...editing.items];
    items.splice(idx, 1);
    setEditing({ ...editing, items });
  };

  const updateItem = (idx, patch) => {
    const items = [...editing.items];
    items[idx] = { ...items[idx], ...patch };
    setEditing({ ...editing, items });
  };

  // Ürün seçilince otomatik doldur
  const pickProduct = (idx, productId) => {
    const p = products.find((x) => x.id === productId);
    if (!p) { updateItem(idx, { productId: "" }); return; }
    updateItem(idx, {
      productId: p.id, productCode: p.productCode, manufacturingCode: p.manufacturingCode,
      nameTr: p.nameTr, nameEn: p.nameEn, unit: p.unit || "adet",
      unitPrice: p.defaultPrice,
    });
  };

  const itemsTotal = calcOrderTotals(editing).total;

  // ÖDEME PLANI yönetimi
  const addPlanItem = (preset) => {
    const c = customers.find((x) => x.id === editing.customerId);
    const item = {
      id: uid(),
      type: preset?.type || "prepayment",
      percentage: preset?.percentage || 0,
      amount: preset?.amount || 0,
      method: "bank_transfer",
      dueDate: preset?.dueDate || "",
      notes: "",
    };
    setEditing({ ...editing, paymentPlan: [...(editing.paymentPlan || []), item] });
  };

  const removePlanItem = (idx) => {
    const p = [...editing.paymentPlan];
    p.splice(idx, 1);
    setEditing({ ...editing, paymentPlan: p });
  };

  const updatePlanItem = (idx, patch) => {
    const p = [...editing.paymentPlan];
    p[idx] = { ...p[idx], ...patch };
    const totals = calcOrderTotals(editing);
    // VAT kalemleri yüzdesi vatAmount üzerinden, diğerleri afterDiscount üzerinden hesaplanır
    const baseForCalc = p[idx].type === "vat" ? totals.vatAmount : totals.afterDiscount;
    // Yüzde değişirse tutarı otomatik hesapla
    if (patch.percentage !== undefined && baseForCalc > 0) {
      p[idx].amount = +(baseForCalc * (Number(patch.percentage) || 0) / 100).toFixed(2);
    }
    // Tutar değişirse yüzdeyi otomatik hesapla
    if (patch.amount !== undefined && baseForCalc > 0) {
      p[idx].percentage = +((Number(patch.amount) || 0) / baseForCalc * 100).toFixed(2);
    }
    setEditing({ ...editing, paymentPlan: p });
  };

  // Hızlı şablonlar — sevk tarihinden itibaren vade hesaplanır
  // ÖNEMLİ: Plan kalemleri KDV'siz mal bedeli (afterDiscount) üzerinden hesaplanır.
  // KDV varsa otomatik olarak ayrı bir "KDV" plan kalemi eklenir (genelde sevk tarihinde ödenir).
  const applyPreset = (key) => {
    const totals = calcOrderTotals(editing);
    const baseAmount = totals.afterDiscount; // KDV'siz mal bedeli (iskonto sonrası)
    const vatAmount = totals.vatAmount;
    const today = todayISO();
    const customer = customers.find((c) => c.id === editing.customerId);
    const vade = Number(customer?.defaultPaymentTerms) || 30;
    const method = customer?.defaultPaymentMethod || "bank_transfer";
    const shipDate = editing.shipmentDate || addDays(today, 30);
    let plan = [];

    if (key === "customer-default") {
      const pre = Number(customer?.defaultPrepaymentPct) || 0;
      const preShip = Number(customer?.defaultPreShipmentPct) || 0;
      const def = Number(customer?.defaultDeferredPct) || 0;
      if (pre > 0) plan.push({ id: uid(), type: "prepayment",  percentage: pre, amount: +(baseAmount * pre / 100).toFixed(2), method, dueDate: today, notes: "Sipariş onayı" });
      if (preShip > 0) plan.push({ id: uid(), type: "preShipment", percentage: preShip, amount: +(baseAmount * preShip / 100).toFixed(2), method, dueDate: shipDate, notes: "Sevk öncesi" });
      if (def > 0) plan.push({ id: uid(), type: "deferred", percentage: def, amount: +(baseAmount * def / 100).toFixed(2), method, dueDate: addDays(shipDate, vade), notes: `Sevkten ${vade} gün sonra` });
    } else if (key === "30-40-30") {
      plan.push({ id: uid(), type: "prepayment",  percentage: 30, amount: +(baseAmount * 0.3).toFixed(2), method, dueDate: today, notes: "Sipariş onayı" });
      plan.push({ id: uid(), type: "preShipment", percentage: 40, amount: +(baseAmount * 0.4).toFixed(2), method, dueDate: shipDate, notes: "Sevkiyat öncesi" });
      plan.push({ id: uid(), type: "deferred",    percentage: 30, amount: +(baseAmount * 0.3).toFixed(2), method, dueDate: addDays(shipDate, vade), notes: `Sevkten ${vade} gün sonra` });
    } else if (key === "50-50") {
      plan.push({ id: uid(), type: "prepayment",  percentage: 50, amount: +(baseAmount * 0.5).toFixed(2), method, dueDate: today, notes: "Ön ödeme" });
      plan.push({ id: uid(), type: "preShipment", percentage: 50, amount: +(baseAmount * 0.5).toFixed(2), method, dueDate: shipDate, notes: "Sevkiyat öncesi bakiye" });
    } else if (key === "100-cash") {
      plan.push({ id: uid(), type: "prepayment", percentage: 100, amount: baseAmount, method: "cash", dueDate: today, notes: "Peşin" });
    } else if (key === "100-lc") {
      plan.push({ id: uid(), type: "preShipment", percentage: 100, amount: baseAmount, method: "letter_of_credit", dueDate: shipDate, notes: "L/C ile" });
    } else if (key === "100-deferred") {
      plan.push({ id: uid(), type: "deferred", percentage: 100, amount: baseAmount, method, dueDate: addDays(shipDate, vade), notes: `Sevkten ${vade} gün sonra` });
    }

    // KDV varsa otomatik kalem ekle — genelde sevkiyat sırasında ödenir
    if (vatAmount > 0) {
      plan.push({
        id: uid(),
        type: "vat",
        percentage: 100, // KDV kalemleri için %100 = vatAmount'un tamamı
        amount: +vatAmount.toFixed(2),
        method,
        dueDate: shipDate,
        notes: "KDV tutarı — mal bedelinden ayrı"
      });
    }

    setEditing({ ...editing, paymentPlan: plan });
  };

  const planTotalCalc = (editing.paymentPlan || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  // Mal bedeli kalemleri (KDV hariç) ve KDV kalemleri ayrı hesap
  const planNonVat = (editing.paymentPlan || []).filter((p) => p.type !== "vat").reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const planVat = (editing.paymentPlan || []).filter((p) => p.type === "vat").reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const orderTotalsForPlan = calcOrderTotals(editing);
  const planDiff = +(itemsTotal - planTotalCalc).toFixed(2);
  const planMatch = Math.abs(planDiff) < 0.01;
  // Mal bedeli için ayrı kontrol
  const malDiff = +(orderTotalsForPlan.afterDiscount - planNonVat).toFixed(2);
  const malMatch = Math.abs(malDiff) < 0.01;
  const vatDiff = +(orderTotalsForPlan.vatAmount - planVat).toFixed(2);
  const vatMatch = Math.abs(vatDiff) < 0.01;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing.id ? `Sipariş Düzenle · ${editing.orderNumber}` : "Yeni Sipariş"}
      subtitle="Üst bilgi → Kalemler → Ödeme planı sırasıyla doldur"
      size="2xl"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>İptal</Btn>
          <Btn variant="primary" icon={Save} onClick={onSave}>Kaydet</Btn>
        </>
      }
    >
      <div className="space-y-6">
        {/* ÜST BİLGİ */}
        <div>
          <SectionTitle>Sipariş Bilgileri</SectionTitle>
          <div className="grid grid-cols-4 gap-3">
            <div><Label required>Sipariş No</Label><Input value={editing.orderNumber} onChange={(e) => setEditing({ ...editing, orderNumber: e.target.value })} className="font-mono" /></div>
            <div className="col-span-2"><Label required>Müşteri</Label>
              <CustomerPicker
                customers={customers}
                value={editing.customerId}
                onChange={onCustomerChange}
              />
            </div>
            <div><Label>Durum</Label>
              <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                {ORDER_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </Select>
            </div>
            <div><Label required>Sipariş Tarihi</Label><Input type="date" value={editing.orderDate} onChange={(e) => setEditing({ ...editing, orderDate: e.target.value })} /></div>
            <div><Label hint="planlanan">Sevk Tarihi</Label><Input type="date" value={editing.shipmentDate} onChange={(e) => setEditing({ ...editing, shipmentDate: e.target.value })} /></div>
            <div><Label hint="gerçekleşen">Fiili Sevk</Label><Input type="date" value={editing.actualShipmentDate} onChange={(e) => setEditing({ ...editing, actualShipmentDate: e.target.value })} /></div>
            {editing.lockedRateAtShipment && editing.currency !== "USD" && (
              <div className="col-span-3 mt-1 p-2 rounded text-[11px] flex items-center gap-2" style={{ background: TOKENS.gold + "12", color: TOKENS.ink, border: `1px solid ${TOKENS.gold}40` }}>
                <Lock size={11} style={{ color: TOKENS.copper }} />
                <span><strong>Sevk Kuru Kilitli:</strong> 1 {editing.currency} = {editing.lockedRateAtShipment.toFixed(4)} USD ({editing.lockedAt && fmtDate(editing.lockedAt)}). Bu siparişin USD karşılığı bu kura göre hesaplanır.</span>
                <button type="button" onClick={() => {
                  if (!confirm("Sevk kurunu mevcut güncel kurla yenilemek ister misin? Bu siparişin USD değeri değişecek.")) return;
                  setEditing({ ...editing, lockedRateAtShipment: undefined, lockedAt: undefined });
                  showToast("Kur kilidi kaldırıldı — sonraki kayıtta yeni kur kilitlenir", "info");
                }} className="ml-auto text-[10px] underline font-bold" style={{ color: TOKENS.copper, background: "transparent", border: "none", cursor: "pointer" }}>
                  Kuru Yenile
                </button>
              </div>
            )}
            <div><Label>Para Birimi</Label>
              <Select value={editing.currency} onChange={(e) => setEditing({ ...editing, currency: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </div>
            <div><Label>Incoterms</Label>
              <Select value={editing.incoterms} onChange={(e) => setEditing({ ...editing, incoterms: e.target.value })}>
                {INCOTERMS.map((i) => <option key={i.key} value={i.key}>{i.key} — {i.label.split("—")[1]}</option>)}
              </Select>
            </div>
            <div><Label>Sevk Yöntemi</Label>
              <Select value={editing.shippingMethod} onChange={(e) => setEditing({ ...editing, shippingMethod: e.target.value })}>
                {SHIPPING_METHODS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </Select>
            </div>
            <div><Label hint="opsiyonel">Yükleme Limanı</Label><Input value={editing.portOfLoading} onChange={(e) => setEditing({ ...editing, portOfLoading: e.target.value })} placeholder="İstanbul / Mersin..." /></div>
            <div><Label hint="opsiyonel">Boşaltma Limanı</Label><Input value={editing.portOfDischarge} onChange={(e) => setEditing({ ...editing, portOfDischarge: e.target.value })} placeholder="Hamburg..." /></div>
            <div><Label>Fatura No</Label><Input value={editing.invoiceNumber} onChange={(e) => setEditing({ ...editing, invoiceNumber: e.target.value })} className="font-mono" /></div>
            <div><Label hint="B/L">Konşimento No</Label><Input value={editing.billOfLading} onChange={(e) => setEditing({ ...editing, billOfLading: e.target.value })} className="font-mono" /></div>
          </div>

          {/* KDV ve Sipariş İskontosu */}
          <div className="mt-4 pt-3 grid grid-cols-4 gap-3" style={{ borderTop: `1px dashed ${TOKENS.border}` }}>
            <div>
              <Label hint="örn 18 / 20 — 0=KDV yok">KDV Oranı (%)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={editing.vatRate ?? 0}
                onChange={(e) => setEditing({ ...editing, vatRate: parseNumber(e.target.value) })}
                placeholder="0"
              />
            </div>
            <div>
              <Label hint="genel toplama uygulanır">Sipariş İskonto Tipi</Label>
              <Select value={editing.discountType || "none"} onChange={(e) => setEditing({ ...editing, discountType: e.target.value })}>
                <option value="none">Yok</option>
                <option value="percentage">Yüzde (%)</option>
                <option value="amount">Tutar ({editing.currency})</option>
              </Select>
            </div>
            {editing.discountType && editing.discountType !== "none" && (
              <div>
                <Label hint={editing.discountType === "percentage" ? "0-100" : `${editing.currency}`}>İskonto Değeri</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editing.discountValue ?? 0}
                  onChange={(e) => setEditing({ ...editing, discountValue: parseNumber(e.target.value) })}
                />
              </div>
            )}
            <div className="col-span-2 text-[11px] flex items-end pb-1.5" style={{ color: TOKENS.muted }}>
              💡 Kalem bazlı iskonto için kalemler tablosundaki <strong>"İsk %"</strong> sütununu kullan
            </div>
          </div>
        </div>

        {/* KALEMLER */}
        <OrderItemsSection
          editing={editing}
          setEditing={setEditing}
          products={products}
          itemsTotal={itemsTotal}
          addItem={addItem}
          removeItem={removeItem}
          updateItem={updateItem}
          pickProduct={pickProduct}
        />

        {/* SEVKİYATLAR — kalemleri sevkiyatlara böl */}
        <ShipmentsSection
          editing={editing}
          setEditing={setEditing}
        />

        {/* İLAVE MALİYETLER (palet, paket, navlun vb) */}
        <div>
          <div className="flex items-center justify-between mb-3 pb-2" style={{ borderBottom: `1px solid ${TOKENS.border}` }}>
            <div className="text-[11px] uppercase tracking-widest font-bold" style={{ color: TOKENS.copper }}>
              İlave Maliyetler
              <span className="ml-2 normal-case font-normal text-[10px]" style={{ color: TOKENS.muted }}>
                · palet, paketleme, navlun vb. KDV'ye dahil edilir
              </span>
            </div>
            <Btn variant="secondary" size="xs" icon={Plus} onClick={() => {
              const cur = editing.additionalCosts || [];
              setEditing({ ...editing, additionalCosts: [...cur, { id: uid(), description: "", amount: 0 }] });
            }}>Maliyet Ekle</Btn>
          </div>

          {(editing.additionalCosts || []).length === 0 ? (
            <div className="text-center py-4 text-xs rounded-md" style={{ background: TOKENS.cream, color: TOKENS.muted, border: `1px dashed ${TOKENS.border}` }}>
              Henüz ek maliyet yok. "Maliyet Ekle" ile ekle (örn: Palet, Paketleme, Navlun, Sigorta).
            </div>
          ) : (
            <div className="rounded-md overflow-hidden" style={{ border: `1px solid ${TOKENS.border}` }}>
              <table className="w-full text-xs">
                <thead style={{ background: TOKENS.cream }}>
                  <tr>
                    <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider font-bold">Açıklama</th>
                    <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider font-bold w-40">Tutar ({editing.currency})</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {(editing.additionalCosts || []).map((c, idx) => (
                    <tr key={c.id || idx} style={{ borderTop: `1px solid ${TOKENS.border}` }}>
                      <td className="px-3 py-1.5">
                        <Input value={c.description}
                          onChange={(e) => {
                            const arr = [...(editing.additionalCosts || [])];
                            arr[idx] = { ...arr[idx], description: e.target.value };
                            setEditing({ ...editing, additionalCosts: arr });
                          }}
                          placeholder="Örn: Palet, Paketleme, Navlun..." />
                      </td>
                      <td className="px-3 py-1.5">
                        <Input type="number" step="0.01" value={c.amount ?? 0}
                          onChange={(e) => {
                            const arr = [...(editing.additionalCosts || [])];
                            arr[idx] = { ...arr[idx], amount: parseNumber(e.target.value) };
                            setEditing({ ...editing, additionalCosts: arr });
                          }}
                          className="text-right tabular-nums" />
                      </td>
                      <td className="px-2">
                        <button onClick={() => {
                          const arr = (editing.additionalCosts || []).filter((_, i) => i !== idx);
                          setEditing({ ...editing, additionalCosts: arr });
                        }} className="p-1 rounded transition" style={{ color: TOKENS.muted, background: "transparent", border: "none" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = TOKENS.oxblood + "15"; e.currentTarget.style.color = TOKENS.oxblood; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TOKENS.muted; }}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: TOKENS.copper + "10", borderTop: `1px solid ${TOKENS.copper}40` }}>
                    <td className="px-3 py-2 text-right text-[11px] font-bold" style={{ color: TOKENS.ink }}>İlave Maliyet Toplamı</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold" style={{ color: TOKENS.copper }}>
                      {fmtMoney((editing.additionalCosts || []).reduce((s, c) => s + (Number(c.amount) || 0), 0), editing.currency)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* ÖDEME PLANI */}
        <div>
          <div className="flex items-center justify-between mb-3 pb-2" style={{ borderBottom: `1px solid ${TOKENS.border}` }}>
            <div className="text-[11px] uppercase tracking-widest font-bold" style={{ color: TOKENS.gold }}>
              Ödeme Planı · Toplam: <span style={{ color: planMatch ? TOKENS.forest : TOKENS.oxblood }}>{fmtMoney(planTotalCalc, editing.currency)}</span>
              {orderTotalsForPlan.vatAmount > 0 && (
                <span className="ml-3 normal-case font-normal text-[10px]" style={{ color: TOKENS.muted }}>
                  Mal: <strong style={{ color: malMatch ? TOKENS.forest : TOKENS.oxblood }}>{fmtMoney(planNonVat, editing.currency)}</strong> / {fmtMoney(orderTotalsForPlan.afterDiscount, editing.currency)}
                  · KDV: <strong style={{ color: vatMatch ? TOKENS.forest : TOKENS.oxblood }}>{fmtMoney(planVat, editing.currency)}</strong> / {fmtMoney(orderTotalsForPlan.vatAmount, editing.currency)}
                </span>
              )}
            </div>
            <Btn variant="secondary" size="xs" icon={Plus} onClick={() => addPlanItem()}>Plan Kalemi Ekle</Btn>
          </div>

          {/* Hızlı şablonlar — en yaygın senaryolar */}
          <div className="rounded-md p-3 mb-3 flex items-center gap-2 flex-wrap" style={{ background: TOKENS.gold + "10", border: `1px solid ${TOKENS.gold}30` }}>
            <span className="text-[11px] font-semibold" style={{ color: TOKENS.goldDark }}>Hızlı Şablon:</span>
            {(() => {
              const customer = customers.find((c) => c.id === editing.customerId);
              const hasDefault = customer && (
                (Number(customer.defaultPrepaymentPct) || 0) +
                (Number(customer.defaultPreShipmentPct) || 0) +
                (Number(customer.defaultDeferredPct) || 0) > 0
              );
              return hasDefault ? (
                <button onClick={() => applyPreset("customer-default")} className="px-2 py-1 text-[11px] rounded-md hover:bg-white transition font-semibold" style={{ border: `1px solid ${TOKENS.gold}`, background: TOKENS.gold + "20", color: TOKENS.ink }}>
                  ⭐ Müşteri Varsayılanı (%{customer.defaultPrepaymentPct || 0} / %{customer.defaultPreShipmentPct || 0} / %{customer.defaultDeferredPct || 0})
                </button>
              ) : null;
            })()}
            <button onClick={() => applyPreset("30-40-30")} className="px-2 py-1 text-[11px] rounded-md hover:bg-white transition" style={{ border: `1px solid ${TOKENS.gold}50`, color: TOKENS.ink }}>%30 ön + %40 sevk öncesi + %30 vadeli</button>
            <button onClick={() => applyPreset("50-50")} className="px-2 py-1 text-[11px] rounded-md hover:bg-white transition" style={{ border: `1px solid ${TOKENS.gold}50`, color: TOKENS.ink }}>%50 ön + %50 sevk öncesi</button>
            <button onClick={() => applyPreset("100-cash")} className="px-2 py-1 text-[11px] rounded-md hover:bg-white transition" style={{ border: `1px solid ${TOKENS.gold}50`, color: TOKENS.ink }}>%100 peşin</button>
            <button onClick={() => applyPreset("100-lc")} className="px-2 py-1 text-[11px] rounded-md hover:bg-white transition" style={{ border: `1px solid ${TOKENS.gold}50`, color: TOKENS.ink }}>%100 akreditif (L/C)</button>
            <button onClick={() => applyPreset("100-deferred")} className="px-2 py-1 text-[11px] rounded-md hover:bg-white transition" style={{ border: `1px solid ${TOKENS.gold}50`, color: TOKENS.ink }}>%100 vadeli</button>
          </div>

          {(editing.paymentPlan || []).length === 0 ? (
            <div className="text-center py-8 text-xs rounded-md" style={{ color: TOKENS.muted, background: TOKENS.cream, border: `1px dashed ${TOKENS.border}` }}>
              Ödeme planı boş. Yukarıdan hızlı şablon seç veya manuel "Plan Kalemi Ekle" ile başla.
              <br /><span className="text-[10px] mt-1 inline-block">Plan kayıt edilince Ödemeler modülünde her kalem ayrı satır olarak çıkar; tahsilat alındığında oradan işaretlersin.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {editing.paymentPlan.map((p, idx) => {
                const tp = PAYMENT_PLAN_TYPES.find((t) => t.key === p.type);
                return (
                  <div key={p.id} className="rounded-md p-3" style={{ background: "white", border: `1px solid ${TOKENS.border}` }}>
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-1" style={{ background: TOKENS[tp?.color] + "20", color: TOKENS[tp?.color] }}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 grid grid-cols-12 gap-2">
                        <div className="col-span-2"><Label>Tip</Label>
                          <Select value={p.type} onChange={(e) => updatePlanItem(idx, { type: e.target.value })}>
                            {PAYMENT_PLAN_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                          </Select>
                        </div>
                        <div className="col-span-2"><Label>%</Label>
                          <Input type="number" step="0.1" value={p.percentage} onChange={(e) => updatePlanItem(idx, { percentage: e.target.value })} />
                        </div>
                        <div className="col-span-2"><Label>Tutar ({editing.currency})</Label>
                          <Input type="number" step="0.01" value={p.amount} onChange={(e) => updatePlanItem(idx, { amount: e.target.value })} />
                        </div>
                        <div className="col-span-3"><Label>Yöntem</Label>
                          <Select value={p.method} onChange={(e) => updatePlanItem(idx, { method: e.target.value })}>
                            {PAYMENT_METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                          </Select>
                        </div>
                        <div className="col-span-3"><Label hint="vade">Tarih</Label><Input type="date" value={p.dueDate} onChange={(e) => updatePlanItem(idx, { dueDate: e.target.value })} /></div>
                        <div className="col-span-12"><Label>Açıklama</Label><Input value={p.notes} onChange={(e) => updatePlanItem(idx, { notes: e.target.value })} placeholder="Sipariş onayında, sevk evrakı sonrası, ..." /></div>
                      </div>
                      <button onClick={() => removePlanItem(idx)} className="p-1.5 rounded mt-5 transition" style={{ color: TOKENS.muted }} onMouseEnter={(e) => { e.currentTarget.style.background = TOKENS.oxblood + "15"; e.currentTarget.style.color = TOKENS.oxblood; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TOKENS.muted; }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!planMatch && itemsTotal > 0 && (editing.paymentPlan || []).length > 0 && (
            <div className="mt-3 rounded-md p-2 text-xs flex items-center gap-2" style={{ background: TOKENS.terracotta + "15", color: TOKENS.terracotta, border: `1px solid ${TOKENS.terracotta}30` }}>
              <AlertTriangle size={14} />
              Ödeme planı toplamı sipariş toplamıyla {planDiff > 0 ? "eksik" : "fazla"}. Yine de kaydedebilirsin.
            </div>
          )}
        </div>

        {/* NOTLAR */}
        <div>
          <Label>Notlar</Label>
          <Textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} placeholder="Sipariş ile ilgili özel açıklamalar..." />
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// SİPARİŞ KALEMLERİ — hızlı arama, bulk yapıştırma, tablo düzenleme
// ============================================================================

// Müşteri seçimi — yazarak arama, seçilince kapanır
function CustomerPicker({ customers, value, onChange }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = customers.find((c) => c.id === value);

  // Arama sonuçları
  const results = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return customers.slice(0, 8);
    return customers.filter((c) =>
      [c.code, c.name, c.country, c.contactPerson, c.email].filter(Boolean)
        .some((v) => v.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [search, customers]);

  // Dış tıklamada kapansın
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const selectCustomer = (c) => {
    onChange(c.id);
    setOpen(false);
    setSearch("");
  };

  const highlight = (text, q) => {
    if (!q || !text) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <strong style={{ color: TOKENS.copper, background: TOKENS.gold + "30" }}>
          {text.slice(idx, idx + q.length)}
        </strong>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 text-sm bg-white rounded-md text-left flex items-center justify-between gap-2 transition"
        style={{ border: `1px solid ${open ? TOKENS.navy : TOKENS.border}`, fontFamily: FONT_BODY, fontWeight: 500 }}
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: TOKENS.navy, background: "#E6F1FB" }}>{selected.code}</span>
            <span className="font-bold truncate" style={{ color: TOKENS.ink }}>{selected.name}</span>
            {selected.country && <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: TOKENS.muted }}>· {selected.country}</span>}
          </span>
        ) : (
          <span style={{ color: TOKENS.muted }}>— müşteri seç —</span>
        )}
        <ChevronDown size={14} style={{ color: TOKENS.muted, transform: open ? "rotate(180deg)" : "" }} />
      </button>

      {/* Açılır panel */}
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-md overflow-hidden shadow-xl"
          style={{ background: "white", border: `1px solid ${TOKENS.border}` }}
        >
          {/* Arama */}
          <div className="p-2" style={{ borderBottom: `1px solid ${TOKENS.border}`, background: TOKENS.cream + "60" }}>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: TOKENS.muted }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                placeholder="Kod, isim, ülke, yetkili..."
                className="w-full pl-7 pr-2 py-1.5 text-xs rounded font-semibold focus:outline-none"
                style={{ border: `1px solid ${TOKENS.border}`, background: "white", fontFamily: FONT_BODY }}
              />
            </div>
          </div>

          {/* Sonuçlar */}
          <div style={{ maxHeight: "260px", overflowY: "auto" }}>
            {results.length === 0 ? (
              <div className="p-3 text-center text-xs" style={{ color: TOKENS.muted }}>Eşleşen müşteri yok</div>
            ) : (
              results.map((c, i) => (
                <div
                  key={c.id}
                  onClick={() => selectCustomer(c)}
                  className="px-3 py-2 cursor-pointer transition"
                  style={{ borderBottom: i < results.length - 1 ? `1px solid ${TOKENS.border}` : "none", background: c.id === value ? TOKENS.gold + "15" : "white" }}
                  onMouseEnter={(e) => { if (c.id !== value) e.currentTarget.style.background = TOKENS.cream; }}
                  onMouseLeave={(e) => { if (c.id !== value) e.currentTarget.style.background = "white"; }}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: TOKENS.navy, background: "#E6F1FB" }}>
                      {highlight(c.code || "—", search)}
                    </span>
                    <span className="text-sm font-bold" style={{ color: TOKENS.ink }}>{highlight(c.name, search)}</span>
                  </div>
                  <div className="text-[10px] font-semibold" style={{ color: TOKENS.muted }}>
                    📍 {highlight(c.country || "—", search)}
                    {c.contactPerson && <> · {highlight(c.contactPerson, search)}</>}
                    {c.defaultCurrency && <> · {c.defaultCurrency}</>}
                    {c.defaultPaymentTerms ? <> · Vade: {c.defaultPaymentTerms} gün</> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SEVKİYATLAR BÖLÜMÜ — sipariş kalemleri birden fazla sevkiyata bölünebilir
// Geriye uyumluluk: shipments[] yoksa tek sevkiyat olarak çalışır
// Item.shipmentNo (1, 2, 3...) hangi sevkiyata ait olduğunu belirtir
// ============================================================================

function ShipmentsSection({ editing, setEditing }) {
  const shipments = editing.shipments || [];
  const items = editing.items || [];

  // Hiç sevkiyat yoksa otomatik #1 oluştur (sipariş seviyesi shipmentDate/actualShipmentDate'i kullanarak)
  // Bu UI'da görünmez, sadece "Sevkiyat Ekle" butonuyla birlikte aktive olur

  const addShipment = () => {
    const nextNo = (shipments.length === 0 ? 2 : Math.max(...shipments.map((s) => s.no)) + 1);
    // İlk eklenirken: order'ın eski tek sevk tarihlerini #1 sevkiyata aktar, sonra #2'yi ekle
    if (shipments.length === 0) {
      const firstShipment = {
        id: uid(), no: 1, name: "1. Sevkiyat",
        shipmentDate: editing.shipmentDate || "",
        actualShipmentDate: editing.actualShipmentDate || "",
        notes: "",
      };
      const newShipment = {
        id: uid(), no: 2, name: "2. Sevkiyat",
        shipmentDate: "", actualShipmentDate: "", notes: "",
      };
      // Mevcut tüm kalemleri 1. sevkiyata ata
      const updatedItems = items.map((it) => ({ ...it, shipmentNo: it.shipmentNo || 1 }));
      setEditing({ ...editing, shipments: [firstShipment, newShipment], items: updatedItems });
    } else {
      setEditing({ ...editing, shipments: [...shipments, { id: uid(), no: nextNo, name: `${nextNo}. Sevkiyat`, shipmentDate: "", actualShipmentDate: "", notes: "" }] });
    }
  };

  const updateShipment = (idx, patch) => {
    const arr = [...shipments];
    arr[idx] = { ...arr[idx], ...patch };
    // Eğer #1 sevkiyatın tarihleri değiştiyse order seviyesindeki shipmentDate/actualShipmentDate'i de senkronize et
    const update = { ...editing, shipments: arr };
    if (arr[idx].no === 1) {
      if (patch.shipmentDate !== undefined) update.shipmentDate = patch.shipmentDate;
      if (patch.actualShipmentDate !== undefined) update.actualShipmentDate = patch.actualShipmentDate;
    }
    setEditing(update);
  };

  const removeShipment = (idx) => {
    if (!confirm(`${shipments[idx].name} silinecek. Bu sevkiyattaki kalemler 1. sevkiyata taşınacak. Onaylıyor musun?`)) return;
    const removedNo = shipments[idx].no;
    const arr = shipments.filter((_, i) => i !== idx);
    // Bu sevkiyattaki kalemleri 1. sevkiyata aktar
    const updatedItems = items.map((it) => it.shipmentNo === removedNo ? { ...it, shipmentNo: 1 } : it);
    if (arr.length === 1) {
      // Tek sevkiyata düştü → eski sisteme geri (shipments yok say)
      setEditing({ ...editing, shipments: [], items: updatedItems.map((it) => ({ ...it, shipmentNo: undefined })), shipmentDate: arr[0].shipmentDate, actualShipmentDate: arr[0].actualShipmentDate });
    } else {
      setEditing({ ...editing, shipments: arr, items: updatedItems });
    }
  };

  const updateItemShipment = (itemId, shipmentNo) => {
    const newItems = items.map((it) => it.id === itemId ? { ...it, shipmentNo: Number(shipmentNo) } : it);
    setEditing({ ...editing, items: newItems });
  };

  // Hiç sevkiyat yoksa sadece "Sevkiyat Ekle" butonu göster
  if (shipments.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3 pb-2" style={{ borderBottom: `1px solid ${TOKENS.border}` }}>
          <div className="text-[11px] uppercase tracking-widest font-bold" style={{ color: TOKENS.gold }}>
            Sevkiyatlar
            <span className="ml-2 normal-case font-normal text-[10px]" style={{ color: TOKENS.muted }}>
              · Şu an tek sevkiyat — kalemleri birden fazla parti hâlinde sevk etmek için bölebilirsin
            </span>
          </div>
          {items.length > 0 && (
            <Btn variant="secondary" size="xs" icon={Plus} onClick={addShipment}>İkinci Sevkiyat Ekle</Btn>
          )}
        </div>
        <div className="text-[11px] rounded-md p-3" style={{ background: TOKENS.cream, color: TOKENS.muted, border: `1px dashed ${TOKENS.border}` }}>
          ℹ️ Tüm kalemler tek sevkiyatta gönderilir (sipariş üst kısmındaki "Planlanan Sevk" ve "Fiili Sevk" tarihleri kullanılır).
          Birden fazla parti hâlinde sevk etmek istersen "İkinci Sevkiyat Ekle" tuşuna bas.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 pb-2" style={{ borderBottom: `1px solid ${TOKENS.border}` }}>
        <div className="text-[11px] uppercase tracking-widest font-bold" style={{ color: TOKENS.gold }}>
          Sevkiyatlar
          <span className="ml-2 normal-case font-normal text-[10px]" style={{ color: TOKENS.muted }}>
            · {shipments.length} parti · Ödeme planı tüm siparişin tamamı üzerinden ortak takip edilir
          </span>
        </div>
        <Btn variant="secondary" size="xs" icon={Plus} onClick={addShipment}>Sevkiyat Ekle</Btn>
      </div>

      <div className="space-y-3">
        {shipments.map((sh, idx) => {
          const shipmentItems = items.filter((it) => (it.shipmentNo || 1) === sh.no);
          const itemsTotal = shipmentItems.reduce((s, it) => s + ((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)) * (1 - (Number(it.discount) || 0) / 100), 0);

          return (
            <div key={sh.id} className="rounded-md overflow-hidden" style={{ border: `1px solid ${TOKENS.border}`, background: "white" }}>
              {/* Sevkiyat başlığı */}
              <div className="px-3 py-2 flex items-center gap-3" style={{ background: TOKENS.gold + "15", borderBottom: `1px solid ${TOKENS.gold}40` }}>
                <Truck size={14} style={{ color: TOKENS.goldDark }} />
                <Input
                  value={sh.name}
                  onChange={(e) => updateShipment(idx, { name: e.target.value })}
                  className="font-bold"
                  style={{ width: "180px", fontSize: "12px" }}
                />
                <span className="text-[10px] font-bold" style={{ color: TOKENS.muted }}>
                  {shipmentItems.length} kalem · {fmtMoney(itemsTotal, editing.currency)}
                </span>
                <div className="flex-1" />
                {sh.no !== 1 && (
                  <button onClick={() => removeShipment(idx)} className="p-1 rounded transition" style={{ color: TOKENS.muted, background: "transparent", border: "none" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = TOKENS.oxblood + "15"; e.currentTarget.style.color = TOKENS.oxblood; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TOKENS.muted; }}
                    title="Sevkiyatı sil">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              {/* Sevkiyat tarihleri */}
              <div className="grid grid-cols-3 gap-3 p-3" style={{ background: TOKENS.cream + "60" }}>
                <div>
                  <Label hint="Plan tarihi">Planlanan Sevk Tarihi</Label>
                  <Input type="date" value={sh.shipmentDate || ""}
                    onChange={(e) => updateShipment(idx, { shipmentDate: e.target.value })} />
                </div>
                <div>
                  <Label hint="Sevk gerçekleşince doldur">Fiili Sevk Tarihi</Label>
                  <Input type="date" value={sh.actualShipmentDate || ""}
                    onChange={(e) => updateShipment(idx, { actualShipmentDate: e.target.value })} />
                </div>
                <div>
                  <Label>Sevkiyat Notu</Label>
                  <Input value={sh.notes || ""}
                    onChange={(e) => updateShipment(idx, { notes: e.target.value })}
                    placeholder="Konşimento, palet sayısı, özel not..." />
                </div>
              </div>

              {/* Bu sevkiyattaki kalemler */}
              <div className="px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider font-bold mb-1.5" style={{ color: TOKENS.muted }}>Bu Sevkiyattaki Kalemler</div>
                {shipmentItems.length === 0 ? (
                  <div className="text-[11px] py-2 text-center" style={{ color: TOKENS.muted }}>
                    Henüz kalem yok. Aşağıdaki "Tüm Kalemler" listesinden bu sevkiyata ekle.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {shipmentItems.map((it) => (
                      <div key={it.id} className="flex items-center gap-2 px-2 py-1 text-[11px] rounded" style={{ background: TOKENS.cream }}>
                        <span className="font-mono font-bold" style={{ color: TOKENS.navy, minWidth: "70px" }}>{it.productCode || "—"}</span>
                        <span className="flex-1 font-bold truncate">{it.nameTr || "—"}</span>
                        <span className="tabular-nums" style={{ color: TOKENS.muted }}>{fmtNum(it.quantity)} {it.unit}</span>
                        <span className="tabular-nums font-bold">{fmtMoney(((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)) * (1 - (Number(it.discount) || 0) / 100), editing.currency)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Tüm kalemleri ve sevkiyat seçimini göster */}
        {items.length > 0 && (
          <div className="rounded-md overflow-hidden mt-3" style={{ border: `1px solid ${TOKENS.border}` }}>
            <div className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold" style={{ background: TOKENS.cream, color: TOKENS.muted }}>
              Kalem-Sevkiyat Eşleştirme · Her kalem hangi sevkiyata gidecek?
            </div>
            <table className="w-full text-xs">
              <thead style={{ background: TOKENS.cream + "80" }}>
                <tr>
                  <th className="text-left px-3 py-1.5 text-[10px] font-bold">Ürün</th>
                  <th className="text-left px-3 py-1.5 text-[10px] font-bold">İsim</th>
                  <th className="text-right px-3 py-1.5 text-[10px] font-bold">Adet</th>
                  <th className="text-center px-3 py-1.5 text-[10px] font-bold w-32">Sevkiyat</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} style={{ borderTop: `1px solid ${TOKENS.border}` }}>
                    <td className="px-3 py-1.5 font-mono font-bold text-[11px]" style={{ color: TOKENS.navy }}>{it.productCode || "—"}</td>
                    <td className="px-3 py-1.5 text-[11px]">{it.nameTr || "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-[11px]">{fmtNum(it.quantity)} {it.unit}</td>
                    <td className="px-3 py-1.5">
                      <Select value={it.shipmentNo || 1} onChange={(e) => updateItemShipment(it.id, e.target.value)} className="text-[11px] py-1">
                        {shipments.map((sh) => <option key={sh.id} value={sh.no}>{sh.name}</option>)}
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function OrderItemsSection({ editing, setEditing, products, itemsTotal, addItem, removeItem, updateItem, pickProduct }) {
  const [search, setSearch] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkMode, setBulkMode] = useState("codes"); // codes | code-qty-price | full
  const searchRef = useRef(null);

  // Arama sonuçları — kod, mamul kodu, isim üzerinden filtrele
  const searchResults = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [];
    return products.filter((p) =>
      [p.productCode, p.manufacturingCode, p.nameTr, p.nameEn].filter(Boolean)
        .some((v) => v.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [search, products]);

  // Aramayı vurgulayan basit fonksiyon
  const highlight = (text, q) => {
    if (!q || !text) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <strong style={{ color: TOKENS.copper, background: TOKENS.gold + "30", padding: "0 2px" }}>
          {text.slice(idx, idx + q.length)}
        </strong>
        {text.slice(idx + q.length)}
      </>
    );
  };

  // Hızlı eklenme: bir ürünü tek tıkla kalemlere ekle
  const addProduct = (p) => {
    const newItem = {
      id: uid(),
      productId: p.id,
      productCode: p.productCode,
      manufacturingCode: p.manufacturingCode || "",
      nameTr: p.nameTr || "",
      nameEn: p.nameEn || "",
      unit: p.unit || "adet",
      quantity: 1,
      unitPrice: p.defaultPrice || 0,
      discount: 0,
    };
    setEditing({
      ...editing,
      items: [...(editing.items || []), newItem],
    });
    setSearch("");
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  // Enter tuşu ilk eşleşeni ekler
  const onSearchKeyDown = (e) => {
    if (e.key === "Enter" && searchResults.length > 0) {
      e.preventDefault();
      addProduct(searchResults[0]);
    } else if (e.key === "Escape") {
      setSearch("");
    }
  };

  // BULK PASTE: Excel'den yapıştırılan veriyi parse et
  const processBulkPaste = () => {
    if (!bulkText.trim()) return;
    const lines = bulkText.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
    const newItems = lines.map((line) => {
      const parts = line.split(/\t+|;\s*/).map((p) => p.trim());
      // Tab/semicolon yoksa virgülle de bölmeyi dene ama dikkatli — sayılarda olabilir
      const useParts = parts.length > 1 ? parts : line.split(/\s{2,}/).map((p) => p.trim());
      const code = useParts[0] || "";
      let qty = 1, price = 0;
      if (bulkMode === "code-qty-price") {
        qty = parseNumber(useParts[1]) || 1;
        price = parseNumber(useParts[2]) || 0;
      } else if (bulkMode === "full") {
        qty = parseNumber(useParts[3]) || 1;
        price = parseNumber(useParts[5]) || 0;
      }
      const product = products.find((p) =>
        p.productCode?.toLowerCase() === code.toLowerCase() ||
        p.manufacturingCode?.toLowerCase() === code.toLowerCase()
      );
      if (product) {
        return {
          id: uid(),
          productId: product.id,
          productCode: product.productCode,
          manufacturingCode: product.manufacturingCode || "",
          nameTr: product.nameTr || "",
          nameEn: product.nameEn || "",
          unit: product.unit || "adet",
          quantity: qty,
          unitPrice: price > 0 ? price : (product.defaultPrice || 0),
          discount: 0,
        };
      } else {
        return {
          id: uid(),
          productId: "",
          productCode: code,
          manufacturingCode: "",
          nameTr: bulkMode === "full" ? (useParts[2] || "") : "",
          nameEn: "",
          unit: "adet",
          quantity: qty,
          unitPrice: price,
          discount: 0,
        };
      }
    });
    setEditing({
      ...editing,
      items: [...(editing.items || []), ...newItems],
    });
    setBulkText("");
    setShowBulk(false);
  };

  // Sütun yapıştırması — alt alta değerleri günceller
  const onColumnPaste = (startIdx, field) => (e) => {
    const text = e.clipboardData?.getData("text");
    if (!text || !text.includes("\n")) return; // tek değer normal yapışsın
    e.preventDefault();
    const values = text.split(/[\r\n]+/).map((v) => v.trim()).filter(Boolean);
    const items = [...(editing.items || [])];
    values.forEach((v, i) => {
      const idx = startIdx + i;
      if (idx >= items.length) return;
      items[idx] = { ...items[idx], [field]: parseNumber(v) };
    });
    setEditing({ ...editing, items });
  };

  return (
    <div>
      {/* Başlık */}
      <div className="flex items-center justify-between mb-3 pb-2" style={{ borderBottom: `1px solid ${TOKENS.border}` }}>
        <div className="text-[11px] uppercase tracking-widest font-bold" style={{ color: TOKENS.gold }}>
          Kalemler ({editing.items?.length || 0}) · Genel Toplam: <span style={{ color: TOKENS.ink }}>{fmtMoney(calcOrderTotals(editing).total, editing.currency)}</span>
        </div>
        <div className="flex gap-2">
          <Btn variant="secondary" size="xs" icon={Receipt} onClick={() => setShowBulk(!showBulk)}>
            {showBulk ? "Toplu Gizle" : "Excel'den Yapıştır"}
          </Btn>
          <Btn variant="secondary" size="xs" icon={Plus} onClick={addItem}>Boş Satır</Btn>
        </div>
      </div>

      {/* HIZLI ARAMA */}
      {products.length > 0 && (
        <div className="mb-3 rounded-md p-3" style={{ background: TOKENS.cream + "80", border: `1px solid ${TOKENS.border}` }}>
          <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: TOKENS.muted }}>
            Hızlı Ürün Ekleme
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: TOKENS.muted }} />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Ürün kodu, mamul kodu veya isim... (Enter ile ekle)"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md focus:outline-none transition font-semibold"
              style={{ border: `2px solid ${search ? TOKENS.gold : TOKENS.border}`, background: "white", fontFamily: FONT_BODY }}
            />
            {search && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold" style={{ color: TOKENS.muted }}>
                {searchResults.length} sonuç
              </span>
            )}
          </div>

          {/* Sonuç listesi */}
          {search && (
            <div className="mt-2 rounded-md overflow-hidden" style={{ border: `1px solid ${TOKENS.border}`, background: "white" }}>
              {searchResults.length === 0 ? (
                <div className="p-3 text-center text-xs" style={{ color: TOKENS.muted }}>
                  "<strong>{search}</strong>" ile eşleşen ürün yok. <button className="underline font-semibold ml-1" style={{ color: TOKENS.copper }} onClick={() => { addItem(); setSearch(""); }}>Manuel boş satır ekle</button>
                </div>
              ) : (
                searchResults.map((p, i) => (
                  <div
                    key={p.id}
                    onClick={() => addProduct(p)}
                    className="px-3 py-2 flex items-center gap-3 cursor-pointer transition"
                    style={{ borderBottom: i < searchResults.length - 1 ? `1px solid ${TOKENS.border}` : "none" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = TOKENS.cream)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded" style={{ color: TOKENS.navy, background: "#E6F1FB" }}>
                          {highlight(p.productCode, search)}
                        </span>
                        <span className="text-sm font-bold" style={{ color: TOKENS.ink }}>
                          {highlight(p.nameTr || p.nameEn || "—", search)}
                        </span>
                      </div>
                      <div className="text-[10px] mt-0.5 font-semibold" style={{ color: TOKENS.muted }}>
                        {p.manufacturingCode && <>Mamul: {highlight(p.manufacturingCode, search)} · </>}
                        {p.unit || "adet"} · Varsayılan: {fmtMoney(p.defaultPrice || 0, p.defaultCurrency || editing.currency)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); addProduct(p); }}
                      className="px-3 py-1 text-[11px] font-bold rounded flex items-center gap-1 flex-shrink-0"
                      style={{ background: TOKENS.navy, color: "white", border: "none" }}
                    >
                      <Plus size={11} /> Ekle
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {!search && (
            <div className="text-[10px] mt-1.5 font-semibold" style={{ color: TOKENS.muted }}>
              💡 Enter tuşu ilk eşleşeni otomatik ekler — klavye ile hızlı kalem girişi
            </div>
          )}
        </div>
      )}

      {/* TOPLU YAPIŞTIRMA */}
      {showBulk && (
        <div className="mb-3 rounded-md p-3" style={{ background: TOKENS.cream + "80", border: `1px solid ${TOKENS.gold}` }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: TOKENS.copper }}>
              Excel'den Toplu Yapıştır
            </div>
            <div className="flex gap-1">
              {[
                { key: "codes", label: "Sadece Kodlar" },
                { key: "code-qty-price", label: "Kod + Adet + Fiyat" },
                { key: "full", label: "Tam Format" },
              ].map((m) => (
                <button
                  key={m.key}
                  onClick={() => setBulkMode(m.key)}
                  className="px-2 py-1 text-[10px] font-bold rounded"
                  style={{
                    background: bulkMode === m.key ? "white" : "transparent",
                    color: bulkMode === m.key ? TOKENS.ink : TOKENS.muted,
                    border: `1px solid ${bulkMode === m.key ? TOKENS.gold : "transparent"}`,
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={
              bulkMode === "codes"
                ? "Her satıra bir kod yapıştır:\nMRM-001\nMRM-002\nTKS-001"
                : bulkMode === "code-qty-price"
                ? "Tab veya virgül ile ayır:\nMRM-001\t350\t42\nMRM-002\t200\t30"
                : "Kod / Mamul / İsim / Adet / Birim / Fiyat (tab ile ayır)"
            }
            className="w-full p-2 text-xs rounded-md font-mono focus:outline-none"
            style={{ border: `2px dashed ${TOKENS.gold}`, background: "white", minHeight: "100px", color: TOKENS.ink }}
          />
          <div className="mt-2 flex items-center gap-2">
            <Btn variant="primary" size="sm" icon={Check} onClick={processBulkPaste}>
              Yapıştırılanları Ekle ({bulkText.split(/[\r\n]+/).filter(Boolean).length} satır)
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => { setBulkText(""); setShowBulk(false); }}>İptal</Btn>
            <span className="text-[10px] ml-auto font-semibold" style={{ color: TOKENS.muted }}>
              💡 Bilinmeyen kodlar boş satır olarak eklenir, sonra düzenlersin
            </span>
          </div>
        </div>
      )}

      {/* KALEM TABLOSU */}
      {(editing.items || []).length === 0 ? (
        <div className="text-center py-8 text-xs rounded-md font-semibold" style={{ color: TOKENS.muted, background: TOKENS.cream, border: `1px dashed ${TOKENS.border}` }}>
          {products.length > 0 ? "Yukarıdaki arama kutusunu kullan veya Excel'den yapıştır" : "Önce ürün katalogu oluştur veya Boş Satır butonuyla manuel ekle"}
        </div>
      ) : (
        <div className="rounded-md overflow-hidden" style={{ border: `1px solid ${TOKENS.border}`, background: "white" }}>
          <table className="w-full text-xs">
            <thead style={{ background: TOKENS.cream }}>
              <tr>
                <th className="w-8 py-2 text-center text-[10px] font-bold" style={{ color: TOKENS.muted }}>#</th>
                <th className="text-left px-2 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: TOKENS.muted, width: "110px" }}>Kod</th>
                <th className="text-left px-2 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: TOKENS.muted }}>İsim</th>
                <th className="text-right px-2 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: TOKENS.muted, width: "75px" }}>Adet</th>
                <th className="text-center px-2 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: TOKENS.muted, width: "65px" }}>Birim</th>
                <th className="text-right px-2 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: TOKENS.muted, width: "90px" }}>Birim Fiyat</th>
                <th className="text-right px-2 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: TOKENS.muted, width: "60px" }} title="Satıra özel iskonto yüzdesi">İsk %</th>
                <th className="text-right px-2 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: TOKENS.muted, width: "100px" }}>Toplam</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {editing.items.map((item, idx) => {
                const baseTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                const lineDisc = Number(item.discount) || 0;
                const lineTotal = baseTotal * (1 - lineDisc / 100);
                const hasProduct = !!item.productId;
                return (
                  <tr key={item.id} style={{ borderTop: `1px solid ${TOKENS.border}`, background: idx % 2 === 1 ? TOKENS.cream + "40" : "white" }}>
                    <td className="text-center text-[11px] font-mono py-2" style={{ color: TOKENS.muted }}>{idx + 1}</td>
                    <td className="px-1 py-1">
                      <input
                        value={item.productCode}
                        onChange={(e) => updateItem(idx, { productCode: e.target.value })}
                        className="w-full px-2 py-1 text-xs font-mono font-bold rounded"
                        style={{ color: TOKENS.navy, border: hasProduct ? "1px solid transparent" : `1px solid ${TOKENS.terracotta}40`, background: hasProduct ? "transparent" : "#FFF8F0" }}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={item.nameTr || item.nameEn || ""}
                        onChange={(e) => updateItem(idx, { nameTr: e.target.value })}
                        className="w-full px-2 py-1 text-xs font-semibold rounded"
                        style={{ color: TOKENS.ink, border: "1px solid transparent", background: "transparent" }}
                      />
                      {item.manufacturingCode && (
                        <div className="text-[9px] px-2 font-mono font-semibold" style={{ color: TOKENS.muted }}>Mamul: {item.manufacturingCode}</div>
                      )}
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                        onPaste={onColumnPaste(idx, "quantity")}
                        className="w-full px-2 py-1.5 text-xs text-right font-bold tabular-nums rounded"
                        style={{ border: `1px solid ${TOKENS.border}`, background: "white" }}
                      />
                    </td>
                    <td className="px-1 py-1 text-center">
                      <select
                        value={item.unit || "adet"}
                        onChange={(e) => updateItem(idx, { unit: e.target.value })}
                        className="text-[11px] font-semibold rounded px-1 py-1"
                        style={{ border: `1px solid ${TOKENS.border}`, background: "white", color: TOKENS.muted, width: "100%" }}
                      >
                        <option>adet</option><option>kg</option><option>ton</option>
                        <option>m²</option><option>m³</option><option>litre</option>
                        <option>paket</option><option>palet</option>
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(idx, { unitPrice: e.target.value })}
                        onPaste={onColumnPaste(idx, "unitPrice")}
                        className="w-full px-2 py-1.5 text-xs text-right font-bold tabular-nums rounded"
                        style={{ border: `1px solid ${TOKENS.border}`, background: "white" }}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={item.discount || 0}
                        onChange={(e) => updateItem(idx, { discount: parseNumber(e.target.value) })}
                        onPaste={onColumnPaste(idx, "discount")}
                        placeholder="0"
                        className="w-full px-1.5 py-1.5 text-xs text-right font-bold tabular-nums rounded"
                        style={{ border: `1px solid ${TOKENS.border}`, background: lineDisc > 0 ? TOKENS.gold + "15" : "white", color: lineDisc > 0 ? TOKENS.copper : TOKENS.ink }}
                      />
                    </td>
                    <td className="px-2 py-2 text-right text-xs font-bold tabular-nums" style={{ color: TOKENS.ink }}>
                      {lineDisc > 0 && (
                        <div className="text-[9px] line-through font-normal mb-0.5" style={{ color: TOKENS.muted }}>{fmtMoney(baseTotal, editing.currency)}</div>
                      )}
                      {fmtMoney(lineTotal, editing.currency)}
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => removeItem(idx)}
                        className="p-1 rounded transition"
                        style={{ color: TOKENS.muted, background: "transparent", border: "none" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = TOKENS.oxblood + "15"; e.currentTarget.style.color = TOKENS.oxblood; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TOKENS.muted; }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {(() => {
                const totals = calcOrderTotals(editing);
                return (
                  <>
                    {(totals.discount > 0 || totals.vatRate > 0 || (Number(editing.vatRate) > 0)) && (
                      <tr style={{ borderTop: `1px solid ${TOKENS.border}`, background: TOKENS.cream + "30" }}>
                        <td colSpan="7" className="px-3 py-1.5 text-right text-[11px] font-semibold" style={{ color: TOKENS.muted }}>
                          Ara Toplam ({editing.items.length} kalem)
                        </td>
                        <td className="px-2 py-1.5 text-right text-[12px] font-bold tabular-nums" style={{ color: TOKENS.ink }}>
                          {fmtMoney(totals.subtotal, editing.currency)}
                        </td>
                        <td></td>
                      </tr>
                    )}
                    {totals.discount > 0 && (
                      <tr style={{ background: TOKENS.cream + "30" }}>
                        <td colSpan="7" className="px-3 py-1.5 text-right text-[11px] font-semibold" style={{ color: TOKENS.copper }}>
                          Sipariş İskontosu ({editing.discountType === "percentage" ? `%${editing.discountValue}` : "tutar"})
                        </td>
                        <td className="px-2 py-1.5 text-right text-[12px] font-bold tabular-nums" style={{ color: TOKENS.copper }}>
                          − {fmtMoney(totals.discount, editing.currency)}
                        </td>
                        <td></td>
                      </tr>
                    )}
                    {totals.vatRate > 0 && (
                      <tr style={{ background: TOKENS.cream + "30" }}>
                        <td colSpan="7" className="px-3 py-1.5 text-right text-[11px] font-semibold" style={{ color: TOKENS.muted }}>
                          KDV (%{totals.vatRate})
                        </td>
                        <td className="px-2 py-1.5 text-right text-[12px] font-bold tabular-nums" style={{ color: TOKENS.ink }}>
                          + {fmtMoney(totals.vatAmount, editing.currency)}
                        </td>
                        <td></td>
                      </tr>
                    )}
                    <tr style={{ borderTop: `2px solid ${TOKENS.gold}`, background: TOKENS.gold + "10" }}>
                      <td colSpan="7" className="px-3 py-2 text-right text-[12px] font-bold uppercase tracking-wider" style={{ color: TOKENS.ink }}>
                        Genel Toplam
                      </td>
                      <td className="px-2 py-2 text-right text-base font-bold tabular-nums" style={{ color: TOKENS.ink }}>
                        {fmtMoney(totals.total, editing.currency)}
                      </td>
                      <td></td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
          <div className="px-3 py-2 text-[10px] font-semibold" style={{ background: TOKENS.cream + "60", color: TOKENS.muted, borderTop: `1px solid ${TOKENS.border}` }}>
            ⌨ Adet veya Birim Fiyat sütununa Excel'den çoklu satır yapıştırabilirsin — alt alta otomatik dağıtılır
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SİPARİŞ DETAY GÖRÜNÜMÜ
// ============================================================================

function OrderDetailModal({ order, onClose, customers, payments, bankAccounts, rates, setView, onEdit, canEdit, t = (k) => k, lang = "tr" }) {
  if (!order) return null;
  const customer = customers.find((c) => c.id === order.customerId);
  const orderPayments = payments.filter((p) => p.orderId === order.id);
  const total = orderTotal(order);
  const paid = orderPaidAmount(order, payments);
  const status = ORDER_STATUSES.find((s) => s.key === order.status);
  const incoterm = INCOTERMS.find((i) => i.key === order.incoterms);
  const ship = SHIPPING_METHODS.find((s) => s.key === order.shippingMethod);
  const ShipIcon = ship?.icon || Ship;

  // Sipariş PDF — proforma stili
  const printOrder = () => {
    const totals = calcOrderTotals(order);
    const remaining = total - paid;

    // Kalemler tablosu
    const itemRows = (order.items || []).map((it, idx) => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.unitPrice) || 0;
      const disc = Number(it.discount) || 0;
      const baseTotal = qty * price;
      const lineTotal = baseTotal * (1 - disc / 100);
      return `
        <tr>
          <td class="center">${idx + 1}</td>
          <td><div class="text-mono">${htmlEscape(it.productCode || "—")}</div>${it.manufacturingCode ? `<div style="font-size:8px;color:#7A736A">${htmlEscape(it.manufacturingCode)}</div>` : ""}</td>
          <td><div style="font-weight:700">${htmlEscape(it.nameTr || "—")}</div>${it.nameEn ? `<div style="font-style:italic;font-size:9px;color:#7A736A">${htmlEscape(it.nameEn)}</div>` : ""}</td>
          <td class="right text-mono">${qty.toLocaleString("tr-TR")} ${htmlEscape(it.unit || "")}</td>
          <td class="right text-mono">${fmtMoneyPDF(price, order.currency)}</td>
          <td class="right text-mono">${disc > 0 ? `%${disc}` : "—"}</td>
          <td class="right text-mono" style="font-weight:700">${fmtMoneyPDF(lineTotal, order.currency)}</td>
        </tr>`;
    }).join("");

    // Ödeme planı
    const planRows = (order.paymentPlan || []).map((p) => {
      const tp = PAYMENT_PLAN_TYPES.find((t) => t.key === p.type);
      const meth = PAYMENT_METHODS.find((m) => m.key === p.method);
      const linkedPayment = orderPayments.find((x) => x.planItemId === p.id);
      const isPaid = linkedPayment?.status === "paid";
      return `
        <tr>
          <td>${tp?.label || p.type}</td>
          <td class="right">${p.percentage ? `%${p.percentage}` : "—"}</td>
          <td class="right text-mono" style="font-weight:700">${fmtMoneyPDF(p.amount, order.currency)}</td>
          <td>${meth?.label || p.method || "—"}</td>
          <td>${p.dueDate ? fmtDate(p.dueDate) : "—"}</td>
          <td class="${isPaid ? "text-success" : "text-warning"}">${isPaid ? "✓ Tahsil" : "Bekliyor"}</td>
        </tr>`;
    }).join("");

    // Tahsilat hareketleri
    const paymentRows = orderPayments
      .sort((a, b) => (b.paidDate || b.dueDate || "").localeCompare(a.paidDate || a.dueDate || ""))
      .map((p) => {
        const tp = PAYMENT_PLAN_TYPES.find((t) => t.key === p.type);
        const meth = PAYMENT_METHODS.find((m) => m.key === p.method);
        const st = PAYMENT_STATUSES.find((s) => s.key === p.status);
        const ba = bankAccounts.find((x) => x.id === p.bankAccountId);
        return `
          <tr>
            <td>${tp?.label || p.type}</td>
            <td class="right text-mono" style="font-weight:700">${fmtMoneyPDF(p.amount, p.currency)}</td>
            <td>${meth?.label || "—"}</td>
            <td>${p.paidDate ? fmtDate(p.paidDate) : "—"}</td>
            <td>${ba?.bankName || "—"}</td>
            <td class="${p.status==='paid'?'text-success':p.status==='overdue'?'text-danger':'text-warning'}">${st?.label || p.status}</td>
          </tr>`;
      }).join("");

    const content = `
      <div class="info-grid">
        <div><div class="label">Sipariş No</div><div class="text-mono" style="font-size:13px;font-weight:700">${htmlEscape(order.orderNumber)}</div></div>
        <div><div class="label">Durum</div><div style="font-weight:700">${status?.label || order.status}</div></div>
        <div><div class="label">Sipariş Tarihi</div><div>${fmtDateLong(order.orderDate)}</div></div>
        <div><div class="label">Planlanan Sevk</div><div>${order.shipmentDate ? fmtDateWithWeek(order.shipmentDate) : "—"}</div></div>
        ${order.actualShipmentDate ? `<div><div class="label">Fiili Sevk</div><div class="text-success">${fmtDateWithWeek(order.actualShipmentDate)}</div></div>` : ""}
        ${order.deliveryDate ? `<div><div class="label">Teslim Tarihi</div><div>${fmtDateLong(order.deliveryDate)}</div></div>` : ""}
        ${order.invoiceNumber ? `<div><div class="label">Fatura No</div><div class="text-mono">${htmlEscape(order.invoiceNumber)}</div></div>` : ""}
        ${order.billOfLading ? `<div><div class="label">Konşimento</div><div class="text-mono">${htmlEscape(order.billOfLading)}</div></div>` : ""}
      </div>

      <h2>Müşteri Bilgileri</h2>
      <div class="info-grid">
        <div><div class="label">Müşteri Kodu</div><div class="text-mono">${htmlEscape(customer?.code || "—")}</div></div>
        <div><div class="label">Müşteri Adı</div><div style="font-weight:700">${htmlEscape(customer?.name || "—")}</div></div>
        <div><div class="label">Ülke</div><div>${htmlEscape(customer?.country || "—")}</div></div>
        <div><div class="label">Yetkili</div><div>${htmlEscape(customer?.contactPerson || "—")}</div></div>
        <div><div class="label">E-posta</div><div>${htmlEscape(customer?.email || "—")}</div></div>
        <div><div class="label">Telefon</div><div>${htmlEscape(customer?.phone || "—")}</div></div>
      </div>

      <h2>Sevkiyat Bilgileri</h2>
      <div class="info-grid">
        ${incoterm ? `<div><div class="label">Incoterms</div><div style="font-weight:700">${incoterm.key} — ${incoterm.label}</div></div>` : ""}
        ${ship ? `<div><div class="label">Sevk Yöntemi</div><div>${ship.label}</div></div>` : ""}
        ${order.portOfLoading ? `<div><div class="label">Yükleme Limanı</div><div>${htmlEscape(order.portOfLoading)}</div></div>` : ""}
        ${order.portOfDischarge ? `<div><div class="label">Boşaltma Limanı</div><div>${htmlEscape(order.portOfDischarge)}</div></div>` : ""}
      </div>

      <h2>Sipariş Kalemleri (${(order.items || []).length})</h2>
      <table>
        <thead>
          <tr>
            <th class="center" style="width:24px">#</th>
            <th style="width:90px">Ürün Kodu</th>
            <th>İsim</th>
            <th class="right" style="width:80px">Miktar</th>
            <th class="right" style="width:90px">Birim Fiyat</th>
            <th class="right" style="width:60px">İsk %</th>
            <th class="right" style="width:90px">Tutar</th>
          </tr>
        </thead>
        <tbody>${itemRows || `<tr><td colspan="7" style="text-align:center;color:#7A736A;padding:12px">Kalem yok</td></tr>`}</tbody>
        <tfoot>
          ${totals.discount > 0 || totals.vatRate > 0 || (order.additionalCosts || []).length > 0 ? `<tr><td colspan="6" class="right" style="font-weight:700;color:#7A736A">Ara Toplam</td><td class="right text-mono" style="font-weight:700">${fmtMoneyPDF(totals.subtotal, order.currency)}</td></tr>` : ""}
          ${totals.discount > 0 ? `<tr><td colspan="6" class="right text-warning">Sipariş İskontosu (${order.discountType === "percentage" ? "%" + order.discountValue : "tutar"})</td><td class="right text-mono text-warning">− ${fmtMoneyPDF(totals.discount, order.currency)}</td></tr>` : ""}
          ${(order.additionalCosts || []).map((c) => `<tr><td colspan="6" class="right" style="color:#B87333">+ ${htmlEscape(c.description || "İlave Maliyet")}</td><td class="right text-mono" style="color:#B87333;font-weight:700">+ ${fmtMoneyPDF(c.amount, order.currency)}</td></tr>`).join("")}
          ${totals.vatRate > 0 ? `<tr><td colspan="6" class="right" style="font-weight:700;color:#7A736A">KDV (%${totals.vatRate})</td><td class="right text-mono" style="font-weight:700">+ ${fmtMoneyPDF(totals.vatAmount, order.currency)}</td></tr>` : ""}
          <tr style="background:#C9A96120;border-top:2px solid #C9A961">
            <td colspan="6" class="right" style="font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Genel Toplam</td>
            <td class="right text-mono" style="font-weight:700;font-size:13px">${fmtMoneyPDF(totals.total, order.currency)}</td>
          </tr>
        </tfoot>
      </table>

      <div class="summary-card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div class="label">Tahsilat Durumu</div>
            <div style="font-size:18px;font-weight:700;margin-top:3px;color:${remaining > 0.01 ? "#B87333" : "#3E7D5A"}">
              ${remaining > 0.01 ? `${fmtMoneyPDF(remaining, order.currency)} kalan` : "TAMAMI TAHSİL EDİLDİ"}
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:9px;color:#7A736A">Tahsil Edilen / Toplam</div>
            <div style="font-size:13px;font-weight:700">${fmtMoneyPDF(paid, order.currency)} / ${fmtMoneyPDF(total, order.currency)}</div>
            <div style="font-size:10px;color:#7A736A;margin-top:2px">% ${total > 0 ? Math.round(paid / total * 100) : 0}</div>
          </div>
        </div>
      </div>

      ${planRows ? `
      <h2>Ödeme Planı (${(order.paymentPlan || []).length})</h2>
      <table>
        <thead>
          <tr>
            <th>Tip</th>
            <th class="right" style="width:60px">%</th>
            <th class="right" style="width:100px">Tutar</th>
            <th>Yöntem</th>
            <th style="width:90px">Vade</th>
            <th style="width:80px">Durum</th>
          </tr>
        </thead>
        <tbody>${planRows}</tbody>
      </table>
      ` : ""}

      ${paymentRows ? `
      <h2>Tahsilat Hareketi (${orderPayments.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Tip</th>
            <th class="right" style="width:100px">Tutar</th>
            <th>Yöntem</th>
            <th style="width:90px">Tahsil Tarihi</th>
            <th>Banka</th>
            <th style="width:80px">Durum</th>
          </tr>
        </thead>
        <tbody>${paymentRows}</tbody>
      </table>
      ` : ""}

      ${order.notes ? `
      <h2>Notlar</h2>
      <div style="padding:8px 12px;background:#F8F5EE;border-left:3px solid #C9A961;font-size:11px">${htmlEscape(order.notes)}</div>
      ` : ""}
    `;

    printPDF({
      title: `Sipariş ${order.orderNumber}`,
      subtitle: `${customer?.name || "—"} · ${fmtDateLong(order.orderDate)}`,
      contentHtml: content,
    });
  };

  return (
    <Modal
      open={!!order}
      onClose={onClose}
      title={`Sipariş ${order.orderNumber}`}
      subtitle={`${customer?.name || "—"} · ${fmtDateLong(order.orderDate)}`}
      size="2xl"
      footer={<>
        <Btn variant="secondary" size="sm" icon={FileDown} onClick={printOrder}>PDF</Btn>
        {canEdit && onEdit && (
          <Btn variant="primary" size="sm" icon={Pencil} onClick={() => { onEdit(order); onClose(); }}>Siparişi Düzenle</Btn>
        )}
        <Btn variant="ghost" size="sm" onClick={onClose}>Kapat</Btn>
      </>}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-4 gap-3">
          <MetricBox label="Toplam" value={fmtMoney(total, order.currency)} accent={TOKENS.navy} />
          <MetricBox label="Tahsil Edilen" value={fmtMoney(paid, order.currency)} accent={TOKENS.forest} />
          <MetricBox label="Kalan" value={fmtMoney(total - paid, order.currency)} accent={total - paid > 0 ? TOKENS.copper : TOKENS.muted} />
          <MetricBox label="Tamamlanma" value={`${total > 0 ? Math.round(paid / total * 100) : 0}%`} accent={TOKENS.gold} />
        </div>

        <Card title="Sipariş Bilgileri" noPadding>
          <div className="grid grid-cols-3 gap-x-6 gap-y-3 p-5">
            <DetailRow icon={Users} label="Müşteri" value={customer?.name || "—"} />
            <DetailRow icon={MapPin} label="Ülke" value={customer?.country || "—"} />
            <DetailRow icon={Activity} label="Durum" value={<Badge color={status?.color} dot>{status?.label}</Badge>} />
            <DetailRow icon={Calendar} label="Sipariş Tarihi" value={fmtDate(order.orderDate)} />
            <DetailRow icon={Calendar} label="Planlanan Sevk" value={fmtDate(order.shipmentDate)} />
            <DetailRow icon={Calendar} label="Fiili Sevk" value={fmtDate(order.actualShipmentDate)} />
            {order.lockedRateAtShipment && order.currency !== "USD" && (
              <DetailRow icon={Lock} label="Sevk Tarihi Kuru" value={`1 ${order.currency} = ${order.lockedRateAtShipment.toFixed(4)} USD${order.lockedAt ? ` (${fmtDate(order.lockedAt)})` : ""}`} />
            )}
            <DetailRow icon={DollarSign} label="Para Birimi" value={order.currency} />
            <DetailRow icon={ShieldCheck} label="Incoterms" value={incoterm?.key + (incoterm ? ` — ${incoterm.label.split("—")[1].trim()}` : "")} />
            <DetailRow icon={ShipIcon} label="Sevk Yöntemi" value={ship?.label || "—"} />
            <DetailRow icon={Anchor} label="Yükleme" value={order.portOfLoading || "—"} />
            <DetailRow icon={Anchor} label="Boşaltma" value={order.portOfDischarge || "—"} />
            <DetailRow icon={Hash} label="Fatura No" value={order.invoiceNumber || "—"} />
            <DetailRow icon={Hash} label="Konşimento" value={order.billOfLading || "—"} />
          </div>
        </Card>

        {/* SEVKİYATLAR — birden fazla varsa göster */}
        {(order.shipments || []).length > 0 && (
          <Card title={`Sevkiyatlar (${order.shipments.length})`} subtitle="Bu sipariş birden fazla parti hâlinde sevk ediliyor — ödeme planı ortak takip edilir" noPadding>
            <div className="divide-y" style={{ borderColor: TOKENS.border }}>
              {order.shipments.map((sh, idx) => {
                const shipItems = (order.items || []).filter((it) => (it.shipmentNo || 1) === sh.no);
                const shipTotal = shipItems.reduce((s, it) => s + ((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)) * (1 - (Number(it.discount) || 0) / 100), 0);
                const isShipped = !!sh.actualShipmentDate;
                return (
                  <div key={sh.id} className="px-4 py-3 flex items-start gap-3" style={{ background: isShipped ? "#3E7D5A0A" : "white", borderTop: idx > 0 ? `1px solid ${TOKENS.border}` : "none" }}>
                    <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: (isShipped ? TOKENS.forest : TOKENS.gold) + "20" }}>
                      <Truck size={16} style={{ color: isShipped ? TOKENS.forest : TOKENS.goldDark }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold" style={{ color: TOKENS.ink }}>{sh.name}</span>
                        <Badge color={isShipped ? "forest" : "gold"}>{isShipped ? "Sevk Edildi" : "Bekliyor"}</Badge>
                        <span className="text-[10px] font-bold" style={{ color: TOKENS.muted }}>{shipItems.length} kalem</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-[11px]" style={{ color: TOKENS.muted }}>
                        {sh.shipmentDate && <span><strong>Plan:</strong> {fmtDate(sh.shipmentDate)} · W{getISOWeek(sh.shipmentDate)}</span>}
                        {sh.actualShipmentDate && <span style={{ color: TOKENS.forest, fontWeight: 700 }}>Fiili: {fmtDate(sh.actualShipmentDate)} · W{getISOWeek(sh.actualShipmentDate)}</span>}
                      </div>
                      {sh.notes && <div className="text-[11px] italic mt-1" style={{ color: TOKENS.muted }}>"{sh.notes}"</div>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold tabular-nums">{fmtMoney(shipTotal, order.currency)}</div>
                      <div className="text-[10px]" style={{ color: TOKENS.muted }}>{shipItems.length === 0 ? "kalem yok" : `${shipItems.length} kalem`}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <Card title={`Kalemler (${order.items?.length || 0})`} noPadding>
          <table className="w-full text-xs">
            <thead style={{ background: TOKENS.cream }}>
              <tr>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold">Ürün</th>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold">İsim</th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold">Adet</th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold">Birim Fiyat</th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold">İsk %</th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold">Toplam</th>
                {(order.shipments || []).length > 0 && <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wider font-bold">Sevk</th>}
              </tr>
            </thead>
            <tbody>
              {(order.items || []).map((i) => {
                const baseTotal = (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0);
                const lineDisc = Number(i.discount) || 0;
                const lineTotal = baseTotal * (1 - lineDisc / 100);
                const shipNo = i.shipmentNo || 1;
                const shipment = (order.shipments || []).find((s) => s.no === shipNo);
                return (
                  <tr key={i.id} style={{ borderTop: `1px solid ${TOKENS.border}` }}>
                    <td className="px-3 py-2"><div className="font-mono font-bold" style={{ color: TOKENS.navy }}>{i.productCode}</div>{i.manufacturingCode && <div className="font-mono text-[10px]" style={{ color: TOKENS.muted }}>{i.manufacturingCode}</div>}</td>
                    <td className="px-3 py-2"><div className="font-semibold">{i.nameTr}</div>{i.nameEn && <div className="italic text-[10px]" style={{ color: TOKENS.muted }}>{i.nameEn}</div>}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtNum(i.quantity)} {i.unit}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtMoney(i.unitPrice, order.currency)}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: lineDisc > 0 ? TOKENS.copper : TOKENS.muted }}>{lineDisc > 0 ? `%${lineDisc}` : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold" style={{ color: TOKENS.ink }}>
                      {lineDisc > 0 && (<div className="text-[9px] line-through font-normal" style={{ color: TOKENS.muted }}>{fmtMoney(baseTotal, order.currency)}</div>)}
                      {fmtMoney(lineTotal, order.currency)}
                    </td>
                    {(order.shipments || []).length > 0 && (
                      <td className="px-3 py-2 text-center text-[10px] font-bold" style={{ color: shipment?.actualShipmentDate ? TOKENS.forest : TOKENS.gold }}>
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded" style={{ background: (shipment?.actualShipmentDate ? TOKENS.forest : TOKENS.gold) + "15" }}>
                          <Truck size={10} />
                          #{shipNo}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {(() => {
                const totals = calcOrderTotals(order);
                return (
                  <>
                    {(totals.discount > 0 || totals.vatRate > 0) && (
                      <tr style={{ borderTop: `1px solid ${TOKENS.border}`, background: TOKENS.cream + "60" }}>
                        <td colSpan="5" className="px-3 py-1.5 text-right text-[11px] font-semibold" style={{ color: TOKENS.muted }}>Ara Toplam</td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-bold">{fmtMoney(totals.subtotal, order.currency)}</td>
                      </tr>
                    )}
                    {totals.discount > 0 && (
                      <tr style={{ background: TOKENS.cream + "60" }}>
                        <td colSpan="5" className="px-3 py-1.5 text-right text-[11px] font-semibold" style={{ color: TOKENS.copper }}>
                          Sipariş İskontosu ({order.discountType === "percentage" ? `%${order.discountValue}` : "tutar"})
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-bold" style={{ color: TOKENS.copper }}>− {fmtMoney(totals.discount, order.currency)}</td>
                      </tr>
                    )}
                    {(order.additionalCosts || []).map((c, ix) => (
                      <tr key={c.id || ix} style={{ background: TOKENS.cream + "60" }}>
                        <td colSpan="5" className="px-3 py-1.5 text-right text-[11px] font-semibold" style={{ color: TOKENS.copper }}>
                          + {c.description || "İlave Maliyet"}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-bold" style={{ color: TOKENS.copper }}>+ {fmtMoney(c.amount, order.currency)}</td>
                      </tr>
                    ))}
                    {totals.vatRate > 0 && (
                      <tr style={{ background: TOKENS.cream + "60" }}>
                        <td colSpan="5" className="px-3 py-1.5 text-right text-[11px] font-semibold" style={{ color: TOKENS.muted }}>KDV (%{totals.vatRate})</td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-bold">+ {fmtMoney(totals.vatAmount, order.currency)}</td>
                      </tr>
                    )}
                    <tr style={{ background: TOKENS.gold + "15", borderTop: `2px solid ${TOKENS.gold}` }}>
                      <td colSpan="5" className="px-3 py-2 text-right font-bold uppercase text-[11px] tracking-wider" style={{ color: TOKENS.ink }}>Genel Toplam</td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-base" style={{ color: TOKENS.ink }}>{fmtMoney(totals.total, order.currency)}</td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        </Card>

        <Card title={`Ödeme Planı & Tahsilat (${orderPayments.length} kalem)`} noPadding action={<Btn variant="ghost" size="xs" onClick={() => { onClose(); setView("payments"); }}>Ödemelere Git <ArrowRight size={11} /></Btn>}>
          {orderPayments.length === 0 ? (
            <div className="p-5 text-center text-xs" style={{ color: TOKENS.muted }}>Ödeme planı yok</div>
          ) : (
            <table className="w-full text-xs">
              <thead style={{ background: TOKENS.cream }}>
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-semibold">Tip</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-semibold">Yöntem</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-semibold">Vade</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-semibold">Tutar</th>
                  <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wider font-semibold">Durum</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-semibold">Tahsil Tarihi</th>
                </tr>
              </thead>
              <tbody>
                {orderPayments.sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "")).map((p) => {
                  const tp = PAYMENT_PLAN_TYPES.find((t) => t.key === p.type);
                  const m = PAYMENT_METHODS.find((x) => x.key === p.method);
                  const st = PAYMENT_STATUSES.find((x) => x.key === p.status);
                  return (
                    <tr key={p.id} style={{ borderTop: `1px solid ${TOKENS.border}` }}>
                      <td className="px-3 py-2"><Badge color={tp?.color}>{tp?.label}</Badge></td>
                      <td className="px-3 py-2">{m?.label || "—"}</td>
                      <td className="px-3 py-2">{fmtDate(p.dueDate)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(p.amount, p.currency)}</td>
                      <td className="px-3 py-2 text-center"><Badge color={st?.color} dot>{st?.label}</Badge></td>
                      <td className="px-3 py-2">{fmtDate(p.paidDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        {order.notes && (
          <div className="rounded-md p-4" style={{ background: TOKENS.gold + "10", border: `1px solid ${TOKENS.gold}40` }}>
            <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: TOKENS.goldDark }}>Notlar</div>
            <div className="text-sm" style={{ color: TOKENS.ink }}>{order.notes}</div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ============================================================================
// ÖDEMELER — tahsilat takibi
// ============================================================================

function PaymentsView({ orders, setOrders, customers, payments, setPayments, bankAccounts, rates, canEdit, showToast, t = (k) => k, lang = "tr" }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState([]);
  const [methodFilter, setMethodFilter] = useState([]);
  const [typeFilter, setTypeFilter] = useState([]);
  const [customerFilter, setCustomerFilter] = useState([]); // multi-select müşteri
  const [orderFilter, setOrderFilter] = useState([]); // multi-select sipariş no
  const [viewMode, setViewMode] = useState("by-order");
  const [marking, setMarking] = useState(null);

  const enriched = useMemo(() => payments.map((p) => {
    const order = orders.find((o) => o.id === p.orderId);
    const customer = customers.find((c) => c.id === order?.customerId);
    const account = bankAccounts.find((b) => b.id === p.bankAccountId);
    return { ...p, order, customer, account };
  }), [payments, orders, customers, bankAccounts]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return enriched.filter((p) => {
      if (statusFilter.length > 0 && !statusFilter.includes(p.status)) return false;
      if (methodFilter.length > 0 && !methodFilter.includes(p.method)) return false;
      if (typeFilter.length > 0 && !typeFilter.includes(p.type)) return false;
      if (customerFilter.length > 0 && !customerFilter.includes(p.customer?.id)) return false;
      if (orderFilter.length > 0 && !orderFilter.includes(p.order?.id)) return false;
      if (!q) return true;
      return [p.order?.orderNumber, p.customer?.name, p.referenceNumber, p.notes].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [enriched, search, statusFilter, methodFilter, typeFilter, customerFilter, orderFilter]);

  // Toplam istatistikler
  const stats = useMemo(() => {
    const paid = enriched.filter((p) => p.status === "paid").reduce((s, p) => s + toUSD(p.amount, p.currency, rates), 0);
    const pending = enriched.filter((p) => p.status === "pending").reduce((s, p) => s + toUSD(p.amount, p.currency, rates), 0);
    const overdue = enriched.filter((p) => p.status === "overdue").reduce((s, p) => s + toUSD(p.amount, p.currency, rates), 0);
    return { paid, pending, overdue, paidCount: enriched.filter((p) => p.status === "paid").length };
  }, [enriched, rates]);

  const markAsPaid = (payment) => {
    setMarking({ ...payment, paidDate: todayISO(), bankAccountId: payment.bankAccountId || bankAccounts.find((b) => b.currency === payment.currency)?.id || "", referenceNumber: payment.referenceNumber || "", paidAmount: payment.amount });
  };

  const confirmMarkPaid = () => {
    const paidAmt = Number(marking.paidAmount) || 0;
    const originalAmt = Number(marking.amount) || 0;

    if (paidAmt <= 0) {
      return showToast("Tahsil edilen tutar 0'dan büyük olmalı", "error");
    }

    const isFullPayment = Math.abs(paidAmt - originalAmt) < 0.01;
    const isOverpayment = paidAmt > originalAmt + 0.01;
    const isPartial = paidAmt < originalAmt - 0.01;

    if (isFullPayment) {
      // Tam tahsilat
      setPayments((arr) => arr.map((p) => p.id === marking.id ? {
        ...p,
        status: "paid",
        paidDate: marking.paidDate,
        bankAccountId: marking.bankAccountId || "",
        referenceNumber: marking.referenceNumber || "",
        amount: originalAmt,
        exchangeRateAtPayment: rates[p.currency],
      } : p));
      showToast("Ödeme tam olarak tahsil edildi", "success");
    } else if (isOverpayment) {
      // Fazla ödeme — fazlalık bir sonraki bekleyen ödemeden düşülür
      const excess = +(paidAmt - originalAmt).toFixed(2);
      // Aynı sipariş için bir sonraki bekleyen ödemeyi bul (vadeye göre erken olan)
      const nextPending = payments
        .filter((p) => p.orderId === marking.orderId && p.status === "pending" && p.id !== marking.id)
        .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))[0];

      let confirmMsg;
      if (nextPending) {
        confirmMsg = `Plan tutarı ${fmtMoney(originalAmt, marking.currency)}, ödenen ${fmtMoney(paidAmt, marking.currency)}.\n\nFazla ${fmtMoney(excess, marking.currency)} bir sonraki bekleyen ödemeden düşülecek (vade ${fmtDate(nextPending.dueDate)}, plan ${fmtMoney(nextPending.amount, nextPending.currency)} → yeni ${fmtMoney(Math.max(0, nextPending.amount - excess), nextPending.currency)}).\n\nOnay?`;
      } else {
        confirmMsg = `Plan tutarı ${fmtMoney(originalAmt, marking.currency)}, ödenen ${fmtMoney(paidAmt, marking.currency)}.\n\nFazla ${fmtMoney(excess, marking.currency)} bir alacak (kredi notu) olarak kaydedilecek — bu siparişin bir sonraki ödemesi yok.\n\nOnay?`;
      }
      if (!confirm(confirmMsg)) return;

      setPayments((arr) => {
        // Mevcut kaydı paid olarak işaretle (paidAmt ile)
        let updated = arr.map((p) => p.id === marking.id ? {
          ...p,
          status: "paid",
          paidDate: marking.paidDate,
          bankAccountId: marking.bankAccountId || "",
          referenceNumber: marking.referenceNumber || "",
          amount: paidAmt,
          exchangeRateAtPayment: rates[p.currency],
          notes: p.notes ? `${p.notes} · Fazla ödeme: ${fmtMoney(excess, p.currency)}` : `Fazla ödeme: ${fmtMoney(excess, p.currency)}`,
        } : p);

        // Bir sonraki bekleyen ödemeyi azalt
        if (nextPending) {
          let remainingExcess = excess;
          updated = updated.map((p) => {
            if (p.id !== nextPending.id) return p;
            const newAmount = Math.max(0, p.amount - remainingExcess);
            const newPct = originalAmt > 0 ? (newAmount / (p.amount || 1)) * (Number(p.percentage) || 0) : p.percentage;
            return {
              ...p,
              amount: +newAmount.toFixed(2),
              notes: p.notes ? `${p.notes} · Önceki fazla ödemeden düşüldü` : "Önceki fazla ödemeden düşüldü",
            };
          });
        }
        return updated;
      });
      showToast(`Fazla ödeme kaydedildi (${fmtMoney(excess, marking.currency)} fazla)`, "success");
    } else if (isPartial) {
      // Kısmi tahsilat
      const remaining = +(originalAmt - paidAmt).toFixed(2);
      const remainingPayment = {
        id: uid(),
        orderId: marking.orderId,
        planItemId: marking.planItemId,
        type: marking.type,
        method: marking.method,
        amount: remaining,
        currency: marking.currency,
        dueDate: marking.dueDate,
        paidDate: "",
        status: "pending",
        bankAccountId: "",
        referenceNumber: "",
        notes: `(${fmtMoney(paidAmt, marking.currency)} kısmi tahsilat sonrası kalan)`,
        createdAt: todayISO(),
      };
      setPayments((arr) => arr.map((p) => p.id === marking.id ? {
        ...p,
        status: "paid",
        paidDate: marking.paidDate,
        bankAccountId: marking.bankAccountId || "",
        referenceNumber: marking.referenceNumber || "",
        amount: paidAmt,
        exchangeRateAtPayment: rates[p.currency],
        notes: p.notes ? `${p.notes} · Kısmi tahsilat` : "Kısmi tahsilat",
      } : p).concat(remainingPayment));
      showToast(`Kısmi tahsilat: ${fmtMoney(paidAmt, marking.currency)} alındı, ${fmtMoney(remaining, marking.currency)} bekliyor`, "success");
    }
    setMarking(null);
  };

  const revert = (payment) => {
    if (!confirm("Bu ödeme bekleyen olarak işaretlensin mi?")) return;
    setPayments((arr) => arr.map((p) => p.id === payment.id ? { ...p, status: "pending", paidDate: "", bankAccountId: "", referenceNumber: "" } : p));
  };

  // Ödemeyi tamamen sil — çift onaylı
  // Eğer bir plan kalemine bağlıysa, plan kaleminden de kaldırılır (sipariş.paymentPlan'dan).
  // Böylece sipariş düzenlenince yeni bir pending kayıt oluşmaz.
  const deletePayment = (payment) => {
    const tp = PAYMENT_PLAN_TYPES.find((t) => t.key === payment.type)?.label || payment.type;
    const isPaid = payment.status === "paid";
    const linked = !!payment.planItemId;
    const msg1 = `Bu ödeme kaydı silinecek:\n\n• Tip: ${tp}\n• Tutar: ${fmtMoney(payment.amount, payment.currency)}\n• Durum: ${PAYMENT_STATUSES.find((s) => s.key === payment.status)?.label || payment.status}\n${isPaid ? "• Tahsil tarihi: " + fmtDate(payment.paidDate) : ""}\n\nDevam edilsin mi?`;
    if (!confirm(msg1)) return;
    const msg2 = linked
      ? "SON ONAY:\n\nBu ödeme bir plan kalemine bağlı.\n• Ödeme kaydı kalıcı olarak silinecek\n• Sipariş ödeme planından da bu kalem kaldırılacak\n\nBu işlem GERİ ALINAMAZ. Emin misin?"
      : "SON ONAY:\n\nBu ödeme kaydı kalıcı olarak silinecek.\nBu işlem GERİ ALINAMAZ. Emin misin?";
    if (!confirm(msg2)) return;

    setPayments((arr) => arr.filter((p) => p.id !== payment.id));
    if (linked) {
      // Sipariş.paymentPlan'dan kaleme ait olanı çıkar
      // setOrders App'ten ctx'le geliyor — burada doğrudan değişemez, ama setOrders props ile gelir
      if (typeof setOrders === "function") {
        setOrders((arr) => arr.map((o) => {
          if (o.id !== payment.orderId) return o;
          return { ...o, paymentPlan: (o.paymentPlan || []).filter((pp) => pp.id !== payment.planItemId) };
        }));
      }
    }
    showToast("Ödeme kaydı silindi", "success");
  };

  // Ödemeler listesi PDF
  const printList = () => {
    if (!filtered.length) return showToast("Yazdırılacak ödeme yok", "error");

    const rows = filtered.map((p) => {
      const tp = PAYMENT_PLAN_TYPES.find((t) => t.key === p.type);
      const meth = PAYMENT_METHODS.find((m) => m.key === p.method);
      const st = PAYMENT_STATUSES.find((s) => s.key === p.status);
      return `
        <tr>
          <td class="text-mono">${htmlEscape(p.order?.orderNumber || "—")}</td>
          <td><div style="font-weight:700">${htmlEscape(p.customer?.name || "—")}</div><div style="font-size:9px;color:#7A736A">${htmlEscape(p.customer?.country || "")}</div></td>
          <td>${tp?.label || p.type}</td>
          <td class="right text-mono" style="font-weight:700">${fmtMoneyPDF(p.amount, p.currency)}</td>
          <td>${meth?.label || "—"}</td>
          <td>${p.dueDate ? fmtDate(p.dueDate) : "—"}</td>
          <td>${p.paidDate ? `<span class="text-success">${fmtDate(p.paidDate)}</span>` : "—"}</td>
          <td class="${p.status==='paid'?'text-success':p.status==='overdue'?'text-danger':p.status==='partial'?'text-warning':''}" style="font-weight:700">${st?.label || p.status}</td>
        </tr>`;
    }).join("");

    // KPI'lar (USD)
    const totalPending = filtered.filter((p) => p.status === "pending").reduce((s, p) => s + toUSD(Number(p.amount) || 0, p.currency, rates), 0);
    const totalPaid = filtered.filter((p) => p.status === "paid").reduce((s, p) => s + toUSD(Number(p.amount) || 0, p.currency, rates), 0);
    const totalOverdue = filtered.filter((p) => p.status === "overdue").reduce((s, p) => s + toUSD(Number(p.amount) || 0, p.currency, rates), 0);

    const filters = [];
    if (search) filters.push(`${lang === "en" ? "Search" : "Arama"}: "${search}"`);
    if (statusFilter.length > 0) filters.push(`${t("status")}: ${statusFilter.map((s) => PAYMENT_STATUSES.find((x) => x.key === s)?.label || s).join(", ")}`);
    if (typeFilter.length > 0) filters.push(`${lang === "en" ? "Type" : "Tip"}: ${typeFilter.map((tp) => PAYMENT_PLAN_TYPES.find((x) => x.key === tp)?.label || tp).join(", ")}`);
    if (methodFilter.length > 0) filters.push(`${lang === "en" ? "Method" : "Yöntem"}: ${methodFilter.map((m) => PAYMENT_METHODS.find((x) => x.key === m)?.label || m).join(", ")}`);
    if (customerFilter.length > 0) filters.push(`${t("customer")}: ${customerFilter.map((id) => customers.find((c) => c.id === id)?.name || id).join(", ")}`);
    if (orderFilter.length > 0) filters.push(`${t("orderNumber")}: ${orderFilter.map((id) => orders.find((o) => o.id === id)?.orderNumber || id).join(", ")}`);

    const content = `
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">Toplam Kayıt</div><div class="kpi-value">${filtered.length}</div></div>
        <div class="kpi"><div class="kpi-label">Tahsil Edilen (USD)</div><div class="kpi-value" style="color:#3E7D5A">$${totalPaid.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
        <div class="kpi"><div class="kpi-label">Bekleyen (USD)</div><div class="kpi-value" style="color:#B87333">$${totalPending.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
        <div class="kpi"><div class="kpi-label">Gecikmiş (USD)</div><div class="kpi-value" style="color:#A6383D">$${totalOverdue.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
      </div>
      ${filters.length ? `<div style="font-size:10px;padding:6px 10px;background:#F8F5EE;border-radius:3px;margin-bottom:8px"><strong>Filtreler:</strong> ${filters.join(" · ")}</div>` : ""}
      <table>
        <thead>
          <tr>
            <th>Sipariş</th>
            <th>Müşteri</th>
            <th>Tip</th>
            <th class="right">Tutar</th>
            <th>Yöntem</th>
            <th>Vade</th>
            <th>Tahsil Tarihi</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    printPDF({
      title: "Ödeme Listesi",
      subtitle: `${filtered.length} ödeme${filters.length ? " · filtreli" : ""}`,
      contentHtml: content,
      orientation: "landscape",
    });
  };

  const handleExport = () => {
    if (!payments.length) return showToast("Aktarılacak ödeme yok", "error");
    const rows = enriched.map((p) => ({
      "Sipariş No": p.order?.orderNumber || "—",
      "Müşteri": p.customer?.name || "—",
      "Tip": PAYMENT_PLAN_TYPES.find((t) => t.key === p.type)?.label || "",
      "Yöntem": PAYMENT_METHODS.find((m) => m.key === p.method)?.label || "",
      "Tutar": p.amount, "Para Birimi": p.currency,
      "Vade": p.dueDate || "", "Tahsil Tarihi": p.paidDate || "",
      "Durum": PAYMENT_STATUSES.find((s) => s.key === p.status)?.label || "",
      "Banka Hesabı": p.account?.name || "",
      "Referans No": p.referenceNumber || "",
      "Notlar": p.notes || "",
    }));
    exportToExcel(rows, `odemeler_${todayISO()}.xlsx`, "Ödemeler");
  };

  return (
    <div>
      <PageHeader title={t("payments")} subtitle={`${payments.length} ${t("paymentsSubtitle")}`}>
        <div className="flex gap-1 rounded-md p-0.5" style={{ background: TOKENS.cream, border: `1px solid ${TOKENS.border}` }}>
          <button
            onClick={() => setViewMode("by-order")}
            className="px-3 py-1.5 text-xs font-bold rounded transition"
            style={{
              background: viewMode === "by-order" ? "white" : "transparent",
              color: viewMode === "by-order" ? TOKENS.ink : TOKENS.muted,
              boxShadow: viewMode === "by-order" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
            }}
          >
            Sipariş Bazlı
          </button>
          <button
            onClick={() => setViewMode("list")}
            className="px-3 py-1.5 text-xs font-bold rounded transition"
            style={{
              background: viewMode === "list" ? "white" : "transparent",
              color: viewMode === "list" ? TOKENS.ink : TOKENS.muted,
              boxShadow: viewMode === "list" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
            }}
          >
            Liste
          </button>
        </div>
        <Btn variant="ghost" size="sm" icon={FileDown} onClick={printList}>PDF</Btn>
        <Btn variant="secondary" size="sm" icon={FileDown} onClick={handleExport}>{t("export")}</Btn>
      </PageHeader>

      <div className="p-8 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <KPICard icon={CheckCircle2} label={t("totalReceived")} value={fmtMoney(stats.paid, "USD", { compact: true })} sub={`${stats.paidCount} ${t("payments").toLowerCase()}`} accent={TOKENS.forest} />
          <KPICard icon={Clock} label={t("pending")} value={fmtMoney(stats.pending, "USD", { compact: true })} sub={`${enriched.filter((p) => p.status === "pending").length}`} accent={TOKENS.gold} />
          <KPICard icon={AlertTriangle} label={t("overdue")} value={fmtMoney(stats.overdue, "USD", { compact: true })} sub={`${enriched.filter((p) => p.status === "overdue").length}`} accent={TOKENS.oxblood} />
        </div>

        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder={lang === "en" ? "Order, customer, reference..." : "Sipariş, müşteri, referans no..."} />
          <div className="w-52"><Label>{t("customer")}</Label>
            <MultiSelect
              values={customerFilter}
              onChange={setCustomerFilter}
              options={customers.map((c) => ({ value: c.id, label: c.name, sub: c.code }))}
              placeholder={t("all")}
            />
          </div>
          <div className="w-48"><Label>{t("orderNumber")}</Label>
            <MultiSelect
              values={orderFilter}
              onChange={setOrderFilter}
              options={orders.map((o) => {
                const c = customers.find((x) => x.id === o.customerId);
                return { value: o.id, label: o.orderNumber, sub: c?.name || "" };
              })}
              placeholder={t("all")}
            />
          </div>
          <div className="w-40"><Label>{t("status")}</Label>
            <MultiSelect
              values={statusFilter}
              onChange={setStatusFilter}
              options={PAYMENT_STATUSES.map((s) => ({ value: s.key, label: s.label }))}
              placeholder={t("all")}
            />
          </div>
          <div className="w-44"><Label>{lang === "en" ? "Method" : "Yöntem"}</Label>
            <MultiSelect
              values={methodFilter}
              onChange={setMethodFilter}
              options={PAYMENT_METHODS.map((m) => ({ value: m.key, label: m.label }))}
              placeholder={t("all")}
            />
          </div>
          <div className="w-36"><Label>{lang === "en" ? "Type" : "Tip"}</Label>
            <MultiSelect
              values={typeFilter}
              onChange={setTypeFilter}
              options={PAYMENT_PLAN_TYPES.map((tp) => ({ value: tp.key, label: tp.label }))}
              placeholder={t("all")}
            />
          </div>
          {(search || statusFilter.length > 0 || methodFilter.length > 0 || typeFilter.length > 0 || customerFilter.length > 0 || orderFilter.length > 0) && <Btn variant="ghost" size="sm" icon={X} onClick={() => { setSearch(""); setStatusFilter([]); setMethodFilter([]); setTypeFilter([]); setCustomerFilter([]); setOrderFilter([]); }}>{t("clear")}</Btn>}
        </FilterBar>

        {payments.length === 0 ? (
          <Card>
            <EmptyState icon={CreditCard} title="Henüz ödeme kaydı yok" hint="Ödeme kayıtları, sipariş içindeki ödeme planından otomatik oluşur. Önce bir sipariş oluştur ve ödeme planı ekle." />
          </Card>
        ) : viewMode === "by-order" ? (
          <PaymentsByOrder filtered={filtered} orders={orders} customers={customers} bankAccounts={bankAccounts} rates={rates} canEdit={canEdit} onMarkPaid={markAsPaid} onRevert={revert} onDelete={deletePayment} />
        ) : (
          <DataTable
            columns={[
              { key: "order", label: "Sipariş", sortValue: (r) => r.order?.orderNumber, render: (r) => (
                <div>
                  <div className="font-mono text-xs font-semibold" style={{ color: TOKENS.navy }}>{r.order?.orderNumber || "—"}</div>
                  <div className="text-[11px]" style={{ color: TOKENS.muted }}>{r.customer?.name || "—"}</div>
                </div>
              )},
              { key: "type", label: "Tip", sortValue: (r) => r.type, render: (r) => { const t = PAYMENT_PLAN_TYPES.find((x) => x.key === r.type); return <Badge color={t?.color}>{t?.label}</Badge>; } },
              { key: "method", label: "Yöntem", sortValue: (r) => r.method, render: (r) => { const m = PAYMENT_METHODS.find((x) => x.key === r.method); const Icon = m?.icon || Banknote; return <span className="inline-flex items-center gap-1 text-xs"><Icon size={11} /> {m?.label}</span>; } },
              { key: "dueDate", label: "Vade", render: (r) => {
                if (!r.dueDate) return "—";
                const days = daysBetween(todayISO(), r.dueDate);
                const overdue = r.status === "overdue";
                return (
                  <div>
                    <div style={{ color: TOKENS.ink }}>{fmtDate(r.dueDate)}</div>
                    {r.status !== "paid" && r.status !== "cancelled" && (
                      <div className="text-[10px]" style={{ color: overdue ? TOKENS.oxblood : days <= 7 ? TOKENS.terracotta : TOKENS.muted }}>
                        {days < 0 ? `${Math.abs(days)} gün gecikti` : days === 0 ? "bugün" : `${days} gün kaldı`}
                      </div>
                    )}
                  </div>
                );
              }},
              { key: "amount", label: "Tutar", align: "right", sortValue: (r) => toUSD(r.amount, r.currency, rates), render: (r) => (
                <div>
                  <div className="font-semibold tabular-nums">{fmtMoney(r.amount, r.currency)}</div>
                  <div className="text-[10px]" style={{ color: TOKENS.muted }}>{fmtMoney(toUSD(r.amount, r.currency, rates), "USD", { compact: true })}</div>
                </div>
              )},
              { key: "account", label: "Banka", render: (r) => r.account?.name || "—" },
              { key: "ref", label: "Referans", render: (r) => r.referenceNumber ? <span className="font-mono text-xs">{r.referenceNumber}</span> : "—", sortable: false },
              { key: "status", label: "Durum", render: (r) => { const s = PAYMENT_STATUSES.find((x) => x.key === r.status); return <Badge color={s?.color} dot>{s?.label}</Badge>; } },
            ]}
            rows={filtered}
            emptyText="Eşleşen ödeme yok"
            actions={canEdit ? (r) => (
              <div className="flex items-center justify-end gap-1">
                {r.status === "paid" ? (
                  <Btn variant="ghost" size="xs" onClick={() => revert(r)}>Geri Al</Btn>
                ) : (
                  <Btn variant="success" size="xs" icon={Check} onClick={() => markAsPaid(r)}>Tahsil</Btn>
                )}
                <button onClick={() => deletePayment(r)} className="p-1 rounded transition" style={{ color: TOKENS.muted, background: "transparent", border: "none" }} onMouseEnter={(e) => { e.currentTarget.style.background = TOKENS.oxblood + "15"; e.currentTarget.style.color = TOKENS.oxblood; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TOKENS.muted; }} title="Ödemeyi sil">
                  <Trash2 size={12} />
                </button>
              </div>
            ) : undefined}
          />
        )}
      </div>

      {/* Tahsil etme modalı */}
      <Modal open={!!marking} onClose={() => setMarking(null)} title="Tahsilatı Kaydet" subtitle="Tam veya kısmi tahsilat girebilirsiniz · Banka hesabı opsiyonel" size="sm"
        footer={<><Btn variant="ghost" onClick={() => setMarking(null)}>İptal</Btn><Btn variant="success" icon={Check} onClick={confirmMarkPaid}>Onayla</Btn></>}
      >
        {marking && (() => {
          const paidAmt = Number(marking.paidAmount) || 0;
          const originalAmt = Number(marking.amount) || 0;
          const remaining = +(originalAmt - paidAmt).toFixed(2);
          const excess = +(paidAmt - originalAmt).toFixed(2);
          const isPartial = paidAmt > 0 && paidAmt < originalAmt - 0.01;
          const isOverpayment = paidAmt > originalAmt + 0.01;
          return (
            <div className="space-y-3">
              <div className="rounded-md p-3 text-xs" style={{ background: TOKENS.cream }}>
                <div><strong>{marking.order?.orderNumber}</strong> · {marking.customer?.name}</div>
                <div style={{ color: TOKENS.muted }}>{PAYMENT_PLAN_TYPES.find((t) => t.key === marking.type)?.label} · Plan: <strong>{fmtMoney(marking.amount, marking.currency)}</strong></div>
              </div>
              <div><Label required>Tahsil Tarihi</Label><Input type="date" value={marking.paidDate} onChange={(e) => setMarking({ ...marking, paidDate: e.target.value })} /></div>
              <div>
                <Label hint="az veya çok girebilirsin">Tahsil Edilen Tutar ({marking.currency})</Label>
                <Input type="number" step="0.01" value={marking.paidAmount} onChange={(e) => setMarking({ ...marking, paidAmount: e.target.value })} />
                {isPartial && (
                  <div className="mt-2 p-2 rounded text-[11px] font-semibold" style={{ background: TOKENS.terracotta + "15", color: TOKENS.terracotta, border: `1px solid ${TOKENS.terracotta}30` }}>
                    ⚡ Kısmi tahsilat: <strong>{fmtMoney(paidAmt, marking.currency)}</strong> alınacak, <strong>{fmtMoney(remaining, marking.currency)}</strong> hâlâ bekleyen olarak kalacak (yeni satır olarak gözükecek).
                  </div>
                )}
                {isOverpayment && (
                  <div className="mt-2 p-2 rounded text-[11px] font-semibold" style={{ background: TOKENS.gold + "20", color: TOKENS.copper, border: `1px solid ${TOKENS.gold}` }}>
                    💰 Fazla ödeme: <strong>{fmtMoney(excess, marking.currency)}</strong> fazla ödendi. Bir sonraki bekleyen ödemeden otomatik düşülecek (varsa). Onay sırasında detayını görürsün.
                  </div>
                )}
              </div>
              <div><Label hint="opsiyonel">Banka Hesabı</Label>
                <Select value={marking.bankAccountId} onChange={(e) => setMarking({ ...marking, bankAccountId: e.target.value })}>
                  <option value="">— seçilmedi —</option>
                  {bankAccounts.filter((b) => b.currency === marking.currency).map((b) => <option key={b.id} value={b.id}>{b.name} ({b.currency})</option>)}
                  {bankAccounts.filter((b) => b.currency !== marking.currency).map((b) => <option key={b.id} value={b.id}>{b.name} ({b.currency})</option>)}
                </Select>
              </div>
              <div><Label hint="dekont/swift no — opsiyonel">Referans No</Label><Input value={marking.referenceNumber} onChange={(e) => setMarking({ ...marking, referenceNumber: e.target.value })} className="font-mono" /></div>
              <div className="text-[10px] p-2 rounded" style={{ background: TOKENS.gold + "15", color: TOKENS.goldDark }}>
                💡 Onayladığında, ödeme tarihindeki USD kuru ({rates[marking.currency]?.toFixed(4) || "1"}) kaydedilir — kur farkı için.
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

// Sipariş bazlı ödeme görünümü — her sipariş bir kart, içinde plan kalemleri
function PaymentsByOrder({ filtered, orders, customers, bankAccounts, rates, canEdit, onMarkPaid, onRevert, onDelete }) {
  // Filtreli ödemeleri sipariş bazlı grupla
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach((p) => {
      const order = p.order;
      if (!order) return;
      if (!map[order.id]) {
        const customer = customers.find((c) => c.id === order.customerId);
        map[order.id] = {
          order, customer,
          payments: [],
          totalPlan: 0, totalPaid: 0, totalPending: 0, totalOverdue: 0,
        };
      }
      map[order.id].payments.push(p);
      const usd = toUSD(p.amount, p.currency, rates);
      map[order.id].totalPlan += usd;
      if (p.status === "paid") map[order.id].totalPaid += usd;
      else if (p.status === "overdue") map[order.id].totalOverdue += usd;
      else if (p.status === "pending") map[order.id].totalPending += usd;
    });
    // En son sipariş tarihine göre sırala
    return Object.values(map).sort((a, b) => (b.order.orderDate || "").localeCompare(a.order.orderDate || ""));
  }, [filtered, customers, rates]);

  if (grouped.length === 0) {
    return <Card><EmptyState icon={Receipt} title="Eşleşen ödeme yok" hint="Filtre kriterlerini değiştir." /></Card>;
  }

  return (
    <div className="space-y-3">
      {grouped.map(({ order, customer, payments: orderPayments, totalPlan, totalPaid, totalPending, totalOverdue }) => {
        const completionPct = totalPlan > 0 ? Math.round((totalPaid / totalPlan) * 100) : 0;
        return (
          <Card key={order.id} noPadding>
            {/* Sipariş başlığı */}
            <div className="px-5 py-4 flex items-center gap-4" style={{ background: TOKENS.cream, borderBottom: `1px solid ${TOKENS.border}` }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-bold" style={{ color: TOKENS.navy }}>{order.orderNumber}</span>
                  <Badge color={ORDER_STATUSES.find((s) => s.key === order.status)?.color} dot>
                    {ORDER_STATUSES.find((s) => s.key === order.status)?.label}
                  </Badge>
                </div>
                <div className="text-sm font-bold" style={{ color: TOKENS.ink }}>{customer?.name || "—"}</div>
                <div className="text-xs" style={{ color: TOKENS.muted }}>
                  {customer?.country || "—"} · Sipariş: {fmtDate(order.orderDate)} · Sevk: {fmtDate(order.shipmentDate)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider font-bold mb-0.5" style={{ color: TOKENS.muted }}>Plan Toplamı</div>
                <div className="text-lg font-bold tabular-nums" style={{ color: TOKENS.ink }}>{fmtMoney(orderTotal(order), order.currency)}</div>
                <div className="flex items-center gap-2 mt-1 justify-end">
                  <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: TOKENS.border }}>
                    <div className="h-full transition-all" style={{ width: `${completionPct}%`, background: completionPct === 100 ? TOKENS.forest : completionPct >= 50 ? TOKENS.gold : TOKENS.copper }} />
                  </div>
                  <span className="text-xs font-bold tabular-nums" style={{ color: TOKENS.ink }}>%{completionPct}</span>
                </div>
              </div>
            </div>

            {/* Plan kalemleri */}
            <div>
              {orderPayments.sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "")).map((p, i) => {
                const tp = PAYMENT_PLAN_TYPES.find((t) => t.key === p.type);
                const m = PAYMENT_METHODS.find((x) => x.key === p.method);
                const st = PAYMENT_STATUSES.find((x) => x.key === p.status);
                const account = bankAccounts.find((b) => b.id === p.bankAccountId);
                const days = p.dueDate ? daysBetween(todayISO(), p.dueDate) : null;
                return (
                  <div key={p.id} className="px-5 py-3 flex items-center gap-3" style={{ borderTop: i > 0 ? `1px solid ${TOKENS.border}40` : "none" }}>
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: TOKENS[st?.color] }} />
                    <div className="w-32 flex-shrink-0">
                      <Badge color={tp?.color}>{tp?.label}</Badge>
                      <div className="text-[10px] mt-1 font-semibold" style={{ color: TOKENS.muted }}>%{p.percentage || 0}</div>
                    </div>
                    <div className="w-32 flex-shrink-0">
                      <div className="text-xs font-bold" style={{ color: TOKENS.ink }}>{fmtDate(p.dueDate)}</div>
                      {p.status !== "paid" && p.status !== "cancelled" && days !== null && (
                        <div className="text-[10px] font-semibold" style={{ color: p.status === "overdue" ? TOKENS.oxblood : days <= 7 ? TOKENS.terracotta : TOKENS.muted }}>
                          {days < 0 ? `${Math.abs(days)} gün gecikti` : days === 0 ? "BUGÜN" : `${days} gün kaldı`}
                        </div>
                      )}
                      {p.status === "paid" && p.paidDate && (
                        <div className="text-[10px] font-semibold" style={{ color: TOKENS.forest }}>Tahsil: {fmtDate(p.paidDate)}</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold" style={{ color: TOKENS.ink }}>{m?.label}</div>
                      {account && <div className="text-[10px]" style={{ color: TOKENS.muted }}>{account.name}</div>}
                      {p.referenceNumber && <div className="text-[10px] font-mono" style={{ color: TOKENS.muted }}>Ref: {p.referenceNumber}</div>}
                    </div>
                    <div className="text-right w-32 flex-shrink-0">
                      <div className="text-sm font-bold tabular-nums" style={{ color: TOKENS.ink }}>{fmtMoney(p.amount, p.currency)}</div>
                      <div className="text-[10px]" style={{ color: TOKENS.muted }}>≈ {fmtMoney(toUSD(p.amount, p.currency, rates), "USD", { compact: true })}</div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {canEdit && (p.status === "paid" ? (
                        <Btn variant="ghost" size="xs" onClick={() => onRevert(p)}>Geri Al</Btn>
                      ) : (
                        <Btn variant="success" size="xs" icon={Check} onClick={() => onMarkPaid(p)}>Tahsil</Btn>
                      ))}
                      {canEdit && <button onClick={() => onDelete(p)} className="p-1 rounded transition" style={{ color: TOKENS.muted, background: "transparent", border: "none" }} onMouseEnter={(e) => { e.currentTarget.style.background = TOKENS.oxblood + "15"; e.currentTarget.style.color = TOKENS.oxblood; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TOKENS.muted; }} title="Ödemeyi sil">
                        <Trash2 size={12} />
                      </button>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Alt özet */}
            <div className="px-5 py-2 flex items-center justify-end gap-4 text-xs font-semibold" style={{ background: TOKENS.cream + "80", borderTop: `1px solid ${TOKENS.border}` }}>
              <span style={{ color: TOKENS.forest }}>Tahsil: {fmtMoney(totalPaid, "USD", { compact: true })}</span>
              {totalPending > 0 && <span style={{ color: TOKENS.gold }}>Bekleyen: {fmtMoney(totalPending, "USD", { compact: true })}</span>}
              {totalOverdue > 0 && <span style={{ color: TOKENS.oxblood }}>Gecikmiş: {fmtMoney(totalOverdue, "USD", { compact: true })}</span>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================================
// NAKİT AKIŞI — beklenen tahsilatların zaman çizelgesi
// ============================================================================

function CashFlowView({ orders, customers, payments, rates, setView, t = (k) => k, lang = "tr" }) {
  const [period, setPeriod] = useState("90"); // gün
  const [groupBy, setGroupBy] = useState("day"); // day, week, month
  const [statusFilter, setStatusFilter] = useState(["all"]); // multi: pending/overdue/all
  const [customerFilter, setCustomerFilter] = useState([]); // multi
  const [orderSearch, setOrderSearch] = useState("");

  // Filtreli ödemeler
  const filteredPayments = useMemo(() => {
    const days = Number(period);
    const today = todayISO();
    const endDate = addDays(today, days);
    const orderQ = orderSearch.toLowerCase().trim();
    const allMode = statusFilter.includes("all") || statusFilter.length === 0;
    return payments.filter((p) => {
      if (p.status === "paid" || p.status === "cancelled") return false;
      if (!p.dueDate) return false;
      // Status filter: birden fazla seçili olabilir (pending, overdue)
      if (!allMode && !statusFilter.includes(p.status)) return false;
      const order = orders.find((o) => o.id === p.orderId);
      if (customerFilter.length > 0 && !customerFilter.includes(order?.customerId)) return false;
      if (orderQ && !order?.orderNumber?.toLowerCase().includes(orderQ)) return false;
      if (p.status === "overdue") return true;
      return p.dueDate <= endDate;
    });
  }, [payments, period, statusFilter, customerFilter, orderSearch, orders]);

  // Tarih bazlı gruplandırma (gün, hafta veya ay)
  const grouped = useMemo(() => {
    const buckets = {};
    filteredPayments.forEach((p) => {
      let key, label;
      const d = new Date(p.dueDate);
      if (groupBy === "day") {
        key = p.dueDate;
        label = d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" });
      } else if (groupBy === "week") {
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // pazartesi
        key = monday.toISOString().slice(0, 10);
        const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
        label = `${monday.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} – ${sunday.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}`;
      } else { // month
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        label = d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
      }
      if (!buckets[key]) buckets[key] = { key, label, items: [], total: 0 };
      buckets[key].items.push(p);
      buckets[key].total += toUSD(p.amount, p.currency, rates);
    });
    return Object.values(buckets).sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredPayments, groupBy, rates]);

  // Üst metrikler
  const stats = useMemo(() => {
    const totalExpected = filteredPayments.filter((p) => p.status === "pending" && p.dueDate >= todayISO()).reduce((s, p) => s + toUSD(p.amount, p.currency, rates), 0);
    const totalOverdue = filteredPayments.filter((p) => p.status === "overdue").reduce((s, p) => s + toUSD(p.amount, p.currency, rates), 0);
    const next7 = filteredPayments.filter((p) => {
      const days = daysBetween(todayISO(), p.dueDate);
      return p.status === "pending" && days >= 0 && days <= 7;
    }).reduce((s, p) => s + toUSD(p.amount, p.currency, rates), 0);
    const next30 = filteredPayments.filter((p) => {
      const days = daysBetween(todayISO(), p.dueDate);
      return p.status === "pending" && days >= 0 && days <= 30;
    }).reduce((s, p) => s + toUSD(p.amount, p.currency, rates), 0);
    return { totalExpected, totalOverdue, next7, next30 };
  }, [filteredPayments, rates]);

  // Para birimi bazlı toplam
  const byCurrency = useMemo(() => {
    const m = {};
    filteredPayments.forEach((p) => {
      if (!m[p.currency]) m[p.currency] = { currency: p.currency, amount: 0, count: 0 };
      m[p.currency].amount += Number(p.amount) || 0;
      m[p.currency].count++;
    });
    return Object.values(m).sort((a, b) => toUSD(b.amount, b.currency, rates) - toUSD(a.amount, a.currency, rates));
  }, [filteredPayments, rates]);

  // Aylık projeksiyon (grafik için)
  const monthlyChart = useMemo(() => {
    const buckets = {};
    filteredPayments.forEach((p) => {
      const d = new Date(p.dueDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!buckets[key]) buckets[key] = { month: key, label: d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" }), expected: 0, overdue: 0 };
      const usd = toUSD(p.amount, p.currency, rates);
      if (p.status === "overdue") buckets[key].overdue += usd;
      else buckets[key].expected += usd;
    });
    return Object.values(buckets).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredPayments, rates]);

  // Nakit akışı PDF
  const printList = () => {
    if (!filteredPayments.length) return alert("Yazdırılacak ödeme yok");

    // Ödeme satırları (vadeye göre sıralı)
    const sorted = [...filteredPayments].sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
    const rows = sorted.map((p) => {
      const order = orders.find((o) => o.id === p.orderId);
      const cust = customers.find((c) => c.id === order?.customerId);
      const tp = PAYMENT_PLAN_TYPES.find((t) => t.key === p.type);
      const meth = PAYMENT_METHODS.find((m) => m.key === p.method);
      const usd = toUSD(Number(p.amount) || 0, p.currency, rates);
      const isOverdue = p.status === "overdue";
      const today = todayISO();
      const daysUntil = p.dueDate ? Math.ceil((new Date(p.dueDate) - new Date(today)) / 86400000) : 0;
      return `
        <tr>
          <td>${p.dueDate ? `<div style="font-weight:700">${fmtDate(p.dueDate)}</div><div style="font-size:9px;color:${isOverdue ? '#A6383D' : '#7A736A'}">${isOverdue ? `${Math.abs(daysUntil)} gün gecikti` : daysUntil === 0 ? "bugün" : `${daysUntil} gün sonra`}</div>` : "—"}</td>
          <td class="text-mono">${htmlEscape(order?.orderNumber || "—")}</td>
          <td><div style="font-weight:700">${htmlEscape(cust?.name || "—")}</div><div style="font-size:9px;color:#7A736A">${htmlEscape(cust?.country || "")}</div></td>
          <td>${tp?.label || p.type}</td>
          <td class="right text-mono" style="font-weight:700">${fmtMoneyPDF(p.amount, p.currency)}</td>
          <td class="right text-mono" style="color:#7A736A">$${usd.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</td>
          <td>${meth?.label || "—"}</td>
          <td class="${isOverdue ? 'text-danger' : 'text-warning'}" style="font-weight:700">${isOverdue ? "GECİKMİŞ" : "Bekliyor"}</td>
        </tr>`;
    }).join("");

    // Aylık özet
    const monthlyRows = monthlyChart.map((m) => `
      <tr>
        <td style="font-weight:700">${m.label}</td>
        <td class="right text-success text-mono">$${(m.expected || 0).toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</td>
        <td class="right text-danger text-mono">$${(m.overdue || 0).toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</td>
        <td class="right text-mono" style="font-weight:700">$${((m.expected || 0) + (m.overdue || 0)).toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</td>
      </tr>`).join("");

    const filters = [];
    if (statusFilter.length > 0 && !statusFilter.includes("all")) {
      const labels = statusFilter.map((s) => s === "pending" ? t("onlyPending") : s === "overdue" ? t("onlyOverdue") : s);
      filters.push(labels.join(", "));
    }
    if (customerFilter.length > 0) filters.push(`${t("customer")}: ${customerFilter.map((id) => customers.find((c) => c.id === id)?.name || id).join(", ")}`);
    if (orderSearch) filters.push(`${t("orderNumber")}: "${orderSearch}"`);

    const content = `
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">${lang === "en" ? `Next ${period} Days` : `Önümüzdeki ${period} Gün`}</div><div class="kpi-value">${filteredPayments.length} ${lang === "en" ? "payments" : "ödeme"}</div></div>
        <div class="kpi"><div class="kpi-label">${lang === "en" ? "Total (USD)" : "Toplam (USD)"}</div><div class="kpi-value">$${stats.total.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
        <div class="kpi"><div class="kpi-label">${lang === "en" ? "Within 7 Days" : "7 Gün İçinde"}</div><div class="kpi-value" style="color:#3E7D5A">$${stats.next7.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
        <div class="kpi"><div class="kpi-label">${lang === "en" ? "Overdue" : "Gecikmiş"}</div><div class="kpi-value" style="color:#A6383D">$${stats.totalOverdue.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
      </div>
      ${filters.length ? `<div style="font-size:10px;padding:6px 10px;background:#F8F5EE;border-radius:3px;margin-bottom:8px"><strong>${lang === "en" ? "Filters" : "Filtreler"}:</strong> ${filters.join(" · ")}</div>` : ""}

      ${monthlyRows ? `
      <h2>${lang === "en" ? "Monthly Collection Projection" : "Aylık Tahsilat Projeksiyonu"}</h2>
      <table>
        <thead>
          <tr>
            <th>${lang === "en" ? "Month" : "Ay"}</th>
            <th class="right">${lang === "en" ? "Expected (USD)" : "Beklenen (USD)"}</th>
            <th class="right">${lang === "en" ? "Overdue (USD)" : "Gecikmiş (USD)"}</th>
            <th class="right">${lang === "en" ? "Total (USD)" : "Toplam (USD)"}</th>
          </tr>
        </thead>
        <tbody>${monthlyRows}</tbody>
      </table>
      ` : ""}

      <h2>${lang === "en" ? "Detailed List (by Due Date)" : "Detaylı Liste (Vade Tarihine Göre)"}</h2>
      <table>
        <thead>
          <tr>
            <th>${lang === "en" ? "Due" : "Vade"}</th>
            <th>${lang === "en" ? "Order" : "Sipariş"}</th>
            <th>${lang === "en" ? "Customer" : "Müşteri"}</th>
            <th>${lang === "en" ? "Type" : "Tip"}</th>
            <th class="right">${lang === "en" ? "Amount" : "Tutar"}</th>
            <th class="right">USD</th>
            <th>${lang === "en" ? "Method" : "Yöntem"}</th>
            <th>${lang === "en" ? "Status" : "Durum"}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    printPDF({
      title: lang === "en" ? "Cash Flow Projection" : "Nakit Akışı Projeksiyonu",
      subtitle: `${lang === "en" ? `Next ${period} days` : `Önümüzdeki ${period} gün`}${filters.length ? (lang === "en" ? " · filtered" : " · filtreli") : ""}`,
      contentHtml: content,
      orientation: "landscape",
      lang,
    });
  };

  return (
    <div>
      <PageHeader title={t("cashflow")} subtitle={t("cashflowSubtitle")}>
        <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="w-32">
          <option value="day">Gün bazlı</option>
          <option value="week">Hafta bazlı</option>
          <option value="month">Ay bazlı</option>
        </Select>
        <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-32">
          <option value="30">30 gün</option>
          <option value="60">60 gün</option>
          <option value="90">90 gün</option>
          <option value="180">180 gün</option>
          <option value="365">1 yıl</option>
        </Select>
        <Btn variant="ghost" size="sm" icon={FileDown} onClick={printList}>PDF</Btn>
      </PageHeader>

      <div className="p-8 space-y-4">
        {/* Üst KPI'lar */}
        <div className="grid grid-cols-4 gap-4">
          <KPICard icon={Clock} label={lang === "en" ? "Within 7 Days" : "7 Gün İçinde"} value={fmtMoney(stats.next7, "USD", { compact: true })} sub={t("upcoming").toLowerCase()} accent={TOKENS.terracotta} />
          <KPICard icon={Calendar} label={lang === "en" ? "Within 30 Days" : "30 Gün İçinde"} value={fmtMoney(stats.next30, "USD", { compact: true })} sub={t("upcoming").toLowerCase()} accent={TOKENS.gold} />
          <KPICard icon={TrendingUp} label={`${t("nextMonth")} (${period} ${t("days")})`} value={fmtMoney(stats.totalExpected, "USD", { compact: true })} sub={t("pending").toLowerCase()} accent={TOKENS.navy} />
          <KPICard icon={AlertTriangle} label={t("overdue")} value={fmtMoney(stats.totalOverdue, "USD", { compact: true })} sub={lang === "en" ? "urgent" : "acil takip"} accent={TOKENS.oxblood} />
        </div>

        {/* Filtreler */}
        <FilterBar>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold" style={{ color: TOKENS.muted }}>{t("showing").toUpperCase()}:</span>
            {[
              { key: "all", label: t("all") },
              { key: "overdue", label: t("onlyOverdue") },
              { key: "pending", label: t("onlyPending") },
            ].map((f) => {
              const isActive = f.key === "all"
                ? (statusFilter.includes("all") || statusFilter.length === 0)
                : (!statusFilter.includes("all") && statusFilter.includes(f.key));
              return (
                <button
                  key={f.key}
                  onClick={() => {
                    if (f.key === "all") setStatusFilter(["all"]);
                    else {
                      // Toggle: pending/overdue çoklu seçim
                      const cleaned = statusFilter.filter((x) => x !== "all");
                      if (cleaned.includes(f.key)) {
                        const next = cleaned.filter((x) => x !== f.key);
                        setStatusFilter(next.length === 0 ? ["all"] : next);
                      } else {
                        setStatusFilter([...cleaned, f.key]);
                      }
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-bold rounded-md transition"
                  style={{
                    background: isActive ? TOKENS.navy : "white",
                    color: isActive ? "white" : TOKENS.ink,
                    border: `1px solid ${isActive ? TOKENS.navy : TOKENS.border}`,
                  }}
                >
                  {f.label}
                </button>
              );
            })}
            <div className="h-6 w-px mx-1" style={{ background: TOKENS.border }} />
            <div style={{ minWidth: "220px" }}>
              <MultiSelect
                values={customerFilter}
                onChange={setCustomerFilter}
                options={customers.map((c) => ({ value: c.id, label: c.name, sub: c.code }))}
                placeholder={t("allCustomers")}
              />
            </div>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: TOKENS.muted }} />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder={t("searchOrderNo")}
                className="pl-7 pr-3 py-1.5 text-xs rounded-md font-semibold focus:outline-none"
                style={{ border: `1px solid ${TOKENS.border}`, background: "white", width: "160px" }}
              />
            </div>
            {(customerFilter.length > 0 || orderSearch || (statusFilter.length > 0 && !statusFilter.includes("all"))) && (
              <Btn variant="ghost" size="sm" icon={X} onClick={() => { setCustomerFilter([]); setOrderSearch(""); setStatusFilter(["all"]); }}>{t("clear")}</Btn>
            )}
          </div>
        </FilterBar>

        {/* Grafik */}
        <Card title="Aylık Tahsilat Projeksiyonu" subtitle={`Önümüzdeki ${period} gün · USD`}>
          {monthlyChart.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: TOKENS.muted }}>Bu dönemde tahsilat yok</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyChart} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 6" stroke={TOKENS.border} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 13, fill: TOKENS.ink, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: TOKENS.muted, fontWeight: 500 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const expected = payload.find((p) => p.dataKey === "expected")?.value || 0;
                    const overdue = payload.find((p) => p.dataKey === "overdue")?.value || 0;
                    return (
                      <div style={{ background: "white", border: `1px solid ${TOKENS.border}`, borderRadius: 6, padding: "8px 12px", fontSize: 13, fontWeight: 600 }}>
                        <div style={{ color: TOKENS.ink, marginBottom: 4 }}>{label}</div>
                        {expected > 0 && <div style={{ color: TOKENS.forest }}>● Beklenen: {fmtMoney(expected)}</div>}
                        {overdue > 0 && <div style={{ color: TOKENS.oxblood }}>● Gecikmiş: {fmtMoney(overdue)}</div>}
                      </div>
                    );
                  }}
                  cursor={{ fill: TOKENS.gold + "15" }}
                />
                <Legend wrapperStyle={{ fontSize: 13, fontWeight: 700, paddingTop: 6 }} iconSize={12} iconType="circle" />
                <Bar dataKey="expected" stackId="a" fill={TOKENS.forest} name="Beklenen (zamanında)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="overdue"  stackId="a" fill={TOKENS.oxblood} name="Gecikmiş" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Net tarih listesi */}
        <Card title={`Tahsilat Takvimi · ${groupBy === "day" ? "Gün Bazlı" : groupBy === "week" ? "Hafta Bazlı" : "Ay Bazlı"}`} noPadding>
          {grouped.length === 0 ? (
            <div className="p-12 text-center text-sm" style={{ color: TOKENS.muted }}>Bu kriterlerle eşleşen tahsilat yok</div>
          ) : (
            <div>
              {grouped.map((group, gIdx) => {
                const groupDate = group.items[0]?.dueDate;
                const isOverdueGroup = groupDate && groupDate < todayISO();
                return (
                  <div key={group.key} style={{ borderBottom: gIdx < grouped.length - 1 ? `1px solid ${TOKENS.border}` : "none" }}>
                    {/* Grup başlığı */}
                    <div className="px-5 py-3 flex items-center justify-between" style={{ background: isOverdueGroup ? TOKENS.oxblood + "08" : TOKENS.cream }}>
                      <div className="flex items-center gap-3">
                        <Calendar size={15} style={{ color: isOverdueGroup ? TOKENS.oxblood : TOKENS.gold }} />
                        <div>
                          <div className="text-base font-bold" style={{ color: TOKENS.ink }}>{group.label}</div>
                          <div className="text-xs" style={{ color: TOKENS.muted }}>{group.items.length} tahsilat</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold tabular-nums" style={{ color: TOKENS.ink }}>{fmtMoney(group.total, "USD", { compact: true })}</div>
                        <div className="text-[11px]" style={{ color: TOKENS.muted }}>USD karşılığı</div>
                      </div>
                    </div>
                    {/* Grup içindeki kalemler */}
                    <div>
                      {group.items.sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "")).map((p) => {
                        const order = orders.find((o) => o.id === p.orderId);
                        const customer = customers.find((c) => c.id === order?.customerId);
                        const tp = PAYMENT_PLAN_TYPES.find((t) => t.key === p.type);
                        const m = PAYMENT_METHODS.find((x) => x.key === p.method);
                        const isOverdue = p.status === "overdue";
                        const days = daysBetween(todayISO(), p.dueDate);
                        return (
                          <div key={p.id} className="px-5 py-3 flex items-center gap-4 hover:bg-amber-50/30 transition" style={{ borderTop: `1px solid ${TOKENS.border}40` }}>
                            <div className="text-center w-16 flex-shrink-0">
                              <div className="text-base font-bold tabular-nums" style={{ color: isOverdue ? TOKENS.oxblood : TOKENS.ink }}>
                                {fmtDate(p.dueDate)}
                              </div>
                              <div className="text-[10px] uppercase tracking-wider font-semibold mt-0.5" style={{ color: isOverdue ? TOKENS.oxblood : days <= 7 ? TOKENS.terracotta : TOKENS.muted }}>
                                {isOverdue ? `${Math.abs(days)} GÜN GEÇTİ` : days === 0 ? "BUGÜN" : `${days} GÜN KALDI`}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold truncate" style={{ color: TOKENS.ink }}>{customer?.name || "—"}</div>
                              <div className="text-xs flex items-center gap-2" style={{ color: TOKENS.muted }}>
                                <span className="font-mono font-semibold" style={{ color: TOKENS.navy }}>{order?.orderNumber}</span>
                                <span>·</span>
                                <Badge color={tp?.color}>{tp?.label}</Badge>
                                <span>·</span>
                                <span>{m?.label}</span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-base font-bold tabular-nums" style={{ color: TOKENS.ink }}>{fmtMoney(p.amount, p.currency)}</div>
                              <div className="text-[11px]" style={{ color: TOKENS.muted }}>≈ {fmtMoney(toUSD(p.amount, p.currency, rates), "USD", { compact: true })}</div>
                            </div>
                            {isOverdue && <Badge color="oxblood" dot>Gecikmiş</Badge>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Para birimi bazlı bekleyen */}
        {byCurrency.length > 1 && (
          <Card title="Para Birimine Göre Toplam" subtitle="Bekleyen tahsilatların döviz dağılımı" noPadding>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
              {byCurrency.map((c, i) => (
                <div key={c.currency} className="px-5 py-4" style={{ borderRight: i < byCurrency.length - 1 ? `1px solid ${TOKENS.border}` : "none" }}>
                  <div className="text-xs uppercase tracking-wider font-bold mb-1" style={{ color: TOKENS.muted }}>{c.currency} · {c.count} ödeme</div>
                  <div className="text-xl font-bold tabular-nums" style={{ color: TOKENS.ink }}>{fmtMoney(c.amount, c.currency)}</div>
                  <div className="text-xs mt-1" style={{ color: TOKENS.muted }}>≈ {fmtMoney(toUSD(c.amount, c.currency, rates), "USD", { compact: true })}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// RAPORLAR
// ============================================================================

function ReportsView({ orders = [], customers = [], products = [], payments = [], rates = {}, t = (k) => k, lang = "tr" }) {
  const [tab, setTab] = useState("summary");

  return (
    <div>
      <PageHeader title={t("reports")} subtitle={t("reportsSubtitle")} />

      <div className="p-8 space-y-4">
        <div className="flex gap-1 rounded-lg p-1" style={{ background: TOKENS.cream, border: `1px solid ${TOKENS.border}` }}>
          {[
            { key: "summary", label: "Özet", icon: BarChart3 },
            { key: "shipment", label: "Sevkiyat Cirosu", icon: Ship },
            { key: "customer", label: "Müşteri", icon: Users },
            { key: "product", label: "Ürün", icon: Package },
            { key: "country", label: "Ülke", icon: Globe },
            { key: "method", label: "Ödeme Yöntemi", icon: CreditCard },
            { key: "status", label: "Durum", icon: Activity },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} className="flex-1 px-3 py-2 text-xs font-bold rounded-md transition inline-flex items-center justify-center gap-1.5"
                style={{ background: active ? "white" : "transparent", color: active ? TOKENS.ink : TOKENS.muted, boxShadow: active ? "0 1px 2px rgba(0,0,0,0.05)" : "none" }}>
                <Icon size={13} /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === "summary" && <SummaryReport orders={orders} customers={customers} products={products} payments={payments} rates={rates} />}
        {tab === "shipment" && <ShipmentReport orders={orders} customers={customers} rates={rates} />}
        {tab === "customer" && <CustomerReport orders={orders} customers={customers} payments={payments} rates={rates} />}
        {tab === "product" && <ProductReport orders={orders} products={products} rates={rates} />}
        {tab === "country" && <CountryReport orders={orders} customers={customers} rates={rates} />}
        {tab === "method" && <MethodReport payments={payments} rates={rates} />}
        {tab === "status" && <StatusReport orders={orders} rates={rates} />}
      </div>
    </div>
  );
}

// ÖZET RAPOR — tarih aralığına göre tüm veriyi gösterir, Excel'e aktarılabilir
function SummaryReport({ orders = [], customers = [], products = [], payments = [], rates = {} }) {
  const [dateRange, setDateRange] = useState({
    from: addDays(todayISO(), -90),
    to: todayISO(),
  });
  const [dateBasis, setDateBasis] = useState("orderDate"); // orderDate, shipmentDate, paidDate

  // Tarih aralığında filtrele
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const d = dateBasis === "shipmentDate" ? (o.actualShipmentDate || o.shipmentDate) : o.orderDate;
      if (!d) return false;
      if (dateRange.from && d < dateRange.from) return false;
      if (dateRange.to && d > dateRange.to) return false;
      return true;
    });
  }, [orders, dateRange, dateBasis]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (p.status !== "paid") return false;
      const d = p.paidDate;
      if (!d) return false;
      if (dateRange.from && d < dateRange.from) return false;
      if (dateRange.to && d > dateRange.to) return false;
      return true;
    });
  }, [payments, dateRange]);

  // Özet metrikler
  const stats = useMemo(() => {
    const orderCount = filteredOrders.length;
    const totalOrdersUSD = filteredOrders.reduce((s, o) => s + orderTotalUSD(o, rates), 0);
    const shippedCount = filteredOrders.filter((o) => o.actualShipmentDate || ["shipped", "delivered", "completed"].includes(o.status)).length;
    const shippedTotalUSD = filteredOrders.filter((o) => o.actualShipmentDate || ["shipped", "delivered", "completed"].includes(o.status)).reduce((s, o) => s + orderTotalUSD(o, rates), 0);
    const paidCount = filteredPayments.length;
    const paidTotalUSD = filteredPayments.reduce((s, p) => s + toUSD(p.amount, p.currency, rates), 0);
    const customerCount = new Set(filteredOrders.map((o) => o.customerId)).size;
    return { orderCount, orderTotalUSD: totalOrdersUSD, shippedCount, shippedTotalUSD, paidCount, paidTotalUSD, customerCount };
  }, [filteredOrders, filteredPayments, rates]);

  // Özet rapor PDF
  const printSummary = () => {
    // Top 10 müşteri
    const customerStats = {};
    filteredOrders.forEach((o) => {
      if (!customerStats[o.customerId]) customerStats[o.customerId] = { orderCount: 0, totalUSD: 0 };
      customerStats[o.customerId].orderCount++;
      customerStats[o.customerId].totalUSD += orderTotalUSD(o, rates);
    });
    const topCustomers = Object.entries(customerStats)
      .map(([id, st]) => ({ ...st, customer: customers.find((c) => c.id === id) }))
      .filter((x) => x.customer)
      .sort((a, b) => b.totalUSD - a.totalUSD)
      .slice(0, 10);

    // Ülke bazlı
    const countryStats = {};
    filteredOrders.forEach((o) => {
      const c = customers.find((x) => x.id === o.customerId);
      const country = c?.country || "—";
      if (!countryStats[country]) countryStats[country] = { count: 0, totalUSD: 0 };
      countryStats[country].count++;
      countryStats[country].totalUSD += orderTotalUSD(o, rates);
    });
    const topCountries = Object.entries(countryStats)
      .map(([country, st]) => ({ country, ...st }))
      .sort((a, b) => b.totalUSD - a.totalUSD)
      .slice(0, 10);

    // Top ürünler (kalem bazında)
    const productStats = {};
    filteredOrders.forEach((o) => {
      (o.items || []).forEach((it) => {
        const k = it.productCode || "?";
        if (!productStats[k]) productStats[k] = { name: it.nameTr || it.nameEn || "—", qty: 0, totalUSD: 0, unit: it.unit || "" };
        productStats[k].qty += Number(it.quantity) || 0;
        const lineTotal = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) * (1 - (Number(it.discount) || 0) / 100);
        productStats[k].totalUSD += toUSD(lineTotal, o.currency, rates);
      });
    });
    const topProducts = Object.entries(productStats)
      .map(([code, st]) => ({ code, ...st }))
      .sort((a, b) => b.totalUSD - a.totalUSD)
      .slice(0, 10);

    const customerRows = topCustomers.map((c, i) => `
      <tr>
        <td class="center" style="font-weight:700">${i + 1}</td>
        <td class="text-mono">${htmlEscape(c.customer.code)}</td>
        <td><div style="font-weight:700">${htmlEscape(c.customer.name)}</div><div style="font-size:9px;color:#7A736A">${htmlEscape(c.customer.country || "")}</div></td>
        <td class="center">${c.orderCount}</td>
        <td class="right text-mono" style="font-weight:700">$${c.totalUSD.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</td>
      </tr>`).join("");

    const countryRows = topCountries.map((c, i) => `
      <tr>
        <td class="center" style="font-weight:700">${i + 1}</td>
        <td style="font-weight:700">${htmlEscape(c.country)}</td>
        <td class="center">${c.count}</td>
        <td class="right text-mono" style="font-weight:700">$${c.totalUSD.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</td>
      </tr>`).join("");

    const productRows = topProducts.map((p, i) => `
      <tr>
        <td class="center" style="font-weight:700">${i + 1}</td>
        <td class="text-mono">${htmlEscape(p.code)}</td>
        <td style="font-weight:700">${htmlEscape(p.name)}</td>
        <td class="right text-mono">${p.qty.toLocaleString("tr-TR")} ${htmlEscape(p.unit)}</td>
        <td class="right text-mono" style="font-weight:700">$${p.totalUSD.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</td>
      </tr>`).join("");

    const dateBasisLabel = dateBasis === "shipmentDate" ? "Sevk Tarihi" : "Sipariş Tarihi";

    const content = `
      <div class="info-grid">
        <div><div class="label">Tarih Aralığı</div><div style="font-weight:700">${fmtDateLong(dateRange.from)} - ${fmtDateLong(dateRange.to)}</div></div>
        <div><div class="label">Tarih Baz Alındı</div><div style="font-weight:700">${dateBasisLabel}</div></div>
      </div>

      <h2>Özet Metrikler</h2>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">Toplam Sipariş</div><div class="kpi-value">${stats.orderCount}</div></div>
        <div class="kpi"><div class="kpi-label">Toplam Müşteri</div><div class="kpi-value">${stats.customerCount}</div></div>
        <div class="kpi"><div class="kpi-label">Toplam Ciro (USD)</div><div class="kpi-value">$${stats.orderTotalUSD.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
        <div class="kpi"><div class="kpi-label">Sevkiyat Cirosu</div><div class="kpi-value" style="color:#3E7D5A">$${stats.shippedTotalUSD.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
        <div class="kpi"><div class="kpi-label">Sevk Edilen</div><div class="kpi-value">${stats.shippedCount}</div></div>
        <div class="kpi"><div class="kpi-label">Tahsil Edilen</div><div class="kpi-value" style="color:#3E7D5A">$${stats.paidTotalUSD.toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
        <div class="kpi"><div class="kpi-label">Tahsilat Sayısı</div><div class="kpi-value">${stats.paidCount}</div></div>
        <div class="kpi"><div class="kpi-label">Ortalama Sipariş</div><div class="kpi-value">$${(stats.orderCount > 0 ? stats.orderTotalUSD / stats.orderCount : 0).toLocaleString("tr-TR", {minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
      </div>

      ${customerRows ? `
      <h2>En Yüksek Cirolu Müşteriler (Top 10)</h2>
      <table>
        <thead>
          <tr>
            <th class="center" style="width:30px">#</th>
            <th>Kod</th>
            <th>Müşteri</th>
            <th class="center">Sipariş</th>
            <th class="right">Ciro (USD)</th>
          </tr>
        </thead>
        <tbody>${customerRows}</tbody>
      </table>
      ` : ""}

      ${countryRows ? `
      <h2>Ülke Bazlı Ciro (Top 10)</h2>
      <table>
        <thead>
          <tr>
            <th class="center" style="width:30px">#</th>
            <th>Ülke</th>
            <th class="center">Sipariş</th>
            <th class="right">Ciro (USD)</th>
          </tr>
        </thead>
        <tbody>${countryRows}</tbody>
      </table>
      ` : ""}

      ${productRows ? `
      <h2>En Çok Satan Ürünler (Top 10)</h2>
      <table>
        <thead>
          <tr>
            <th class="center" style="width:30px">#</th>
            <th>Kod</th>
            <th>İsim</th>
            <th class="right">Toplam Adet</th>
            <th class="right">Ciro (USD)</th>
          </tr>
        </thead>
        <tbody>${productRows}</tbody>
      </table>
      ` : ""}
    `;

    printPDF({
      title: "Özet Rapor",
      subtitle: `${fmtDateLong(dateRange.from)} - ${fmtDateLong(dateRange.to)} · ${dateBasisLabel} bazlı`,
      contentHtml: content,
    });
  };

  // Excel'e aktarma — her şey
  const exportFullReport = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Özet
    const summaryRows = [
      { "Metrik": "Tarih Aralığı", "Değer": `${dateRange.from} → ${dateRange.to}` },
      { "Metrik": "Sipariş Sayısı", "Değer": stats.orderCount },
      { "Metrik": "Sipariş Cirosu (USD)", "Değer": stats.orderTotalUSD.toFixed(2) },
      { "Metrik": "Sevk Edilen Sipariş", "Değer": stats.shippedCount },
      { "Metrik": "Sevkiyat Cirosu (USD)", "Değer": stats.shippedTotalUSD.toFixed(2) },
      { "Metrik": "Tahsil Edilen Ödeme Sayısı", "Değer": stats.paidCount },
      { "Metrik": "Tahsil Edilen Toplam (USD)", "Değer": stats.paidTotalUSD.toFixed(2) },
      { "Metrik": "Aktif Müşteri Sayısı", "Değer": stats.customerCount },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Özet");

    // Sheet 2: Siparişler
    const orderRows = filteredOrders.map((o) => {
      const c = customers.find((x) => x.id === o.customerId);
      return {
        "Sipariş No": o.orderNumber,
        "Müşteri": c?.name || "—",
        "Ülke": c?.country || "",
        "Sipariş Tarihi": o.orderDate || "",
        "Sevk Tarihi (Plan)": o.shipmentDate || "",
        "Fiili Sevk": o.actualShipmentDate || "",
        "Durum": ORDER_STATUSES.find((s) => s.key === o.status)?.label || o.status,
        "Para Birimi": o.currency,
        "Tutar": orderTotal(o),
        "Tutar (USD)": orderTotalUSD(o, rates).toFixed(2),
        "Incoterms": o.incoterms || "",
        "Fatura No": o.invoiceNumber || "",
        "Konşimento": o.billOfLading || "",
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orderRows), "Siparişler");

    // Sheet 3: Tahsilatlar
    const payRows = filteredPayments.map((p) => {
      const o = orders.find((x) => x.id === p.orderId);
      const c = customers.find((x) => x.id === o?.customerId);
      return {
        "Sipariş No": o?.orderNumber || "—",
        "Müşteri": c?.name || "—",
        "Tip": PAYMENT_PLAN_TYPES.find((t) => t.key === p.type)?.label || "",
        "Yöntem": PAYMENT_METHODS.find((m) => m.key === p.method)?.label || "",
        "Tahsil Tarihi": p.paidDate,
        "Vade": p.dueDate || "",
        "Tutar": p.amount,
        "Para Birimi": p.currency,
        "Tutar (USD)": toUSD(p.amount, p.currency, rates).toFixed(2),
        "Kur": p.exchangeRateAtPayment?.toFixed(4) || "",
        "Referans": p.referenceNumber || "",
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payRows), "Tahsilatlar");

    // Sheet 4: Müşteri Özeti
    const customerSummary = {};
    filteredOrders.forEach((o) => {
      const c = customers.find((x) => x.id === o.customerId);
      const key = c?.name || "—";
      if (!customerSummary[key]) customerSummary[key] = { name: key, country: c?.country || "", count: 0, total: 0 };
      customerSummary[key].count++;
      customerSummary[key].total += orderTotalUSD(o, rates);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      Object.values(customerSummary).sort((a, b) => b.total - a.total).map((c) => ({
        "Müşteri": c.name, "Ülke": c.country, "Sipariş": c.count, "Toplam (USD)": c.total.toFixed(2),
      }))
    ), "Müşteri Özeti");

    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadBlob(out, `ozet_rapor_${dateRange.from}_${dateRange.to}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="w-32">
            <Label>Bazda</Label>
            <Select value={dateBasis} onChange={(e) => setDateBasis(e.target.value)}>
              <option value="orderDate">Sipariş Tarihi</option>
              <option value="shipmentDate">Sevk Tarihi</option>
            </Select>
          </div>
          <DateRange from={dateRange.from} to={dateRange.to} onChange={setDateRange} />
          <div className="flex gap-2 ml-auto">
            <Btn variant="ghost" size="sm" onClick={() => setDateRange({ from: addDays(todayISO(), -30), to: todayISO() })}>Son 30 gün</Btn>
            <Btn variant="ghost" size="sm" onClick={() => setDateRange({ from: addDays(todayISO(), -90), to: todayISO() })}>Son 90 gün</Btn>
            <Btn variant="ghost" size="sm" onClick={() => setDateRange({ from: addDays(todayISO(), -365), to: todayISO() })}>Son 1 yıl</Btn>
            <Btn variant="ghost" size="sm" onClick={() => {
              const d = new Date();
              setDateRange({ from: `${d.getFullYear()}-01-01`, to: todayISO() });
            }}>Bu yıl</Btn>
            <Btn variant="secondary" size="sm" icon={FileDown} onClick={printSummary}>PDF</Btn>
            <Btn variant="primary" size="sm" icon={FileDown} onClick={exportFullReport}>Excel'e Tüm Rapor</Btn>
          </div>
        </div>
      </Card>

      {/* Özet KPI'lar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={FileText} label="Sipariş Sayısı" value={stats.orderCount} sub={`${stats.customerCount} müşteri`} accent={TOKENS.navy} />
        <KPICard icon={DollarSign} label="Toplam Sipariş Cirosu" value={fmtMoney(stats.orderTotalUSD, "USD", { compact: true })} sub="USD bazında" accent={TOKENS.gold} />
        <KPICard icon={Ship} label="Sevkiyat Cirosu" value={fmtMoney(stats.shippedTotalUSD, "USD", { compact: true })} sub={`${stats.shippedCount} sevk edildi`} accent={TOKENS.copper} />
        <KPICard icon={CheckCircle2} label="Tahsil Edilen" value={fmtMoney(stats.paidTotalUSD, "USD", { compact: true })} sub={`${stats.paidCount} ödeme`} accent={TOKENS.forest} />
      </div>

      {/* En aktif müşteriler tablosu */}
      <Card title="Dönemin En Aktif Müşterileri" subtitle={`${dateRange.from} → ${dateRange.to}`} noPadding>
        {filteredOrders.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: TOKENS.muted }}>Bu tarih aralığında sipariş yok</div>
        ) : (
          <DataTable
            columns={[
              { key: "name", label: "Müşteri", render: (r) => <span className="font-bold">{r.name}</span> },
              { key: "country", label: "Ülke" },
              { key: "count", label: "Sipariş", align: "right" },
              { key: "shipped", label: "Sevk Edilmiş", align: "right" },
              { key: "total", label: "Toplam Ciro (USD)", align: "right", render: (r) => fmtMoney(r.total, "USD", { compact: true }) },
              { key: "paid", label: "Tahsil Edilen (USD)", align: "right", render: (r) => fmtMoney(r.paid, "USD", { compact: true }) },
            ]}
            rows={(() => {
              const map = {};
              filteredOrders.forEach((o) => {
                const c = customers.find((x) => x.id === o.customerId);
                const key = c?.id || "—";
                if (!map[key]) map[key] = { id: key, name: c?.name || "—", country: c?.country || "—", count: 0, total: 0, shipped: 0, paid: 0 };
                map[key].count++;
                map[key].total += orderTotalUSD(o, rates);
                if (o.actualShipmentDate || ["shipped", "delivered", "completed"].includes(o.status)) {
                  map[key].shipped++;
                }
              });
              filteredPayments.forEach((p) => {
                const o = orders.find((x) => x.id === p.orderId);
                if (!o) return;
                const c = customers.find((x) => x.id === o.customerId);
                const key = c?.id || "—";
                if (map[key]) map[key].paid += toUSD(p.amount, p.currency, rates);
              });
              return Object.values(map).sort((a, b) => b.total - a.total);
            })()}
            emptyText="Veri yok"
          />
        )}
      </Card>
    </div>
  );
}

// SEVKİYAT RAPORU — sevk edilen tarihe göre ciro
function ShipmentReport({ orders = [], customers = [], rates = {} }) {
  const [dateRange, setDateRange] = useState({
    from: addDays(todayISO(), -90),
    to: todayISO(),
  });

  // Sadece sevk edilmiş siparişler (actualShipmentDate var olan)
  const shippedOrders = useMemo(() => {
    return orders.filter((o) => {
      const shipDate = o.actualShipmentDate;
      if (!shipDate) return false;
      if (dateRange.from && shipDate < dateRange.from) return false;
      if (dateRange.to && shipDate > dateRange.to) return false;
      return true;
    });
  }, [orders, dateRange]);

  // Aylık sevkiyat dağılımı
  const monthlyShipment = useMemo(() => {
    const buckets = {};
    shippedOrders.forEach((o) => {
      const d = new Date(o.actualShipmentDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!buckets[key]) buckets[key] = { month: key, label: d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" }), value: 0, count: 0 };
      buckets[key].value += orderTotalUSD(o, rates);
      buckets[key].count++;
    });
    return Object.values(buckets).sort((a, b) => a.month.localeCompare(b.month));
  }, [shippedOrders, rates]);

  const stats = useMemo(() => ({
    count: shippedOrders.length,
    totalUSD: shippedOrders.reduce((s, o) => s + orderTotalUSD(o, rates), 0),
    customers: new Set(shippedOrders.map((o) => o.customerId)).size,
    avgUSD: shippedOrders.length > 0 ? shippedOrders.reduce((s, o) => s + orderTotalUSD(o, rates), 0) / shippedOrders.length : 0,
  }), [shippedOrders, rates]);

  const exportShipment = () => {
    if (!shippedOrders.length) return;
    const rows = shippedOrders.map((o) => {
      const c = customers.find((x) => x.id === o.customerId);
      return {
        "Sevk Tarihi": o.actualShipmentDate,
        "Sipariş No": o.orderNumber,
        "Müşteri": c?.name || "—",
        "Ülke": c?.country || "",
        "Sipariş Tarihi": o.orderDate || "",
        "Para Birimi": o.currency,
        "Tutar": orderTotal(o),
        "Tutar (USD)": orderTotalUSD(o, rates).toFixed(2),
        "Incoterms": o.incoterms || "",
        "Konşimento": o.billOfLading || "",
        "Fatura No": o.invoiceNumber || "",
      };
    });
    exportToExcel(rows, `sevkiyat_cirosu_${dateRange.from}_${dateRange.to}.xlsx`, "Sevkiyat");
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="text-sm font-bold flex-shrink-0" style={{ color: TOKENS.ink }}>Fiili Sevk Tarihi:</div>
          <DateRange from={dateRange.from} to={dateRange.to} onChange={setDateRange} />
          <div className="flex gap-2 ml-auto">
            <Btn variant="ghost" size="sm" onClick={() => setDateRange({ from: addDays(todayISO(), -30), to: todayISO() })}>Son 30 gün</Btn>
            <Btn variant="ghost" size="sm" onClick={() => setDateRange({ from: addDays(todayISO(), -90), to: todayISO() })}>Son 90 gün</Btn>
            <Btn variant="ghost" size="sm" onClick={() => setDateRange({ from: addDays(todayISO(), -365), to: todayISO() })}>Son 1 yıl</Btn>
            <Btn variant="ghost" size="sm" onClick={() => {
              const d = new Date();
              setDateRange({ from: `${d.getFullYear()}-01-01`, to: todayISO() });
            }}>Bu yıl</Btn>
            <Btn variant="primary" size="sm" icon={FileDown} onClick={exportShipment}>Excel</Btn>
          </div>
        </div>
        <p className="text-[11px] mt-3" style={{ color: TOKENS.muted }}>
          ℹ️ Bu rapor <strong>fiili sevkiyat tarihi</strong> girilmiş siparişleri gösterir. Sipariş kaydında "Fiili Sevk" alanını dolduran kayıtlar listelenir.
        </p>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Ship} label="Sevk Edilen Sipariş" value={stats.count} sub={`${stats.customers} müşteri`} accent={TOKENS.copper} />
        <KPICard icon={DollarSign} label="Toplam Sevkiyat Cirosu" value={fmtMoney(stats.totalUSD, "USD", { compact: true })} sub="USD bazında" accent={TOKENS.gold} />
        <KPICard icon={TrendingUp} label="Ortalama Sipariş" value={fmtMoney(stats.avgUSD, "USD", { compact: true })} sub="USD bazında" accent={TOKENS.navy} />
        <KPICard icon={Calendar} label="Dönem Uzunluğu" value={`${daysBetween(dateRange.from, dateRange.to)} gün`} sub={`${dateRange.from} → ${dateRange.to}`} accent={TOKENS.forest} />
      </div>

      {monthlyShipment.length > 0 && (
        <Card title="Aylık Sevkiyat Cirosu" subtitle="Fiili sevk tarihine göre · USD">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyShipment} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="shipGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TOKENS.copper} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={TOKENS.gold} stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke={TOKENS.border} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: TOKENS.ink, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: TOKENS.muted, fontWeight: 500 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={{ fontSize: 13, borderRadius: 8, fontWeight: 600 }} />
              <Bar dataKey="value" fill="url(#shipGrad)" radius={[6, 6, 0, 0]} name="Ciro" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card title="Sevk Edilen Siparişler" subtitle={`${shippedOrders.length} kayıt`} noPadding>
        {shippedOrders.length === 0 ? (
          <div className="p-12 text-center text-sm" style={{ color: TOKENS.muted }}>
            Bu tarih aralığında fiili sevkiyatı girilmiş sipariş yok.<br/>
            <span className="text-xs">Sipariş kaydında "Fiili Sevk" alanını doldurarak sevk tarihi atayabilirsin.</span>
          </div>
        ) : (
          <DataTable
            columns={[
              { key: "actualShipmentDate", label: "Sevk Tarihi", render: (r) => <span className="font-bold">{fmtDate(r.actualShipmentDate)}</span> },
              { key: "orderNumber", label: "Sipariş No", render: (r) => <span className="font-mono font-bold" style={{ color: TOKENS.navy }}>{r.orderNumber}</span> },
              { key: "customer", label: "Müşteri", sortValue: (r) => customers.find((c) => c.id === r.customerId)?.name || "", render: (r) => {
                const c = customers.find((x) => x.id === r.customerId);
                return (
                  <div>
                    <div className="font-medium">{c?.name || "—"}</div>
                    <div className="text-[11px]" style={{ color: TOKENS.muted }}>{c?.country || ""}</div>
                  </div>
                );
              }},
              { key: "incoterms", label: "Incoterms", render: (r) => r.incoterms ? <Badge color="navy">{r.incoterms}</Badge> : "—" },
              { key: "currency", label: "Pb." },
              { key: "total", label: "Tutar", align: "right", sortValue: (r) => orderTotal(r), render: (r) => <span className="font-bold tabular-nums">{fmtMoney(orderTotal(r), r.currency)}</span> },
              { key: "totalUSD", label: "USD", align: "right", sortValue: (r) => toUSD(orderTotal(r), r.currency, rates), render: (r) => <span className="tabular-nums" style={{ color: TOKENS.muted }}>{fmtMoney(toUSD(orderTotal(r), r.currency, rates), "USD", { compact: true })}</span> },
              { key: "billOfLading", label: "Konşimento", render: (r) => r.billOfLading ? <span className="font-mono text-xs">{r.billOfLading}</span> : "—" },
            ]}
            rows={shippedOrders}
            keyField="id"
            defaultSort={{ key: "actualShipmentDate", dir: "desc" }}
            emptyText="Veri yok"
          />
        )}
      </Card>
    </div>
  );
}

function CustomerReport({ orders = [], customers = [], payments = [], rates = {} }) {
  const data = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const c = customers.find((x) => x.id === o.customerId);
      const key = c?.name || "—";
      if (!map[key]) map[key] = { name: key, country: c?.country, count: 0, total: 0, paid: 0 };
      map[key].count++;
      map[key].total += orderTotalUSD(o, rates);
    });
    payments.filter((p) => p.status === "paid").forEach((p) => {
      const o = orders.find((x) => x.id === p.orderId);
      const c = customers.find((x) => x.id === o?.customerId);
      const key = c?.name || "—";
      if (map[key]) map[key].paid += toUSD(p.amount, p.currency, rates);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [orders, customers, payments, rates]);

  return (
    <Card title="Müşteri Performansı" subtitle="Ciro ve tahsilat oranı" noPadding>
      <DataTable
        columns={[
          { key: "name", label: "Müşteri", render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "country", label: "Ülke" },
          { key: "count", label: "Sipariş", align: "right" },
          { key: "total", label: "Toplam Ciro", align: "right", render: (r) => fmtMoney(r.total, "USD", { compact: true }) },
          { key: "paid", label: "Tahsil Edilen", align: "right", render: (r) => fmtMoney(r.paid, "USD", { compact: true }) },
          { key: "rate", label: "Tahsilat %", align: "right", sortValue: (r) => r.total ? r.paid / r.total : 0, render: (r) => {
            const pct = r.total > 0 ? Math.round((r.paid / r.total) * 100) : 0;
            const color = pct >= 90 ? TOKENS.forest : pct >= 60 ? TOKENS.gold : TOKENS.oxblood;
            return <span style={{ color }} className="font-semibold">%{pct}</span>;
          }},
        ]}
        rows={data.map((r, i) => ({ ...r, _idx: i }))}
        emptyText="Veri yok"
      />
    </Card>
  );
}

function ProductReport({ orders = [], products = [], rates = {} }) {
  const data = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      (o.items || []).forEach((i) => {
        const key = i.productCode || "—";
        if (!map[key]) map[key] = { code: key, name: i.nameTr || i.nameEn || "—", qty: 0, count: 0, total: 0 };
        map[key].count++;
        map[key].qty += Number(i.quantity) || 0;
        map[key].total += toUSD((Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), o.currency, rates);
      });
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [orders, rates]);

  return (
    <Card title="Ürün Performansı" subtitle="Adet ve ciro bazında" noPadding>
      <DataTable
        columns={[
          { key: "code", label: "Ürün Kodu", render: (r) => <span className="font-mono font-semibold" style={{ color: TOKENS.navy }}>{r.code}</span> },
          { key: "name", label: "İsim" },
          { key: "count", label: "Sipariş", align: "right" },
          { key: "qty", label: "Toplam Adet", align: "right", render: (r) => fmtNum(r.qty) },
          { key: "total", label: "Ciro (USD)", align: "right", render: (r) => fmtMoney(r.total, "USD", { compact: true }) },
        ]}
        rows={data}
        keyField="code"
        emptyText="Veri yok"
      />
    </Card>
  );
}

function CountryReport({ orders = [], customers = [], rates = {} }) {
  const data = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const c = customers.find((x) => x.id === o.customerId);
      const key = c?.country || "—";
      if (!map[key]) map[key] = { country: key, count: 0, customers: new Set(), total: 0 };
      map[key].count++;
      map[key].customers.add(o.customerId);
      map[key].total += orderTotalUSD(o, rates);
    });
    return Object.values(map).map((r) => ({ ...r, customerCount: r.customers.size })).sort((a, b) => b.total - a.total);
  }, [orders, customers, rates]);

  return (
    <Card title="Ülke Bazlı" subtitle="İhracat dağılımı" noPadding>
      <DataTable
        columns={[
          { key: "country", label: "Ülke", render: (r) => <span className="font-medium">📍 {r.country}</span> },
          { key: "customerCount", label: "Müşteri", align: "right" },
          { key: "count", label: "Sipariş", align: "right" },
          { key: "total", label: "Ciro (USD)", align: "right", render: (r) => fmtMoney(r.total, "USD", { compact: true }) },
        ]}
        rows={data}
        keyField="country"
        emptyText="Veri yok"
      />
    </Card>
  );
}

function MethodReport({ payments = [], rates = {} }) {
  const data = useMemo(() => {
    const map = {};
    payments.filter((p) => p.status !== "cancelled").forEach((p) => {
      const key = p.method;
      if (!map[key]) map[key] = { method: key, label: PAYMENT_METHODS.find((x) => x.key === key)?.label || key, count: 0, paid: 0, pending: 0 };
      map[key].count++;
      const usd = toUSD(p.amount, p.currency, rates);
      if (p.status === "paid") map[key].paid += usd;
      else map[key].pending += usd;
    });
    return Object.values(map).sort((a, b) => (b.paid + b.pending) - (a.paid + a.pending));
  }, [payments, rates]);

  return (
    <Card title="Ödeme Yöntemi Analizi" subtitle="Yöntem bazında tahsilat ve bekleyen" noPadding>
      <DataTable
        columns={[
          { key: "label", label: "Yöntem" },
          { key: "count", label: "Kayıt", align: "right" },
          { key: "paid", label: "Tahsil Edilen", align: "right", render: (r) => fmtMoney(r.paid, "USD", { compact: true }) },
          { key: "pending", label: "Bekleyen", align: "right", render: (r) => fmtMoney(r.pending, "USD", { compact: true }) },
          { key: "total", label: "Toplam", align: "right", sortValue: (r) => r.paid + r.pending, render: (r) => <strong>{fmtMoney(r.paid + r.pending, "USD", { compact: true })}</strong> },
        ]}
        rows={data}
        keyField="method"
        emptyText="Veri yok"
      />
    </Card>
  );
}

function StatusReport({ orders = [], rates = {} }) {
  const data = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const key = o.status;
      if (!map[key]) map[key] = { status: key, label: ORDER_STATUSES.find((x) => x.key === key)?.label || key, count: 0, total: 0 };
      map[key].count++;
      map[key].total += orderTotalUSD(o, rates);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [orders, rates]);

  return (
    <Card title="Sipariş Durumu" subtitle="Aşamalara göre dağılım" noPadding>
      <DataTable
        columns={[
          { key: "label", label: "Durum", render: (r) => { const s = ORDER_STATUSES.find((x) => x.key === r.status); return <Badge color={s?.color} dot>{s?.label}</Badge>; } },
          { key: "count", label: "Sipariş Sayısı", align: "right" },
          { key: "total", label: "Toplam Hacim (USD)", align: "right", render: (r) => fmtMoney(r.total, "USD", { compact: true }) },
        ]}
        rows={data}
        keyField="status"
        emptyText="Veri yok"
      />
    </Card>
  );
}

// ============================================================================
// AYARLAR — kur, demo, yedek, Supabase
// ============================================================================

function SettingsView({ customers, setCustomers, products, setProducts, bankAccounts, setBankAccounts, orders, setOrders, payments, setPayments, rates, setRates, users, setUsers, currentUser, isAdmin, canEdit, setView, showToast, t = (k) => k, lang = "tr", setLang }) {
  const fileRef = useRef(null);

  // Demo veriler — tüm modüller dolu görünsün
  const loadDemo = () => {
    if (!confirm("Mevcut veriler silinip demo verilerle değiştirilecek. Devam edilsin mi?")) return;

    const demoCustomers = [
      { id: uid(), code: "MST-001", name: "Hamburg Stein GmbH", contactPerson: "Klaus Weber", email: "k.weber@hamburg-stein.de", phone: "+49 40 1234567", country: "Almanya", address: "Hafenstraße 12, 20457 Hamburg", taxNumber: "DE123456789", defaultCurrency: "EUR", defaultPaymentTerms: 60, creditLimit: 75000, preferredIncoterm: "CIF", notes: "Düzenli müşteri, ödeme geçmişi temiz", createdAt: todayISO() },
      { id: uid(), code: "MST-002", name: "Lyon Textile Import SARL", contactPerson: "Marie Dubois", email: "m.dubois@lyon-textile.fr", phone: "+33 4 78 12 34 56", country: "Fransa", address: "12 Rue de la Soie, 69001 Lyon", taxNumber: "FR12345678901", defaultCurrency: "EUR", defaultPaymentTerms: 45, creditLimit: 50000, preferredIncoterm: "FOB", notes: "Mevsimsel siparişler", createdAt: todayISO() },
      { id: uid(), code: "MST-003", name: "Dubai Trading LLC", contactPerson: "Ahmed Al-Rashid", email: "ahmed@dubaitrading.ae", phone: "+971 4 123 4567", country: "BAE", address: "Al Wasl Road, Dubai", taxNumber: "AE123456789", defaultCurrency: "USD", defaultPaymentTerms: 30, creditLimit: 100000, preferredIncoterm: "FOB", notes: "Hızlı ödeme", createdAt: todayISO() },
      { id: uid(), code: "MST-004", name: "Milano Marble Co.", contactPerson: "Giuseppe Rossi", email: "g.rossi@milanomarble.it", phone: "+39 02 1234567", country: "İtalya", address: "Via Brera 28, 20121 Milano", taxNumber: "IT12345678901", defaultCurrency: "EUR", defaultPaymentTerms: 90, creditLimit: 120000, preferredIncoterm: "CIF", notes: "Akreditifli çalışır", createdAt: todayISO() },
    ];

    const demoProducts = [
      { id: uid(), productCode: "MRM-001", manufacturingCode: "DNZ-A1", nameTr: "Beyaz Mermer Plaka 60x60", nameEn: "White Marble Slab 60x60", category: "Mermer", unit: "m²", defaultPrice: 45, defaultCurrency: "USD", notes: "", createdAt: todayISO() },
      { id: uid(), productCode: "MRM-002", manufacturingCode: "DNZ-A2", nameTr: "Travertin Açık 40x40", nameEn: "Travertine Light 40x40", category: "Mermer", unit: "m²", defaultPrice: 32, defaultCurrency: "USD", notes: "", createdAt: todayISO() },
      { id: uid(), productCode: "TKS-001", manufacturingCode: "DNZ-T1", nameTr: "Pamuk Bornoz 500g", nameEn: "Cotton Bathrobe 500g", category: "Tekstil", unit: "adet", defaultPrice: 18.5, defaultCurrency: "USD", notes: "", createdAt: todayISO() },
      { id: uid(), productCode: "TKS-002", manufacturingCode: "DNZ-T2", nameTr: "Havlu Seti 4'lü", nameEn: "Towel Set 4-pack", category: "Tekstil", unit: "paket", defaultPrice: 24, defaultCurrency: "USD", notes: "", createdAt: todayISO() },
      { id: uid(), productCode: "GIDA-001", manufacturingCode: "DNZ-G1", nameTr: "Sızma Zeytinyağı 5L", nameEn: "Extra Virgin Olive Oil 5L", category: "Gıda", unit: "adet", defaultPrice: 38, defaultCurrency: "USD", notes: "", createdAt: todayISO() },
    ];

    const demoBanks = [
      { id: uid(), name: "Garanti USD", bankName: "Garanti BBVA", currency: "USD", iban: "TR00 0006 2000 0000 0000 0000 01", swift: "TGBATRIS", accountNumber: "1234567", branch: "Denizli Şubesi", notes: "Ana USD hesabı", createdAt: todayISO() },
      { id: uid(), name: "İş Bankası EUR", bankName: "İş Bankası", currency: "EUR", iban: "TR00 0006 4000 0000 0000 0000 02", swift: "ISBKTRIS", accountNumber: "7654321", branch: "Denizli Şubesi", notes: "EUR tahsilatları", createdAt: todayISO() },
      { id: uid(), name: "Akbank TRY", bankName: "Akbank", currency: "TRY", iban: "TR00 0004 6000 0000 0000 0000 03", swift: "AKBKTRIS", accountNumber: "9876543", branch: "Denizli Şubesi", notes: "Yerel ödemeler", createdAt: todayISO() },
    ];

    // Demo siparişler — farklı durumlar, ödeme planları
    const today = new Date();
    const dateOff = (days) => { const d = new Date(today); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };

    const o1 = {
      id: uid(), orderNumber: `SP-${today.getFullYear()}-0001`, customerId: demoCustomers[0].id,
      orderDate: dateOff(-45), shipmentDate: dateOff(-15), actualShipmentDate: dateOff(-15),
      currency: "EUR", status: "delivered", incoterms: "CIF", shippingMethod: "sea",
      portOfLoading: "Mersin", portOfDischarge: "Hamburg",
      invoiceNumber: "FT-2024-001", billOfLading: "BL-HMB-7821",
      items: [
        { id: uid(), productId: demoProducts[0].id, productCode: "MRM-001", manufacturingCode: "DNZ-A1", nameTr: "Beyaz Mermer Plaka 60x60", nameEn: "White Marble Slab 60x60", unit: "m²", quantity: 350, unitPrice: 42 },
        { id: uid(), productId: demoProducts[1].id, productCode: "MRM-002", manufacturingCode: "DNZ-A2", nameTr: "Travertin Açık 40x40", nameEn: "Travertine Light 40x40", unit: "m²", quantity: 200, unitPrice: 30 },
      ],
      paymentPlan: [
        { id: uid(), type: "prepayment", percentage: 30, amount: 6300, method: "bank_transfer", dueDate: dateOff(-45), notes: "Sipariş onayı" },
        { id: uid(), type: "preShipment", percentage: 40, amount: 8400, method: "bank_transfer", dueDate: dateOff(-20), notes: "Sevk öncesi" },
        { id: uid(), type: "deferred", percentage: 30, amount: 6300, method: "bank_transfer", dueDate: dateOff(45), notes: "60 gün vade" },
      ],
      notes: "İlk sipariş; ek 100 m² talep edebilirler", createdAt: dateOff(-45),
    };

    const o2 = {
      id: uid(), orderNumber: `SP-${today.getFullYear()}-0002`, customerId: demoCustomers[2].id,
      orderDate: dateOff(-20), shipmentDate: dateOff(5), actualShipmentDate: "",
      currency: "USD", status: "production", incoterms: "FOB", shippingMethod: "sea",
      portOfLoading: "Mersin", portOfDischarge: "Jebel Ali",
      invoiceNumber: "", billOfLading: "",
      items: [
        { id: uid(), productId: demoProducts[2].id, productCode: "TKS-001", manufacturingCode: "DNZ-T1", nameTr: "Pamuk Bornoz 500g", nameEn: "Cotton Bathrobe 500g", unit: "adet", quantity: 1500, unitPrice: 17 },
        { id: uid(), productId: demoProducts[3].id, productCode: "TKS-002", manufacturingCode: "DNZ-T2", nameTr: "Havlu Seti 4'lü", nameEn: "Towel Set 4-pack", unit: "paket", quantity: 800, unitPrice: 22 },
      ],
      paymentPlan: [
        { id: uid(), type: "prepayment", percentage: 50, amount: 21550, method: "bank_transfer", dueDate: dateOff(-20), notes: "Ön ödeme" },
        { id: uid(), type: "preShipment", percentage: 50, amount: 21550, method: "bank_transfer", dueDate: dateOff(2), notes: "Sevk öncesi" },
      ],
      notes: "", createdAt: dateOff(-20),
    };

    const o3 = {
      id: uid(), orderNumber: `SP-${today.getFullYear()}-0003`, customerId: demoCustomers[3].id,
      orderDate: dateOff(-60), shipmentDate: dateOff(-30), actualShipmentDate: dateOff(-30),
      currency: "EUR", status: "shipped", incoterms: "CIF", shippingMethod: "sea",
      portOfLoading: "Mersin", portOfDischarge: "Genoa",
      invoiceNumber: "FT-2024-003", billOfLading: "BL-GEN-4421",
      items: [
        { id: uid(), productId: demoProducts[0].id, productCode: "MRM-001", manufacturingCode: "DNZ-A1", nameTr: "Beyaz Mermer Plaka 60x60", nameEn: "White Marble Slab 60x60", unit: "m²", quantity: 800, unitPrice: 44 },
      ],
      paymentPlan: [
        { id: uid(), type: "preShipment", percentage: 100, amount: 35200, method: "letter_of_credit", dueDate: dateOff(-32), notes: "L/C 90 gün" },
      ],
      notes: "Akreditifli işlem · evraklar bankaya teslim edildi", createdAt: dateOff(-60),
    };

    const o4 = {
      id: uid(), orderNumber: `SP-${today.getFullYear()}-0004`, customerId: demoCustomers[1].id,
      orderDate: dateOff(-10), shipmentDate: dateOff(20), actualShipmentDate: "",
      currency: "EUR", status: "confirmed", incoterms: "FOB", shippingMethod: "road",
      portOfLoading: "İstanbul", portOfDischarge: "Lyon",
      invoiceNumber: "", billOfLading: "",
      items: [
        { id: uid(), productId: demoProducts[2].id, productCode: "TKS-001", manufacturingCode: "DNZ-T1", nameTr: "Pamuk Bornoz 500g", nameEn: "Cotton Bathrobe 500g", unit: "adet", quantity: 600, unitPrice: 16 },
      ],
      paymentPlan: [
        { id: uid(), type: "prepayment", percentage: 30, amount: 2880, method: "bank_transfer", dueDate: dateOff(-10), notes: "" },
        { id: uid(), type: "preShipment", percentage: 70, amount: 6720, method: "bank_transfer", dueDate: dateOff(18), notes: "" },
      ],
      notes: "", createdAt: dateOff(-10),
    };

    const demoOrders = [o1, o2, o3, o4];

    // Plan kalemlerinden ödeme kayıtları üret
    const demoPayments = [];
    demoOrders.forEach((o) => {
      o.paymentPlan.forEach((p) => {
        // o1: tüm ödemeler tahsil; o2: sadece ön ödeme tahsil; o3: tahsil edilmemiş;
        // o4: ön ödeme tahsil
        let status = "pending", paidDate = "", bankAccountId = "", referenceNumber = "";
        if (o === o1) {
          if (p.type === "prepayment" || p.type === "preShipment") { status = "paid"; paidDate = p.dueDate; bankAccountId = demoBanks[1].id; referenceNumber = "SWIFT-" + Math.floor(Math.random() * 100000); }
        } else if (o === o2) {
          if (p.type === "prepayment") { status = "paid"; paidDate = p.dueDate; bankAccountId = demoBanks[0].id; referenceNumber = "SWIFT-" + Math.floor(Math.random() * 100000); }
        } else if (o === o4) {
          if (p.type === "prepayment") { status = "paid"; paidDate = p.dueDate; bankAccountId = demoBanks[1].id; referenceNumber = "SWIFT-" + Math.floor(Math.random() * 100000); }
        }
        demoPayments.push({
          id: uid(), orderId: o.id, planItemId: p.id,
          type: p.type, method: p.method, amount: p.amount, currency: o.currency,
          dueDate: p.dueDate, paidDate, status, bankAccountId, referenceNumber,
          notes: p.notes, createdAt: o.createdAt,
        });
      });
    });

    setCustomers(demoCustomers);
    setProducts(demoProducts);
    setBankAccounts(demoBanks);
    setOrders(demoOrders);
    setPayments(demoPayments);
    showToast("Demo veriler yüklendi", "success");
  };

  const wipeAll = () => {
    if (!confirm("TÜM veriler silinecek. Bu işlem geri alınamaz. Emin misin?")) return;
    if (!confirm("Son onay: gerçekten tüm müşteri, ürün, sipariş ve ödeme verileri silinsin mi?")) return;
    setCustomers([]); setProducts([]); setBankAccounts([]); setOrders([]); setPayments([]);
    showToast("Tüm veriler silindi", "success");
  };

  const fullBackup = () => {
    const data = { customers, products, bankAccounts, orders, payments, rates, exportedAt: new Date().toISOString(), version: "2.0" };
    downloadBlob(JSON.stringify(data, null, 2), `exportflow_yedek_${todayISO()}.json`, "application/json");
    showToast("Yedek alındı", "success");
  };

  const restoreBackup = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!confirm(`Yedek dosyasında: ${data.customers?.length || 0} müşteri, ${data.products?.length || 0} ürün, ${data.orders?.length || 0} sipariş, ${data.payments?.length || 0} ödeme. Mevcut veriler ile DEĞİŞTİRİLECEK. Devam?`)) return;
        if (data.customers) setCustomers(data.customers);
        if (data.products) setProducts(data.products);
        if (data.bankAccounts) setBankAccounts(data.bankAccounts);
        if (data.orders) setOrders(data.orders);
        if (data.payments) setPayments(data.payments);
        if (data.rates) setRates(data.rates);
        showToast("Yedek geri yüklendi", "success");
      } catch (err) { showToast("Yedek dosyası okunamadı: " + err.message, "error"); }
    };
    r.readAsText(file);
  };

  return (
    <div>
      <PageHeader title={t("settings")} subtitle="Kurlar, demo veri, yedekleme ve paylaşımlı veritabanı" />

      <div className="p-8 space-y-4 max-w-4xl">
        {/* Hızlı eylemler */}
        <Card title="Hızlı Eylemler">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {canEdit ? (
              <>
                <Btn variant="accent" icon={Sparkles} onClick={loadDemo}>Demo Yükle</Btn>
                <Btn variant="secondary" icon={FileDown} onClick={fullBackup}>Tam Yedek Al</Btn>
                <input ref={fileRef} type="file" accept=".json" onChange={(e) => { restoreBackup(e.target.files[0]); e.target.value = ""; }} className="hidden" />
                <Btn variant="secondary" icon={FileUp} onClick={() => fileRef.current?.click()}>Yedekten Yükle</Btn>
                <Btn variant="danger" icon={Trash2} onClick={wipeAll}>Tüm Veriyi Sil</Btn>
              </>
            ) : (
              <>
                <Btn variant="secondary" icon={FileDown} onClick={fullBackup}>Tam Yedek Al</Btn>
                <div className="col-span-3 flex items-center px-3 py-2 rounded-md text-xs font-semibold" style={{ background: TOKENS.cream, color: TOKENS.muted, border: `1px solid ${TOKENS.border}` }}>
                  🔒 Veri değiştirme işlemleri için giriş yapmanız gerekiyor.
                </div>
              </>
            )}
          </div>
          <p className="text-xs mt-3" style={{ color: TOKENS.muted }}>
            <strong>Demo Yükle:</strong> 4 müşteri, 5 ürün, 3 banka, 4 sipariş ve ilgili ödeme planlarıyla sistemi anında dolu görmek için.<br />
            <strong>Yedek:</strong> Tüm verini tek bir JSON dosyasında saklar; başka bir tarayıcıda açıp geri yükleyebilirsin.
          </p>
        </Card>

        {/* Kurlar */}
        <Card title="Döviz Kurları" subtitle="USD bazında · Raporlarda ve nakit akışında kullanılır"
          action={
            <Btn variant="accent" size="sm" icon={RefreshCw} onClick={async () => {
              showToast("TCMB'den kurlar çekiliyor...", "info");
              try {
                const r = await fetch("/api/tcmb");
                if (!r.ok) {
                  const err = await r.json().catch(() => ({}));
                  showToast("Hata: " + (err.error || `HTTP ${r.status}`), "error");
                  return;
                }
                const data = await r.json();
                const newRates = { ...rates };
                Object.entries(data).forEach(([k, v]) => {
                  if (k.startsWith("_")) return;
                  if (typeof v === "number") newRates[k] = v;
                });
                newRates._lastUpdate = data._date || todayISO();
                newRates._source = "TCMB";
                setRates(newRates);
                showToast(`Kurlar TCMB'den güncellendi (${data._date || "bugün"})`, "success");
              } catch (e) {
                showToast("TCMB'ye ulaşılamadı: " + e.message, "error");
              }
            }}>TCMB'den Güncelle</Btn>
          }
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {CURRENCIES.filter((c) => c !== "USD").map((c) => (
              <div key={c}>
                <Label>{c}/USD</Label>
                <Input type="number" step="0.0001" value={rates[c] || 0} onChange={(e) => canEdit && setRates({ ...rates, [c]: parseFloat(e.target.value) || 0 })} readOnly={!canEdit} style={{ opacity: canEdit ? 1 : 0.7, cursor: canEdit ? "auto" : "not-allowed" }} />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px]" style={{ color: TOKENS.muted }}>
            <p>
              Örn: 1 EUR = 1.08 USD ise EUR/USD: 1.08. Ödeme tahsil ederken o günkü kur kayıt edilir.
            </p>
            {rates._lastUpdate && (
              <Badge color="forest" dot>
                {rates._source === "TCMB" ? "TCMB" : "Manuel"} · {fmtDate(rates._lastUpdate)}
              </Badge>
            )}
          </div>
        </Card>

        {/* Banka Hesapları erişim kartı */}
        <Card title="Banka Hesapları" subtitle="Tahsilat yaparken seçilebilir · Opsiyonel"
          action={<Btn variant="secondary" size="sm" icon={Landmark} onClick={() => setView("bankAccounts")}>Banka Hesaplarını Yönet</Btn>}>
          <p className="text-xs" style={{ color: TOKENS.muted }}>
            Sistemde {bankAccounts.length} banka hesabı var. Banka hesabı zorunlu değil — tahsilat girerken opsiyonel olarak seçebilirsin.
          </p>
        </Card>

        {/* Supabase rehber */}
        <Card title="Paylaşımlı Veritabanı (Supabase)" subtitle="3-5 kişiyle aynı veriyi gerçek zamanlı paylaşmak için">
          <div className="text-sm space-y-3" style={{ color: TOKENS.ink }}>
            <p>
              Şu anda sistem <strong>{storage.label}</strong> modunda çalışıyor. Paylaşımlı veritabanına geçmek için aşağıdaki adımları takip et:
            </p>
            <ol className="list-decimal pl-5 space-y-2 text-xs">
              <li><strong>supabase.com</strong> → "Start your project" → ücretsiz hesap aç (e-posta veya GitHub ile)</li>
              <li>Yeni bir proje oluştur (örn: "export-flow"). Bölge olarak Frankfurt veya Londra seç (Türkiye'ye yakın). Veritabanı şifresi belirle, bir yere yaz.</li>
              <li>Proje hazır olunca sol menüden <strong>SQL Editor</strong> → "New query"</li>
              <li>Aşağıdaki SQL'i kopyala-yapıştır ve <strong>Run</strong>:
                <pre className="mt-2 p-2 rounded text-[10px] font-mono overflow-x-auto" style={{ background: TOKENS.ink, color: "#cbd5e1" }}>
{`create table data (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

alter table data enable row level security;

create policy "public access" on data
  for all using (true) with check (true);`}
                </pre>
              </li>
              <li>Sol menüden <strong>Project Settings → API</strong>'a git. İki şeyi kopyala:
                <ul className="list-disc pl-5 mt-1">
                  <li><strong>Project URL</strong> (örn: https://abcdefgh.supabase.co)</li>
                  <li><strong>anon / public</strong> anahtarı (uzun bir karakter dizisi)</li>
                </ul>
              </li>
              <li>Proje klasörünün kök dizininde <strong>.env</strong> adında bir dosya oluştur, içine şunu yaz (anahtarları kendi değerlerinle değiştir):
                <pre className="mt-2 p-2 rounded text-[10px] font-mono" style={{ background: TOKENS.ink, color: "#cbd5e1" }}>
{`VITE_SUPABASE_URL=https://senin-projen.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh...uzun-karakter-dizisi`}
                </pre>
              </li>
              <li><strong>Vercel'de:</strong> Project Settings → Environment Variables → aynı iki değişkeni ekle. Sonra Deployments sekmesinden son deploy'u "Redeploy" yap.</li>
              <li>Hepsi bu! Yeniden açtığında sol altta "Bulut · Paylaşımlı" yazısını göreceksin. Ekibin URL'i ile girdiğinde aynı veriyi görecek.</li>
            </ol>
            <div className="rounded-md p-3 mt-3 text-[11px]" style={{ background: TOKENS.gold + "15", border: `1px solid ${TOKENS.gold}40`, color: TOKENS.ink }}>
              <strong>💡 İpucu:</strong> Supabase ücretsiz planı ayda 500 MB veri, sınırsız okuma için yeterli — sizin gibi 3-5 kişilik bir ekip için fazlasıyla.
            </div>
            <div className="rounded-md p-3 text-[11px]" style={{ background: TOKENS.terracotta + "15", border: `1px solid ${TOKENS.terracotta}40`, color: TOKENS.ink }}>
              <strong>⚠️ Güvenlik:</strong> Yukarıdaki SQL "herkese açık" politika kullanıyor — yani projenizin URL'ini bilen herkes verilere erişebilir. URL'i sadece ekibinle paylaş. Kullanıcı şifresi/login eklemek istersen ileride Supabase Auth eklenebilir.
            </div>
          </div>
        </Card>

        {/* Kullanıcılar — Supabase Auth ile yönetilir */}
        <Card title="Kullanıcı Yönetimi" subtitle="Yeni kullanıcılar Supabase Dashboard üzerinden eklenir">
          <div className="space-y-3 text-sm" style={{ color: TOKENS.ink }}>
            <div className="p-3 rounded-md" style={{ background: TOKENS.gold + "12", border: `1px solid ${TOKENS.gold}40` }}>
              <strong>Mevcut oturum:</strong> {currentUser ? `${currentUser.name} (${currentUser.email}) — ${USER_ROLES.find((r) => r.key === currentUser.role)?.label || currentUser.role}` : "Misafir (sadece görüntüleme)"}
            </div>
            <p className="text-xs" style={{ color: TOKENS.muted }}>
              Kullanıcı eklemek/silmek için <strong>Supabase Dashboard</strong>'a gir → <strong>Authentication → Users</strong> sekmesine geç → "Add user" ile yeni kullanıcı oluştur. Email + şifre gir.
            </p>
            <div className="p-3 rounded-md text-xs" style={{ background: TOKENS.cream, border: `1px solid ${TOKENS.border}` }}>
              <div className="font-bold mb-1" style={{ color: TOKENS.ink }}>Roller (User Metadata'da tutulur):</div>
              <ul className="space-y-1 list-disc list-inside" style={{ color: TOKENS.muted }}>
                {USER_ROLES.map((r) => <li key={r.key}><strong style={{ color: TOKENS.ink }}>{r.label}:</strong> {r.desc}</li>)}
              </ul>
              <div className="mt-2 pt-2 text-[11px]" style={{ borderTop: `1px solid ${TOKENS.border}` }}>
                💡 Supabase'de kullanıcı eklerken <strong>"Auto Confirm User"</strong> seçeneğini işaretle, e-posta doğrulama beklemesin.<br/>
                💡 Rol atamak için kullanıcıya tıkla → <strong>Raw User Meta Data</strong> → <code>{`{"role": "admin"}`}</code> ekle.
              </div>
            </div>
            {SUPABASE_URL_AUTH && (
              <a href={`${SUPABASE_URL_AUTH.replace(".supabase.co", ".supabase.com").replace("https://", "https://supabase.com/dashboard/project/")}/auth/users`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-md"
                style={{ background: TOKENS.navy, color: "white", textDecoration: "none" }}>
                Supabase Dashboard'a Git <ArrowRight size={12} />
              </a>
            )}
          </div>
        </Card>

        {/* Veri özeti */}
        <Card title="Veri Özeti">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center">
            {[
              { label: "Müşteri", value: customers.length, icon: Users },
              { label: "Ürün", value: products.length, icon: Package },
              { label: "Banka", value: bankAccounts.length, icon: Landmark },
              { label: "Sipariş", value: orders.length, icon: FileText },
              { label: "Ödeme", value: payments.length, icon: CreditCard },
              { label: "Tahsil Edilen", value: payments.filter((p) => p.status === "paid").length, icon: CheckCircle2 },
            ].map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.label} className="rounded-md p-3" style={{ background: TOKENS.cream }}>
                  <Icon size={14} className="mx-auto mb-1" style={{ color: TOKENS.gold }} />
                  <div className="text-xl font-bold" style={{ color: TOKENS.ink, fontFamily: FONT_DISPLAY }}>{m.value}</div>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: TOKENS.muted }}>{m.label}</div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="text-center text-[11px] py-4" style={{ color: TOKENS.muted }}>
          İhracat Operasyonları · Yönetim Sistemi v2.2
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// KULLANICI YÖNETİMİ — sadece adminler için
