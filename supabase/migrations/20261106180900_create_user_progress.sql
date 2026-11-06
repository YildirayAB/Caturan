-- =============================================================================
-- Migration: create_user_progress
-- Proyek   : Caturan (https://github.com/YildirayAB/Caturan)
-- Tujuan   : Membuat tabel public.user_progress untuk menyimpan payload progres
--            belajar catur per akun pengguna dengan perlindungan ketat RLS.
-- =============================================================================

-- 1. Buat tabel utama public.user_progress
CREATE TABLE IF NOT EXISTS public.user_progress (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    progress JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_progress_progress_is_object CHECK (jsonb_typeof(progress) = 'object')
);

COMMENT ON TABLE public.user_progress IS
    'Menyimpan state progres belajar pengguna Caturan dalam format JSONB object (1 baris per user_id).';
COMMENT ON COLUMN public.user_progress.user_id IS
    'UUID pengguna yang merujuk langsung ke auth.users(id).';
COMMENT ON COLUMN public.user_progress.progress IS
    'Payload JSON object dari ProgressService (schemaVersion, totalXp, completedLessonIds, startedLessonIds, lastOpenedLessonId, activityDates, lessonCompletedAt, updatedAt).';
COMMENT ON COLUMN public.user_progress.created_at IS
    'Waktu pertama kali baris progres pengguna dibuat.';
COMMENT ON COLUMN public.user_progress.updated_at IS
    'Waktu terakhir kali baris progres pengguna diperbarui.';

-- 2. Fungsi & Trigger otomatis untuk memperbarui kolom updated_at saat UPDATE
CREATE OR REPLACE FUNCTION public.handle_user_progress_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_user_progress_updated_at ON public.user_progress;

CREATE TRIGGER set_user_progress_updated_at
    BEFORE UPDATE ON public.user_progress
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_progress_updated_at();

-- 3. Aktifkan Row Level Security (RLS) secara eksplisit
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress FORCE ROW LEVEL SECURITY;

-- 4. Atur ulang izin tabel (Database Grants) secara eksplisit
-- Cabut seluruh akses default dari PUBLIC dan anon, serta reset akses authenticated
REVOKE ALL ON TABLE public.user_progress FROM PUBLIC;
REVOKE ALL ON TABLE public.user_progress FROM anon;
REVOKE ALL ON TABLE public.user_progress FROM authenticated;

-- Berikan hanya izin SELECT, INSERT, dan UPDATE kepada role authenticated (tanpa DELETE)
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_progress TO authenticated;

-- 5. Kebijakan Row Level Security (RLS Policies) khusus role authenticated
-- Policy SELECT: Pengguna terautentikasi hanya dapat membaca baris miliknya sendiri
DROP POLICY IF EXISTS "user_progress_select_own" ON public.user_progress;
CREATE POLICY "user_progress_select_own"
    ON public.user_progress
    FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);

-- Policy INSERT: Pengguna terautentikasi hanya dapat menambahkan baris dengan user_id miliknya sendiri
DROP POLICY IF EXISTS "user_progress_insert_own" ON public.user_progress;
CREATE POLICY "user_progress_insert_own"
    ON public.user_progress
    FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

-- Policy UPDATE: Pengguna terautentikasi hanya dapat mengubah baris miliknya sendiri (sebelum & sesudah perubahan)
DROP POLICY IF EXISTS "user_progress_update_own" ON public.user_progress;
CREATE POLICY "user_progress_update_own"
    ON public.user_progress
    FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);
