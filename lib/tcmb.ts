'use server';

/**
 * TCMB'den USD/TRY satış kurunu çeker.
 * TCMB günlük kuru today.xml olarak yayınlar; hafta sonu/tatilde en son iş günü
 * kuru geçerlidir. "Bir önceki gün" için dünden başlayıp geriye doğru ilk
 * yayınlanmış günü buluruz (TCMB tarihli arşiv: /kurlar/YYYYMM/DDMMYYYY.xml).
 *
 * Sonuç kısa süreli cache'lenmez; sipariş kaydı anında bir kez çağrılır ve
 * kilitlenir, sonrası veritabanındaki kilitli değerden okunur.
 */
export async function getTcmbUsdRate(): Promise<{ rate: number; date: string } | null> {
  const tryDates: Date[] = [];
  const base = new Date();
  // Dünden başlayıp 7 gün geriye kadar dene (tatil/hafta sonu için)
  for (let i = 1; i <= 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    tryDates.push(d);
  }

  for (const d of tryDates) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const url = `https://www.tcmb.gov.tr/kurlar/${yyyy}${mm}/${dd}${mm}${yyyy}.xml`;
    try {
      // Günlük revalidate: aynı gün içindeki tüm siparişler tek fetch'i paylaşır
      const res = await fetch(url, { next: { revalidate: 43200 } });
      if (!res.ok) continue;
      const xml = await res.text();
      // <Currency CurrencyCode="USD"> ... <ForexSelling>32,1234</ForexSelling>
      const usdBlock = xml.match(/<Currency[^>]*CurrencyCode="USD"[\s\S]*?<\/Currency>/);
      if (!usdBlock) continue;
      const selling = usdBlock[0].match(/<ForexSelling>([\d.,]+)<\/ForexSelling>/);
      if (!selling) continue;
      const rate = Number(selling[1].replace(',', '.'));
      if (!Number.isFinite(rate) || rate <= 0) continue;
      return { rate, date: `${yyyy}-${mm}-${dd}` };
    } catch {
      continue;
    }
  }
  return null;
}
