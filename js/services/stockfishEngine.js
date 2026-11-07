/**
 * Layanan Engine Catur Stockfish (WebAssembly Web Worker — UCI Protocol)
 * Menggunakan Stockfish 19 Lite Single-Threaded (`stockfish-19-lite-single.js` & `.wasm`)
 *
 * Tanggung jawab:
 * - Menjalankan Stockfish di dalam Web Worker terpisah agar UI utama tidak pernah membeku
 * - Menangani handshake protokol UCI (`uci` -> `uciok`, `isready` -> `readyok`)
 * - Memeriksa dukungan opsi UCI (`option name Skill Level`) secara dinamis dari respons `uci`
 * - Mengonfigurasi tingkat kesulitan (Pemula, Menengah, Lanjutan) hanya saat permainan baru
 * - Mengirim posisi (`position fen <fen>`) dan pencarian (`go movetime <ms>`)
 * - Membaca `bestmove <uci-move>` dan memvalidasi sesi/gameId agar respons lama tidak bocor ke game baru
 * - Menghentikan pencarian (`stop`), mereset state permainan (`ucinewgame`), dan mengakhiri Worker (`terminate`)
 */

import { parseUciMove } from '../components/chessboardUI.js';

export const PLAY_DIFFICULTY_IDS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced'
};

export const DEFAULT_PLAY_DIFFICULTY_ID = PLAY_DIFFICULTY_IDS.BEGINNER;

/**
 * Konfigurasi tingkat kesulitan komputer sesuai Bagian 3:
 * Catatan: Nilai di bawah adalah parameter konfigurasi awal UCI (Skill Level & waktu pikir),
 * bukan klaim rating Elo pemain.
 */
export const PLAY_DIFFICULTIES = [
  {
    id: PLAY_DIFFICULTY_IDS.BEGINNER,
    title: 'Pemula',
    skillLevel: 2,
    moveTimeMs: 300,
    badgeLabel: 'Skill Level 2 • ~300 ms',
    description:
      'Waktu pencarian singkat dengan tingkat kesalahan taktis yang ramah bagi pemula. Cocok untuk berlatih aturan dasar dan alur permainan penuh.'
  },
  {
    id: PLAY_DIFFICULTY_IDS.INTERMEDIATE,
    title: 'Menengah',
    skillLevel: 8,
    moveTimeMs: 700,
    badgeLabel: 'Skill Level 8 • ~700 ms',
    description:
      'Permainan seimbang yang mulai aktif memanfaatkan bidak lawan yang tidak terjaga dan menyusun kombinasi taktik dasar.'
  },
  {
    id: PLAY_DIFFICULTY_IDS.ADVANCED,
    title: 'Lanjutan',
    skillLevel: 15,
    moveTimeMs: 1200,
    badgeLabel: 'Skill Level 15 • ~1200 ms',
    description:
      'Kalkulasi posisi dan taktik yang tajam dengan waktu pencarian lebih dalam. Cocok untuk menguji ketelitian strategi dan pertahanan.'
  }
];

export function getPlayDifficultyById(difficultyId) {
  return (
    PLAY_DIFFICULTIES.find(d => d.id === difficultyId) ||
    PLAY_DIFFICULTIES[0]
  );
}

/**
 * Mem-parsing baris `option name ...` dari output `uci` Stockfish
 * Contoh: `option name Skill Level type spin default 20 min 0 max 20`
 */
export function parseUciOptionLine(line) {
  if (typeof line !== 'string') return null;
  const trimmed = line.trim();
  if (!trimmed.startsWith('option name ')) return null;

  const match = /^option\s+name\s+(.+?)\s+type\s+(\S+)(?:\s+(.*))?$/.exec(trimmed);
  if (!match) return null;

  const name = match[1].trim();
  const type = match[2].trim();
  const rest = match[3] || '';

  const minMatch = /\bmin\s+(-?\d+)/.exec(rest);
  const maxMatch = /\bmax\s+(-?\d+)/.exec(rest);
  const defaultMatch = /\bdefault\s+(\S+)/.exec(rest);

  return {
    name,
    type,
    defaultValue: defaultMatch ? defaultMatch[1] : null,
    min: minMatch ? Number(minMatch[1]) : null,
    max: maxMatch ? Number(maxMatch[1]) : null
  };
}

