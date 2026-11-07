/**
 * Layanan Progres Belajar, Perhitungan XP, Level Pengguna, dan Streak Harian
 */

import {
  storageService,
  calculateXpFromCompletedLessons,
  createInitialPuzzleProgressState,
  sanitizePuzzleProgress,
  createInitialPlayProgressState,
  sanitizePlayProgress,
  createInitialOpeningProgressState,
  sanitizeOpeningProgress
} from './storage.js';
import { PLAY_DIFFICULTIES, getPlayDifficultyById } from './stockfishEngine.js';
import { CURRICULUM_CATEGORIES, getAllLessons, getLessonById } from '../data/curriculum.js';
import {
  PUZZLE_DIFFICULTIES,
  getAllPuzzles,
  getPuzzleById,
  getPuzzleCategoryById,
  getPuzzleDifficultyById,
  getAvailablePuzzleCategories,
  getDailyPuzzle
} from '../data/puzzles.js';
import {
  OPENING_CATEGORIES,
  OPENING_DIFFICULTIES,
  OPENING_REPERTOIRE_SIDES,
  OPENING_STATUS_META,
  getAllOpenings,
  getOpeningById
} from '../data/openings.js';

const LEVEL_THRESHOLDS = [
  { level: 0, minXp: 0, title: 'Belum Berlevel (Pemula Baru)' },
  { level: 1, minXp: 50, title: 'Pecatur Pemula' },
  { level: 2, minXp: 250, title: 'Pelajar Dasar' },
  { level: 3, minXp: 550, title: 'Praktisi Aturan' },
  { level: 4, minXp: 950, title: 'Taktisi Muda' },
  { level: 5, minXp: 1400, title: 'Perancang Strategi' },
  { level: 6, minXp: 1850, title: 'Master Pembukaan' },
  { level: 7, minXp: 2150, title: 'Grandmaster Akademi' }
];

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function diffDays(dateStrA, dateStrB) {
  const [y1, m1, d1] = dateStrA.split('-').map(Number);
  const [y2, m2, d2] = dateStrB.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

class ProgressService {
  constructor() {
    this._state = storageService.getProgress();
    this._listeners = [];

    if (typeof storageService.subscribeCloudMerge === 'function') {
      storageService.subscribeCloudMerge(mergedState => {
        if (mergedState) {
          this._state = mergedState;
          this._notify();
        }
      });
    }
  }

  reload() {
    this._state = storageService.getProgress();
    this._notify();
    return this._state;
  }

  async syncWithCloudForUser(userId) {
    this._state = storageService.getProgress();
    const result = await storageService.performInitialSync(userId);
    if (result && result.progress) {
      this._state = result.progress;
    } else {
      this._state = storageService.getProgress();
    }
    this._notify();
    return result;
  }

  handleUserSignedOut() {
    storageService.setActiveUser(null);
  }

  getState() {
    return this._state;
  }

  /**
   * Menghitung level berdasarkan total XP.
   * Jika XP masih 0, level adalah 0 (jujur sesuai kondisi awal).
   */
  calculateLevelInfo(xp = this._state.totalXp) {
    const safeXp = typeof xp === 'number' && Number.isFinite(xp) && xp >= 0 ? xp : 0;
    let current = LEVEL_THRESHOLDS[0];
    let next = LEVEL_THRESHOLDS[1];

    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
      if (safeXp >= LEVEL_THRESHOLDS[i].minXp) {
        current = LEVEL_THRESHOLDS[i];
        next = LEVEL_THRESHOLDS[i + 1] || null;
      }
    }

    let progressToNext = 100;
    let xpNeededForNext = 0;
    if (next) {
      const range = next.minXp - current.minXp;
      const earnedInLevel = safeXp - current.minXp;
      progressToNext = Math.min(100, Math.max(0, Math.round((earnedInLevel / range) * 100)));
      xpNeededForNext = Math.max(0, next.minXp - safeXp);
    }

    return {
      level: current.level,
      title: current.title,
      currentMinXp: current.minXp,
      nextLevel: next ? next.level : null,
      nextMinXp: next ? next.minXp : null,
      xpNeededForNext,
      progressToNext
    };
  }

  /**
   * Menghitung streak belajar harian secara jujur dari riwayat tanggal belajar.
   * Menggunakan zona waktu lokal secara konsisten.
   * Jika belum ada aktivitas belajar, streak = 0.
   */
  calculateStreak(activityDates = this._state.activityDates, referenceDate = new Date()) {
    if (!Array.isArray(activityDates) || activityDates.length === 0) {
      return 0;
    }

    const validDates = activityDates.filter(
      d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())
    );
    if (validDates.length === 0) return 0;

    const uniqueSorted = [...new Set(validDates)].sort();
    const today = getLocalDateString(referenceDate);
    const lastDate = uniqueSorted[uniqueSorted.length - 1];

    // Jika aktivitas terakhir lebih dari 1 hari yang lalu (kemarin terlewat), streak kembali 0
    const gapFromToday = diffDays(lastDate, today);
    if (gapFromToday > 1 || gapFromToday < 0) {
      return 0;
    }

    let streak = 1;
    for (let i = uniqueSorted.length - 1; i > 0; i--) {
      const diff = diffDays(uniqueSorted[i - 1], uniqueSorted[i]);
      if (diff === 1) {
        streak++;
      } else if (diff > 1) {
        break;
      }
    }
    return streak;
  }

  /**
   * Mencatat bahwa sebuah materi sedang dibuka/dipelajari (tanpa menambah XP)
   */
  markLessonOpened(lessonId) {
    const found = getLessonById(lessonId);
    if (!found) return;

    const started = new Set(this._state.startedLessonIds);
    started.add(lessonId);

    this._state = storageService.saveProgress({
      ...this._state,
      lastOpenedLessonId: lessonId,
      startedLessonIds: Array.from(started)
    });

    this._notify();
  }

  /**
   * Menandai materi selesai dan memberikan XP satu kali saja.
   * Membuka ulang atau menekan selesai ulang pada materi yang sama TIDAK akan menambah XP lagi.
   */
  completeLesson(lessonId) {
    const found = getLessonById(lessonId);
    if (!found) {
      return { success: false, alreadyCompleted: false, xpGained: 0 };
    }

    const { lesson } = found;
    const isAlreadyDone = this._state.completedLessonIds.includes(lessonId);

    if (isAlreadyDone) {
      return {
        success: true,
        alreadyCompleted: true,
        xpGained: 0,
        totalXp: this._state.totalXp,
        levelInfo: this.calculateLevelInfo(this._state.totalXp)
      };
    }

    const prevLevelInfo = this.calculateLevelInfo(this._state.totalXp);

    const completedSet = new Set(this._state.completedLessonIds);
    completedSet.add(lessonId);
    const updatedCompletedIds = Array.from(completedSet);

    const newTotalXp = calculateXpFromCompletedLessons(updatedCompletedIds);
    const newLevelInfo = this.calculateLevelInfo(newTotalXp);

    const startedSet = new Set(this._state.startedLessonIds);
    startedSet.add(lessonId);

    const today = getLocalDateString();
    const datesSet = new Set(this._state.activityDates);
    datesSet.add(today);

    const completedAtMap = {
      ...this._state.lessonCompletedAt,
      [lessonId]: new Date().toISOString()
    };

    this._state = storageService.saveProgress({
      ...this._state,
      totalXp: newTotalXp,
      completedLessonIds: updatedCompletedIds,
      startedLessonIds: Array.from(startedSet),
      lastOpenedLessonId: lessonId,
      activityDates: Array.from(datesSet),
      lessonCompletedAt: completedAtMap
    });

    this._notify();

    return {
      success: true,
      alreadyCompleted: false,
      xpGained: lesson.xpReward,
      totalXp: newTotalXp,
      levelInfo: newLevelInfo,
      leveledUp: newLevelInfo.level > prevLevelInfo.level
    };
  }

  isLessonCompleted(lessonId) {
    return this._state.completedLessonIds.includes(lessonId);
  }

  isLessonStarted(lessonId) {
    return (
      this._state.startedLessonIds.includes(lessonId) ||
      this._state.completedLessonIds.includes(lessonId)
    );
  }

  // =========================================================================
  // MVP 2 — PROGRES PUZZLE CATUR (Bagian 7)
  // =========================================================================

  _getPuzzleProgress() {
    return sanitizePuzzleProgress(
      this._state && this._state.puzzleProgress
        ? this._state.puzzleProgress
        : createInitialPuzzleProgressState()
    );
  }

  isPuzzleSolved(puzzleId) {
    if (!puzzleId) return false;
    const p = this._getPuzzleProgress();
    return p.solvedPuzzleIds.includes(puzzleId);
  }

  isDailyPuzzleCompleted(dateStr = getLocalDateString()) {
    const p = this._getPuzzleProgress();
    return p.dailyPuzzleDates.includes(dateStr);
  }

  /**
   * Mencatat puzzle terakhir yang sedang dibuka/dimainkan
   */
  markPuzzleOpened(puzzleId) {
    const found = getPuzzleById(puzzleId);
    if (!found) return;

    const currentPuzzleProg = this._getPuzzleProgress();
    const nowIso = new Date().toISOString();

    this._state = storageService.saveProgress({
      ...this._state,
      puzzleProgress: {
        ...currentPuzzleProg,
        lastPlayedPuzzleId: puzzleId,
        updatedAt: nowIso
      }
    });

    this._notify();
  }

  /**
   * Mencatat penggunaan petunjuk (Hint) pada progres puzzle (Bagian 5)
   */
  recordPuzzleHintUsed(
    puzzleId,
    hintLevel = 1,
    { id = null, mode = 'mixed', referenceDate = new Date() } = {}
  ) {
    const found = getPuzzleById(puzzleId);
    if (!found) return null;

    const currentPuzzleProg = this._getPuzzleProgress();
    const nowIso = new Date().toISOString();
    const today = getLocalDateString(referenceDate);
    const eventId =
      typeof id === 'string' && id.trim().length > 0
        ? id.trim()
        : `hint_${puzzleId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const existingEvents = [...currentPuzzleProg.attemptEvents];
    const existingIdx = existingEvents.findIndex(e => e.id === eventId);

    if (existingIdx >= 0) {
      const prev = existingEvents[existingIdx];
      existingEvents[existingIdx] = {
        ...prev,
        hintsUsed: Math.max(prev.hintsUsed || 0, hintLevel)
      };
    } else {
      existingEvents.push({
        id: eventId,
        puzzleId,
        solved: false,
        hintsUsed: Math.max(1, hintLevel),
        wrongMoves: 0,
        mode: mode || 'mixed',
        timestamp: nowIso,
        date: today
      });
    }

    this._state = storageService.saveProgress({
      ...this._state,
      puzzleProgress: {
        ...currentPuzzleProg,
        attemptEvents: existingEvents,
        lastPlayedPuzzleId: puzzleId,
        updatedAt: nowIso
      }
    });

    this._notify();
    return eventId;
  }

  /**
   * Mencatat event percobaan puzzle (baik langkah salah maupun puzzle selesai) secara idempoten.
   * Tidak menambah XP global MVP 1 sesuai aturan Bagian 7.
   */
  recordPuzzleAttempt({
    id = null,
    puzzleId,
    solved = false,
    hintsUsed = 0,
    wrongMoves = 0,
    mode = 'mixed',
    isDaily = false,
    referenceDate = new Date()
  } = {}) {
    const found = getPuzzleById(puzzleId);
    if (!found) {
      return { success: false, error: 'Puzzle tidak ditemukan' };
    }

    const currentPuzzleProg = this._getPuzzleProgress();
    const nowIso = new Date().toISOString();
    const today = getLocalDateString(referenceDate);
    const eventId =
      typeof id === 'string' && id.trim().length > 0
        ? id.trim()
        : `att_${puzzleId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const wasAlreadySolved = currentPuzzleProg.solvedPuzzleIds.includes(puzzleId);

    const updatedEvents = [...currentPuzzleProg.attemptEvents];
    const existingIdx = updatedEvents.findIndex(e => e.id === eventId);

    const eventPayload = {
      id: eventId,
      puzzleId,
      solved: Boolean(solved),
      hintsUsed: Math.max(0, Math.floor(Number(hintsUsed) || 0)),
      wrongMoves: Math.max(0, Math.floor(Number(wrongMoves) || 0)),
      mode: mode || (isDaily ? 'daily' : 'mixed'),
      timestamp: nowIso,
      date: today
    };

    if (existingIdx >= 0) {
      const prev = updatedEvents[existingIdx];
      updatedEvents[existingIdx] = {
        ...prev,
        solved: prev.solved || eventPayload.solved,
        hintsUsed: Math.max(prev.hintsUsed || 0, eventPayload.hintsUsed),
        wrongMoves: Math.max(prev.wrongMoves || 0, eventPayload.wrongMoves),
        mode: eventPayload.mode || prev.mode,
        timestamp: nowIso,
        date: today
      };
    } else {
      updatedEvents.push(eventPayload);
    }

    const solvedSet = new Set(currentPuzzleProg.solvedPuzzleIds);
    if (solved) {
      solvedSet.add(puzzleId);
    }

    const dailyDatesSet = new Set(currentPuzzleProg.dailyPuzzleDates);
    const dailyForToday = getDailyPuzzle(today);
    if (solved && (isDaily || mode === 'daily' || (dailyForToday && dailyForToday.id === puzzleId))) {
      dailyDatesSet.add(today);
    }

    // Jika menyelesaikan puzzle, catat juga tanggal hari ini di activityDates untuk streak belajar harian
    const activityDatesSet = new Set(this._state.activityDates);
    if (solved) {
      activityDatesSet.add(today);
    }

    this._state = storageService.saveProgress({
      ...this._state,
      activityDates: Array.from(activityDatesSet),
      puzzleProgress: {
        solvedPuzzleIds: Array.from(solvedSet),
        attemptEvents: updatedEvents,
        dailyPuzzleDates: Array.from(dailyDatesSet),
        lastPlayedPuzzleId: puzzleId,
        updatedAt: nowIso
      }
    });

    this._notify();

    return {
      success: true,
      eventId,
      solved: Boolean(solved),
      wasAlreadySolved,
      puzzleSummary: this.getPuzzleSummary(referenceDate)
    };
  }

  /**
   * Menghitung seluruh statistik Puzzle Catur secara jujur dari data aktual puzzleProgress
   */
  getPuzzleSummary(referenceDate = new Date()) {
    const allPuzzles = getAllPuzzles();
    const totalPuzzlesCount = allPuzzles.length;
    const puzzleProg = this._getPuzzleProgress();
    const solvedSet = new Set(puzzleProg.solvedPuzzleIds);

    const validSolvedPuzzles = allPuzzles.filter(p => solvedSet.has(p.id));
    const solvedCount = validSolvedPuzzles.length;
    const overallPercentage =
      totalPuzzlesCount > 0 ? Math.round((solvedCount / totalPuzzlesCount) * 100) : 0;

    // Statistik percobaan & akurasi dari attemptEvents
    const attemptEvents = puzzleProg.attemptEvents;
    const totalAttempts = attemptEvents.length;
    const successfulAttempts = attemptEvents.filter(e => e.solved).length;
    const accuracy =
      totalAttempts > 0 ? Math.round((successfulAttempts / totalAttempts) * 100) : 0;

    const today = getLocalDateString(referenceDate);
    const solvedTodayIds = new Set(
      attemptEvents
        .filter(e => e.solved && e.date === today)
        .map(e => e.puzzleId)
    );
    const solvedTodayCount = solvedTodayIds.size;

    const totalHintsUsed = attemptEvents.reduce((acc, ev) => acc + (ev.hintsUsed || 0), 0);

    // Puzzle Harian Deterministik berdasarkan tanggal lokal
    const dailyPuzzleObj = getDailyPuzzle(today);
    const isDailyCompleted =
      puzzleProg.dailyPuzzleDates.includes(today) ||
      Boolean(dailyPuzzleObj && solvedSet.has(dailyPuzzleObj.id) && solvedTodayIds.has(dailyPuzzleObj.id));

    const dailyPuzzle = dailyPuzzleObj
      ? {
          ...dailyPuzzleObj,
          date: today,
          isCompleted: isDailyCompleted,
          isEverSolved: solvedSet.has(dailyPuzzleObj.id),
          categoryInfo: getPuzzleCategoryById(dailyPuzzleObj.primaryTheme),
          difficultyInfo: getPuzzleDifficultyById(dailyPuzzleObj.difficulty)
        }
      : null;

    // Puzzle terakhir yang dimainkan
    let lastPlayedPuzzle = null;
    if (puzzleProg.lastPlayedPuzzleId) {
      const foundLast = getPuzzleById(puzzleProg.lastPlayedPuzzleId);
      if (foundLast) {
        lastPlayedPuzzle = {
          ...foundLast,
          isSolved: solvedSet.has(foundLast.id),
          categoryInfo: getPuzzleCategoryById(foundLast.primaryTheme),
          difficultyInfo: getPuzzleDifficultyById(foundLast.difficulty)
        };
      }
    }

    // Ringkasan per kategori tema berbahasa Indonesia (hanya kategori yang memiliki data puzzle)
    const availableCategories = getAvailablePuzzleCategories();
    const categoriesSummary = availableCategories.map(cat => {
      const catPuzzles = allPuzzles.filter(
        p => p.primaryTheme === cat.id || (Array.isArray(p.themes) && p.themes.includes(cat.id))
      );
      const total = catPuzzles.length;
      const solved = catPuzzles.filter(p => solvedSet.has(p.id)).length;
      const percentage = total > 0 ? Math.round((solved / total) * 100) : 0;

      const availableDifficulties = PUZZLE_DIFFICULTIES.map(diff => {
        const count = catPuzzles.filter(p => p.difficulty === diff.id).length;
        return count > 0
          ? {
              id: diff.id,
              title: diff.title,
              ratingRange: diff.ratingRange,
              count
            }
          : null;
      }).filter(Boolean);

      return {
        ...cat,
        totalPuzzles: total,
        solvedPuzzles: solved,
        percentage,
        availableDifficulties
      };
    });

    // Ringkasan per tingkat kesulitan (Pemula, Menengah, Lanjutan)
    const difficultiesSummary = PUZZLE_DIFFICULTIES.map(diff => {
      const diffPuzzles = allPuzzles.filter(p => p.difficulty === diff.id);
      const total = diffPuzzles.length;
      const solved = diffPuzzles.filter(p => solvedSet.has(p.id)).length;
      const percentage = total > 0 ? Math.round((solved / total) * 100) : 0;

      return {
        ...diff,
        totalPuzzles: total,
        solvedPuzzles: solved,
        percentage
      };
    });

    // Daftar puzzle yang sudah diselesaikan
    const solvedTimestampMap = new Map();
    for (const ev of attemptEvents) {
      if (ev.solved) {
        solvedTimestampMap.set(ev.puzzleId, ev.timestamp);
      }
    }

    const solvedPuzzlesList = validSolvedPuzzles.map(p => {
      const catInfo = getPuzzleCategoryById(p.primaryTheme);
      const diffInfo = getPuzzleDifficultyById(p.difficulty);
      return {
        ...p,
        categoryTitle: catInfo ? catInfo.title : p.primaryTheme,
        difficultyTitle: diffInfo ? diffInfo.title : p.difficulty,
        solvedAt: solvedTimestampMap.get(p.id) || puzzleProg.updatedAt || null
      };
    });

    // Riwayat latihan terbaru (terurut dari yang paling baru)
    const recentHistory = [...attemptEvents]
      .reverse()
      .slice(0, 12)
      .map(ev => {
        const p = getPuzzleById(ev.puzzleId);
        const catInfo = p ? getPuzzleCategoryById(p.primaryTheme) : null;
        const diffInfo = p ? getPuzzleDifficultyById(p.difficulty) : null;
        return {
          ...ev,
          puzzle: p || null,
          categoryTitle: catInfo ? catInfo.title : 'Campuran',
          difficultyTitle: diffInfo ? diffInfo.title : '-',
          rating: p ? p.rating : null
        };
      });

    return {
      totalPuzzlesCount,
      solvedCount,
      overallPercentage,
      totalAttempts,
      successfulAttempts,
      accuracy,
      solvedTodayCount,
      totalHintsUsed,
      dailyPuzzle,
      lastPlayedPuzzle,
      categoriesSummary,
      difficultiesSummary,
      solvedPuzzlesList,
      recentHistory,
      solvedPuzzleIds: puzzleProg.solvedPuzzleIds,
      dailyPuzzleDates: puzzleProg.dailyPuzzleDates
    };
  }

  // =========================================================================
  // MVP 3 — PROGRES BERMAIN MELAWAN KOMPUTER (Bagian 9)
  // =========================================================================

  _getPlayProgress() {
    return sanitizePlayProgress(
      this._state && this._state.playProgress
        ? this._state.playProgress
        : createInitialPlayProgressState()
    );
  }

  /**
   * Mencatat satu permainan melawan komputer yang telah selesai secara idempoten.
   * Hanya menyimpan game yang benar-benar selesai dan mencegah duplikasi berdasarkan `id` unik.
   * Tidak menambahkan XP global MVP 1 sesuai aturan Bagian 9.
   */
  recordPlayGameFinished({
    id,
    result,
    playerColor = 'white',
    difficulty = 'beginner',
    startedAt = null,
    finishedAt = null,
    termination = 'checkmate',
    pgn = ''
  } = {}) {
    if (!result || !['win', 'loss', 'draw'].includes(result)) {
      return { success: false, error: 'Hasil permainan tidak valid.' };
    }

    const currentPlayProg = this._getPlayProgress();
    const nowIso = new Date().toISOString();
    const validFinishedAt =
      typeof finishedAt === 'string' && Number.isFinite(Date.parse(finishedAt))
        ? finishedAt
        : nowIso;
    const validStartedAt =
      typeof startedAt === 'string' && Number.isFinite(Date.parse(startedAt))
        ? startedAt
        : validFinishedAt;

    const eventId =
      typeof id === 'string' && id.trim().length > 0
        ? id.trim()
        : `play_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const alreadyRecorded = currentPlayProg.gameEvents.some(ev => ev.id === eventId);
    if (alreadyRecorded) {
      return {
        success: true,
        alreadyRecorded: true,
        eventId,
        playSummary: this.getPlaySummary()
      };
    }

    const newEvent = {
      id: eventId,
      result,
      playerColor: playerColor === 'black' || playerColor === 'b' ? 'black' : 'white',
      difficulty: getPlayDifficultyById(difficulty).id,
      startedAt: validStartedAt,
      finishedAt: validFinishedAt,
      termination: typeof termination === 'string' && termination.trim() ? termination.trim() : 'draw',
      pgn: typeof pgn === 'string' ? pgn.trim() : ''
    };

    const updatedEvents = [...currentPlayProg.gameEvents, newEvent];

    this._state = storageService.saveProgress({
      ...this._state,
      playProgress: {
        gameEvents: updatedEvents,
        lastPlayedAt: validFinishedAt
      }
    });

    this._notify();

    return {
      success: true,
      alreadyRecorded: false,
      eventId,
      gameEvent: newEvent,
      playSummary: this.getPlaySummary()
    };
  }

  /**
   * Menghitung statistik permainan melawan komputer secara jujur dari gameEvents yang tersimpan.
   * Tidak menyimpan angka total secara terpisah agar bebas duplikasi saat sinkronisasi multi-perangkat.
   */
  getPlaySummary() {
    const playProg = this._getPlayProgress();
    const gameEvents = playProg.gameEvents;

    const totalGames = gameEvents.length;
    const wins = gameEvents.filter(e => e.result === 'win').length;
    const losses = gameEvents.filter(e => e.result === 'loss').length;
    const draws = gameEvents.filter(e => e.result === 'draw').length;
    const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

    const recentGames = [...gameEvents]
      .reverse()
      .slice(0, 10)
      .map(ev => {
        const diffInfo = getPlayDifficultyById(ev.difficulty);
        return {
          ...ev,
          resultLabel: formatPlayResultLabel(ev.result),
          playerColorLabel: ev.playerColor === 'black' ? 'Hitam' : 'Putih',
          difficultyTitle: diffInfo ? diffInfo.title : ev.difficulty,
          terminationLabel: formatPlayTerminationLabel(ev.termination)
        };
      });

    const byDifficulty = PLAY_DIFFICULTIES.map(diff => {
      const diffEvents = gameEvents.filter(e => e.difficulty === diff.id);
      const dTotal = diffEvents.length;
      const dWins = diffEvents.filter(e => e.result === 'win').length;
      const dLosses = diffEvents.filter(e => e.result === 'loss').length;
      const dDraws = diffEvents.filter(e => e.result === 'draw').length;
      const dWinRate = dTotal > 0 ? Math.round((dWins / dTotal) * 100) : 0;

      return {
        ...diff,
        totalGames: dTotal,
        wins: dWins,
        losses: dLosses,
        draws: dDraws,
        winRate: dWinRate
      };
    });

    return {
      totalGames,
      wins,
      losses,
      draws,
      winRate,
      lastPlayedAt: playProg.lastPlayedAt,
      recentGames,
      byDifficulty,
      gameEvents
    };
  }

  // =========================================================================
  // MVP 4 — PROGRES OPENING TRAINER (Bagian 3, 4, 6, 9)
  // =========================================================================

  _getOpeningProgress() {
    return sanitizeOpeningProgress(
      this._state && this._state.openingProgress
        ? this._state.openingProgress
        : createInitialOpeningProgressState()
    );
  }

  /**
   * Menentukan status pembelajaran opening secara deterministik:
   * - 'mastered' (Dikuasai)
   * - 'needs-review' (Perlu Diulang)
   * - 'studying' (Sedang Dipelajari)
   * - 'not-studied' (Belum Dipelajari)
   */
  getOpeningStatus(openingId) {
    if (!openingId) return 'not-studied';
    const openingProg = this._getOpeningProgress();

    if (openingProg.masteredOpeningIds.includes(openingId)) {
      return 'mastered';
    }

    const attemptsForOpening = openingProg.attemptEvents.filter(
      ev => ev.openingId === openingId
    );
    if (attemptsForOpening.length > 0) {
      const hasImperfectAttempt = attemptsForOpening.some(
        ev =>
          ev.wrongMoves > 0 ||
          ev.hintsUsed > 0 ||
          ev.completionStatus === 'needs-review' ||
          ev.completionStatus === 'failed'
      );
      if (hasImperfectAttempt) {
        return 'needs-review';
      }
      return 'studying';
    }

    if (openingProg.studiedOpeningIds.includes(openingId)) {
      return 'studying';
    }

    return 'not-studied';
  }

  getOpeningStatusInfo(openingId) {
    const status = this.getOpeningStatus(openingId);
    return OPENING_STATUS_META[status] || OPENING_STATUS_META['not-studied'];
  }

  /**
   * Mencatat bahwa sebuah variasi opening sedang/sudah dipelajari pada Learn Mode.
   * Tidak menambahkan XP global.
   */
  markOpeningStudied(openingId, { referenceDate = new Date() } = {}) {
    const found = getOpeningById(openingId);
    if (!found) return null;

    const currentOpeningProg = this._getOpeningProgress();
    const nowIso = new Date().toISOString();
    const today = getLocalDateString(referenceDate);

    const studiedSet = new Set(currentOpeningProg.studiedOpeningIds);
    studiedSet.add(openingId);

    const activityDatesSet = new Set(this._state.activityDates);
    activityDatesSet.add(today);

    this._state = storageService.saveProgress({
      ...this._state,
      activityDates: Array.from(activityDatesSet),
      openingProgress: {
        ...currentOpeningProg,
        studiedOpeningIds: Array.from(studiedSet),
        lastStudiedOpeningId: openingId,
        updatedAt: nowIso
      }
    });

    this._notify();
    return this.getOpeningStatusInfo(openingId);
  }

  /**
   * Mencatat satu sesi latihan opening (Opening Practice Mode) secara idempoten berdasarkan `id` unik.
   * Tidak menambahkan XP global tanpa aturan yang jelas.
   */
  recordOpeningPracticeAttempt({
    id = null,
    openingId,
    repertoireSide = null,
    correctMoves = 0,
    wrongMoves = 0,
    hintsUsed = 0,
    completionStatus = null,
    referenceDate = new Date()
  } = {}) {
    const found = getOpeningById(openingId);
    if (!found) {
      return { success: false, error: 'Opening tidak ditemukan.' };
    }

    const currentOpeningProg = this._getOpeningProgress();
    const nowIso = new Date().toISOString();
    const today = getLocalDateString(referenceDate);
    const eventId =
      typeof id === 'string' && id.trim().length > 0
        ? id.trim()
        : `open_att_${openingId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const cleanCorrect = Math.max(0, Math.floor(Number(correctMoves) || 0));
    const cleanWrong = Math.max(0, Math.floor(Number(wrongMoves) || 0));
    const cleanHints = Math.max(0, Math.floor(Number(hintsUsed) || 0));
    const validSide =
      repertoireSide === 'black' || found.repertoireSide === 'black' ? 'black' : 'white';

    const isCleanMastery = cleanCorrect > 0 && cleanWrong === 0 && cleanHints === 0;
    let effectiveStatus = 'completed';
    if (isCleanMastery) {
      effectiveStatus = 'mastered';
    } else if (cleanWrong > 0 || cleanHints > 0) {
      effectiveStatus = 'needs-review';
    }
    if (
      typeof completionStatus === 'string' &&
      ['completed', 'mastered', 'needs-review', 'in_progress', 'failed'].includes(
        completionStatus.trim()
      )
    ) {
      effectiveStatus = completionStatus.trim();
    }

    const updatedEvents = [...currentOpeningProg.attemptEvents];
    const existingIdx = updatedEvents.findIndex(ev => ev.id === eventId);

    const eventPayload = {
      id: eventId,
      openingId,
      repertoireSide: validSide,
      correctMoves: cleanCorrect,
      wrongMoves: cleanWrong,
      hintsUsed: cleanHints,
      completionStatus: effectiveStatus,
      timestamp: nowIso,
      date: today
    };

    if (existingIdx >= 0) {
      const prev = updatedEvents[existingIdx];
      updatedEvents[existingIdx] = {
        ...prev,
        correctMoves: Math.max(prev.correctMoves || 0, eventPayload.correctMoves),
        wrongMoves: Math.max(prev.wrongMoves || 0, eventPayload.wrongMoves),
        hintsUsed: Math.max(prev.hintsUsed || 0, eventPayload.hintsUsed),
        completionStatus: eventPayload.completionStatus,
        timestamp: nowIso,
        date: today
      };
    } else {
      updatedEvents.push(eventPayload);
    }

    const studiedSet = new Set(currentOpeningProg.studiedOpeningIds);
    studiedSet.add(openingId);

    const masteredSet = new Set(currentOpeningProg.masteredOpeningIds);
    if (isCleanMastery || effectiveStatus === 'mastered') {
      masteredSet.add(openingId);
    }

    const activityDatesSet = new Set(this._state.activityDates);
    activityDatesSet.add(today);

    this._state = storageService.saveProgress({
      ...this._state,
      activityDates: Array.from(activityDatesSet),
      openingProgress: {
        studiedOpeningIds: Array.from(studiedSet),
        masteredOpeningIds: Array.from(masteredSet),
        attemptEvents: updatedEvents,
        lastStudiedOpeningId: openingId,
        updatedAt: nowIso
      }
    });

    this._notify();

    const totalMoveAttempts = cleanCorrect + cleanWrong;
    const sessionAccuracy =
      totalMoveAttempts > 0 ? Math.round((cleanCorrect / totalMoveAttempts) * 100) : 0;

    return {
      success: true,
      eventId,
      openingId,
      status: this.getOpeningStatus(openingId),
      statusInfo: this.getOpeningStatusInfo(openingId),
      isMastered: masteredSet.has(openingId),
      sessionAccuracy,
      openingSummary: this.getOpeningSummary()
    };
  }

  /**
   * Menghitung seluruh statistik Opening Trainer secara jujur dari data aktual openingProgress.
   */
  getOpeningSummary() {
    const allOpenings = getAllOpenings();
    const totalOpeningsCount = allOpenings.length;
    const openingProg = this._getOpeningProgress();

    const studiedSet = new Set(openingProg.studiedOpeningIds);
    const masteredSet = new Set(openingProg.masteredOpeningIds);

    const validStudiedOpenings = allOpenings.filter(o => studiedSet.has(o.id));
    const validMasteredOpenings = allOpenings.filter(o => masteredSet.has(o.id));

    const studiedCount = validStudiedOpenings.length;
    const masteredCount = validMasteredOpenings.length;

    const attemptEvents = openingProg.attemptEvents;
    const totalPracticeSessions = attemptEvents.length;

    let totalCorrectMoves = 0;
    let totalWrongMoves = 0;
    let totalHintsUsed = 0;

    for (const ev of attemptEvents) {
      totalCorrectMoves += ev.correctMoves || 0;
      totalWrongMoves += ev.wrongMoves || 0;
      totalHintsUsed += ev.hintsUsed || 0;
    }

    const totalEvaluatedMoves = totalCorrectMoves + totalWrongMoves;
    const successRate =
      totalEvaluatedMoves > 0
        ? Math.round((totalCorrectMoves / totalEvaluatedMoves) * 100)
        : 0;

    let lastStudiedOpening = null;
    if (openingProg.lastStudiedOpeningId) {
      const foundLast = getOpeningById(openingProg.lastStudiedOpeningId);
      if (foundLast) {
        const statusInfo = this.getOpeningStatusInfo(foundLast.id);
        lastStudiedOpening = {
          ...foundLast,
          status: statusInfo.id,
          statusLabel: statusInfo.label,
          statusBadgeClass: statusInfo.badgeClass
        };
      }
    }

    // Ringkasan Repertoire Putih & Repertoire Hitam
    const buildRepertoireStats = sideInfo => {
      const sideOpenings = allOpenings.filter(o => o.repertoireSide === sideInfo.id);
      const totalAvailable = sideOpenings.length;
      const studied = sideOpenings.filter(o => studiedSet.has(o.id)).length;
      const mastered = sideOpenings.filter(o => masteredSet.has(o.id)).length;
      const percentage = totalAvailable > 0 ? Math.round((studied / totalAvailable) * 100) : 0;
      const masteryPercentage =
        totalAvailable > 0 ? Math.round((mastered / totalAvailable) * 100) : 0;

      return {
        ...sideInfo,
        totalAvailable,
        studiedCount: studied,
        masteredCount: mastered,
        percentage,
        masteryPercentage
      };
    };

    const repertoireSummary = {
      white: buildRepertoireStats(OPENING_REPERTOIRE_SIDES[0]),
      black: buildRepertoireStats(OPENING_REPERTOIRE_SIDES[1])
    };

    // Ringkasan Kategori Opening (hanya tampilkan kategori yang memiliki data)
    const categoriesSummary = OPENING_CATEGORIES.map(cat => {
      const catOpenings = allOpenings.filter(
        o => o.categoryId === cat.id || o.category === cat.title
      );
      const total = catOpenings.length;
      if (total === 0) return null;

      const studied = catOpenings.filter(o => studiedSet.has(o.id)).length;
      const mastered = catOpenings.filter(o => masteredSet.has(o.id)).length;
      const percentage = Math.round((studied / total) * 100);

      return {
        ...cat,
        totalOpenings: total,
        studiedOpenings: studied,
        masteredOpenings: mastered,
        percentage
      };
    }).filter(Boolean);

    const difficultiesSummary = OPENING_DIFFICULTIES.map(diff => {
      const diffOpenings = allOpenings.filter(o => o.difficulty === diff.id);
      const total = diffOpenings.length;
      const studied = diffOpenings.filter(o => studiedSet.has(o.id)).length;
      const mastered = diffOpenings.filter(o => masteredSet.has(o.id)).length;
      return {
        ...diff,
        totalOpenings: total,
        studiedOpenings: studied,
        masteredOpenings: mastered
      };
    });

    const recentSessions = [...attemptEvents]
      .reverse()
      .slice(0, 10)
      .map(ev => {
        const opening = getOpeningById(ev.openingId);
        const totalMoves = (ev.correctMoves || 0) + (ev.wrongMoves || 0);
        const accuracy = totalMoves > 0 ? Math.round((ev.correctMoves / totalMoves) * 100) : 0;
        return {
          ...ev,
          opening,
          openingName: opening ? opening.name : ev.openingId,
          eco: opening ? opening.eco : '-',
          accuracy
        };
      });

    return {
      totalOpeningsCount,
      studiedCount,
      masteredCount,
      totalPracticeSessions,
      totalCorrectMoves,
      totalWrongMoves,
      totalHintsUsed,
      successRate,
      lastStudiedOpening,
      repertoireSummary,
      categoriesSummary,
      difficultiesSummary,
      recentSessions,
      studiedOpeningIds: openingProg.studiedOpeningIds,
      masteredOpeningIds: openingProg.masteredOpeningIds,
      attemptEvents
    };
  }

  /**
   * Mendapatkan ringkasan lengkap untuk Dashboard dan Halaman Belajar
   */
  getSummary() {
    const allLessons = getAllLessons();
    const totalLessonsCount = allLessons.length;
    const validCompletedLessons = allLessons.filter(l =>
      this._state.completedLessonIds.includes(l.id)
    );
    const completedCount = validCompletedLessons.length;
    const overallPercentage =
      totalLessonsCount > 0 ? Math.round((completedCount / totalLessonsCount) * 100) : 0;

    const levelInfo = this.calculateLevelInfo(this._state.totalXp);
    const streak = this.calculateStreak(this._state.activityDates);

    // Cari materi pertama yang belum selesai sebagai rekomendasi utama berikutnya
    const uncompletedLessons = allLessons.filter(
      l => !this._state.completedLessonIds.includes(l.id)
    );
    const recommendedNextLesson = uncompletedLessons[0] || null;
    const recommendedLessons = uncompletedLessons.slice(0, 4);

    // Materi terakhir yang dibuka pengguna
    let continueLesson = null;
    if (this._state.lastOpenedLessonId) {
      const lastFound = getLessonById(this._state.lastOpenedLessonId);
      if (lastFound) {
        continueLesson = {
          ...lastFound.lesson,
          isCompleted: this.isLessonCompleted(lastFound.lesson.id)
        };
      }
    }

    // Ringkasan per kategori (Level 1 s/d Level 6)
    const categoriesSummary = CURRICULUM_CATEGORIES.map((cat, catIdx) => {
      const total = cat.lessons.length;
      const completed = cat.lessons.filter(l =>
        this._state.completedLessonIds.includes(l.id)
      ).length;
      const started = cat.lessons.filter(
        l =>
          this._state.startedLessonIds.includes(l.id) ||
          this._state.completedLessonIds.includes(l.id)
      ).length;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

      let status = 'Belum dimulai';
      let statusCode = 'not-started';
      if (completed === total && total > 0) {
        status = 'Selesai';
        statusCode = 'completed';
      } else if (completed > 0 || started > 0) {
        status = 'Sedang dipelajari';
        statusCode = 'in-progress';
      }

      // Cek apakah kategori sebelumnya sudah selesai untuk memberikan indikator tahapan
      const prevCatCompleted =
        catIdx === 0 ||
        CURRICULUM_CATEGORIES[catIdx - 1].lessons.every(l =>
          this._state.completedLessonIds.includes(l.id)
        );

      const enrichedLessons = cat.lessons.map(lesson => {
        const isCompleted = this.isLessonCompleted(lesson.id);
        const isStarted = this.isLessonStarted(lesson.id);
        const isRecommendedNext =
          recommendedNextLesson && recommendedNextLesson.id === lesson.id;

        return {
          ...lesson,
          isCompleted,
          isStarted,
          isRecommendedNext
        };
      });

      return {
        ...cat,
        totalLessons: total,
        completedLessons: completed,
        percentage,
        status,
        statusCode,
        isStageUnlocked: prevCatCompleted || completed > 0 || started > 0,
        lessons: enrichedLessons
      };
    });

    return {
      totalXp: this._state.totalXp,
      level: levelInfo.level,
      levelInfo,
      completedCount,
      totalLessonsCount,
      overallPercentage,
      streak,
      hasAnyActivity:
        completedCount > 0 ||
        this._state.startedLessonIds.length > 0 ||
        Boolean(this._state.lastOpenedLessonId),
      continueLesson,
      recommendedNextLesson,
      recommendedLessons,
      categoriesSummary,
      firstLesson: allLessons[0],
      puzzleSummary: this.getPuzzleSummary(),
      playSummary: this.getPlaySummary(),
      openingSummary: this.getOpeningSummary()
    };
  }

  resetAllProgress() {
    this._state = storageService.resetProgress();
    this._notify();
    return this.getSummary();
  }

  subscribe(callback) {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(cb => cb !== callback);
    };
  }

  _notify() {
    const summary = this.getSummary();
    for (const cb of this._listeners) {
      cb(summary);
    }
  }
}

export function formatPlayResultLabel(res) {
  if (res === 'win') return 'Menang';
  if (res === 'loss') return 'Kalah';
  return 'Seri';
}

export function formatPlayTerminationLabel(term) {
  switch (term) {
    case 'checkmate':
      return 'Skakmat';
    case 'stalemate':
      return 'Remis Otomatis — Stalemate';
    case 'threefold_repetition':
      return 'Klaim Remis — Pengulangan Tiga Kali';
    case 'fifty_move_rule':
      return 'Klaim Remis — Aturan 50 Langkah';
    case 'fivefold_repetition':
      return 'Remis Otomatis — Pengulangan Lima Kali';
    case 'seventy_five_move_rule':
      return 'Remis Otomatis — Aturan 75 Langkah';
    case 'insufficient_material':
      return 'Remis Otomatis — Materi Tidak Cukup';
    case 'resign':
      return 'Menyerah';
    default:
      return 'Remis';
  }
}

export const progressService = new ProgressService();
export default progressService;
