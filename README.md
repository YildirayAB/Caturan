# ♟️ Caturan — Platform Pembelajaran Catur Interaktif Berbahasa Indonesia

**Caturan** adalah platform edukasi dan tutor catur digital interaktif berbahasa Indonesia yang dirancang untuk membantu siapa saja mempelajari catur secara bertahap, terstruktur, dan menyenangkan—mulai dari mengenal papan catur untuk pertama kalinya hingga menguasai taktik, strategi, pembukaan (*opening*), dan permainan akhir (*endgame*).

Tidak seperti artikel atau buku teori catur statis, **Caturan** menggabungkan penjelasan teori yang ringkas dan mudah dipahami dengan **papan catur interaktif langsung di setiap materi**, sehingga pengguna dapat langsung mempraktikkan setiap konsep di atas papan dengan validasi aturan catur standar internasional (FIDE).

---

## ✨ Mengapa Caturan?

Banyak pemula merasa terintimidasi saat belajar catur karena istilah asing yang rumit, materi yang melompat-lompat, atau kurangnya latihan terarah. **Caturan** hadir untuk menjembatani kesenjangan tersebut melalui:

1. **100% Berbahasa Indonesia yang Jelas & Ramah Pemula**  
   Setiap konsep—mulai dari notasi aljabar, *fork*, *pin*, *skewer*, *castling* (rokade), hingga *opposition* pada babak akhir—dijelaskan dengan bahasa yang mengalir, terstruktur, dan disertai rangkuman intisari materi.
2. **Belajar Sambil Praktik (*Learn by Doing*)**  
   Setiap materi dilengkapi skenario latihan bertahap (*multi-step guided practice*) di atas papan catur interaktif. Lawan virtual akan merespons langkah Anda secara otomatis sesuai skenario materi, dilengkapi umpan balik (*feedback*) instan untuk setiap langkah benar maupun kurang tepat.
3. **Sistem Progres yang Jujur & Memotivasi**  
   Statistik belajar dimulai secara jujur dari `0`. Setiap materi yang dituntaskan memberikan hadiah **XP (Experience Points)** satu kali (tanpa duplikasi), menaikkan **Level Pengguna**, serta mencatat **Streak Belajar Harian** untuk membangun kebiasaan latihan yang konsisten.
4. **Sinkronisasi Cloud Lintas Perangkat & Dukungan Offline**  
   Terintegrasi dengan **Supabase Auth** dan **PostgreSQL (Row Level Security)** serta cache **LocalStorage**. Progres belajar tersinkronisasi secara cerdas antarperangkat dengan algoritma *deterministic merge* yang mencegah kehilangan maupun penggandaan data.

---

## 🚀 Fitur Utama

### 1. 📊 Dashboard Pembelajaran Pintar
- **Ringkasan Aktivitas Real-Time**: Menampilkan sapaan dinamis sesuai capaian belajar terkini.
- **Kartu Statistik Utama**: Memantau **Level Pengguna**, **Total XP**, **Jumlah Materi Selesai** (dari 30 materi), dan **Streak Belajar Harian**.
- **Lanjutkan Belajar (*Continue Learning*)**: Akses satu klik menuju materi terakhir yang sedang dipelajari.
- **Rekomendasi Materi Berikutnya**: Menyusun saran materi selanjutnya secara otomatis berdasarkan urutan kurikulum.
- **Pemantauan Progres Per Kategori**: Bar progres visual untuk masing-masing dari 6 level kurikulum.

### 2. 📚 Kurikulum Terstruktur (6 Level • 30 Materi)
- Materi disusun secara berjenjang dari tingkat dasar hingga mahir.
- Dilengkapi filter kategori per level, indikator status per materi (*Belum Dimulai*, *Sedang Dipelajari*, *Selesai*), estimasi waktu belajar, dan hadiah XP.

