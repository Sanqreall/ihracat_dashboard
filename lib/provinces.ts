/** Türkiye'nin 81 ili (plaka sırası). Sipariş teslimat ili seçimi ve rapor filtresi için. */
export const TURKEY_PROVINCES: string[] = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin',
  'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale',
  'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum',
  'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Isparta', 'Mersin',
  'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir', 'Kocaeli',
  'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş',
  'Nevşehir', 'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas',
  'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak', 'Van', 'Yozgat', 'Zonguldak',
  'Aksaray', 'Bayburt', 'Karaman', 'Kırıkkale', 'Batman', 'Şırnak', 'Bartın', 'Ardahan',
  'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce',
];

const norm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    // i/ı/İ/I hepsini tek forma indir (kullanıcı yazımına toleranslı)
    .replace(/[iıİI\u0130\u0131]/g, 'i')
    .replace(/i̇/g, 'i');

/** Serbest metni resmi il adına eşler (büyük/küçük, İ/ı toleranslı). Bulunamazsa null. */
export function normalizeProvince(input: string | null | undefined): string | null {
  if (!input) return null;
  const target = norm(String(input));
  return TURKEY_PROVINCES.find((p) => norm(p) === target) ?? null;
}
