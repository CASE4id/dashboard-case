# Panduan Memperbarui Data Dashboard PraKTIk

Panduan ini untuk staf Direktorat Transmisi, Ketenagalistrikan, Kedirgantaraan, dan Antariksa (TKKA) Bappenas.
**Tidak perlu kemampuan pemrograman.** Yang dibutuhkan hanya:

- Microsoft Excel
- Browser (Chrome/Edge)
- Akun GitHub yang sudah diundang ke repositori dashboard (minta ke admin)

Waktu yang dibutuhkan: ± 30–60 menit sekali setahun.

---

## Gambaran singkat

Dashboard memiliki **tiga sektor**. Setiap sektor punya folder data sendiri:

| Sektor | Folder | Nama file | Isi file |
|---|---|---|---|
| Ketenagalistrikan | `data/listrik/` | `statistik-pln-TAHUN.xlsx` | **Satu file per tahun** (2014, 2015, … 2025) |
| Transmisi Gas | `data/gas/` | `statistik-gas-TAHUN.xlsx` | **Satu file berisi semua tahun**; TAHUN = tahun data terakhir |
| Kedirgantaraan | `data/udara/` | `statistik-udara-TAHUN.xlsx` | **Satu file berisi semua tahun**; TAHUN = tahun data terakhir |

```
data/listrik/statistik-pln-2025.xlsx
data/listrik/statistik-pln-2026.xlsx    ← file baru (Ketenagalistrikan)
data/gas/statistik-gas-2025.xlsx        ← edisi baru, berisi 2020–2025 (Transmisi Gas)
data/udara/statistik-udara-2025.xlsx    ← edisi baru, berisi 2020–2025 (Kedirgantaraan)
```

- **Ketenagalistrikan:** begitu file tahun baru diunggah, tahun itu otomatis muncul di pilihan "Tahun" dan menjadi tampilan awal.
- **Gas & Kedirgantaraan:** situs hanya membaca file dengan **tahun terbesar** di namanya. File edisi lama boleh tetap ada (sebagai arsip).
- Tidak ada kode yang perlu diubah.

---

## Langkah 1 — Siapkan file Excel

Cara termudah untuk semua sektor: **salin file terakhir, ganti namanya, lalu perbarui isinya.**
Ambil file terakhir dari dashboard (tab **Data & Unduh** → **Unduh Excel**) atau dari folder data di GitHub.
Nama file: huruf kecil semua, tanpa spasi, pakai tanda hubung `-`.

### 1A. Ketenagalistrikan (Statistik PLN)

1. Salin file tahun lalu, simpan sebagai **`statistik-pln-TAHUN.xlsx`**, mis. `statistik-pln-2026.xlsx`.
2. Ganti angka di setiap sheet (`t01` … `t30`) dengan data dari publikasi **Statistik PLN** terbaru.
3. Sheet `kualitas_data` (catatan teknis, bahasa Inggris) boleh dikosongkan atau diisi catatan baru.

#### Cara otomatis dari PDF (disarankan)

File Statistik PLN dapat dibuat otomatis dari PDF-nya, tanpa mengetik angka:

1. Siapkan **tautan langsung ke file PDF** Statistik PLN (tautan yang langsung mengunduh file `.pdf`, bukan halaman web).
2. Di repositori GitHub, buka tab **Actions** → pilih **Tambah data PLN dari PDF** (kiri) → klik **Run workflow** (kanan).
3. Isi **Tahun data** (mis. `2026`) dan **tautan PDF** → klik tombol hijau **Run workflow**. Tunggu ±3 menit.
4. Buka tab **Pull requests** → pull request **Data Statistik PLN 2026 (otomatis dari PDF)**. Isinya berupa laporan:
   - **✅ Siap ditinjau**: cocokkan angka nasional dan daftar perubahan besar dengan PDF, lalu **Merge pull request** → **Confirm merge**.
   - **⚠️ Perlu bantuan teknis** (pull request berstatus *Draft*): biasanya PLN mengubah susunan kolom tabel. Minta bantuan teknis
     mengikuti petunjuk di laporan; setelah diperbaiki, jalankan ulang dengan *Use workflow from* = branch `data-pln-2026`.
5. Isi sheet `catatan` bila perlu (cara manual di bawah), lalu periksa dashboard seperti Langkah 4.

