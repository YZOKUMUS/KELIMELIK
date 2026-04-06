# Kelimelik Asistan

Tarayıcıda 15x15 tahta üzerinde harfleri girip, `kelimeler.json` sözlüğüne göre olası hamle önerileri üretir.

## Kullanım

- `index.html` dosyasını açın.
- Harf girme:
  - **Alfabe paleti**: Sağdaki harflerden sürükle-bırak ile tahtaya bırakın.
  - **Hızlı yazma**: Tahtada bir kare seçin → alttaki kutuya `kelime` yazın → **Enter** ile yerleştirin. **Tab** ile yön değiştirin (→ / ↓).
- Rack (isteğe bağlı): `Elindeki harfler` kutusu öneri üretirken kullanılır.
- Öneriler:
  - `Olası hamleleri bul` → öneri listesi
  - Öneriye tıklayınca tahta üzerinde **önizleme (yeşil)** görünür
  - `Seçili öneriyi onayla` ile kalıcı hale gelir
  - `Önizlemeyi temizle` ile iptal edilir

## Sözlük yükleme notu

Bazı tarayıcılarda `file://` ile açınca `fetch('kelimeler.json')` engellenebilir. Bu durumda sayfa otomatik olarak **dosya seçme** butonu gösterir; buradan `kelimeler.json` dosyasını seçin.

## GitHub’a yükleme

Bu proje statik dosyalardan oluşur. GitHub’a göndermek için:

```bash
git init
git add .
git commit -m "Initial commit"
```

Sonra GitHub’da yeni repo oluşturup ekrana verdiği komutlarla `git remote add origin ...` ve `git push -u origin main` yapabilirsiniz.

