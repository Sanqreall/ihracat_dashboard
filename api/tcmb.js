// Vercel Serverless Function — TCMB kurlarını çeker
// CORS sorununu sunucu tarafında çözer (TCMB tarayıcıdan direkt erişime izin vermiyor)
// Frontend'den /api/tcmb endpoint'ine GET atılır, JSON döner
//
// Hafta sonu/tatil günlerinde TCMB son işgününün verisini döner.

export default async function handler(req, res) {
  // 12 saat cache (kurlar günde bir kez güncellenir)
  res.setHeader("Cache-Control", "public, max-age=43200, s-maxage=43200, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const r = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ExportFlow/1.0)" },
    });

    if (!r.ok) {
      // Tatil/hafta sonu — son işgününün verisini dene
      // TCMB arşivi: /kurlar/YYMM/DDMMYY.xml formatında (örn 202604/30042026.xml)
      // Geri saymak yerine error dön; frontend cache'i kullansın
      return res.status(502).json({ error: "TCMB veri sağlamadı (tatil/hafta sonu olabilir)", status: r.status });
    }

    const xml = await r.text();
    const rates = parseTCMBxml(xml);

    if (!rates.USD || rates.USD.tryRate === 0) {
      return res.status(502).json({ error: "USD kuru bulunamadı, XML formatı değişmiş olabilir" });
    }

    // USD bazına normalize et: rates[X] = 1 X kaç USD eder
    // TCMB TRY bazlı veriyor: 1 USD = X TRY, 1 EUR = Y TRY, vs.
    // 1 X = X.tryRate / USD.tryRate USD
    const usdTry = rates.USD.tryRate;
    const result = {
      USD: 1,
      TRY: 1 / usdTry,
      _date: rates._date,
      _source: "TCMB",
    };

    Object.entries(rates).forEach(([code, info]) => {
      if (code === "USD" || code === "_date") return;
      if (info.tryRate > 0) result[code] = info.tryRate / usdTry;
    });

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
}

// Basit XML parser — TCMB'nin <Currency Kod="USD"> bloklarını çeker
function parseTCMBxml(xml) {
  const result = {};
  // Tarih
  const dateMatch = xml.match(/Tarih_Date.*?Date="([^"]+)"/);
  if (dateMatch) result._date = dateMatch[1];

  // Her <Currency> bloğunu yakala
  const currencyBlocks = xml.match(/<Currency[^>]*>[\s\S]*?<\/Currency>/g) || [];
  for (const block of currencyBlocks) {
    const codeMatch = block.match(/CurrencyCode="([^"]+)"/);
    const unitMatch = block.match(/<Unit>(\d+)<\/Unit>/);
    const sellingMatch = block.match(/<ForexSelling>([\d.]*)<\/ForexSelling>/);
    const buyingMatch = block.match(/<ForexBuying>([\d.]*)<\/ForexBuying>/);
    if (!codeMatch) continue;

    const code = codeMatch[1];
    const unit = parseInt(unitMatch?.[1] || "1");
    const selling = parseFloat(sellingMatch?.[1] || "0");
    const buying = parseFloat(buyingMatch?.[1] || "0");
    // Ortalama kullan (alış+satış)/2, unit'e bölerek tek birim TRY karşılığı
    const avg = (selling > 0 && buying > 0) ? (selling + buying) / 2 : (selling || buying);
    if (avg === 0) continue;

    result[code] = { tryRate: avg / unit };
  }
  return result;
}
