-- =============================================================================
-- Migration: add_final_fen_to_analysis_history
-- Proyek   : Caturan (https://github.com/YildirayAB/Caturan)
-- Tujuan   : Menambahkan kolom final_fen ke tabel public.analysis_history secara
--            aman (additive IF NOT EXISTS) tanpa merusak tabel/data yang sudah ada.
-- =============================================================================

-- 1. Tambahkan kolom final_fen jika belum tersedia
ALTER TABLE public.analysis_history
    ADD COLUMN IF NOT EXISTS final_fen VARCHAR(150);

-- 2. Tambahkan komentar kolom untuk dokumentasi skema
COMMENT ON COLUMN public.analysis_history.final_fen IS
    'String FEN posisi akhir mainline pertandingan untuk render visual thumbnail cepat tanpa re-parsing.';