### 3. ♟️ Ruang Belajar & Papan Catur Interaktif
- **Mesin Validasi Catur Penuh (`Chess.js`)**: Mendukung seluruh aturan resmi catur termasuk langkah legal tiap bidak, *Check* (skak), *Checkmate* (skakmat), *Stalemate* (remis pat), *Castling* (rokade), *En Passant*, dan *Pawn Promotion* (promosi bidak).
- **Interaksi Ganda**: Mendukung klik petak asal–tujuan (*click-to-move*) maupun seret dan lepas (*drag-and-drop*) yang responsif di desktop maupun layar sentuh.
- **Fitur Pendukung Latihan**:
  - 💡 **Petunjuk (*Hint*)** untuk membantu ketika menemui jalan buntu.
  - 🔄 **Ulangi Posisi (*Restart*)** untuk mengulang latihan dari posisi awal.
  - 🔃 **Balik Papan (*Flip Board*)** untuk melihat sudut pandang Putih atau Hitam.
  - 🧭 **Mode Eksplorasi Bebas** setelah latihan utama tuntas agar pengguna dapat mencoba berbagai variasi langkah secara mandiri.

### 4. ☁️ Autentikasi Privat & Sinkronisasi Cloud (Supabase)
- **Manajemen Sesi Aman**: Menggunakan Supabase Auth (Email & Kata Sandi) dengan pemulihan sesi otomatis dan fitur pengaturan ulang kata sandi.
- **Strategi *Deterministic Cloud-Local Merge***: Menggabungkan riwayat materi selesai (`completedLessonIds`), materi yang pernah dibuka (`startedLessonIds`), kalender aktivitas harian (`activityDates`), serta menghitung ulang `totalXp` secara deterministik berdasarkan kurikulum.
- **Indikator Status Sinkronisasi Transparan**: Menampilkan status real-time (`Tersinkronisasi`, `Menyinkronkan`, `Sinkronisasi tertunda`, `Offline`, atau `Gagal menyinkronkan` beserta tombol **Coba Lagi**).

### 5. 🎨 Desain Minimalis, Kontras Tinggi, & Responsif
- **Light Mode & Dark Mode**: Pergantian tema instan yang nyaman di mata tanpa penggunaan gradasi warna (*100% solid color system*).
- **Sidebar Adaptif**: Sidebar navigasi dapat disembunyikan sepenuhnya (*collapsible*) di layar desktop untuk memaksimalkan ruang belajar, serta berubah menjadi *responsive slide-over drawer* di tablet dan smartphone.

---

## 📖 Struktur Kurikulum Lengkap (30 Materi)

| Level | Kategori Kurikulum | Jumlah Materi | Topik Pembelajaran Utama |
| :---: | :--- | :---: | :--- |
| **Level 1** | **Dasar-Dasar Catur** | 5 Materi | Mengenal papan catur & petak terang/gelap, sistem koordinat & notasi aljabar (`a1`–`h8`), pengenalan 6 jenis bidak, posisi awal standar, serta tujuan permainan catur. |
| **Level 2** | **Aturan Permainan** | 7 Materi | Cara gerak & tangkap tiap bidak (Pion, Benteng, Kuda, Gajah, Menteri, Raja), konsep *Check* (skak) & 3 cara menghindarinya (CPR), *Checkmate* (skakmat), *Stalemate* & remis, *Castling* (rokade), *En Passant*, dan *Pawn Promotion*. |
| **Level 3** | **Taktik Catur** | 5 Materi | *Fork* (serangan ganda), *Pin* (paku mutlak & relatif), *Skewer* (tusuk sate), *Discovered Attack* (serangan terbuka), serta *Back Rank Mate* (skakmat baris belakang). |
| **Level 4** | **Strategi Catur** | 5 Materi | Penguasaan pusat papan (*center control*), pengembangan perwira (*piece development*), keamanan Raja (*king safety*), struktur pion (*isolated*, *doubled*, *passed pawn*), dan koordinasi antarbidak. |
| **Level 5** | **Opening (Pembukaan)** | 4 Materi | Prinsip emas pembukaan catur, *Italian Game* (`1.e4 e5 2.Nf3 Nc6 3.Bc4`), *Sicilian Defense* (`1.e4 c5`), dan *Queen's Gambit* (`1.d4 d5 2.c4`). |
| **Level 6** | **Endgame (Permainan Akhir)** | 4 Materi | Aktivasi Raja di babak akhir, teknik *King and Pawn vs King* & konsep *Opposition*, skakmat dasar *King and Queen vs King*, serta *Rook Endgame* dasar. |

