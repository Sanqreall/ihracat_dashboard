# Export-Flow · İhracat Yönetim Sistemi

Türkiye'den ihracat yapan firmalar için sipariş, müşteri ve nakit akışı yönetimi. Tek sayfada çalışır, Excel'e aktarır, paylaşımlı buluta bağlanır.

## Neyi Yönetir

- **Müşteriler** — Kod, ülke, tercih edilen para birimi, vade, kredi limiti
- **Ürünler** — Ürün kodu, mamul kodu, TR/EN isim, varsayılan fiyat
- **Banka Hesapları** — IBAN, SWIFT, para birimi bazlı tahsilat takibi
- **Siparişler** — Müşteriye bağlı, çok kalemli, Incoterms, sevkiyat bilgileri
- **Ödeme Planı** — Sipariş içinde ön ödeme + sevk öncesi + vadeli yapısı
- **Ödemeler** — Plan kalemlerinden otomatik oluşur, banka hesabı bazlı tahsilat
- **Nakit Akışı** — Haftalık projeksiyon, gecikmiş alarmı, yöntem bazlı dağılım
- **Raporlar** — Müşteri / ürün / ülke / ödeme yöntemi / durum bazında

## Bu Sürümde Yeni Olan Ne?

- **Müşteri modülü eklendi** (eskiden sipariş içinde serbest metindi). Müşteri seçince ülke, para birimi, vade ve Incoterm otomatik geliyor.
- **Banka hesapları** ayrı modül oldu — tahsilat hangi hesaba geldi takip ediliyor.
- **9 farklı ödeme yöntemi** (banka havalesi, akreditif/L/C, vesaik mukabili, peşin, açık hesap, çek, kredi kartı, konsinye, diğer).
- **Sipariş içinde ödeme planı** — % bazlı, otomatik tutar hesaplama, hızlı şablonlar (30-40-30, 50-50, %100 L/C vb.). Plan kaydedilince ödemeler modülünde her kalem ayrı satır olarak çıkar.
- **Kredi limiti & risk göstergesi** — açık hesap satışta görsel uyarı.
- **Tahsilat anındaki kur kaydı** — kur farkı kâr/zararı için.
- **Paylaşımlı bulut (Supabase)** — sadece API anahtarlarıyla aktif olur.

---

## Hızlı Başlangıç (Yerel Test)

