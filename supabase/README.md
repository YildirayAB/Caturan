# Dokumentasi Supabase — Caturan

Folder ini menyimpan konfigurasi lokal, skema tabel database, kebijakan keamanan **Row Level Security (RLS)**, dan riwayat SQL migration untuk proyek **Caturan** (`https://github.com/YildirayAB/Caturan`).

- **Supabase Project Ref**: `igghkhjgebbbcbsliwyo`

---

## 1. Struktur Folder

```text
supabase/
├── config.toml                                         # Konfigurasi utama Supabase CLI (registrasi publik dinonaktifkan)
├── migrations/
│   ├── .gitkeep
│   └── 20261106180900_create_user_progress.sql         # Migration pembuatan tabel public.user_progress & RLS
├── seed.sql                                            # Data awal (seed) untuk lingkungan pengembangan lokal
└── README.md                                           # Dokumentasi skema database, RLS, dan panduan operasional
```

---

## 2. Deskripsi Tabel `public.user_progress`

Tabel `public.user_progress` berfungsi menyimpan payload progres belajar catur untuk setiap akun pengguna yang terautentikasi melalui **Supabase Auth** (`auth.users`).

Meskipun Caturan pada tahap awal digunakan secara privat oleh 1 akun pemilik proyek (yang diakses bersama dari Laptop A dan Laptop B), desain tabel berbasis `user_id` ini secara alami sudah siap mendukung banyak akun di masa mendatang tanpa perlu merombak skema tabel.

### A. Struktur Kolom Tabel