Jika cara otomatis tidak dapat dipakai, gunakan cara manual berikut.

### 1B. Transmisi Gas (BPS, Statistik Gas)

1. Salin file terakhir, simpan dengan tahun data terakhir yang baru, mis. **`statistik-gas-2025.xlsx`**.
2. Di setiap sheet `g01` … `g10`: **tambahkan satu kolom di paling kanan** dengan judul tahun baru (mis. `2025`, berupa angka), lalu isi angkanya.
3. Perbarui juga angka tahun-tahun sebelumnya jika BPS merevisinya di publikasi baru.
4. Baris `total` / `average` adalah angka yang dipublikasikan BPS; isi sesuai publikasi (jangan diganti rumus).
5. Sheet `catatan`: perbarui keterangan, mis. "Angka 2025 bersifat sementara" (kolom `years` = `2025`).

### 1C. Kedirgantaraan (BPS, Statistik Transportasi Udara)

1. Salin file terakhir, simpan dengan tahun data terakhir yang baru, mis. **`statistik-udara-2025.xlsx`**.
2. Di sheet `a01` … `a04`: **tambahkan baris** untuk tahun baru (kolom `year` = 2025). **Jangan hapus** baris tahun lama.
3. Sheet `a05` (per bandara) dan `a06` (per provinsi): tambahkan baris tahun baru. Jika publikasi hanya memuat tahun terbaru,
   baris tahun lama boleh tetap ada.
4. Perhatikan satuan: kargo dalam **ton** di `a01`, tetapi dalam **kg** di `a05`/`a06` (sesuai publikasi).

### 1D. Data per provinsi (mis. desa berlistrik, rasio desa berlistrik)

Data sederhana per provinsi tampil di tab **Provinsi** (sektor Ketenagalistrikan). Panduan lengkap dengan gambar:
**`docs/Panduan-Menambah-Data-Provinsi.pdf`**. Ringkasnya:

1. Susun data menjadi empat kolom: **Tahun | Provinsi | Indikator | Nilai**. Ini **aturan baku untuk semua sumber**
   (BPS, kementerian, PLN, dll.), karena setiap sumber punya bentuk tabel berbeda. Tabel kecil: salin-tempel;
   tabel lebar: Excel **Data → From Table/Range → Unpivot Other Columns** (langkah di panduan PDF, Langkah 2).
   Templat dan contoh (PJUTS): `data/referensi/templat-indikator-provinsi.xlsx`. Cek Data masih bisa membaca
   sebagian tabel mentah, tetapi akan memberi catatan "bukan susunan standar"; jangan mengandalkannya.
2. Periksa di **Cek Data** → **Unduh versi rapi** → beri nama pendek tanpa tahun, mis. `desa-berlistrik.xlsx`.
3. Lengkapi sheet `info` (judul, sumber, satuan, komposisi) dan `indikator` (nama Inggris, makin tinggi makin baik); periksa ulang.
4. Unggah ke folder `data/provinsi/`.
5. Tambahkan satu baris di `data/provinsi/daftar-indikator.xlsx` (file | tampilkan = ya | urutan), periksa di Cek Data, unggah.
6. Tahun berikutnya: tambahkan baris di file yang sama dan unggah ulang dengan nama sama.

Penulisan provinsi yang benar tetapi tidak dikenali: tambahkan ke kolom `alternatif` di `data/referensi/provinsi.xlsx`.
Selama daftar kosong, tab Provinsi tidak ditampilkan.

### Aturan pengisian (semua sektor, penting!)

| Boleh ✅ | Jangan ❌ |
|---|---|
| Mengubah angka di dalam sel | Mengubah nama sheet (`t01`, `g01`, `a01`, `units`, `tabel`, …) |
| Menambah baris unit/tahun baru | Mengubah/menerjemahkan **judul kolom** di baris 1 |
| Mengosongkan sel jika data tidak ada (sama dengan "-") | Menggabungkan sel (merge cells) |
| Angka desimal pakai koma atau titik | Menulis teks di kolom angka (mis. "n/a", "±5") |
| Angka negatif sebagai `-3,53` | Menambah baris total/judul di tengah tabel |

- Sheet `README` di dalam file tidak dibaca oleh situs (hanya untuk catatan).

### Khusus Ketenagalistrikan

