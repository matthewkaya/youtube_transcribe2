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

app.post('/transcript', async (req, res) => {
  const { url } = req.body;
  const logs = [];

  if (!url || !url.includes("youtube.com/watch")) {
    return res.status(400).json({ error: 'Geçerli bir YouTube video URL’si girin.' });
  }

  clearScreenshots();

  try {
    logs.push('▶️ Puppeteer başlatılıyor...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    await page.setViewport({ width: 1280, height: 800 });

    // 1. Proxy sitesine git
    logs.push('🌐 Proxy sitesine gidiliyor...');
    await page.goto('https://www.youtubeunblocked.live/_tr/', { waitUntil: 'domcontentloaded' });
    await delay(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/1_proxy_home.png` });

    // 2. Arama kutusuna link yapıştır ve Enter’a bas
    logs.push('🔗 YouTube linki yapıştırılıyor...');
    await page.type('input[name="q"]', url);
    await delay(1000);
    await page.keyboard.press('Enter');

    // 3. Sayfanın yönlenmesini bekle
    logs.push('⏳ Video sayfası yükleniyor...');
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
    await delay(4000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/2_video_loaded.png` });

    // 4. ...more tıklaması
    logs.push('🔍 ...more butonu aranıyor...');
    const expandBtn = await page.$('tp-yt-paper-button#expand');
    if (expandBtn) {
      logs.push('📖 ...more bulundu, tıklanıyor...');
      await page.evaluate(el => el.scrollIntoView(), expandBtn);
      await delay(500);
      await expandBtn.click();
      await delay(1500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/3_after_expand.png` });
    } else {
      logs.push('⚠️ ...more butonu bulunamadı.');
    }

    // 5. Show transcript
    logs.push('🔍 Show transcript butonu aranıyor...');
    const transcriptBtnSelector = 'button[aria-label="Show transcript"]';
    await page.waitForSelector(transcriptBtnSelector, { timeout: 10000 });
    const transcriptBtn = await page.$(transcriptBtnSelector);

    if (!transcriptBtn) {
      logs.push('❌ transcriptBtn bulunamadı.');
      throw new Error('transcriptBtn null');
    }

    logs.push('✅ transcriptBtn bulundu, tıklanıyor...');
    await page.evaluate(el => el.scrollIntoView(), transcriptBtn);
    await delay(500);
    await page.evaluate(el => el.click(), transcriptBtn);
    await delay(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/4_after_transcript_click.png` });

    // 6. Transcript segmentlerini bekle
    logs.push('🕒 transcript segmentleri bekleniyor...');
    await page.waitForSelector('ytd-transcript-segment-renderer', { timeout: 20000 });
    await delay(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/5_transcript_segments.png` });

    const transcript = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('ytd-transcript-segment-renderer'))
        .map(el => el.innerText)
        .filter(Boolean);
    });

    await browser.close();

    if (transcript.length === 0) {
      logs.push('❌ transcript segmentleri boş');
      return res.status(404).json({ error: 'Transcript segmentleri bulunamadı.', logs });
    }

    res.json({ transcript, logs });

  } catch (err) {
    logs.push(`🚨 HATA: ${err.message}`);
    res.status(500).json({
      error: 'Transcript alınırken hata oluştu.',
      details: err.message,
      logs
    });
  }
});

app.listen(4000, () => {
  console.log('✅ Transcript API çalışıyor: http://localhost:4000');
});