---

## 🛠️ Teknologi & Arsitektur

Proyek ini dibangun dengan arsitektur **Modular Vanilla JavaScript (ES Modules)** yang ringan, cepat, tanpa ketergantungan framework frontend yang berat, serta siap dijalankan di mana saja:

- **Frontend**: HTML5 Semantik, CSS3 Custom Properties (Modular Stylesheets), JavaScript (ES6+ Modules).
- **Chess Engine & Move Validation**: `Chess.js` (implementasi penuh aturan FIDE, parser FEN, generator langkah legal, dan deteksi akhir permainan).
- **Backend & Cloud Database**: **Supabase** (`@supabase/supabase-js` v2, PostgreSQL `JSONB`, Supabase Auth, dan Row Level Security).
- **Local Persistence**: `LocalStorage` dengan lapisan sanitasi skema dan *automatic backup snapshot*.
- **Development Server & Static Deployment**: Node.js Development Server (`dev-server.js`) & Static Build Output (`dist/`) untuk **Vercel** (`vercel.json`).

### Struktur Direktori Proyek

```text
Caturan/
├── css/
│   ├── variables.css          # Variabel sistem desain, palet warna Light/Dark Mode, & tipografi
│   ├── layout.css             # Struktur App Shell, Topbar, Sidebar Desktop/Mobile, & Grid responsif
│   ├── components.css         # Komponen kartu, tombol, badge, progress bar, & halaman Login
│   └── chessboard.css         # Styling papan catur interaktif, koordinat, & highlight langkah
├── js/
│   ├── main.js                # Entry point aplikasi (CaturanApp controller, routing, & auth gate)
│   ├── env.js                 # Stub konfigurasi environment runtime di sisi klien
│   ├── components/
│   │   ├── chessboardUI.js    # Komponen papan catur interaktif & evaluator latihan/puzzle
│   │   ├── dashboardView.js   # Tampilan halaman Dashboard utama
│   │   ├── learnView.js       # Tampilan halaman Kurikulum Belajar (6 Level, 30 Materi)
│   │   ├── lessonDetailView.js# Tampilan ruang belajar teori + praktik papan catur
│   │   ├── puzzleView.js      # Tampilan halaman Dashboard Puzzle Catur (MVP 2)
│   │   ├── puzzlePlayView.js  # Tampilan ruang latihan Papan Puzzle Interaktif (MVP 2)
│   │   ├── playView.js        # Tampilan halaman Dashboard Bermain & Pengaturan Permainan (MVP 3)
│   │   ├── playGameView.js    # Tampilan ruang pertandingan Melawan Komputer / Stockfish (MVP 3)
│   │   ├── openingView.js     # Tampilan halaman Opening Dashboard & Opening Library (MVP 4)
│   │   ├── openingLearnView.js# Tampilan halaman Opening Detail & Learn Mode (MVP 4)
│   │   ├── openingPracticeView.js # Tampilan halaman Opening Practice Mode & Practice Result (MVP 4)
│   │   ├── loginView.js       # Tampilan halaman Login privat
│   │   ├── sidebar.js         # Komponen navigasi sidebar, status sinkronisasi, & akun
│   │   └── icons.js           # Kumpulan ikon UI & vektor bidak catur SVG standar turnamen
│   ├── data/
│   │   ├── curriculum.js      # Database lengkap 6 level & 30 materi beserta skenario FEN & langkah
│   │   ├── puzzles.json       # Dataset statis 60 puzzle taktik terkurasi dari Lichess Open Database
│   │   ├── puzzles.js         # Modul ES dataset puzzle, kategori tema, kesulitan, & pemilihan harian
│   │   ├── openings.json      # Dataset statis 24 variasi opening terkurasi dari Lichess Chess Openings
│   │   └── openings.js        # Modul ES dataset opening, kategori, repertoire, & pemilih variasi
│   ├── services/
│   │   ├── auth.js            # Layanan autentikasi Supabase Auth & manajemen sesi
│   │   ├── progress.js        # Kalkulasi XP, Level, Streak harian, progres puzzle, & statistik bermain
│   │   ├── stockfishEngine.js # Layanan UCI Web Worker untuk engine Stockfish 19 Lite WASM (MVP 3)
│   │   ├── storage.js         # LocalStorageAdapter, SupabaseStorageAdapter, & algoritma Merge
│   │   ├── supabaseClient.js  # Inisialisasi Supabase client & validasi keamanan kunci publik
│   │   └── theme.js           # Pengelolaan tema Light Mode & Dark Mode
│   └── vendor/
│       ├── chess.js           # Mesin aturan catur Chess.js
│       ├── supabase.js        # Bundel ES Module @supabase/supabase-js untuk browser
│       └── stockfish/         # Binary lokal Stockfish 19 Lite Single-Threaded (.js, .wasm, Copying.txt)
├── scripts/
│   └── generate-env.js        # Script penyuntik variabel environment & penyalin aset static dist/
├── supabase/
│   ├── config.toml            # Konfigurasi proyek lokal Supabase CLI v3
│   ├── migrations/            # Riwayat migrasi SQL skema database & kebijakan RLS
│   ├── seed.sql               # File seed database lokal
│   └── README.md              # Dokumentasi alur kerja database & Supabase CLI
├── THIRD_PARTY_NOTICES.md     # Pemberitahuan lisensi pihak ketiga (Stockfish GPL-3.0, Lichess CC0, dll.)
├── .env.example               # Template variabel environment publik
├── index.html                 # Dokumen utama aplikasi
├── package.json               # Manifes proyek & dependensi
├── dev-server.js              # Server HTTP pengembangan lokal Node.js
└── vercel.json                # Konfigurasi static website deployment Vercel
```

