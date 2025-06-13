const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());
app.use(express.json());

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR);

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function clearScreenshots() {
  const files = fs.readdirSync(SCREENSHOT_DIR);
  for (const file of files) {
    if (file.endsWith('.png')) {
      fs.unlinkSync(path.join(SCREENSHOT_DIR, file));
    }
  }
}

// Cookie okuma fonksiyonu - cookies klasöründen tüm .txt dosyalarını oku
function parseCookies() {
  const cookiesDir = path.join(__dirname, 'cookies');
  
  // Cookies klasörü yoksa oluştur
  if (!fs.existsSync(cookiesDir)) {
    fs.mkdirSync(cookiesDir, { recursive: true });
    console.log('📁 Cookies klasörü oluşturuldu');
  }
  
  // Cookies klasöründeki tüm .txt dosyalarını oku
  const cookieFiles = fs.readdirSync(cookiesDir).filter(file => file.endsWith('.txt'));
  
  if (cookieFiles.length === 0) {
    console.log('⚠️ Cookies klasöründe cookie dosyası bulunamadı');
    return [];
  }
  
  console.log(`📄 ${cookieFiles.length} cookie dosyası bulundu: ${cookieFiles.join(', ')}`);
  
  const cookies = [];
  
  // Her cookie dosyasını oku
  for (const cookieFile of cookieFiles) {
    const filePath = path.join(cookiesDir, cookieFile);
    console.log(`🔍 ${cookieFile} dosyası okunuyor...`);
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      content.split('\n').forEach(line => {
        if (line.startsWith('#') || line.trim() === '') return;
        
        const parts = line.split('\t');
        if (parts.length >= 7) {
          cookies.push({
            name: parts[5],
            value: parts[6],
            domain: parts[0].replace(/^\./, ''),
            path: parts[2],
            secure: parts[3] === 'TRUE',
            httpOnly: parts[0].startsWith('#HttpOnly_')
          });
        }
      });
      
      console.log(`✅ ${cookieFile} başarıyla okundu`);
    } catch (error) {
      console.log(`❌ ${cookieFile} okunamadı: ${error.message}`);
    }
  }
  
  console.log(`🍪 Toplam ${cookies.length} cookie yüklendi`);
  return cookies;
}

