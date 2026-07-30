'use server';

/**
 * TCMB'den USD/TRY satış kurunu çeker.
 *
 * TCMB günlük kuru tarihli arşivde yayınlar: /kurlar/YYYYMM/DDMMYYYY.xml
 * Hafta sonu/tatilde o güne ait dosya olmadığından, verilen tarihten (dahil)
 * geriye doğru ilk yayınlanmış iş gününü buluruz.
 *
 * @param forDate 'YYYY-MM-DD' — kurun isteneceği tarih (örn. siparişin tarihi).
 *                Verilmezse bugünden bir önceki günden başlanır (varsayılan).
 *
 * Not: Siparişin kuru, siparişin TARİHİNE göre alınır — bugün girilmiş olsa
 * bile bir hafta önceki bir sipariş, o haftanın kurunu alır. Kur kaydedildikten
 * sonra siparişte kilitlenir; sonraki okumalar veritabanındaki değerden yapılır.
 */
export async function getTcmbUsdRate(forDate?: string | null): Promise<{ rate: number; date: string } | null> {
  const tryDates: Date[] = [];

  if (forDate) {
    // Sipariş tarihinden başlayıp (o gün dahil) 10 gün geriye
    const base = new Date(`${forDate}T12:00:00`);
    if (!Number.isNaN(base.getTime())) {
      for (let i = 0; i <= 10; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() - i);
        tryDates.push(d);
      }
    }
  }

  if (!tryDates.length) {
    // Tarih verilmedi ya da geçersiz: dünden başlayıp 7 gün geriye (eski davranış)
    const base = new Date();
    for (let i = 1; i <= 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      tryDates.push(d);
    }
  }

  // Gelecekteki bir tarih istenirse (ör. ileri tarihli sipariş), o günün kuru
  // henüz yayınlanmamış olabilir; bu durumda döngü doğal olarak en son mevcut
  // güne kadar iner. Bugünden ileri tarihleri elemeye gerek yok, fetch başarısız
  // olursa bir önceki güne geçilir.
  for (const d of tryDates) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const url = `https://www.tcmb.gov.tr/kurlar/${yyyy}${mm}/${dd}${mm}${yyyy}.xml`;
    try {
      const res = await fetch(url, { next: { revalidate: 43200 } });
      if (!res.ok) continue;
      const xml = await res.text();
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
