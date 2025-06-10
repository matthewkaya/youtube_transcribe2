# Node.js tabanlı Alpine Linux image kullan
FROM node:18-alpine

# Gerekli sistem paketlerini yükle (Puppeteer için)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# Chromium'un binary path'ini ayarla
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Çalışma dizinini oluştur
WORKDIR /app

# Package.json dosyalarını kopyala
COPY package*.json ./

# Bağımlılıkları yükle
RUN npm ci --only=production

# Uygulama kodunu kopyala
COPY index.js ./

# Screenshots klasörünü oluştur
RUN mkdir -p screenshots

# Cookies klasörünü oluştur (boş kalacak, volume olarak bağlanacak)
RUN mkdir -p cookies

# Non-root kullanıcı oluştur
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Klasör izinlerini ayarla
RUN chown -R nodejs:nodejs /app

# Non-root kullanıcıya geç
USER nodejs

# Port'u expose et
EXPOSE 4000

# Sağlık kontrolü ekle
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000 || exit 1

# Uygulamayı başlat
CMD ["node", "index.js"]