- Kolom **`year`** boleh dibiarkan; situs selalu memakai tahun dari **nama file**.
- Baris **`indonesia`** (nasional) wajib ada di setiap tabel, karena dipakai sebagai pembanding.
- Kolom `unit_name_reported` = nama unit persis seperti di laporan tahun itu (nama unit PLN sering berubah). `unit_name` = nama terkini.

**Jika ada unit/provinsi baru:**

1. Tambahkan barisnya di sheet tabel terkait dengan `unit_id` baru (huruf kecil, pakai garis bawah, mis. `uid_kalimantan_utara`).
2. Tambahkan juga di sheet **`units`**: `unit_id`, `unit_name`, `row_type`, `parent_unit_id`, `region`.
   - `row_type` gunakan salah satu: `distribution_unit`, `regional_unit`, `province`, `transmission_dispatch_unit`,
     `transmission_unit`, `generation_unit`, `generation_subsidiary`, `subsidiary`, `generation_projects`,
     `generation_transmission_unit`, `construction_unit`, `project_component`, `regional_total`, `national_total`.
3. **Jangan mengganti `unit_id` unit lama**, agar perbandingan antartahun tetap tersambung. Jika unit berganti nama, cukup ubah `unit_name_reported`.

**Catatan khusus (opsional):** sheet **`catatan`** berisi keterangan yang muncul sebagai kotak kuning pada kartu indikator.
Contoh: SAIDI UID Aceh 2025 tinggi akibat bencana. Kolom:

| year | unit_id | indicator | note_id | note_en |
|---|---|---|---|---|
| 2026 | uid_aceh | saidi_hours_per_customer | Teks Bahasa Indonesia | English text |

`indicator` diisi dengan nama kolom dari tabel (mis. `saidi_hours_per_customer`, `electrification_ratio_pct`).

---

## Langkah 2 — Cek file dengan halaman "Cek Data"

1. Buka **`<alamat-situs>/cek-data.html`**
   (saat ini: `https://case4id.github.io/dashboard-case/cek-data.html`, atau klik tautan **Cek Data** di bagian bawah dashboard).
2. Seret file Excel ke kotak yang tersedia. Sektornya dikenali otomatis dari nama file.
3. Baca hasilnya:
   - **✔ SIAP DIUNGGAH**: lanjut ke Langkah 3. Hasil cek juga menyebut **folder tujuan** file tersebut.
   - **✖ BELUM SIAP**: daftar kesalahan menunjukkan sheet, baris, dan kolom yang salah. Perbaiki di Excel, lalu cek ulang.

File **tidak dikirim ke mana pun** saat dicek; pemeriksaan hanya terjadi di browser Anda.

---

## Langkah 3 — Unggah ke GitHub (lewat browser)

1. Masuk ke **github.com** dengan akun Anda, lalu buka repositori dashboard.
2. Klik folder **`data`**, lalu folder sektornya: **`listrik`**, **`gas`**, atau **`udara`**.
3. Klik tombol **Add file** (kanan atas) → **Upload files**.
4. Seret file Excel ke halaman tersebut.
5. Di kotak **Commit changes** di bawah, tulis keterangan singkat, mis. `Tambah data Statistik PLN 2026`.
6. Pastikan pilihan **Commit directly to the main branch** dipilih → klik **Commit changes**.

> **Memperbaiki data yang sudah diunggah?** Unggah ulang file dengan **nama yang sama persis** ke folder yang sama.
> GitHub akan menggantikan file lama (riwayat versi lama tetap tersimpan dan bisa dikembalikan).

---

## Langkah 4 — Periksa hasilnya

1. Tunggu **1–3 menit**. GitHub sedang memperbarui situs; status bisa dilihat di tab **Actions** repositori (tanda centang hijau = selesai).
2. Buka situs dashboard, pilih sektornya, tekan **Ctrl + F5** (muat ulang penuh). Browser kadang masih menampilkan versi lama hingga **±10 menit**; untuk memastikan, buka di **jendela penyamaran/incognito** (**Ctrl + Shift + N**).
3. Pastikan tahun baru muncul di pilihan **Tahun** dan angka nasional sesuai publikasi.
4. Jika muncul kotak kuning "Sebagian data tidak terbaca", klik untuk melihat rinciannya, perbaiki file, lalu unggah ulang.

---

