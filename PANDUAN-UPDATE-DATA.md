# Panduan Memperbarui Data Dashboard PraKTIk

Panduan ini untuk staf Direktorat Transmisi, Ketenagalistrikan, Kedirgantaraan, dan Antariksa (TKKA) Bappenas.
**Tidak perlu kemampuan pemrograman.** Yang dibutuhkan hanya:

- Microsoft Excel
- Browser (Chrome/Edge)
- Akun GitHub yang sudah diundang ke repositori dashboard (minta ke admin)

Waktu yang dibutuhkan: ± 30–60 menit sekali setahun.

---

## Gambaran singkat

Situs membaca **satu file Excel per tahun** di folder `data/`:

```
data/statistik-pln-2025.xlsx
data/statistik-pln-2026.xlsx   ← file baru yang Anda tambahkan
```

Begitu file baru diunggah, tahun tersebut **otomatis** muncul di pilihan "Tahun" dan menjadi tampilan awal.
Tidak ada kode yang perlu diubah.

---

## Langkah 1 — Siapkan file Excel tahun baru

1. Unduh file tahun sebelumnya sebagai **templat**: buka dashboard → tab **Data & Unduh** → tombol **Unduh Excel**.
   (Atau ambil dari folder `data/` di GitHub.)
2. Simpan sebagai nama baru: **`statistik-pln-TAHUN.xlsx`**, contoh `statistik-pln-2026.xlsx`.
   - huruf kecil semua, tanpa spasi, pakai tanda hubung `-`.
3. Ganti angka di setiap sheet dengan data dari publikasi **Statistik PLN** terbaru.

### Aturan pengisian (penting!)

| Boleh ✅ | Jangan ❌ |
|---|---|
| Mengubah angka di dalam sel | Mengubah nama sheet (`t01`, `t02`, … `units`, `data_dictionary`) |
| Menambah baris unit baru (lihat bawah) | Mengubah/menerjemahkan **judul kolom** di baris 1 |
| Mengosongkan sel jika data tidak ada (sama dengan "-") | Menggabungkan sel (merge cells) |
| Angka desimal pakai koma atau titik | Menulis teks di kolom angka (mis. "n/a", "±5") |
| Angka negatif sebagai `-3,53` | Menambah baris total/judul di tengah tabel |

- Kolom **`year`** boleh dibiarkan; situs selalu memakai tahun dari **nama file**.
- Baris **`indonesia`** (nasional) wajib ada di setiap tabel, karena dipakai sebagai pembanding.
- Sheet `README` di dalam file tidak dibaca oleh situs (hanya untuk catatan).

### Jika ada unit/provinsi baru

1. Tambahkan barisnya di sheet tabel terkait dengan `unit_id` baru (huruf kecil, pakai garis bawah, mis. `uid_kalimantan_utara`).
2. Tambahkan juga di sheet **`units`**: `unit_id`, `unit_name`, `row_type`, `parent_unit_id`, `region`.
   - `row_type` gunakan salah satu: `distribution_unit`, `regional_unit`, `province`, `transmission_dispatch_unit`,
     `transmission_unit`, `generation_unit`, `generation_subsidiary`, `subsidiary`, `generation_projects`,
     `regional_total`, `national_total`.
3. **Jangan mengganti `unit_id` unit lama**, agar perbandingan antartahun tetap tersambung.

### Catatan khusus (opsional)

Sheet **`catatan`** berisi keterangan yang muncul sebagai kotak kuning pada kartu indikator.
Contoh: SAIDI UID Aceh 2025 tinggi akibat bencana. Kolom:

| year | unit_id | indicator | note_id | note_en |
|---|---|---|---|---|
| 2026 | uid_aceh | saidi_hours_per_customer | Teks Bahasa Indonesia | English text |

`indicator` diisi dengan nama kolom dari tabel (mis. `saidi_hours_per_customer`, `electrification_ratio_pct`).
Hapus baris catatan tahun lalu jika sudah tidak relevan.

---

## Langkah 2 — Cek file dengan halaman "Cek Data"

1. Buka **`<alamat-situs>/cek-data.html`**
   (contoh: `https://NAMA-ORGANISASI.github.io/dashboard-praktik/cek-data.html`).
2. Seret file Excel ke kotak yang tersedia.
3. Baca hasilnya:
   - **✔ SIAP DIUNGGAH**: lanjut ke Langkah 3.
   - **✖ BELUM SIAP**: daftar kesalahan menunjukkan sheet, baris, dan kolom yang salah. Perbaiki di Excel, lalu cek ulang.

File **tidak dikirim ke mana pun** saat dicek; pemeriksaan hanya terjadi di browser Anda.

---

## Langkah 3 — Unggah ke GitHub (lewat browser)

1. Masuk ke **github.com** dengan akun Anda, lalu buka repositori dashboard.
2. Klik folder **`data`**.
3. Klik tombol **Add file** (kanan atas) → **Upload files**.
4. Seret file `statistik-pln-2026.xlsx` ke halaman tersebut.
5. Di kotak **Commit changes** di bawah, tulis keterangan singkat, mis. `Tambah data Statistik PLN 2026`.
6. Pastikan pilihan **Commit directly to the main branch** dipilih → klik **Commit changes**.

> **Memperbaiki data yang sudah diunggah?** Unggah ulang file dengan **nama yang sama persis**.
> GitHub akan menggantikan file lama (riwayat versi lama tetap tersimpan dan bisa dikembalikan).

---

## Langkah 4 — Periksa hasilnya

1. Tunggu **1–3 menit**. GitHub sedang memperbarui situs; status bisa dilihat di tab **Actions** repositori (tanda centang hijau = selesai).
2. Buka situs dashboard, tekan **Ctrl + F5** (muat ulang penuh).
3. Pastikan tahun baru muncul di pilihan **Tahun** dan angka nasional sesuai publikasi.
4. Jika muncul kotak kuning "Sebagian data tidak terbaca", klik untuk melihat rinciannya, perbaiki file, lalu unggah ulang.

---

## Jika terjadi masalah

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| Tahun baru tidak muncul | Nama file salah (mis. `Statistik PLN 2026.xlsx`) | Ubah nama menjadi `statistik-pln-2026.xlsx` lalu unggah ulang |
| Kartu menampilkan "Data tidak tersedia" | Sel kosong atau baris unit tidak ada | Periksa sheet terkait |
| Kotak kuning "Sebagian data tidak terbaca" | Ada teks di kolom angka atau sheet hilang | Jalankan Cek Data, perbaiki |
| Situs kosong / error merah | File rusak atau situs belum selesai diperbarui | Tunggu 3 menit; jika tetap, kembalikan versi sebelumnya (bawah) |

### Mengembalikan ke versi sebelumnya

Di GitHub, buka file di folder `data/` → klik **History** → pilih versi sebelumnya → klik **⋯** → **View file** → **Download (Raw)**,
lalu unggah ulang file tersebut dengan nama yang sama.

---

## Hal yang sebaiknya TIDAK diubah tanpa bantuan teknis

- File di folder `assets/` (kode tampilan)
- `index.html`, `cek-data.html`

Mengubah teks sumber data atau kontak di footer: edit `assets/js/config.js` (bagian `source` dan `contact`)
langsung di GitHub (ikon pensil ✏️), lalu **Commit changes**.

---

## Kontak & serah terima

| Peran | Nama | Kontak |
|---|---|---|
| Pemilik konten | Direktorat TKKA, Bappenas | dit.tkka@bappenas.go.id |
| Admin GitHub | _(isi saat serah terima)_ | |
| Petugas pembaruan data | _(isi saat serah terima)_ | |