/**
 * Mem-parsing baris `bestmove ...` dari output Stockfish
 * Contoh: `bestmove e2e4 ponder e7e5` atau `bestmove a7a8q`
 */
export function parseBestMoveLine(line) {
  if (typeof line !== 'string') return null;
  const trimmed = line.trim();
  if (!trimmed.startsWith('bestmove ')) return null;

  const parts = trimmed.split(/\s+/);
  const uciMove = parts[1] || null;
  if (!uciMove || uciMove === '(none)' || uciMove === '0000') {
    return {
      uciMove: null,
      parsed: null,
      ponder: null,
      rawLine: trimmed
    };
  }

  const ponderIdx = parts.indexOf('ponder');
  const ponder = ponderIdx !== -1 && parts[ponderIdx + 1] ? parts[ponderIdx + 1] : null;
  const parsed = parseUciMove(uciMove);

  return {
    uciMove,
    parsed,
    ponder,
    rawLine: trimmed
  };
}

let cachedNodeEngineInstance = null;

/**
 * Membuat adapter Worker untuk lingkungan Node.js (khusus pengujian lokal otomatis)
 * ketika global `Worker` browser tidak tersedia.
 */
async function createNodeStockfishWorkerAdapter() {
  const { createRequire } = await import('node:module');
  const requireFn = createRequire(import.meta.url);
  const initStockfish = requireFn('stockfish');

  if (!cachedNodeEngineInstance) {
    cachedNodeEngineInstance = await Promise.resolve(initStockfish('lite-single'));
  }
  const engine = cachedNodeEngineInstance;

  let terminated = false;
  const adapter = {
    onmessage: null,
    onerror: null,
    postMessage(cmd) {
      if (terminated || !engine) return;
      try {
        if (typeof engine.processCommand === 'function') {
          engine.processCommand(String(cmd));
        } else if (typeof engine.postMessage === 'function') {
          engine.postMessage(String(cmd));
        }
      } catch (err) {
        if (typeof adapter.onerror === 'function') {
          adapter.onerror(err);
        }
      }
    },
    terminate() {
      if (terminated) return;
      terminated = true;
      try {
        if (engine && typeof engine.processCommand === 'function') {
          engine.processCommand('stop');
        }
      } catch {
        // Abaikan error saat proses dihentikan
      }
    }
  };

  engine.listener = line => {
    if (terminated) return;
    if (typeof adapter.onmessage === 'function') {
      adapter.onmessage({ data: String(line) });
    }
  };

  return adapter;
}

export class StockfishEngineService {
  constructor({
    workerUrl = new URL('../vendor/stockfish/stockfish-19-lite-single.js', import.meta.url),
    workerFactory = null,
    initTimeoutMs = 15000,
    readyTimeoutMs = 10000,
    searchTimeoutBufferMs = 10000
  } = {}) {
    this.workerUrl = workerUrl;
    this.workerFactory = workerFactory;
    this.initTimeoutMs = initTimeoutMs;
    this.readyTimeoutMs = readyTimeoutMs;
    this.searchTimeoutBufferMs = searchTimeoutBufferMs;

    this._worker = null;
    this._initPromise = null;
    this._isUciOk = false;
    this._isReady = false;
    this._supportedOptions = new Map();
    this._engineInfo = {
      name: null,
      author: null
    };

    this._activeGameId = null;
    this._isGameInProgress = false;
    this._currentDifficultyId = DEFAULT_PLAY_DIFFICULTY_ID;

    this._uciWaiter = null;
    this._readyWaiters = [];
    this._activeSearch = null;
    this._searchRequestCounter = 0;
  }