## Jika terjadi masalah

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| Tahun baru tidak muncul | Nama file salah (mis. `Statistik PLN 2026.xlsx`) atau salah folder | Ubah nama menjadi `statistik-pln-2026.xlsx` (atau `statistik-gas-…`/`statistik-udara-…`) dan unggah ke folder sektornya |
| Kartu menampilkan "Data tidak tersedia" | Sel kosong atau baris unit tidak ada | Periksa sheet terkait |
| Kotak kuning "Sebagian data tidak terbaca" | Ada teks di kolom angka atau sheet hilang | Jalankan Cek Data, perbaiki |
| Situs kosong / error merah | File rusak atau situs belum selesai diperbarui | Tunggu 3 menit; jika tetap, kembalikan versi sebelumnya (bawah) |
| Tab **Actions** menunjukkan tanda ✖ merah pada "pages build and deployment" (mis. *Server Error* / *502*) | Gangguan sementara di server GitHub, bukan kesalahan file Anda | Buka run tersebut → **Re-run jobs** → **Re-run all jobs**. Jika gagal lagi, cek https://www.githubstatus.com dan coba lagi nanti |
| Run "pages build and deployment" berstatus **Queued** (titik kuning) lebih dari 15 menit | Antrean GitHub sedang macet; run ini tidak bisa dibatalkan | Tunggu. Atau unggah/ubah file apa pun (mis. perbaikan kecil di panduan ini): setiap perubahan di `main` memulai run baru |

### Mengembalikan ke versi sebelumnya

Di GitHub, buka file di folder `data/listrik/`, `data/gas/` atau `data/udara/` → klik **History** → pilih versi sebelumnya → klik **⋯** → **View file** → **Download (Raw)**,
lalu unggah ulang file tersebut dengan nama yang sama.

---

## Hal yang sebaiknya TIDAK diubah tanpa bantuan teknis

- File di folder `assets/` (kode tampilan), **kecuali** `assets/js/config.js` sesuai bagian
  "Menambah atau menghapus kolom & indikator" di bawah
- `index.html`, `cek-data.html`

Mengubah teks sumber data atau kontak di footer: edit `assets/js/config.js` (bagian `source` dan `contact`)
langsung di GitHub (ikon pensil ✏️), lalu **Commit changes**.

---

## Menambah atau menghapus kolom & indikator

Bagian ini untuk perubahan **isi** data (bukan pembaruan tahunan biasa) pada sektor **Ketenagalistrikan**.
Untuk sektor Gas dan Kedirgantaraan, kategori baru cukup ditambahkan sebagai baris (gas) atau kolom/baris (udara); grafik baru memerlukan bantuan teknis (`assets/js/sektor-gas.js`, `sektor-udara.js`). Lakukan dengan hati-hati; jika ragu, minta bantuan teknis.

### Ringkasan: apa yang perlu diubah?

| Perubahan | Di Excel | Di `assets/js/config.js` | Hasil di dashboard |
|---|---|---|---|
| Kolom baru, cukup tampil di tabel | Tambah kolom + baris di `data_dictionary` | Tidak perlu | Muncul di tab **Data & Unduh** |
| Kolom baru dijadikan indikator | Seperti di atas | Tambah entri di `INDICATORS` (A) | Muncul di **Perbandingan** dan **Analisis** |
| Indikator hasil hitungan (rasio dsb.) | Tidak perlu (jika kolomnya sudah ada) | Tambah entri dengan rumus (B) | Sama seperti di atas |
| Tampilkan indikator sebagai kartu di Ringkasan | — | Tambah `key`-nya di `SUMMARY_CARDS` | Kartu baru di tab **Ringkasan** |
| Menghapus kolom | Hapus kolom | Hapus dari `DATA_SCHEMA`; jika dipakai indikator, hapus juga entrinya (C) | Kolom hilang dari tabel/indikator |
| Tabel (sheet) baru, mis. `t35` | Tambah sheet + baris `data_dictionary` | Tambah `"t35"` ke `sheets` dan ke `DATA_SCHEMA` | Muncul di tab **Data & Unduh** |
| Grafik baru atau tab baru | — | Perlu bantuan teknis (`app.js`) | — |

Halaman **Cek Data** membantu: kolom baru muncul sebagai *catatan*; kolom yang hilang muncul sebagai *kesalahan*
lengkap dengan nama indikator yang memakainya.

### Cara mengedit `config.js` di GitHub