| Nama Kolom | Tipe Data | Constraint & Default | Deskripsi |
| :--- | :--- | :--- | :--- |
| `user_id` | `UUID` | `PRIMARY KEY`, `REFERENCES auth.users(id) ON DELETE CASCADE` | ID unik pengguna dari tabel autentikasi Supabase (`auth.users`). Jika akun dihapus, baris progres ikut terhapus otomatis. |
| `progress` | `JSONB` | `NOT NULL DEFAULT '{}'::jsonb`, `CHECK (jsonb_typeof(progress) = 'object')` | Objek JSONB yang menyimpan seluruh state progres belajar pengguna. Hanya menerima tipe JSON *object* (menolak array, string, angka, atau boolean). |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Waktu pembuatan baris progres pertama kali. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` (Diperbarui otomatis oleh trigger `set_user_progress_updated_at`) | Waktu pembaruan terakhir baris progres pada sisi server database. |

### B. Struktur Data Payload JSONB (`progress`)

Kolom `progress` dirancang 100% selaras dengan struktur state pada `js/services/storage.js` (`createInitialProgressState` & `sanitizeProgressState`) dan `js/services/progress.js`:

```json
{
  "schemaVersion": 1,
  "totalXp": 150,
  "completedLessonIds": [
    "l1-1-mengenal-papan",
    "l1-2-koordinat",
    "l1-3-mengenal-bidak"
  ],
  "startedLessonIds": [
    "l1-1-mengenal-papan",
    "l1-2-koordinat",
    "l1-3-mengenal-bidak",
    "l1-4-cara-bergerak"
  ],
  "lastOpenedLessonId": "l1-4-cara-bergerak",
  "activityDates": [
    "2026-11-06",
    "2026-11-07"
  ],
  "lessonCompletedAt": {
    "l1-1-mengenal-papan": "2026-11-06T16:30:00.000Z",
    "l1-2-koordinat": "2026-11-06T16:45:00.000Z",
    "l1-3-mengenal-bidak": "2026-11-07T00:15:00.000Z"
  },
  "updatedAt": "2026-11-07T00:15:00.000Z"
}
```

*(Catatan: Preferensi tampilan lokal perangkat seperti `THEME_PREF` dan `SIDEBAR_COLLAPSED` tetap disimpan di `LocalStorage` masing-masing perangkat).*

---

## 3. Keamanan Row Level Security (RLS) & Hak Akses (Grants)

Tabel `public.user_progress` diamankan secara berlapis melalui **Database Role Privileges** dan **Row Level Security**:

1. **Aktivasi RLS Eksplisit**:
   - `ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;`
   - `ALTER TABLE public.user_progress FORCE ROW LEVEL SECURITY;`
2. **Pembatasan Hak Akses Role (`REVOKE` & `GRANT`)**:
   - Seluruh hak akses untuk `PUBLIC` dan `anon` dicabut sepenuhnya (`REVOKE ALL`). Pengguna tanpa login (`anon`) tidak dapat membaca maupun memodifikasi tabel.
   - Role `authenticated` **hanya** diberikan izin `SELECT`, `INSERT`, dan `UPDATE` (`GRANT SELECT, INSERT, UPDATE ON TABLE public.user_progress TO authenticated;`).
   - Izin `DELETE` **tidak diberikan** kepada role `authenticated` untuk mencegah penghapusan baris progres secara tidak sengaja dari sisi klien.
3. **Kebijakan RLS (`CREATE POLICY ... TO authenticated`)**:
   - **`user_progress_select_own` (`FOR SELECT TO authenticated`)**:
     Menggunakan kondisi `USING (auth.uid() = user_id)` sehingga pengguna yang login hanya bisa melihat datanya sendiri.
   - **`user_progress_insert_own` (`FOR INSERT TO authenticated`)**:
     Menggunakan kondisi `WITH CHECK (auth.uid() = user_id)` sehingga pengguna hanya bisa membuat baris progres untuk `user_id` miliknya sendiri.
   - **`user_progress_update_own` (`FOR UPDATE TO authenticated`)**:
     Menggunakan kondisi `USING (auth.uid() = user_id)` (sebelum perubahan) **dan** `WITH CHECK (auth.uid() = user_id)` (setelah perubahan), sehingga pengguna hanya bisa memperbarui barisnya sendiri dan tidak bisa memindahkan kepemilikan baris ke `user_id` lain.

---

## 4. Cara Memeriksa dan Menerapkan Migration

Pastikan Anda menjalankan perintah berikut dari direktori root `Caturan/`:

1. **Memeriksa daftar dan status migration (Lokal vs Remote):**
   ```powershell
   npx supabase migration list
   ```
2. **Simulasi pengecekan sebelum menerapkan migration (`--dry-run`):**
   ```powershell
   npx supabase db push --dry-run
   ```
3. **Menerapkan migration ke proyek Supabase Hosted (setelah disetujui):**
   ```powershell
   npx supabase db push
   ```
4. **Membuat file migration baru di masa mendatang:**
   ```powershell
   npx supabase migration new <nama_migration>
   ```

---

## 5. Langkah Manual Pembuatan Akun Pemilik di Supabase Dashboard

Karena Caturan tidak membuka registrasi publik, akun pemilik dibuat secara manual melalui **Supabase Dashboard**:

1. Buka [Supabase Dashboard](https://supabase.com/dashboard/project/igghkhjgebbbcbsliwyo).
2. Pastikan registrasi publik dinonaktifkan:
   - Masuk ke menu **Authentication** → **Providers** → **Email** (atau **User Signups** di **Auth Settings**).
   - Matikan opsi **Allow new users to sign up** (*Disable public sign-ups*), lalu klik **Save**.
3. Buat akun pemilik secara manual:
   - Masuk ke menu **Authentication** → **Users**.
   - Klik tombol **Add user** → pilih **Create new user**.
   - Masukkan **Email** dan **Password** yang kuat untuk akun pemilik Caturan.
   - Centang opsi **Auto Confirm User** agar akun langsung aktif tanpa perlu verifikasi email.
   - Klik **Create user**.
4. Gunakan akun email dan password yang sama tersebut untuk login di **Laptop A** maupun **Laptop B** ketika fitur sinkronisasi antarmuka diaktifkan.

---

## 6. Aturan Keamanan Kredensial

- **Jangan pernah** menyimpan `SUPABASE_SERVICE_ROLE_KEY` atau *Database Password* di dalam kode frontend maupun melakukan commit file `.env` ke GitHub.
- Di sisi frontend nantinya hanya boleh menggunakan **Project URL** dan **Anon / Publishable Key** publik, karena seluruh keamanan data telah dijaga penuh oleh **Supabase Auth + RLS** pada tabel `public.user_progress`.