  /**
   * Mengembalikan salinan informasi engine & opsi UCI yang terdeteksi
   */
  getEngineStatus() {
    return {
      isWorkerActive: Boolean(this._worker),
      isUciOk: this._isUciOk,
      isReady: this._isReady,
      isSearching: Boolean(this._activeSearch && !this._activeSearch.cancelled),
      activeGameId: this._activeGameId,
      difficultyId: this._currentDifficultyId,
      difficulty: getPlayDifficultyById(this._currentDifficultyId),
      engineInfo: { ...this._engineInfo },
      supportedOptions: Array.from(this._supportedOptions.keys())
    };
  }

  /**
   * Memeriksa apakah opsi UCI tertentu didukung oleh engine berdasarkan respons `uci`
   */
  supportsOption(optionName) {
    if (typeof optionName !== 'string') return false;
    return this._supportedOptions.has(optionName);
  }

  getOptionMetadata(optionName) {
    if (typeof optionName !== 'string') return null;
    return this._supportedOptions.get(optionName) || null;
  }

  /**
   * Mengatur tingkat kesulitan sebelum permainan dimulai.
   * Menolak perubahan apabila permainan sedang berlangsung sesuai aturan Bagian 3.
   */
  setDifficulty(difficultyId) {
    if (this._isGameInProgress) {
      throw new Error(
        'Tingkat kesulitan tidak dapat diubah ketika permainan sedang berlangsung.'
      );
    }
    const diff = getPlayDifficultyById(difficultyId);
    this._currentDifficultyId = diff.id;
    return diff;
  }

  getDifficulty() {
    return getPlayDifficultyById(this._currentDifficultyId);
  }

  setGameInProgress(inProgress) {
    this._isGameInProgress = Boolean(inProgress);
  }

  /**
   * Membuat Web Worker dan menjalankan handshake UCI (`uci` -> `uciok`, lalu `isready` -> `readyok`)
   */
  async init() {
    if (this._worker && this._isUciOk && this._isReady) {
      return this.getEngineStatus();
    }

    if (this._initPromise) {
      return this._initPromise;
    }

    this._initPromise = this._performInit();
    try {
      const status = await this._initPromise;
      return status;
    } catch (err) {
      this._initPromise = null;
      throw err;
    }
  }

  async _createWorkerInstance() {
    if (typeof this.workerFactory === 'function') {
      return await this.workerFactory(this.workerUrl);
    }
    if (typeof Worker === 'function') {
      const urlStr =
        this.workerUrl instanceof URL ? this.workerUrl.href : String(this.workerUrl);
      return new Worker(urlStr);
    }
    return await createNodeStockfishWorkerAdapter(this.workerUrl);
  }