---

## 🎨 Sistem Desain & Palet Warna

**Caturan** menerapkan prinsip desain **100% Solid Color (Tanpa Gradient)** untuk menjaga keterbacaan teks teori dan kejelasan visual petak papan catur di segala kondisi pencahayaan:

| Elemen Desain | Light Mode | Dark Mode |
| :--- | :--- | :--- |
| **Background Utama** | `#F8F5EF` (*Warm Ivory*) | `#101C30` (*Deep Navy*) |
| **Permukaan Kartu / Sidebar** | `#FFFFFF` (*Pure White*) | `#17263F` (*Slate Navy*) |
| **Warna Teks Utama** | `#17243A` (*Dark Slate*) | `#F5F3EF` (*Soft Off-White*) |
| **Warna Aksen Utama** | `#E98232` (*Warm Chess Amber*) | `#E98232` (*Warm Chess Amber*) |

---

## ⚙️ Cara Menjalankan Secara Lokal

### 1. Prasyarat
- **Node.js** (v18 atau lebih baru)
- **Git**

### 2. Clone Repository & Instal Dependensi
```bash
git clone https://github.com/YildirayAB/Caturan.git
cd Caturan
npm install
```

### 3. Konfigurasi Variabel Environment (`.env.local`)
Salin file `.env.example` menjadi `.env.local` di root proyek:
```bash
cp .env.example .env.local
```
Kemudian isi dengan URL dan *Publishable / Anon Key* dari project Supabase Anda:
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_or_anon_key_here
```
> 🔒 **Catatan Keamanan**: Jangan pernah memasukkan `service_role` key, `secret` key, atau password database ke dalam `.env.local` maupun kode frontend. File `.env.local` secara otomatis diabaikan oleh `.gitignore`.

### 4. Jalankan Server Pengembangan
```bash
npm run dev
```
Buka **`http://localhost:3000`** di browser Anda.

