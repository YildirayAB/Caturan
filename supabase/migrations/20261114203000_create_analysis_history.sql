-- =============================================================================
-- Migration: create_analysis_history
-- Proyek   : Caturan (https://github.com/YildirayAB/Caturan)
-- Tujuan   : Membuat tabel public.analysis_history untuk menyimpan dan mengelola
--            riwayat analisis pertandingan (Game Review) pengguna dengan RLS ketat.
-- =============================================================================

-- 1. Aktifkan ekstensi pgcrypto / uuid-ossp jika diperlukan untuk gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Buat tabel utama public.analysis_history
CREATE TABLE IF NOT EXISTS public.analysis_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    white_player VARCHAR(150),
    black_player VARCHAR(150),
    result VARCHAR(30),
    event VARCHAR(150),
    site VARCHAR(150),
    game_date VARCHAR(50),
    time_control VARCHAR(50),
    move_count INTEGER NOT NULL DEFAULT 0,
    final_fen VARCHAR(150),
    pgn_text TEXT NOT NULL,
    review_snapshot JSONB NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    engine_version VARCHAR(100) DEFAULT 'Stockfish 19 Lite WASM',
    analysis_settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT analysis_history_snapshot_is_object CHECK (jsonb_typeof(review_snapshot) = 'object'),
    CONSTRAINT analysis_history_settings_is_object CHECK (jsonb_typeof(analysis_settings) = 'object'),
    CONSTRAINT analysis_history_pgn_not_empty CHECK (length(trim(pgn_text)) > 0),
    CONSTRAINT analysis_history_title_not_empty CHECK (length(trim(title)) > 0)
);

COMMENT ON TABLE public.analysis_history IS
    'Menyimpan riwayat hasil analisis Chess Analysis Studio (Game Review) per akun pengguna.';
COMMENT ON COLUMN public.analysis_history.id IS
    'UUID primary key riwayat analisis.';
COMMENT ON COLUMN public.analysis_history.user_id IS
    'UUID pengguna pemilik riwayat yang merujuk langsung ke auth.users(id).';
COMMENT ON COLUMN public.analysis_history.title IS
    'Judul atau nama analisis pertandingan yang dapat diubah (rename) oleh pengguna.';
COMMENT ON COLUMN public.analysis_history.final_fen IS
    'String FEN posisi akhir mainline pertandingan untuk render visual thumbnail cepat tanpa re-parsing.';
COMMENT ON COLUMN public.analysis_history.pgn_text IS
    'Teks PGN asli yang sudah divalidasi, mempertahankan komentar, metadata, dan variasi.';
COMMENT ON COLUMN public.analysis_history.review_snapshot IS
    'Snapshot ringkas terversioning berisi hasil Game Review (evaluasi, klasifikasi, best move, loss, ringkasan).';
COMMENT ON COLUMN public.analysis_history.schema_version IS
    'Versi skema snapshot Game Review untuk kompatibilitas data di masa mendatang.';

-- 3. Fungsi & Trigger otomatis untuk memperbarui kolom updated_at saat UPDATE
CREATE OR REPLACE FUNCTION public.handle_analysis_history_updated_at()
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

DROP TRIGGER IF EXISTS set_analysis_history_updated_at ON public.analysis_history;

CREATE TRIGGER set_analysis_history_updated_at
    BEFORE UPDATE ON public.analysis_history
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_analysis_history_updated_at();

-- 4. Indeks untuk optimasi query riwayat pengguna & pagination (user_id, created_at DESC)
CREATE INDEX IF NOT EXISTS idx_analysis_history_user_created
    ON public.analysis_history (user_id, created_at DESC);

-- 5. Aktifkan Row Level Security (RLS) secara eksplisit
ALTER TABLE public.analysis_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_history FORCE ROW LEVEL SECURITY;

-- 6. Atur izin tabel (Database Grants)
REVOKE ALL ON TABLE public.analysis_history FROM PUBLIC;
REVOKE ALL ON TABLE public.analysis_history FROM anon;
REVOKE ALL ON TABLE public.analysis_history FROM authenticated;

-- Berikan izin SELECT, INSERT, UPDATE, DELETE kepada role authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.analysis_history TO authenticated;

-- 7. Kebijakan Row Level Security (RLS Policies) khusus role authenticated
-- Policy SELECT: Pengguna hanya dapat membaca riwayat miliknya sendiri
DROP POLICY IF EXISTS "analysis_history_select_own" ON public.analysis_history;
CREATE POLICY "analysis_history_select_own"
    ON public.analysis_history
    FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);

-- Policy INSERT: Pengguna hanya dapat menyimpan riwayat dengan user_id miliknya sendiri
DROP POLICY IF EXISTS "analysis_history_insert_own" ON public.analysis_history;
CREATE POLICY "analysis_history_insert_own"
    ON public.analysis_history
    FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

-- Policy UPDATE: Pengguna hanya dapat memperbarui riwayat miliknya sendiri
DROP POLICY IF EXISTS "analysis_history_update_own" ON public.analysis_history;
CREATE POLICY "analysis_history_update_own"
    ON public.analysis_history
    FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- Policy DELETE: Pengguna hanya dapat menghapus riwayat miliknya sendiri
DROP POLICY IF EXISTS "analysis_history_delete_own" ON public.analysis_history;
CREATE POLICY "analysis_history_delete_own"
    ON public.analysis_history
    FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);
