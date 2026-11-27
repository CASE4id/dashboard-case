# Sumber Buku Panduan

`buku-panduan.html` + `img/` adalah sumber dari `docs/Buku-Panduan-Dashboard-PraKTIk.pdf`.

- Ubah teks di `buku-panduan.html`, lalu cetak ulang ke PDF: buka file di Chrome/Edge → **Print** → **Save as PDF**
  (ukuran A4, aktifkan *Background graphics*), atau dengan Playwright: `node render.js "$PWD/buku-panduan.html" ../Buku-Panduan-Dashboard-PraKTIk.pdf`.
- Tangkapan layar dashboard dibuat ulang dengan `shots.js` (perlu Playwright dan server lokal `python3 -m http.server 8101` di folder repositori).
- Kotak "jalur klik" GitHub adalah ilustrasi; tangkapan layar GitHub asli dapat ditambahkan ke `img/` dan disisipkan dengan `<figure><img src="img/NAMA.png"></figure>`.