  async _performInit() {
    this._cleanupWorkerOnly();

    const worker = await this._createWorkerInstance();
    this._worker = worker;
    this._isUciOk = false;
    this._isReady = false;
    this._supportedOptions.clear();
    this._engineInfo = { name: null, author: null };

    worker.onmessage = event => {
      const rawData = typeof event === 'string' ? event : event?.data;
      if (typeof rawData !== 'string') return;
      const lines = rawData.split(/\r?\n/);
      for (const line of lines) {
        this._handleEngineLine(line);
      }
    };

    worker.onerror = err => {
      const errorObj =
        err instanceof Error
          ? err
          : new Error(err?.message || 'Terjadi kesalahan pada Web Worker Stockfish.');
      this._rejectAllWaiters(errorObj);
    };

    // 1. Kirim `uci` dan tunggu `uciok`
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._uciWaiter = null;
        reject(new Error('Waktu inisialisasi UCI Stockfish habis (timeout menunggu uciok).'));
      }, this.initTimeoutMs);

      this._uciWaiter = {
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
        reject: err => {
          clearTimeout(timer);
          reject(err);
        }
      };

      this._sendRawCommand('uci');
    });

    // 2. Kirim `isready` dan tunggu `readyok`
    await this.waitReady();

    return this.getEngineStatus();
  }

  _sendRawCommand(cmd) {
    if (!this._worker || typeof this._worker.postMessage !== 'function') {
      throw new Error('Web Worker Stockfish belum aktif.');
    }
    this._worker.postMessage(cmd);
  }

  _handleEngineLine(rawLine) {
    if (typeof rawLine !== 'string') return;
    const line = rawLine.trim();
    if (!line) return;

    // Parsing identitas engine
    if (line.startsWith('id name ')) {
      this._engineInfo.name = line.slice('id name '.length).trim();
      return;
    }
    if (line.startsWith('id author ')) {
      this._engineInfo.author = line.slice('id author '.length).trim();
      return;
    }

    // Parsing daftar opsi UCI yang didukung engine
    if (line.startsWith('option name ')) {
      const opt = parseUciOptionLine(line);
      if (opt && opt.name) {
        this._supportedOptions.set(opt.name, opt);
      }
      return;
    }

    // Handshake `uciok`
    if (line === 'uciok') {
      this._isUciOk = true;
      if (this._uciWaiter) {
        const waiter = this._uciWaiter;
        this._uciWaiter = null;
        waiter.resolve();
      }
      return;
    }

    // Handshake `readyok`
    if (line === 'readyok') {
      this._isReady = true;
      if (this._readyWaiters.length > 0) {
        const waiter = this._readyWaiters.shift();
        waiter.resolve();
      }
      return;
    }

    // Respons pencarian `bestmove`
    if (line.startsWith('bestmove ')) {
      const bestMoveInfo = parseBestMoveLine(line);
      if (this._activeSearch) {
        const currentSearch = this._activeSearch;
        this._activeSearch = null;
        if (currentSearch.timeoutId) {
          clearTimeout(currentSearch.timeoutId);
        }

        // Jika pencarian sudah dibatalkan atau berasal dari game lama, abaikan hasilnya
        const isStaleGame =
          currentSearch.gameId &&
          this._activeGameId &&
          currentSearch.gameId !== this._activeGameId;

        if (currentSearch.cancelled || isStaleGame) {
          currentSearch.resolve({
            cancelled: true,
            uciMove: null,
            parsed: null,
            gameId: currentSearch.gameId,
            requestId: currentSearch.requestId
          });
          return;
        }

        currentSearch.resolve({
          cancelled: false,
          uciMove: bestMoveInfo ? bestMoveInfo.uciMove : null,
          parsed: bestMoveInfo ? bestMoveInfo.parsed : null,
          ponder: bestMoveInfo ? bestMoveInfo.ponder : null,
          rawLine: line,
          gameId: currentSearch.gameId,
          requestId: currentSearch.requestId
        });
      }
    }
  }

  /**
   * Mengirim `isready` dan menunggu hingga `readyok` diterima dari Worker
   */
  async waitReady(timeoutMs = this.readyTimeoutMs) {
    if (!this._worker || !this._isUciOk) {
      throw new Error('Engine belum menyelesaikan handshake UCI (uciok).');
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._readyWaiters = this._readyWaiters.filter(w => w !== waiterObj);
        reject(new Error('Waktu tunggu respons readyok dari Stockfish habis (timeout).'));
      }, timeoutMs);

      const waiterObj = {
        resolve: () => {
          clearTimeout(timer);
          resolve(true);
        },
        reject: err => {
          clearTimeout(timer);
          reject(err);
        }
      };

      this._readyWaiters.push(waiterObj);
      this._sendRawCommand('isready');
    });
  }

  /**
   * Menghentikan pencarian yang sedang berjalan dengan mengirim `stop`
   * dan menunggu hingga pencarian lama benar-benar selesai / dibatalkan.
   */
  async stopSearch(reason = 'stopped') {
    if (!this._activeSearch) {
      return;
    }

    const searchToStop = this._activeSearch;
    searchToStop.cancelled = true;
    searchToStop.cancelReason = reason;

    if (searchToStop.timeoutId) {
      clearTimeout(searchToStop.timeoutId);
      searchToStop.timeoutId = null;
    }

    if (this._worker && this._isUciOk) {
      try {
        this._sendRawCommand('stop');
      } catch {
        // Abaikan jika worker sudah ditutup
      }
    }

    // Selesaikan promise pencarian yang sedang menunggu sebagai cancelled
    this._activeSearch = null;
    searchToStop.resolve({
      cancelled: true,
      reason,
      uciMove: null,
      parsed: null,
      gameId: searchToStop.gameId,
      requestId: searchToStop.requestId
    });

    if (this._worker && this._isUciOk) {
      try {
        await this.waitReady();
      } catch {
        // Abaikan jika worker sedang di-reset
      }
    }
  }

  /**
   * Memulai permainan baru:
   * 1. Menghentikan pencarian sebelumnya jika masih berjalan
   * 2. Mengatur session/game identifier aktif agar respons lama diabaikan
   * 3. Mengatur tingkat kesulitan untuk permainan baru ini
   * 4. Mengirim `ucinewgame` dan `setoption name Skill Level value <N>` (jika didukung oleh engine)
   * 5. Menunggu `isready` -> `readyok`
   */
  async startNewGame({
    gameId = `game_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    difficulty = this._currentDifficultyId
  } = {}) {
    this._isGameInProgress = false;
    const diffConfig = getPlayDifficultyById(difficulty);
    this._currentDifficultyId = diffConfig.id;
    this._activeGameId = gameId;

    await this.init();

    // Hentikan pencarian yang mungkin masih berjalan dari game sebelumnya
    if (this._activeSearch) {
      await this.stopSearch('new_game_started');
    }

    // Jika selama await terdapat startNewGame lain yang lebih baru, batalkan eksekusi ini
    if (this._activeGameId !== gameId) {
      return {
        cancelled: true,
        gameId
      };
    }

    // Terapkan opsi UCI Skill Level hanya jika terverifikasi didukung melalui respons `uci`
    if (this.supportsOption('Skill Level')) {
      const optMeta = this.getOptionMetadata('Skill Level');
      const minVal = typeof optMeta?.min === 'number' ? optMeta.min : 0;
      const maxVal = typeof optMeta?.max === 'number' ? optMeta.max : 20;
      const clampedSkill = Math.max(minVal, Math.min(maxVal, diffConfig.skillLevel));
      this._sendRawCommand(`setoption name Skill Level value ${clampedSkill}`);
    }

    // Jika engine mendukung Clear Hash, bersihkan hash untuk permainan baru
    this._sendRawCommand('ucinewgame');
    await this.waitReady();

    if (this._activeGameId !== gameId) {
      return {
        cancelled: true,
        gameId
      };
    }

    this._isGameInProgress = true;
    return {
      cancelled: false,
      gameId: this._activeGameId,
      difficulty: diffConfig,
      skillLevelApplied: this.supportsOption('Skill Level') ? diffConfig.skillLevel : null
    };
  }

  /**
   * Meminta langkah terbaik (`bestmove`) dari Stockfish untuk posisi FEN tertentu.
   * Menjamin:
   * - Engine sudah siap (`uciok` & `readyok`)
   * - Tidak ada pencarian lama yang berjalan bersamaan
   * - Respons yang kembali selalu cocok dengan `gameId` dan `requestId` terbaru
   */
  async requestBestMove({
    fen,
    gameId = this._activeGameId,
    moveTimeMs = null
  } = {}) {
    if (!fen || typeof fen !== 'string' || !fen.trim()) {
      throw new Error('FEN posisi catur wajib diisi untuk meminta langkah komputer.');
    }

    if (gameId && this._activeGameId && gameId !== this._activeGameId) {
      return {
        cancelled: true,
        reason: 'stale_game_id',
        uciMove: null,
        parsed: null,
        gameId
      };
    }

    await this.init();

    // Pastikan tidak ada pencarian sebelumnya yang masih berjalan
    if (this._activeSearch) {
      await this.stopSearch('superseded_by_new_request');
    }

    // Cek ulang apakah gameId masih aktif setelah await
    if (gameId && this._activeGameId && gameId !== this._activeGameId) {
      return {
        cancelled: true,
        reason: 'stale_game_id',
        uciMove: null,
        parsed: null,
        gameId
      };
    }

    await this.waitReady();

    if (gameId && this._activeGameId && gameId !== this._activeGameId) {
      return {
        cancelled: true,
        reason: 'stale_game_id',
        uciMove: null,
        parsed: null,
        gameId
      };
    }

    const diffConfig = getPlayDifficultyById(this._currentDifficultyId);
    const effectiveMoveTime =
      typeof moveTimeMs === 'number' && Number.isFinite(moveTimeMs) && moveTimeMs >= 50
        ? Math.floor(moveTimeMs)
        : diffConfig.moveTimeMs;

    const requestId = ++this._searchRequestCounter;
    const totalTimeoutMs = Math.max(8000, effectiveMoveTime + this.searchTimeoutBufferMs);

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this._activeSearch && this._activeSearch.requestId === requestId) {
          this._activeSearch = null;
          try {
            this._sendRawCommand('stop');
          } catch {
            // Abaikan
          }
          reject(new Error('Waktu pencarian langkah komputer habis (timeout).'));
        }
      }, totalTimeoutMs);

      this._activeSearch = {
        requestId,
        gameId: gameId || this._activeGameId,
        fen: fen.trim(),
        cancelled: false,
        timeoutId,
        resolve,
        reject
      };

      try {
        this._sendRawCommand(`position fen ${fen.trim()}`);
        this._sendRawCommand(`go movetime ${effectiveMoveTime}`);
      } catch (err) {
        clearTimeout(timeoutId);
        this._activeSearch = null;
        reject(err);
      }
    });
  }

  _rejectAllWaiters(errorObj) {
    if (this._uciWaiter) {
      const uciW = this._uciWaiter;
      this._uciWaiter = null;
      uciW.reject(errorObj);
    }

    while (this._readyWaiters.length > 0) {
      const rw = this._readyWaiters.shift();
      rw.reject(errorObj);
    }

    if (this._activeSearch) {
      const active = this._activeSearch;
      this._activeSearch = null;
      if (active.timeoutId) {
        clearTimeout(active.timeoutId);
      }
      active.reject(errorObj);
    }
  }

  _cleanupWorkerOnly() {
    if (this._activeSearch) {
      const active = this._activeSearch;
      this._activeSearch = null;
      if (active.timeoutId) {
        clearTimeout(active.timeoutId);
      }
      active.resolve({
        cancelled: true,
        reason: 'worker_terminated',
        uciMove: null,
        parsed: null,
        gameId: active.gameId,
        requestId: active.requestId
      });
    }

    this._rejectAllWaiters(new Error('Web Worker Stockfish dihentikan.'));

    if (this._worker) {
      try {
        this._worker.terminate();
      } catch {
        // Abaikan
      }
      this._worker = null;
    }

    this._isUciOk = false;
    this._isReady = false;
  }

  /**
   * Mengakhiri Web Worker sepenuhnya ketika pengguna meninggalkan halaman permainan
   * atau ketika engine tidak lagi digunakan.
   */
  terminate() {
    this._isGameInProgress = false;
    this._initPromise = null;
    this._cleanupWorkerOnly();
  }

  destroy() {
    this.terminate();
  }
}

export const stockfishEngine = new StockfishEngineService();
export default stockfishEngine;
