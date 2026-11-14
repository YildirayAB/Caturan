/**
 * Layanan Penyimpanan & Sinkronisasi Cloud Analysis History (MVP 5.6)
 *
 * Mengelola interaksi Supabase untuk tabel `public.analysis_history`:
 * 1. Simpan hasil Game Review terversioning ke Supabase.
 * 2. Ambil daftar riwayat analisis dengan pagination dan pengurutan (created_at DESC).
 * 3. Buka kembali riwayat analisis (reconstruct Game Review dari snapshot).
 * 4. Ubah judul (Rename) analisis.
 * 5. Hapus riwayat (Delete) analisis.
 * 6. Mengamankan autentikasi & validasi ukuran payload.
 *
 * Kepatuhan:
 * - Tidak pernah menggunakan service_role key di frontend.
 * - Tidak pernah menyimpan PGN ke LocalStorage.
 * - Membatasi ukuran payload dan snapshot ringkas.
 */

import { getSupabaseClient } from './supabaseClient.js';
import { authService } from './auth.js';

export const CURRENT_ANALYSIS_SCHEMA_VERSION = 1;
export const MAX_ANALYSIS_TITLE_LENGTH = 150;
export const MAX_SNAPSHOT_PAYLOAD_BYTES = 500 * 1024; // 500 KB limit per game snapshot
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Membangun snapshot ringkas dari Game Review yang selesai untuk disimpan di Supabase.
 * Menghindari data raw log yang tidak terpakai, hanya data yang diperlukan untuk merender
 * grafik, klasifikasi, best move, dan laporan statistik.
 */
export function buildAnalysisSnapshot({ report, graphData, snapshots, analysisSettings = {} }) {
  if (!report || !snapshots || !Array.isArray(snapshots) || snapshots.length === 0) {
    throw new Error('Data Game Review tidak valid untuk pembuatan snapshot.');
  }

  // Format ringkas per ply:
  // ply, eval (type, value, raw, label, isMate), bestMove (uci, san), classification, cpl, playedMoveUci
  const positions = snapshots.map(snap => {
    const analysis = snap.analysis || {};
    const evalObj = analysis.evaluation || null;
    const bestMove = analysis.bestMove || null;
    const classification = snap.classification || null;

    return {
      ply: snap.ply,
      moveNumber: snap.moveNumber,
      turn: snap.turn,
      san: snap.san || null,
      playedMoveUci: snap.playedMoveUci || null,
      eval: evalObj
        ? {
            type: evalObj.type,
            value: evalObj.value,
            raw: evalObj.raw,
            label: evalObj.label,
            isMate: Boolean(evalObj.isMate),
            mateValue: evalObj.mateValue ?? null
          }
        : null,
      bestMove: bestMove
        ? {
            uci: bestMove.uci || null,
            san: bestMove.san || null,
            from: bestMove.from || null,
            to: bestMove.to || null
          }
        : null,
      classification: classification
        ? {
            category: classification.category,
            name: classification.name,
            centipawnLoss: classification.centipawnLoss,
            pawnsLoss: classification.pawnsLoss
          }
        : null
    };
  });

  const snapshot = {
    schemaVersion: CURRENT_ANALYSIS_SCHEMA_VERSION,
    engineVersion: 'Stockfish 19 Lite WASM',
    analysisSettings: {
      depth: analysisSettings.depth || 16,
      moveTimeMs: analysisSettings.moveTimeMs || 250,
      isMobile: Boolean(analysisSettings.isMobile)
    },
    savedAt: new Date().toISOString(),
    report: {
      gameInfo: report.gameInfo || {},
      accuracy: report.accuracy || {},
      counts: report.counts || {},
      criticalMoments: report.criticalMoments || []
    },
    graphPoints: Array.isArray(graphData?.points) ? graphData.points : [],
    positions
  };

  // Simpan finalFen posisi akhir jika tersedia di snapshot ply terakhir
  if (positions.length > 0) {
    const lastSnap = snapshots[snapshots.length - 1];
    if (lastSnap?.fen) {
      snapshot.finalFen = lastSnap.fen;
    }
  }

  const jsonString = JSON.stringify(snapshot);
  const byteSize = typeof Blob !== 'undefined'
    ? new Blob([jsonString]).size
    : Buffer.byteLength(jsonString, 'utf8');

  if (byteSize > MAX_SNAPSHOT_PAYLOAD_BYTES) {
    throw new Error(`Ukuran data analisis (${Math.round(byteSize / 1024)} KB) melebihi batas aman (${Math.round(MAX_SNAPSHOT_PAYLOAD_BYTES / 1024)} KB).`);
  }

  return snapshot;
}