**1. Node.js kur** (eğer yoksa): [nodejs.org](https://nodejs.org/) → "LTS" sürümünü indir, kur.

**2. Bağımlılıkları yükle:**
```bash
cd export-flow
npm install
```

**3. Çalıştır:**
```bash
npm run dev
```

Tarayıcı `http://localhost:5173` adresinde açılır. **Ayarlar → Demo Yükle** ile sistem örnek verilerle dolar.

---

## GitHub'a Yükleme

### 1. GitHub hesabı

[github.com](https://github.com) → Sign up (zaten varsa giriş yap).

### 2. Yeni repo oluştur

- Sağ üst **+** → **New repository**
- İsim: `export-flow`
- **Private** seçili (sadece davet ettiğin kişiler görür)
- README/.gitignore eklemeyi atla → **Create repository**

### 3. Yerel projeyi gönder

Git kurulu değilse: [git-scm.com](https://git-scm.com/) → indir, kur.

Proje klasöründe terminalde sırayla:

```bash
git init
git add .
git commit -m "İlk sürüm"
git branch -M main
git remote add origin https://github.com/SENIN_KULLANICI_ADIN/export-flow.git
git push -u origin main
```

> İlk push'ta GitHub kullanıcı adı ve şifre (veya kişisel access token) sorabilir.

### 4. Ekibi davet et

Repo → **Settings → Collaborators → Add people** → ekip arkadaşlarının GitHub kullanıcı adlarını ekle.

---

## Vercel'e Deploy (Canlıya Çıkma)

### 1. Vercel hesabı

[vercel.com](https://vercel.com) → **Sign Up** → **Continue with GitHub** ile bağla. Ücretsiz plan yeterli.

### 2. Projeyi içe aktar

- Dashboard'da **Add New → Project**
- `export-flow` repo'sunu seç → **Import**
- Ayarlar otomatik gelir (Vite framework). Hiçbir şey değiştirme.
- **Deploy** butonuna bas.

1-2 dakika sonra `https://export-flow-xxx.vercel.app` URL'ini alırsın.

### 3. Otomatik dağıtım

GitHub'a her `git push` attığında Vercel otomatik yeni sürümü canlıya alır.

---

## Paylaşımlı Veritabanı (Supabase) — 3-5 Kişi Aynı Veriyi Görsün

Bu kısım **opsiyoneldir**. Atlanırsa veriler her kullanıcının kendi tarayıcısında saklanır (yerel mod).

### 1. Supabase hesabı

[supabase.com](https://supabase.com) → **Start your project** → e-posta veya GitHub ile kayıt ol.

### 2. Yeni proje oluştur

- **New project**
- İsim: `export-flow`
- Veritabanı şifresi: güçlü bir şifre belirle, **bir yere yaz**.
- Bölge: **Frankfurt** veya **London** (Türkiye'ye yakın, hız için).
- **Create new project** → 1-2 dakika beklersin, hazırlanır.

### 3. SQL'i çalıştır

- Sol menü → **SQL Editor** → **New query**
- Proje klasöründeki `supabase-setup.sql` dosyasını aç, içeriğini kopyala
- Editor'a yapıştır → **Run** butonu (sağ alt)
- "Success" mesajını gör

### 4. API anahtarlarını al

- Sol menü → **Project Settings** (en alttaki ⚙️ ikonu) → **API**
- İki şeyi kopyala:
  - **Project URL** (örnek: `https://abcdefgh.supabase.co`)
  - **anon / public key** (uzun bir karakter dizisi, "eyJh..." ile başlar)

### 5. Vercel'e ekle

- Vercel'de projene git → **Settings → Environment Variables**
- İki yeni değişken ekle:
  - Name: `VITE_SUPABASE_URL`, Value: az önce kopyaladığın Project URL
  - Name: `VITE_SUPABASE_ANON_KEY`, Value: anon/public key
- **Save**
- Sol menü → **Deployments** → en üstteki deploy'da **⋯ → Redeploy**

Yeniden açtığında sol altta **"Bulut · Paylaşımlı"** yazısını göreceksin. Aynı URL'i ekibinle paylaş; herkes aynı veriyi görecek.

### Yerel geliştirmede de bulut kullanmak için

Proje klasörünün kök dizininde `.env` adında bir dosya oluştur:

```
VITE_SUPABASE_URL=https://senin-projen.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh...senin-anahtarın
```

`npm run dev` ile çalıştırdığında bulut moduna geçer.

> Not: `.env` dosyası `.gitignore` sayesinde GitHub'a yüklenmez (anahtarların güvende kalır).

---

## Veri Yedekleme

**Bulut moduna geçmeden önce mevcut verini kaybetme:**

1. **Ayarlar → Tam Yedek Al** → JSON dosyası iner
2. Bulut modu kurduktan sonra → **Ayarlar → Yedekten Yükle** → aynı dosyayı seç

Aynı yöntem, tarayıcı değiştirirken de işe yarar.

---

## İki Mod Karşılaştırma

|  | **Yerel Mod** | **Bulut Mod (Supabase)** |
|---|---|---|
| Kurulum | Hiçbir şey gerekmez | 5 dakikalık SQL + anahtar yapıştırma |
| Veriler nerede | Kullanıcının tarayıcısında | Supabase'de paylaşımlı |
| Çoklu kullanıcı | Hayır | Evet, gerçek zamanlı |
| Maliyet | Ücretsiz | Ücretsiz (500 MB'a kadar) |
| Cihaz değişince | Yedek alıp aktarman gerek | Otomatik aynı veriyi görürsün |

---

## Klasör Yapısı

```
export-flow/
├── src/
│   ├── App.jsx              # Tüm sistem mantığı
│   ├── main.jsx             # React giriş noktası
│   └── index.css            # Tailwind direktifleri
├── index.html               # HTML şablonu
├── package.json             # Bağımlılıklar
├── vite.config.js           # Build yapılandırması
├── tailwind.config.js       # Tailwind ayarları
├── postcss.config.js        # PostCSS ayarları
├── vercel.json              # Vercel SPA yönlendirme
├── supabase-setup.sql       # Supabase için hazır SQL
├── .env.example             # .env şablonu
└── .gitignore
```

## Teknoloji

- **React 18** + **Vite** (modern build)
- **Tailwind CSS** (utility-first stil)
- **Recharts** (grafikler)
- **Lucide React** (ikonlar)
- **SheetJS / xlsx** (Excel)
- **Supabase** (opsiyonel; REST API üzerinden, ek paket gerekmez)

---

## Sıkça Karşılaşılan Sorunlar

**"npm: command not found"** → Node.js kurulu değil. [nodejs.org](https://nodejs.org/) → LTS indir.

**"Permission denied" git push'ta** → GitHub kullanıcı adı/şifre yerine "personal access token" iste. GitHub → Settings → Developer settings → Personal access tokens → "classic" → "Generate new token" → repo izinleri seç → token'ı kopyala, şifre yerine yapıştır.

**Vercel'de "Build failed"** → Logları oku; çoğu zaman tekrar Redeploy yapmak çözer.

**Supabase'de veriler görünmüyor** → SQL'i çalıştırdın mı? Anahtarları doğru kopyaladın mı? Vercel'de Redeploy attın mı? Sol alttaki rozette "Bulut" mu yazıyor?

**Demo veriler silinmiyor** → Ayarlar → "Tüm Veriyi Sil" iki kez onay ister.

---

## Lisans

Özel kullanım için hazırlandı.
