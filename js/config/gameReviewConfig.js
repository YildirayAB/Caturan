/**
 * Konfigurasi Evaluasi & Klasifikasi Langkah Game Review Caturan (MVP 5.5)
 *
 * Catatan Metodologi:
 * - Ambang batas (threshold) centipawn loss di bawah ini adalah aturan heuristik Caturan
 *   untuk memberikan umpan balik pembelajaran yang mudah dimengerti pengguna, dan bukan standar resmi universal FIDE.
 * - Evaluasi seluruh posisi dinormalisasi ke perspektif Putih (White perspective).
 * - Perhitungan Centipawn Loss:
 *   Untuk langkah Putih: loss = max(0, evalBeforeWhite - evalAfterWhite)
 *   Untuk langkah Hitam: loss = max(0, evalAfterWhite - evalBeforeWhite)
 */

export const MOVE_CLASSIFICATION = {
  BEST: 'best',
  EXCELLENT: 'excellent',
  GOOD: 'good',
  INACCURACY: 'inaccuracy',
  MISTAKE: 'mistake',
  BLUNDER: 'blunder'
};

export const MOVE_CLASSIFICATION_META = {
  [MOVE_CLASSIFICATION.BEST]: {
    id: 'best',
    name: 'Best',
    label: 'Best Move',
    badgeClass: 'badge-move-best',
    symbol: '★',
    description: 'Langkah terbaik sesuai rekomendasi Stockfish.'
  },
  [MOVE_CLASSIFICATION.EXCELLENT]: {
    id: 'excellent',
    name: 'Excellent',
    label: 'Excellent',
    badgeClass: 'badge-move-excellent',
    symbol: '✦',
    description: 'Langkah sangat kuat mendekati langkah terbaik (kehilangan <= 15 cp).'
  },
  [MOVE_CLASSIFICATION.GOOD]: {
    id: 'good',
    name: 'Good',
    label: 'Good',
    badgeClass: 'badge-move-good',
    symbol: '✓',
    description: 'Langkah solid dan aman (kehilangan 16 - 40 cp).'
  },
  [MOVE_CLASSIFICATION.INACCURACY]: {
    id: 'inaccuracy',
    name: 'Inaccuracy',
    label: 'Inaccuracy',
    badgeClass: 'badge-move-inaccuracy',
    symbol: '?!',
    description: 'Ketidaktelitian kecil yang sedikit mengurangi keunggulan (kehilangan 41 - 80 cp).'
  },
  [MOVE_CLASSIFICATION.MISTAKE]: {
    id: 'mistake',
    name: 'Mistake',
    label: 'Mistake',
    badgeClass: 'badge-move-mistake',
    symbol: '?',
    description: 'Kesalahan taktis atau posisi yang nyata (kehilangan 81 - 150 cp).'
  },
  [MOVE_CLASSIFICATION.BLUNDER]: {
    id: 'blunder',
    name: 'Blunder',
    label: 'Blunder',
    badgeClass: 'badge-move-blunder',
    symbol: '??',
    description: 'Kesalahan fatal yang membalikkan evaluasi atau melewatkan forced mate (kehilangan > 150 cp).'
  }
};

export const CENTIPAWN_LOSS_THRESHOLDS = {
  EXCELLENT_MAX_CP: 15,
  GOOD_MAX_CP: 40,
  INACCURACY_MAX_CP: 80,
  MISTAKE_MAX_CP: 150
};

/**
 * Konfigurasi durasi engine Stockfish untuk Game Review (seluruh posisi).
 * Dibuat ringan dan cepat agar responsif pada mobile serta ramah CPU/baterai.
 */
export const GAME_REVIEW_MOVETIME_MS = 250;
export const GAME_REVIEW_MOBILE_MOVETIME_MS = 200;
