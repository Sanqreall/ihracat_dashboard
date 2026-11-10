export const CURRENCIES = ["USD", "EUR", "TRY", "GBP", "CHF", "JPY", "CNY", "RUB", "AED", "SAR"] as const;

export const INCOTERMS = [
  { key: "EXW", label: "EXW — İş Yerinde Teslim" },
  { key: "FCA", label: "FCA — Taşıyıcıya Teslim" },
  { key: "FOB", label: "FOB — Gemi Bordasında Teslim" },
  { key: "CFR", label: "CFR — Mal Bedeli + Navlun" },
  { key: "CIF", label: "CIF — Mal Bedeli + Sigorta + Navlun" },
  { key: "CPT", label: "CPT — Taşıma Ödenmiş" },
  { key: "CIP", label: "CIP — Taşıma + Sigorta Ödenmiş" },
  { key: "DAP", label: "DAP — Belirli Yerde Teslim" },
  { key: "DPU", label: "DPU — Boşaltılmış Teslim" },
  { key: "DDP", label: "DDP — Gümrüklü Teslim" },
];

export const SHIPPING_METHODS = [
  { key: "sea", label: "Deniz Yolu" },
  { key: "air", label: "Hava Yolu" },
  { key: "road", label: "Kara Yolu" },
  { key: "rail", label: "Demir Yolu" },
  { key: "multi", label: "Multimodal" },
];

export const ORDER_STATUSES = [
  { key: "draft", label: "Taslak", tone: "muted" },
  { key: "confirmed", label: "Onaylı", tone: "navy" },
  { key: "production", label: "Üretimde", tone: "copper" },
  { key: "ready", label: "Sevke Hazır", tone: "gold" },
  { key: "shipped", label: "Sevk Edildi", tone: "navy" },
  { key: "delivered", label: "Teslim Edildi", tone: "forest" },
  { key: "completed", label: "Tamamlandı", tone: "forest" },
  { key: "cancelled", label: "İptal", tone: "oxblood" },
] as const;

export const PAYMENT_METHODS = [
  { key: "bank_transfer", label: "Banka Havalesi / SWIFT" },
  { key: "letter_of_credit", label: "Akreditif (L/C)" },
  { key: "cad", label: "Vesaik Mukabili (CAD)" },
  { key: "cash", label: "Peşin" },
  { key: "open_account", label: "Açık Hesap" },
  { key: "check", label: "Çek" },
  { key: "credit_card", label: "Kredi Kartı" },
  { key: "consignment", label: "Konsinye" },
  { key: "other", label: "Diğer" },
];

export const PLAN_TYPES = [
  { key: "prepayment", label: "Ön Ödeme" },
  { key: "preShipment", label: "Sevk Öncesi" },
  { key: "deferred", label: "Vadeli" },
  { key: "vat", label: "KDV" },
  { key: "cost", label: "Ek Maliyet" },
  { key: "other", label: "Diğer" },
] as const;

export const PLAN_STATUSES: Record<string, { label: string; tone: Tone }> = {
  open: { label: "Bekliyor", tone: "copper" },
  partial: { label: "Kısmi", tone: "gold" },
  paid: { label: "Tahsil Edildi", tone: "forest" },
  overdue: { label: "Gecikmiş", tone: "oxblood" },
  cancelled: { label: "İptal", tone: "muted" },
};

export const ROLES = [
  { key: "admin", label: "Yönetici", desc: "Her şey + kullanıcı yönetimi + veri aktarımı" },
  { key: "editor", label: "Editör", desc: "Kayıt ekler, düzenler, siler" },
  { key: "viewer", label: "Görüntüleyici", desc: "Sadece görür" },
  { key: "pending", label: "Onay bekliyor", desc: "Hiçbir şey göremez" },
];

export const UNITS = ["adet", "takım", "set", "m²", "m³", "m", "kg", "ton", "koli", "palet"];

export type Tone = "muted" | "navy" | "copper" | "gold" | "forest" | "oxblood";

export const labelOf = (list: readonly { key: string; label: string }[], key?: string | null) =>
  list.find((x) => x.key === key)?.label ?? key ?? "—";

export const orderStatusTone = (key: string): Tone =>
  (ORDER_STATUSES.find((s) => s.key === key)?.tone as Tone) ?? "muted";