/**
 * Memvalidasi apakah snapshot yang dimuat kompatibel dengan skema saat ini.
 */
export function isSnapshotCompatible(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  if (snapshot.schemaVersion !== CURRENT_ANALYSIS_SCHEMA_VERSION) return false;
  if (!snapshot.report || !Array.isArray(snapshot.positions)) return false;
  return true;
}

/**
 * Memulihkan state Game Review dari snapshot yang kompatibel.
 */
export function restoreGameReviewFromSnapshot(snapshot, parsedGame) {
  if (!isSnapshotCompatible(snapshot)) {
    throw new Error('Skema snapshot analisis tidak kompatibel dengan versi saat ini.');
  }

  const positions = snapshot.positions || [];
  const initialFen = parsedGame.initialFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  // Bangun kembali struktur snapshots yang diharapkan oleh gameReviewView & evaluationGraph
  const restoredSnapshots = positions.map((pos, index) => {
    return {
      ply: pos.ply,
      moveNumber: pos.moveNumber,
      turn: pos.turn,
      fen: pos.ply === 0 ? initialFen : '', // Akan diisi saat replay jika perlu
      playedMoveUci: pos.playedMoveUci,
      san: pos.san,
      analysis: pos.eval
        ? {
            ok: true,
            depth: snapshot.analysisSettings?.depth || 16,
            evaluation: pos.eval,
            bestMove: pos.bestMove,
            pv: { moves: [], formattedSan: '' }
          }
        : null,
      classification: pos.classification
    };
  });

  return {
    report: snapshot.report,
    graphData: {
      points: snapshot.graphPoints || [],
      totalMoves: snapshot.report?.gameInfo?.totalMoves || 0
    },
    snapshots: restoredSnapshots,
    isRestoredFromCloud: true
  };
}

export class AnalysisHistoryService {
  constructor(clientGetter = getSupabaseClient) {
    this._getClient = clientGetter;
  }

  /**
   * Menyimpan riwayat analisis baru ke Supabase
   */
  async saveAnalysis({
    title,
    pgnText,
    parsedGame,
    gameReviewReport,
    gameReviewGraphData,
    gameReviewSnapshots,
    analysisSettings = {}
  }) {
    const user = authService.getUser();
    if (!user || !user.id) {
      throw new Error('Anda harus masuk terlebih dahulu untuk menyimpan analisis ke cloud.');
    }

    if (!pgnText || typeof pgnText !== 'string' || !pgnText.trim()) {
      throw new Error('Teks PGN tidak boleh kosong.');
    }

    if (!gameReviewReport || !gameReviewSnapshots || gameReviewSnapshots.length === 0) {
      throw new Error('Hasil Game Review belum lengkap. Jalankan analisis sampai selesai sebelum menyimpan.');
    }

    // Bangun judul default jika kosong
    const headers = parsedGame?.headers || {};
    const whitePlayer = headers.White || 'Putih';
    const blackPlayer = headers.Black || 'Hitam';
    const result = headers.Result || '*';
    const moveCount = parsedGame?.moves?.length || 0;

    const defaultTitle = `${whitePlayer} vs ${blackPlayer}`;
    const cleanTitle = (typeof title === 'string' && title.trim().length > 0)
      ? title.trim().slice(0, MAX_ANALYSIS_TITLE_LENGTH)
      : defaultTitle;

    const reviewSnapshot = buildAnalysisSnapshot({
      report: gameReviewReport,
      graphData: gameReviewGraphData,
      snapshots: gameReviewSnapshots,
      analysisSettings
    });

    const client = this._getClient();
    if (!client) {
      throw new Error('Layanan database Supabase belum terkonfigurasi.');
    }

    const finalFen = parsedGame?.finalFen || reviewSnapshot?.finalFen || (parsedGame?.positions ? parsedGame.positions[parsedGame.positions.length - 1]?.fen : null);

    const payload = {
      user_id: user.id,
      title: cleanTitle,
      white_player: whitePlayer,
      black_player: blackPlayer,
      result: result,
      event: headers.Event || null,
      site: headers.Site || null,
      game_date: headers.Date || null,
      time_control: headers.TimeControl || null,
      move_count: moveCount,
      final_fen: finalFen || null,
      pgn_text: pgnText.trim(),
      review_snapshot: reviewSnapshot,
      schema_version: CURRENT_ANALYSIS_SCHEMA_VERSION,
      engine_version: 'Stockfish 19 Lite WASM',
      analysis_settings: reviewSnapshot.analysisSettings
    };

    const { data, error } = await client
      .from('analysis_history')
      .insert(payload)
      .select('id, title, created_at, updated_at')
      .single();

    if (error) {
      console.error('[AnalysisHistoryService] Gagal menyimpan analisis:', error);
      throw new Error(this._translateDbError(error, 'Gagal menyimpan analisis ke cloud.'));
    }

    return {
      success: true,
      id: data.id,
      title: data.title,
      createdAt: data.created_at
    };
  }

