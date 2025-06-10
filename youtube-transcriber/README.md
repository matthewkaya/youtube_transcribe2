# YouTube Transcript API

YouTube videolarından transcript (altyazı) çıkaran Node.js API'si.

## Özellikler

- 🍪 Cookie desteği (cookies klasöründen otomatik okuma)
- 🎯 Direkt YouTube API kullanımı (proxy yok)
- 📝 Çoklu format desteği
- 🔧 Debug modu (screenshot ve detaylı log)
- ⚡ Hızlı mod (production için optimize)
- 🐳 Docker desteği
- 📱 Responsive ve güvenilir

## Kurulum

### Yerel Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Cookie dosyasını cookies klasörüne koy
cp your_cookies.txt cookies/

# Sunucuyu başlat
node index.js
```

### Docker ile Kullanım

```bash
# Docker image'ını oluştur
docker build -t youtube-transcriber .

# Container'ı çalıştır
docker run -d \
  --name youtube-transcriber \
  -p 4000:4000 \
  -v $(pwd)/cookies:/app/cookies:ro \
  youtube-transcriber
```

### Docker Compose ile Kullanım

```bash
# Cookie dosyanızı cookies klasörüne koyun
cp your_cookies.txt cookies/

# Servisi başlatın
docker-compose up -d

# Logları görüntüleyin
docker-compose logs -f
```

## API Kullanımı

### Transcript Alma

**Normal Mod (Hızlı):**
```bash
curl -X POST http://localhost:4000/transcript \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=VIDEO_ID"}'
```

**Debug Mod (Detaylı Log ve Screenshot ile):**
```bash
curl -X POST http://localhost:4000/transcript \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=VIDEO_ID",
    "debug": true
  }'
```

### Parametreler

- `url` (zorunlu): YouTube video URL'si
- `debug` (opsiyonel): Debug modu (varsayılan: `false`)
  - `true`: Screenshot'lar alınır, detaylı loglar tutulur
  - `false`: Hızlı mod, minimal işlem

### Yanıt Formatı

**Normal Mod:**
```json
{
  "success": true,
  "transcript": "Video transkript metni...",
  "segments": ["Segment 1", "Segment 2", ...]
}
```

**Debug Mod:**
```json
{
  "success": true,
  "transcript": "Video transkript metni...",
  "segments": ["Segment 1", "Segment 2", ...],
  "logs": [
    "▶️ Puppeteer başlatılıyor...",
    "🍪 Cookie'ler yükleniyor...",
    "✅ 25 cookie yüklendi",
    "🌐 YouTube video sayfasına gidiliyor...",
    "..."
  ]
}
```

## Cookie Dosyası Formatı

Cookie dosyaları Netscape formatında olmalıdır:
```
# Netscape HTTP Cookie File
.youtube.com	TRUE	/	FALSE	1234567890	cookie_name	cookie_value
```

## Klasör Yapısı

```
├── index.js              # Ana uygulama
├── package.json          # NPM bağımlılıkları
├── Dockerfile            # Docker yapılandırması
├── docker-compose.yml    # Docker Compose yapılandırması
├── cookies/              # Cookie dosyaları (volume olarak bağlanır)
│   └── *.txt            # Cookie dosyaları
└── screenshots/          # Debug screenshot'ları
    └── *.png            # İşlem adımları
```

## Ortam Değişkenleri

- `NODE_ENV`: Çalışma ortamı (production/development)
- `PUPPETEER_EXECUTABLE_PATH`: Chrome/Chromium binary yolu

## Sağlık Kontrolü

API `/` endpoint'inde sağlık kontrolü yapar:
```bash
curl http://localhost:4000/
```

## Hata Ayıklama

### Debug Modu

Debug modunu aktifleştirmek için API çağrınızda `"debug": true` parametresini kullanın:

```bash
curl -X POST http://localhost:4000/transcript \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=VIDEO_ID",
    "debug": true
  }'
```

Debug modunda:
- 📸 Her adımda screenshot alınır (`screenshots/` klasörüne kaydedilir)
- 📝 Detaylı loglar tutulur ve response'da döndürülür
- 🔍 Hata durumunda daha fazla bilgi sağlar

### Screenshot Dosyaları

Debug modunda screenshots klasöründeki PNG dosyalarını kontrol ederek işlem adımlarını görebilirsiniz:
- `1_video_loaded.png` - Video sayfası yüklendi
- `2_after_expand.png` - Açıklama kısmı genişletildi
- `3_no_transcript_btn.png` - Transcript butonu bulunamadı (hata durumu)
- `4_after_transcript_click.png` - Transcript butonu tıklandı
- `5_transcript_segments.png` - Transcript segmentleri yüklendi
- `5_no_segments.png` - Transcript segmentleri bulunamadı (hata durumu)

### Performance

- **Normal Mod**: Hızlı çalışır, screenshot almaz, minimal log
- **Debug Mod**: Daha yavaş ama detaylı bilgi sağlar

Production ortamında normal modu kullanmanız önerilir.