---

## 🌐 Deployment ke Vercel

Proyek ini telah dikonfigurasi agar siap di-deploy ke **Vercel**:
1. Hubungkan repository GitHub **Caturan** ke dashboard Vercel.
2. Pada menu **Project Settings → Environment Variables**, tambahkan:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Saat proses deployment berjalan, perintah `npm run build` pada `vercel.json` akan menyiapkan konfigurasi runtime secara otomatis.

---

## 🗺️ Peta Jalan Pengembangan (*Roadmap*)

- [x] **Tahap 1 (MVP 1 — Selesai)**:
  - Dashboard Progres Belajar, Sistem XP, Level, dan Streak Harian.
  - Kurikulum Belajar 6 Level (30 Materi Lengkap) dengan Teori & Papan Catur Interaktif.
  - Sistem Tema Light Mode & Dark Mode serta Navigasi Sidebar Responsif.
  - Autentikasi Privat Supabase Auth & Sinkronisasi Progres Cloud (`public.user_progress` dengan RLS).
- [x] **Tahap 2 (MVP 2 — Selesai)**:
  - 🧩 **Puzzle Taktik Catur Interaktif**: Dashboard Puzzle, Statistik Akurasi, Puzzle Harian Deterministik, 6 Kategori Tema Taktik, 3 Tingkat Kesulitan, Sistem Petunjuk 2 Tahap, serta Sinkronisasi Cloud `puzzleProgress`.
- [x] **Tahap 3 (MVP 3 — Selesai)**:
  - 🤖 **Bermain Melawan Komputer (Stockfish 19 Lite WASM)**: Pertandingan catur standar melawan engine Stockfish di Web Worker dengan 3 tingkat kesulitan (*Pemula*, *Menengah*, *Lanjutan*), pilihan warna bidak (*Putih*, *Hitam*, *Acak*), riwayat notasi SAN, bidak tertangkap, serta sinkronisasi cloud `playProgress`.
- [x] **Tahap 4 (MVP 4 — Selesai)**:
  - 🧭 **Opening Trainer**: Koleksi 24 variasi pembukaan catur tervalidasi (12 Repertoire Putih & 12 Repertoire Hitam), Opening Dashboard, Opening Library dengan filter & pencarian nama/ECO, Opening Detail & Learn Mode dengan Explanation Panel berbahasa Indonesia, Opening Practice Mode interaktif dengan sistem Hint 3 tahap, serta sinkronisasi cloud `openingProgress`.
- [ ] **Tahap Berikutnya (Coming Soon)**:
  - 📈 **Papan Analisis**: Evaluasi posisi dan peninjauan notasi pertandingan (PGN).

---

## 📚 Atribusi Pihak Ketiga & Sumber Data

- **Stockfish 19 Lite WASM (`stockfish@19.0.1`)**: Mesin catur lawan komputer pada fitur **Bermain Melawan Komputer (MVP 3)** didistribusikan di bawah lisensi **GNU General Public License v3.0 (GPL-3.0)**. Informasi lengkap sumber kode dan teks lisensi tersedia pada [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).
- **Lichess Open Database**: Dataset teka-teki taktik catur pada fitur **Puzzle Catur (MVP 2)** bersumber dari **Lichess Open Database — CC0 Public Domain** (`https://database.lichess.org/#puzzles`).
- **Lichess Chess Openings Dataset (`lichess-org/chess-openings`)**: Data kode ECO, nama pembukaan, urutan langkah PGN, UCI, dan EPD pada fitur **Opening Trainer (MVP 4)** bersumber dari **Lichess Chess Openings Dataset — CC0 1.0 Universal Public Domain** (`https://github.com/lichess-org/chess-openings`). Penjelasan strategis dan ide utama disusun secara orisinal dalam Bahasa Indonesia sebagai panduan belajar umum.

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah **MIT License**. Dibangun dengan dedikasi untuk memajukan ekosistem pembelajaran catur digital berbahasa Indonesia.