  /**
   * Mengambil daftar riwayat analisis pengguna dengan pagination
   */
  async getAnalysisList({ page = 1, pageSize = DEFAULT_PAGE_SIZE, searchQuery = '', sortOrder = 'desc' } = {}) {
    const user = authService.getUser();
    if (!user || !user.id) {
      return { items: [], totalCount: 0, page, pageSize, error: 'Unauthorized' };
    }

    const client = this._getClient();
    if (!client) {
      return { items: [], totalCount: 0, page, pageSize, error: 'Supabase client not configured' };
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const ascending = sortOrder === 'asc';

    let query = client
      .from('analysis_history')
      .select('id, title, white_player, black_player, result, event, site, game_date, move_count, final_fen, pgn_text, created_at, updated_at, schema_version', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending })
      .range(from, to);

    if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim()) {
      const q = `%${searchQuery.trim()}%`;
      query = query.or(`title.ilike.${q},white_player.ilike.${q},black_player.ilike.${q},event.ilike.${q}`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[AnalysisHistoryService] Gagal mengambil daftar riwayat:', error);
      return {
        items: [],
        totalCount: 0,
        page,
        pageSize,
        error: this._translateDbError(error, 'Gagal memuat daftar riwayat analisis.')
      };
    }

    return {
      items: data || [],
      totalCount: count || 0,
      page,
      pageSize,
      error: null
    };
  }

  /**
   * Mengambil detail satu riwayat analisis beserta PGN & snapshot penuh
   */
  async getAnalysisById(id) {
    const user = authService.getUser();
    if (!user || !user.id) {
      throw new Error('Anda harus masuk terlebih dahulu.');
    }

    if (!id) {
      throw new Error('ID riwayat tidak valid.');
    }

    const client = this._getClient();
    if (!client) {
      throw new Error('Layanan database Supabase belum terkonfigurasi.');
    }

    const { data, error } = await client
      .from('analysis_history')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      console.error('[AnalysisHistoryService] Gagal memuat riwayat:', error);
      throw new Error(this._translateDbError(error, 'Riwayat analisis tidak ditemukan atau tidak dapat diakses.'));
    }

    return data;
  }

  /**
   * Mengubah judul (Rename) analisis tersimpan
   */
  async renameAnalysis(id, newTitle) {
    const user = authService.getUser();
    if (!user || !user.id) {
      throw new Error('Anda harus masuk terlebih dahulu.');
    }

    if (!id) throw new Error('ID riwayat tidak valid.');

    const cleanTitle = (typeof newTitle === 'string' ? newTitle.trim() : '').slice(0, MAX_ANALYSIS_TITLE_LENGTH);
    if (!cleanTitle) {
      throw new Error('Judul analisis tidak boleh kosong.');
    }

    const client = this._getClient();
    if (!client) {
      throw new Error('Layanan database Supabase belum terkonfigurasi.');
    }

    const { data, error } = await client
      .from('analysis_history')
      .update({ title: cleanTitle })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, title, updated_at')
      .single();

    if (error) {
      console.error('[AnalysisHistoryService] Gagal mengubah judul:', error);
      throw new Error(this._translateDbError(error, 'Gagal memperbarui judul analisis.'));
    }

    return data;
  }

  /**
   * Menghapus riwayat analisis
   */
  async deleteAnalysis(id) {
    const user = authService.getUser();
    if (!user || !user.id) {
      throw new Error('Anda harus masuk terlebih dahulu.');
    }

    if (!id) throw new Error('ID riwayat tidak valid.');

    const client = this._getClient();
    if (!client) {
      throw new Error('Layanan database Supabase belum terkonfigurasi.');
    }

    const { error } = await client
      .from('analysis_history')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[AnalysisHistoryService] Gagal menghapus riwayat:', error);
      throw new Error(this._translateDbError(error, 'Gagal menghapus riwayat analisis.'));
    }

    return { success: true, id };
  }

  _translateDbError(error, fallback) {
    if (!error) return fallback;
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('network') || msg.includes('fetch')) {
      return 'Koneksi internet bermasalah. Periksa jaringan Anda lalu coba lagi.';
    }
    if (msg.includes('row-level security') || msg.includes('permission') || msg.includes('jwt')) {
      return 'Sesi autentikasi telah berakhir. Silakan masuk kembali.';
    }
    return fallback;
  }
}

export const analysisHistoryService = new AnalysisHistoryService();
export default analysisHistoryService;