// Ana endpoint
app.post('/transcript', async (req, res) => {
  const { url, debug = false } = req.body; // debug parametresi eklendi
  const logs = [];

  if (!url || !url.includes("youtube.com/watch")) {
    return res.status(400).json({ error: 'Gecerli bir YouTube video URL\'si girin.' });
  }

  if (debug) {
    clearScreenshots(); // Sadece debug modunda screenshot'ları temizle
  }

  try {
    if (debug) logs.push('▶️ Puppeteer başlatılıyor...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    // Cookie'leri yükle
    if (debug) logs.push('🍪 Cookie\'ler yükleniyor...');
    const cookies = parseCookies();
    if (cookies.length > 0) {
      for (const cookie of cookies) {
        try {
          await page.setCookie(cookie);
        } catch (e) {
          // Cookie hatalarını sessizce geç
        }
      }
      if (debug) logs.push(`✅ ${cookies.length} cookie yüklendi`);
    }

    // 1. Direkt YouTube'a git
    if (debug) logs.push('🌐 YouTube video sayfasına gidiliyor...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
    if (debug) await page.screenshot({ path: `${SCREENSHOT_DIR}/1_video_loaded.png` });

    // 2. Sayfayı aşağı kaydır (description kısmını görmek için)
    if (debug) logs.push('📜 Sayfa aşağı kaydırılıyor...');
    await page.evaluate(() => {
      window.scrollTo(0, 400);
    });
    await delay(2000);

    // 3. ...more butonu varsa tıkla
    if (debug) logs.push('🔍 ...more butonu aranıyor...');
    const expandSelectors = [
      'tp-yt-paper-button#expand',
      'ytd-text-inline-expander #expand',
      'button[aria-label="Show more"]',
      'button:has-text("Show more")'
    ];

    let expandBtn = null;
    for (const selector of expandSelectors) {
      try {
        expandBtn = await page.$(selector);
        if (expandBtn) {
          if (debug) logs.push(`📖 ...more butonu bulundu (${selector}), tıklanıyor...`);
          await page.evaluate(el => el.scrollIntoView(), expandBtn);
          await delay(500);
          await expandBtn.click();
          await delay(1500);
          if (debug) await page.screenshot({ path: `${SCREENSHOT_DIR}/2_after_expand.png` });
          break;
        }
      } catch (e) {
        // Selector bulunamazsa devam et
      }
    }

    if (!expandBtn && debug) {
      logs.push('⚠️ ...more butonu bulunamadı, devam ediliyor...');
    }

    // 4. Show transcript butonu ara
    if (debug) logs.push('🔍 Show transcript butonu aranıyor...');
    const transcriptSelectors = [
      'button[aria-label="Show transcript"]',
      'button[aria-label="Transkripti göster"]',
      'yt-button-shape[aria-label="Show transcript"]',
      'button:has-text("Show transcript")',
      'button:has-text("Transcript")'
    ];

    let transcriptBtn = null;
    for (const selector of transcriptSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        transcriptBtn = await page.$(selector);
        if (transcriptBtn) {
          if (debug) logs.push(`✅ Transcript butonu bulundu (${selector})`);
          break;
        }
      } catch (e) {
        // Selector bulunamazsa devam et
      }
    }

    if (!transcriptBtn) {
      if (debug) {
        logs.push('❌ Transcript butonu bulunamadı');
        await page.screenshot({ path: `${SCREENSHOT_DIR}/3_no_transcript_btn.png` });
      }
      throw new Error('Transcript butonu bulunamadı - video transcript desteği olmayabilir');
    }

    if (debug) logs.push('🎯 Transcript butonuna tıklanıyor...');
    await page.evaluate(el => el.scrollIntoView(), transcriptBtn);
    await delay(500);
    await page.evaluate(el => el.click(), transcriptBtn);
    await delay(3000);
    if (debug) await page.screenshot({ path: `${SCREENSHOT_DIR}/4_after_transcript_click.png` });

    // 5. Transcript segmentlerini bekle
    if (debug) logs.push('🕒 Transcript segmentleri bekleniyor...');
    const segmentSelectors = [
      'ytd-transcript-segment-renderer',
      '.ytd-transcript-segment-renderer',
      '[class*="transcript-segment"]'
    ];

    let segments = [];
    for (const selector of segmentSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 10000 });
        segments = await page.$$(selector);
        if (segments.length > 0) {
          if (debug) logs.push(`✅ ${segments.length} transcript segmenti bulundu`);
          break;
        }
      } catch (e) {
        if (debug) logs.push(`⚠️ ${selector} ile segment bulunamadı`);
      }
    }

    if (segments.length === 0) {
      if (debug) {
        logs.push('❌ Transcript segmentleri bulunamadı');
        await page.screenshot({ path: `${SCREENSHOT_DIR}/5_no_segments.png` });
      }
      throw new Error('Transcript segmentleri yüklenemedi');
    }

    if (debug) await page.screenshot({ path: `${SCREENSHOT_DIR}/5_transcript_segments.png` });

    // 6. Transcript metinlerini çıkar
    if (debug) logs.push('📝 Transcript metinleri çıkarılıyor...');
    const transcript = await page.evaluate(() => {
      const selectors = [
        'ytd-transcript-segment-renderer',
        '.ytd-transcript-segment-renderer',
        '[class*="transcript-segment"]'
      ];
      
      let allTexts = [];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          allTexts = Array.from(elements).map(el => {
            // Zaman damgasını çıkar, sadece metni al
            const text = el.innerText || el.textContent || '';
            return text.replace(/^\d+:\d+/, '').trim();
          }).filter(text => text.length > 0);
          break;
        }
      }
      
      return allTexts;
    });

    await browser.close();

    if (transcript.length === 0) {
      if (debug) logs.push('❌ Transcript metinleri boş');
      return res.status(404).json({ 
        error: 'Transcript metinleri çıkarılamadı.', 
        ...(debug && { logs })
      });
    }

    if (debug) logs.push(`✅ ${transcript.length} transcript satırı başarıyla alındı`);
    
    const response = { 
      success: true, 
      transcript: transcript.join(' '), 
      segments: transcript
    };
    
    if (debug) {
      response.logs = logs;
    }
    
    res.json(response);

  } catch (err) {
    if (debug) logs.push(`🚨 HATA: ${err.message}`);
    
    const errorResponse = {
      error: 'Transcript alınırken hata oluştu.',
      details: err.message
    };
    
    if (debug) {
      errorResponse.logs = logs;
    }
    
    res.status(500).json(errorResponse);
  }
});

// Sağlık kontrolü endpoint'i
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'YouTube Transcript API çalışıyor',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Transcript API çalışıyor: http://localhost:${PORT}`);
  console.log(`📁 Cookies klasörü: ${path.join(__dirname, 'cookies')}`);
  console.log(`📸 Screenshots klasörü: ${path.join(__dirname, 'screenshots')}`);
});