1. Buka repositori → folder `assets` → `js` → `config.js`.
2. Klik ikon **pensil ✏️** (kanan atas file).
3. Ubah teks sesuai contoh di bawah. **Perhatikan tanda koma, tanda kutip, dan kurung**: satu tanda yang hilang bisa membuat dashboard kosong.
4. Klik **Commit changes…** → tulis keterangan singkat → **Commit changes**.
5. Tunggu 1–3 menit, buka dashboard di jendela *incognito*, dan pastikan semua tab tampil.
6. **Jika dashboard menjadi kosong/error:** buka `config.js` → **History** → buka versi sebelumnya → salin seluruh isinya →
   edit `config.js` dengan pensil, tempel, lalu **Commit changes**. Dashboard kembali seperti semula.

### (A) Contoh: kolom dijadikan indikator

Salin blok ini ke dalam daftar `window.INDICATORS = [ ... ];`, tepat **sebelum** baris `];` penutupnya:

```js
  {
    key: "own_use_power_plant", table: "t02", column: "own_use_power_plant_pct",
    id: "Pemakaian Sendiri Pembangkit", en: "Power Plant Own Use",
    unit: "%", decimals: 2, better: "low",
    note: { id: "Persentase energi yang dipakai sendiri oleh pembangkit.", en: "Share of energy used by the power plants themselves." },
  },
```

| Isian | Arti |
|---|---|
| `key` | Kode unik, huruf kecil + garis bawah. Jangan diubah setelah dipakai (tautan yang dibagikan memakai kode ini). |
| `table`, `column` | Nama sheet dan judul kolom **persis** seperti di Excel. |
| `id`, `en` | Nama indikator dalam Bahasa Indonesia dan Inggris. |
| `unit` | Satuan, mis. `"%"`, `"MW"`, atau `{ id: "kWh/pelanggan", en: "kWh/customer" }`. |
| `decimals` | Jumlah angka di belakang koma. |
| `better` | `"high"` = makin tinggi makin baik, `"low"` = makin rendah makin baik, `null` = netral (tanpa warna hijau/merah). |
| `compareNational: false` | Tambahkan jika nilai nasional tidak sebanding dengan unit (mis. total MW). |
| `note` | Keterangan singkat (boleh dihapus). |

### (B) Contoh: indikator hasil hitungan

```js
  {
    key: "ipp_share", id: "Porsi IPP pada Kapasitas Terpasang", en: "IPP Share of Installed Capacity",
    unit: "%", decimals: 1, better: null,
    uses: ["t21.ipp_mw", "t21.total_mw"],
    value: (db, u, y) => {
      const r = db.row("t21", u, y);
      if (!r || !r.total_mw) return null;
      return ((r.ipp_mw || 0) / r.total_mw) * 100;
    },
  },
```

`uses` mencatat kolom yang dipakai rumus, agar Cek Data bisa memberi tahu indikator mana yang terdampak jika kolomnya hilang.
Lihat juga contoh "Cadangan Daya" dan "Porsi EBT" yang sudah ada di `config.js`.

### (C) Menghapus kolom atau indikator

1. Hapus kolom di file Excel tahun baru. File tahun-tahun lama **tidak perlu** diubah.
2. Di `config.js`, bagian `DATA_SCHEMA`: hapus nama kolom tersebut dari daftar sheet-nya.
3. Jika Cek Data menyebut kolom itu *dipakai indikator*, hapus juga blok indikatornya dari `INDICATORS` dan `key`-nya dari `SUMMARY_CARDS`.
4. Jika kolom dipakai grafik di tab **Pembangkitan** atau **Jaringan & Susut**, bagian grafik itu akan kosong untuk tahun baru. Hubungi bantuan teknis bila perlu diganti.

### Jika definisi indikator berubah antartahun

Tab **Analisis → Antar tahun** membandingkan angka apa adanya. Jika cara hitung atau cakupan suatu indikator berubah,
tambahkan keterangan di sheet **`catatan`** agar pembaca tahu angkanya tidak sepenuhnya sebanding.

---

## Kontak & serah terima

| Peran | Nama | Kontak |
|---|---|---|
| Pemilik konten | Direktorat TKKA, Bappenas | dit.tkka@bappenas.go.id |
| Admin GitHub | _(isi saat serah terima)_ | |
| Petugas pembaruan data | _(isi saat serah terima)_ | |
