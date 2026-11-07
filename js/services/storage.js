/**
 * Layanan Penyimpanan Modular & Sinkronisasi Cloud (Storage Service) — Caturan
 * Menggabungkan:
 * 1. LocalStorageAdapter (cache lokal cepat & fallback offline)
 * 2. SupabaseStorageAdapter (penyimpanan cloud pada tabel public.user_progress)
 * 3. Strategi Initial Sync & Deterministic Merge (anti-duplikasi XP & materi)
 */

import { getAllLessons, getLessonById } from '../data/curriculum.js';
import { getSupabaseClient } from './supabaseClient.js';

export const STORAGE_KEYS = {
  USER_PROGRESS: 'chess_academy_mvp1_progress_v1',
  USER_PROGRESS_BACKUP: 'chess_academy_mvp1_progress_backup_v1',
  THEME_PREF: 'chess_academy_mvp1_theme_v1',
  SIDEBAR_COLLAPSED: 'chess_academy_mvp1_sidebar_collapsed_v1'
};

export const SYNC_STATUS = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  PENDING: 'pending',
  OFFLINE: 'offline',
  ERROR: 'error'
};

export const SYNC_STATUS_LABELS = {
  [SYNC_STATUS.IDLE]: 'Sinkronisasi tertunda',
  [SYNC_STATUS.SYNCING]: 'Menyinkronkan',
  [SYNC_STATUS.SYNCED]: 'Tersinkronisasi',
  [SYNC_STATUS.PENDING]: 'Sinkronisasi tertunda',
  [SYNC_STATUS.OFFLINE]: 'Offline',
  [SYNC_STATUS.ERROR]: 'Gagal menyinkronkan'
};

/**
 * State awal progres puzzle yang jujur (semua statistik bernilai 0)
 */
export function createInitialPuzzleProgressState() {
  return {
    solvedPuzzleIds: [],
    attemptEvents: [],
    dailyPuzzleDates: [],
    lastPlayedPuzzleId: null,
    updatedAt: null
  };
}

/**
 * State awal yang jujur (semua statistik bernilai 0)
 */
export function createInitialProgressState() {
  return {
    schemaVersion: 2,
    totalXp: 0,
    completedLessonIds: [],
    startedLessonIds: [],
    lastOpenedLessonId: null,
    activityDates: [], // Format 'YYYY-MM-DD' untuk perhitungan streak harian
    lessonCompletedAt: {}, // Map lessonId -> ISO timestamp
    puzzleProgress: createInitialPuzzleProgressState(),
    updatedAt: null
  };
}

/**
 * Menghitung ulang totalXp secara deterministik dari daftar completedLessonIds
 * berdasarkan nilai xpReward masing-masing materi di kurikulum (js/data/curriculum.js).
 * Tidak pernah menjumlahkan local.totalXp + cloud.totalXp secara mentah.
 */
export function calculateXpFromCompletedLessons(completedLessonIds) {
  if (!Array.isArray(completedLessonIds) || completedLessonIds.length === 0) {
    return 0;
  }
  const uniqueIds = new Set(
    completedLessonIds.filter(id => typeof id === 'string' && id.trim().length > 0)
  );
  let totalXp = 0;
  for (const lessonId of uniqueIds) {
    const found = getLessonById(lessonId);
    if (found && found.lesson && typeof found.lesson.xpReward === 'number') {
      totalXp += found.lesson.xpReward;
    }
  }
  return totalXp;
}

/**
 * Memeriksa apakah sebuah string adalah ISO timestamp yang valid
 */
function isValidIsoTimestamp(val) {
  if (typeof val !== 'string' || val.trim().length === 0) return false;
  const time = Date.parse(val);
  return Number.isFinite(time);
}

/**
 * Sanitasi namespace puzzleProgress agar tahan terhadap data korup atau data lama (schemaVersion 1)
 */
export function sanitizePuzzleProgress(rawPuzzle) {
  const initial = createInitialPuzzleProgressState();
  if (!rawPuzzle || typeof rawPuzzle !== 'object' || Array.isArray(rawPuzzle)) {
    return initial;
  }

  const cleanStringArray = arr =>
    Array.isArray(arr)
      ? [
          ...new Set(
            arr
              .filter(item => typeof item === 'string' && item.trim().length > 0)
              .map(item => item.trim())
          )
        ]
      : [];

  const cleanDatesArray = arr =>
    Array.isArray(arr)
      ? [
          ...new Set(
            arr
              .filter(
                item => typeof item === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.trim())
              )
              .map(item => item.trim())
          )
        ].sort()
      : [];

  // Sanitasi attemptEvents berdasarkan event ID unik (idempotent)
  const eventsById = new Map();
  if (Array.isArray(rawPuzzle.attemptEvents)) {
    for (const rawEv of rawPuzzle.attemptEvents) {
      if (!rawEv || typeof rawEv !== 'object' || Array.isArray(rawEv)) continue;
      const id =
        typeof rawEv.id === 'string' && rawEv.id.trim().length > 0 ? rawEv.id.trim() : null;
      const puzzleId =
        typeof rawEv.puzzleId === 'string' && rawEv.puzzleId.trim().length > 0
          ? rawEv.puzzleId.trim()
          : null;
      if (!id || !puzzleId) continue;

      const ts = isValidIsoTimestamp(rawEv.timestamp)
        ? rawEv.timestamp
        : new Date(0).toISOString();

      let dateStr =
        typeof rawEv.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawEv.date.trim())
          ? rawEv.date.trim()
          : null;
      if (!dateStr) {
        const d = new Date(Date.parse(ts));
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dateStr = `${y}-${m}-${day}`;
      }

      const hintsUsed =
        typeof rawEv.hintsUsed === 'number' &&
        Number.isFinite(rawEv.hintsUsed) &&
        rawEv.hintsUsed >= 0
          ? Math.floor(rawEv.hintsUsed)
          : 0;

      const wrongMoves =
        typeof rawEv.wrongMoves === 'number' &&
        Number.isFinite(rawEv.wrongMoves) &&
        rawEv.wrongMoves >= 0
          ? Math.floor(rawEv.wrongMoves)
          : 0;

      const mode =
        typeof rawEv.mode === 'string' && rawEv.mode.trim().length > 0
          ? rawEv.mode.trim()
          : 'mixed';

      const cleanEv = {
        id,
        puzzleId,
        solved: Boolean(rawEv.solved),
        hintsUsed,
        wrongMoves,
        mode,
        timestamp: ts,
        date: dateStr
      };

      const existing = eventsById.get(id);
      if (!existing) {
        eventsById.set(id, cleanEv);
      } else {
        eventsById.set(id, {
          ...existing,
          solved: existing.solved || cleanEv.solved,
          hintsUsed: Math.max(existing.hintsUsed, cleanEv.hintsUsed),
          wrongMoves: Math.max(existing.wrongMoves, cleanEv.wrongMoves)
        });
      }
    }
  }

  const attemptEvents = Array.from(eventsById.values()).sort((a, b) => {
    const tA = Date.parse(a.timestamp);
    const tB = Date.parse(b.timestamp);
    if (tA !== tB) return tA - tB;
    return a.id.localeCompare(b.id);
  });

  // Pastikan setiap puzzle yang memiliki attemptEvent solved=true juga tercatat di solvedPuzzleIds
  const rawSolvedIds = cleanStringArray(rawPuzzle.solvedPuzzleIds);
  const solvedFromEvents = attemptEvents.filter(e => e.solved).map(e => e.puzzleId);
  const solvedPuzzleIds = [...new Set([...rawSolvedIds, ...solvedFromEvents])];

  return {
    solvedPuzzleIds,
    attemptEvents,
    dailyPuzzleDates: cleanDatesArray(rawPuzzle.dailyPuzzleDates),
    lastPlayedPuzzleId:
      typeof rawPuzzle.lastPlayedPuzzleId === 'string' &&
      rawPuzzle.lastPlayedPuzzleId.trim().length > 0
        ? rawPuzzle.lastPlayedPuzzleId.trim()
        : null,
    updatedAt: isValidIsoTimestamp(rawPuzzle.updatedAt) ? rawPuzzle.updatedAt : null
  };
}

/**
 * Memeriksa apakah puzzleProgress memiliki aktivitas nyata
 */
export function hasMeaningfulPuzzleProgress(puzzleProg) {
  if (!puzzleProg || typeof puzzleProg !== 'object' || Array.isArray(puzzleProg)) {
    return false;
  }
  const clean = sanitizePuzzleProgress(puzzleProg);
  return (
    clean.solvedPuzzleIds.length > 0 ||
    clean.attemptEvents.length > 0 ||
    clean.dailyPuzzleDates.length > 0 ||
    Boolean(clean.lastPlayedPuzzleId)
  );
}

/**
 * Menggabungkan (Merge) puzzleProgress Local dan Cloud secara deterministik & idempoten (Bagian 7)
 */
export function mergePuzzleProgress(localPuzzleRaw, cloudPuzzleRaw, localRootUpdatedAt = null, cloudRootUpdatedAt = null) {
  const localP = sanitizePuzzleProgress(localPuzzleRaw);
  const cloudP = sanitizePuzzleProgress(cloudPuzzleRaw);

  // 1. Gabungkan attemptEvents berdasarkan event ID unik (idempotent)
  const mergedEventsMap = new Map();
  for (const ev of [...cloudP.attemptEvents, ...localP.attemptEvents]) {
    const existing = mergedEventsMap.get(ev.id);
    if (!existing) {
      mergedEventsMap.set(ev.id, { ...ev });
    } else {
      mergedEventsMap.set(ev.id, {
        ...existing,
        solved: existing.solved || ev.solved,
        hintsUsed: Math.max(existing.hintsUsed, ev.hintsUsed),
        wrongMoves: Math.max(existing.wrongMoves, ev.wrongMoves)
      });
    }
  }

  const attemptEvents = Array.from(mergedEventsMap.values()).sort((a, b) => {
    const tA = Date.parse(a.timestamp);
    const tB = Date.parse(b.timestamp);
    if (tA !== tB) return tA - tB;
    return a.id.localeCompare(b.id);
  });

  // 2. Gabungkan solvedPuzzleIds sebagai himpunan unik (termasuk dari attemptEvents yang solved)
  const solvedPuzzleIds = [
    ...new Set([
      ...cloudP.solvedPuzzleIds,
      ...localP.solvedPuzzleIds,
      ...attemptEvents.filter(e => e.solved).map(e => e.puzzleId)
    ])
  ];

  // 3. Gabungkan dailyPuzzleDates sebagai himpunan unik terurut
  const dailyPuzzleDates = [
    ...new Set([...cloudP.dailyPuzzleDates, ...localP.dailyPuzzleDates])
  ].sort();

  // 4. Pilih lastPlayedPuzzleId & updatedAt terbaru
  const localPTime = isValidIsoTimestamp(localP.updatedAt)
    ? Date.parse(localP.updatedAt)
    : isValidIsoTimestamp(localRootUpdatedAt)
    ? Date.parse(localRootUpdatedAt)
    : -1;
  const cloudPTime = isValidIsoTimestamp(cloudP.updatedAt)
    ? Date.parse(cloudP.updatedAt)
    : isValidIsoTimestamp(cloudRootUpdatedAt)
    ? Date.parse(cloudRootUpdatedAt)
    : -1;

  let lastPlayedPuzzleId = null;
  if (localPTime > cloudPTime) {
    lastPlayedPuzzleId = localP.lastPlayedPuzzleId || cloudP.lastPlayedPuzzleId || null;
  } else if (cloudPTime > localPTime) {
    lastPlayedPuzzleId = cloudP.lastPlayedPuzzleId || localP.lastPlayedPuzzleId || null;
  } else {
    lastPlayedPuzzleId = localP.lastPlayedPuzzleId || cloudP.lastPlayedPuzzleId || null;
  }

  let puzzleUpdatedAt = null;
  if (isValidIsoTimestamp(localP.updatedAt) && isValidIsoTimestamp(cloudP.updatedAt)) {
    puzzleUpdatedAt =
      Date.parse(localP.updatedAt) >= Date.parse(cloudP.updatedAt)
        ? localP.updatedAt
        : cloudP.updatedAt;
  } else if (isValidIsoTimestamp(localP.updatedAt)) {
    puzzleUpdatedAt = localP.updatedAt;
  } else if (isValidIsoTimestamp(cloudP.updatedAt)) {
    puzzleUpdatedAt = cloudP.updatedAt;
  }

  return {
    solvedPuzzleIds,
    attemptEvents,
    dailyPuzzleDates,
    lastPlayedPuzzleId,
    updatedAt: puzzleUpdatedAt
  };
}

/**
 * Sanitasi objek progres agar tahan terhadap data LocalStorage atau JSONB yang rusak/korup
 * Mendukung backward compatibility penuh dari schemaVersion 1 ke schemaVersion 2.
 */
export function sanitizeProgressState(parsed, { recalculateXp = false } = {}) {
  const initial = createInitialProgressState();
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return initial;
  }

  const cleanStringArray = arr =>
    Array.isArray(arr)
      ? [...new Set(arr.filter(item => typeof item === 'string' && item.trim().length > 0))]
      : [];

  const cleanDatesArray = arr =>
    Array.isArray(arr)
      ? [
          ...new Set(
            arr
              .filter(
                item => typeof item === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.trim())
              )
              .map(item => item.trim())
          )
        ].sort()
      : [];

  const completedLessonIds = cleanStringArray(parsed.completedLessonIds);
  const rawStartedIds = cleanStringArray(parsed.startedLessonIds);
  // Pastikan setiap materi yang sudah selesai juga tercatat pernah dimulai
  const startedLessonIds = [...new Set([...rawStartedIds, ...completedLessonIds])];

  const cleanCompletedAt = {};
  if (
    parsed.lessonCompletedAt &&
    typeof parsed.lessonCompletedAt === 'object' &&
    !Array.isArray(parsed.lessonCompletedAt)
  ) {
    for (const [k, v] of Object.entries(parsed.lessonCompletedAt)) {
      if (typeof k === 'string' && k.trim().length > 0 && isValidIsoTimestamp(v)) {
        cleanCompletedAt[k.trim()] = v;
      }
    }
  }

  const deterministicXp = calculateXpFromCompletedLessons(completedLessonIds);
  const rawTotalXp =
    typeof parsed.totalXp === 'number' && Number.isFinite(parsed.totalXp) && parsed.totalXp >= 0
      ? Math.floor(parsed.totalXp)
      : 0;

  // Jika recalculateXp aktif atau terdapat completedLessonIds yang tervalidasi di kurikulum,
  // pastikan totalXp sinkron dengan kurikulum.
  const validTotalXp =
    recalculateXp || completedLessonIds.length > 0 ? deterministicXp : rawTotalXp;

  const puzzleProgress = sanitizePuzzleProgress(parsed.puzzleProgress);

  return {
    schemaVersion: 2,
    totalXp: validTotalXp,
    completedLessonIds,
    startedLessonIds,
    lastOpenedLessonId:
      typeof parsed.lastOpenedLessonId === 'string' && parsed.lastOpenedLessonId.trim().length > 0
        ? parsed.lastOpenedLessonId.trim()
        : null,
    activityDates: cleanDatesArray(parsed.activityDates),
    lessonCompletedAt: cleanCompletedAt,
    puzzleProgress,
    updatedAt: isValidIsoTimestamp(parsed.updatedAt) ? parsed.updatedAt : null
  };
}

/**
 * Memeriksa apakah state progres memiliki aktivitas/data belajar atau puzzle nyata (bukan state kosong awal)
 */
export function hasMeaningfulProgress(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return false;
  }
  const sanitized = sanitizeProgressState(state);
  return (
    sanitized.completedLessonIds.length > 0 ||
    sanitized.startedLessonIds.length > 0 ||
    sanitized.activityDates.length > 0 ||
    Boolean(sanitized.lastOpenedLessonId) ||
    Object.keys(sanitized.lessonCompletedAt).length > 0 ||
    sanitized.totalXp > 0 ||
    hasMeaningfulPuzzleProgress(sanitized.puzzleProgress)
  );
}

/**
 * Menggabungkan (Merge) progres Local dan Cloud secara deterministik (MVP 1 + MVP 2):
 * - completedLessonIds: Set union unik (diurutkan mengikuti urutan kurikulum bila ada).
 * - startedLessonIds: Set union unik (mencakup seluruh completedLessonIds).
 * - activityDates: tanggal unik 'YYYY-MM-DD' terurut naik.
 * - lessonCompletedAt: gabungan seluruh riwayat penyelesaian materi yang valid (simpan timestamp paling awal jika ada di keduanya).
 * - lastOpenedLessonId: diambil dari state yang memiliki updatedAt paling baru.
 * - puzzleProgress: gabungan solvedPuzzleIds unik, attemptEvents unik berdasarkan ID, dailyPuzzleDates unik, dan lastPlayedPuzzleId terbaru.
 * - updatedAt: timestamp terbaru.
 * - totalXp: dihitung ulang secara deterministik dari completedLessonIds hasil merge dan kurikulum.
 */
export function mergeProgressStates(localRaw, cloudRaw) {
  const local = sanitizeProgressState(localRaw, { recalculateXp: true });
  const cloud = sanitizeProgressState(cloudRaw, { recalculateXp: true });

  const curriculumOrderMap = new Map(
    getAllLessons().map((lesson, idx) => [lesson.id, idx])
  );

  const sortLessonIds = ids =>
    [...ids].sort((a, b) => {
      const idxA = curriculumOrderMap.has(a) ? curriculumOrderMap.get(a) : Number.MAX_SAFE_INTEGER;
      const idxB = curriculumOrderMap.has(b) ? curriculumOrderMap.get(b) : Number.MAX_SAFE_INTEGER;
      if (idxA !== idxB) return idxA - idxB;
      return a.localeCompare(b);
    });

  // 1. completedLessonIds: Set union unik
  const mergedCompletedSet = new Set([
    ...cloud.completedLessonIds,
    ...local.completedLessonIds
  ]);
  const completedLessonIds = sortLessonIds(mergedCompletedSet);

  // 2. startedLessonIds: Set union unik (termasuk seluruh completedLessonIds)
  const mergedStartedSet = new Set([
    ...cloud.startedLessonIds,
    ...local.startedLessonIds,
    ...completedLessonIds
  ]);
  const startedLessonIds = sortLessonIds(mergedStartedSet);

  // 3. activityDates: tanggal unik 'YYYY-MM-DD' terurut
  const activityDates = [
    ...new Set([...cloud.activityDates, ...local.activityDates])
  ].sort();

  // 4. lessonCompletedAt: gabungkan riwayat penyelesaian yang valid
  const lessonCompletedAt = { ...cloud.lessonCompletedAt };
  for (const [lessonId, ts] of Object.entries(local.lessonCompletedAt)) {
    if (!isValidIsoTimestamp(ts)) continue;
    const existing = lessonCompletedAt[lessonId];
    if (!existing || !isValidIsoTimestamp(existing)) {
      lessonCompletedAt[lessonId] = ts;
    } else {
      // Gunakan waktu penyelesaian pertama yang tercatat valid
      const tLocal = Date.parse(ts);
      const tCloud = Date.parse(existing);
      lessonCompletedAt[lessonId] = tLocal <= tCloud ? ts : existing;
    }
  }

  // 5. Bandingkan updatedAt untuk memilih lastOpenedLessonId & updatedAt terbaru
  const localTime = isValidIsoTimestamp(local.updatedAt) ? Date.parse(local.updatedAt) : -1;
  const cloudTime = isValidIsoTimestamp(cloud.updatedAt) ? Date.parse(cloud.updatedAt) : -1;

  let lastOpenedLessonId = null;
  if (localTime > cloudTime) {
    lastOpenedLessonId = local.lastOpenedLessonId || cloud.lastOpenedLessonId || null;
  } else if (cloudTime > localTime) {
    lastOpenedLessonId = cloud.lastOpenedLessonId || local.lastOpenedLessonId || null;
  } else {
    lastOpenedLessonId = local.lastOpenedLessonId || cloud.lastOpenedLessonId || null;
  }

  // Pastikan jika lastOpenedLessonId ada, materi tersebut juga masuk ke startedLessonIds
  if (lastOpenedLessonId && !mergedStartedSet.has(lastOpenedLessonId)) {
    mergedStartedSet.add(lastOpenedLessonId);
  }
  const finalStartedLessonIds = sortLessonIds(mergedStartedSet);

  // 6. Merge namespace puzzleProgress secara deterministik & idempoten
  const puzzleProgress = mergePuzzleProgress(
    local.puzzleProgress,
    cloud.puzzleProgress,
    local.updatedAt,
    cloud.updatedAt
  );

  const localPuzzleTime = isValidIsoTimestamp(local.puzzleProgress?.updatedAt)
    ? Date.parse(local.puzzleProgress.updatedAt)
    : -1;
  const cloudPuzzleTime = isValidIsoTimestamp(cloud.puzzleProgress?.updatedAt)
    ? Date.parse(cloud.puzzleProgress.updatedAt)
    : -1;
  const maxTime = Math.max(localTime, cloudTime, localPuzzleTime, cloudPuzzleTime);

  let latestUpdatedAt = null;
  if (maxTime >= 0) {
    latestUpdatedAt = new Date(maxTime).toISOString();
  } else {
    latestUpdatedAt = new Date().toISOString();
  }

  // 7. Hitung ulang totalXp secara deterministik dari completedLessonIds
  const totalXp = calculateXpFromCompletedLessons(completedLessonIds);

  return {
    schemaVersion: 2,
    totalXp,
    completedLessonIds,
    startedLessonIds: finalStartedLessonIds,
    lastOpenedLessonId,
    activityDates,
    lessonCompletedAt,
    puzzleProgress,
    updatedAt: latestUpdatedAt
  };
}

/**
 * Membandingkan apakah dua state progres memiliki isi fungsional yang sama
 * (mengabaikan perbedaan milidetik pada updatedAt jika seluruh data identik)
 */
export function areProgressStatesEqual(stateA, stateB) {
  const a = sanitizeProgressState(stateA, { recalculateXp: true });
  const b = sanitizeProgressState(stateB, { recalculateXp: true });

  return (
    a.schemaVersion === b.schemaVersion &&
    a.totalXp === b.totalXp &&
    a.lastOpenedLessonId === b.lastOpenedLessonId &&
    JSON.stringify(a.completedLessonIds) === JSON.stringify(b.completedLessonIds) &&
    JSON.stringify(a.startedLessonIds) === JSON.stringify(b.startedLessonIds) &&
    JSON.stringify(a.activityDates) === JSON.stringify(b.activityDates) &&
    JSON.stringify(a.lessonCompletedAt) === JSON.stringify(b.lessonCompletedAt) &&
    a.puzzleProgress.lastPlayedPuzzleId === b.puzzleProgress.lastPlayedPuzzleId &&
    JSON.stringify(a.puzzleProgress.solvedPuzzleIds) ===
      JSON.stringify(b.puzzleProgress.solvedPuzzleIds) &&
    JSON.stringify(a.puzzleProgress.attemptEvents) ===
      JSON.stringify(b.puzzleProgress.attemptEvents) &&
    JSON.stringify(a.puzzleProgress.dailyPuzzleDates) ===
      JSON.stringify(b.puzzleProgress.dailyPuzzleDates) &&
    a.updatedAt === b.updatedAt
  );
}

/**
 * Adapter Penyimpanan Lokal (LocalStorage)
 */
export class LocalStorageAdapter {
  getProgress() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return createInitialProgressState();
      }
      const raw = window.localStorage.getItem(STORAGE_KEYS.USER_PROGRESS);
      if (!raw) {
        return createInitialProgressState();
      }
      const parsed = JSON.parse(raw);
      return sanitizeProgressState(parsed, { recalculateXp: true });
    } catch (err) {
      console.warn('Gagal membaca progres dari LocalStorage, menggunakan state awal:', err);
      return createInitialProgressState();
    }
  }

  saveProgress(state, { preserveUpdatedAt = false } = {}) {
    try {
      const sanitized = sanitizeProgressState(state, { recalculateXp: true });
      const payload = {
        ...sanitized,
        updatedAt:
          preserveUpdatedAt && isValidIsoTimestamp(sanitized.updatedAt)
            ? sanitized.updatedAt
            : new Date().toISOString()
      };
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEYS.USER_PROGRESS, JSON.stringify(payload));
      }
      return payload;
    } catch (err) {
      console.error('Gagal menyimpan progres ke LocalStorage:', err);
      return sanitizeProgressState(state, { recalculateXp: true });
    }
  }

  /**
   * Menyimpan salinan cadangan (snapshot backup) ke LocalStorage sebelum initial sync
   */
  saveBackupSnapshot(state = null) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      const current = state || this.getProgress();
      const backupPayload = {
        backedUpAt: new Date().toISOString(),
        progress: sanitizeProgressState(current, { recalculateXp: true })
      };
      window.localStorage.setItem(
        STORAGE_KEYS.USER_PROGRESS_BACKUP,
        JSON.stringify(backupPayload)
      );
      return backupPayload;
    } catch (err) {
      console.warn('Gagal membuat backup snapshot progres lokal:', err);
      return null;
    }
  }

  getBackupSnapshot() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      const raw = window.localStorage.getItem(STORAGE_KEYS.USER_PROGRESS_BACKUP);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        backedUpAt: parsed.backedUpAt || null,
        progress: sanitizeProgressState(parsed.progress, { recalculateXp: true })
      };
    } catch {
      return null;
    }
  }

  resetProgress() {
    const initial = createInitialProgressState();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEYS.USER_PROGRESS);
      }
    } catch (err) {
      console.error('Gagal menghapus progres dari LocalStorage:', err);
    }
    return initial;
  }

  getTheme() {
    try {
      const val = window.localStorage.getItem(STORAGE_KEYS.THEME_PREF);
      return val === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }

  saveTheme(theme) {
    try {
      window.localStorage.setItem(STORAGE_KEYS.THEME_PREF, theme === 'dark' ? 'dark' : 'light');
    } catch (err) {
      console.error('Gagal menyimpan preferensi tema:', err);
    }
  }

  getSidebarCollapsed() {
    try {
      return window.localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
    } catch {
      return false;
    }
  }

  saveSidebarCollapsed(isCollapsed) {
    try {
      window.localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, isCollapsed ? 'true' : 'false');
    } catch (err) {
      console.error('Gagal menyimpan preferensi sidebar:', err);
    }
  }
}

/**
 * Adapter Penyimpanan Cloud Supabase (Tabel public.user_progress)
 */
export class SupabaseStorageAdapter {
  constructor(clientGetter = getSupabaseClient) {
    this._getClient = clientGetter;
  }

  _validatePayload(userId, progress) {
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new Error('user_id wajib diisi untuk operasi penyimpanan cloud.');
    }
    if (!progress || typeof progress !== 'object' || Array.isArray(progress)) {
      throw new Error('Payload progress harus berupa JSON object yang valid.');
    }
    return sanitizeProgressState(progress, { recalculateXp: true });
  }

  /**
   * Membaca baris progres milik pengguna dari public.user_progress
   */
  async fetchUserProgress(userId) {
    const client = this._getClient();
    if (!client) {
      return {
        ok: false,
        exists: false,
        progress: null,
        error: new Error('Supabase client belum terkonfigurasi.')
      };
    }

    try {
      const { data, error } = await client
        .from('user_progress')
        .select('user_id, progress, created_at, updated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        return { ok: false, exists: false, progress: null, error };
      }

      if (!data) {
        return { ok: true, exists: false, progress: null, rowUpdatedAt: null };
      }

      const rawProgress =
        data.progress && typeof data.progress === 'object' && !Array.isArray(data.progress)
          ? {
              ...data.progress,
              updatedAt: data.progress.updatedAt || data.updated_at || null
            }
          : createInitialProgressState();

      const sanitized = sanitizeProgressState(rawProgress, { recalculateXp: true });
      return {
        ok: true,
        exists: true,
        progress: sanitized,
        rowUpdatedAt: data.updated_at || null
      };
    } catch (err) {
      return { ok: false, exists: false, progress: null, error: err };
    }
  }

  /**
   * Membuat baris progres pertama kali (INSERT) saat pengguna belum memiliki baris di database
   */
  async insertUserProgress(userId, progress) {
    const client = this._getClient();
    if (!client) {
      return { ok: false, progress: null, error: new Error('Supabase client belum terkonfigurasi.') };
    }

    try {
      const cleanProgress = this._validatePayload(userId, progress);
      const payloadToSave = {
        ...cleanProgress,
        updatedAt: isValidIsoTimestamp(cleanProgress.updatedAt)
          ? cleanProgress.updatedAt
          : new Date().toISOString()
      };

      const { data, error } = await client
        .from('user_progress')
        .insert({
          user_id: userId,
          progress: payloadToSave
        })
        .select('user_id, progress, updated_at')
        .single();

      if (error) {
        return { ok: false, progress: null, error };
      }

      const saved = sanitizeProgressState(
        data && data.progress ? data.progress : payloadToSave,
        { recalculateXp: true }
      );
      return { ok: true, progress: saved, rowUpdatedAt: data?.updated_at || null };
    } catch (err) {
      return { ok: false, progress: null, error: err };
    }
  }

  /**
   * Memperbarui baris progres yang sudah ada (UPDATE) di public.user_progress
   */
  async updateUserProgress(userId, progress) {
    const client = this._getClient();
    if (!client) {
      return { ok: false, progress: null, error: new Error('Supabase client belum terkonfigurasi.') };
    }

    try {
      const cleanProgress = this._validatePayload(userId, progress);
      const payloadToSave = {
        ...cleanProgress,
        updatedAt: isValidIsoTimestamp(cleanProgress.updatedAt)
          ? cleanProgress.updatedAt
          : new Date().toISOString()
      };

      const { data, error } = await client
        .from('user_progress')
        .update({
          progress: payloadToSave
        })
        .eq('user_id', userId)
        .select('user_id, progress, updated_at')
        .single();

      if (error) {
        return { ok: false, progress: null, error };
      }

      const saved = sanitizeProgressState(
        data && data.progress ? data.progress : payloadToSave,
        { recalculateXp: true }
      );
      return { ok: true, progress: saved, rowUpdatedAt: data?.updated_at || null };
    } catch (err) {
      return { ok: false, progress: null, error: err };
    }
  }

  /**
   * Menyimpan progres dengan UPSERT (INSERT jika belum ada, UPDATE jika sudah ada)
   */
  async saveUserProgress(userId, progress) {
    const client = this._getClient();
    if (!client) {
      return { ok: false, progress: null, error: new Error('Supabase client belum terkonfigurasi.') };
    }

    try {
      const cleanProgress = this._validatePayload(userId, progress);
      const payloadToSave = {
        ...cleanProgress,
        updatedAt: isValidIsoTimestamp(cleanProgress.updatedAt)
          ? cleanProgress.updatedAt
          : new Date().toISOString()
      };

      const { data, error } = await client
        .from('user_progress')
        .upsert(
          {
            user_id: userId,
            progress: payloadToSave
          },
          { onConflict: 'user_id' }
        )
        .select('user_id, progress, updated_at')
        .single();

      if (error) {
        return { ok: false, progress: null, error };
      }

      const saved = sanitizeProgressState(
        data && data.progress ? data.progress : payloadToSave,
        { recalculateXp: true }
      );
      return { ok: true, progress: saved, rowUpdatedAt: data?.updated_at || null };
    } catch (err) {
      return { ok: false, progress: null, error: err };
    }
  }
}

/**
 * StorageService Terpadu:
 * Mengoordinasikan LocalStorageAdapter + SupabaseStorageAdapter,
 * mengelola antrean debounce sinkronisasi otomatis, pemulihan saat online,
 * serta pelaporan status sinkronisasi yang jujur ke UI.
 */
export class StorageService {
  constructor({
    localAdapter = new LocalStorageAdapter(),
    cloudAdapter = new SupabaseStorageAdapter(),
    debounceMs = 300
  } = {}) {
    this.localAdapter = localAdapter;
    this.cloudAdapter = cloudAdapter;
    this.debounceMs = debounceMs;

    this._activeUserId = null;
    this._syncStatus = SYNC_STATUS.IDLE;
    this._syncError = null;
    this._lastSyncedAt = null;
    this._hasPendingChanges = false;
    this._debounceTimer = null;
    this._isSyncingPromise = null;
    this._statusListeners = [];
    this._progressMergeListeners = [];

    this._bindNetworkEvents();
  }

  _isBrowserOnline() {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  }

  _bindNetworkEvents() {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('online', () => {
        if (this._activeUserId) {
          this.retrySync();
        }
      });

      window.addEventListener('offline', () => {
        if (this._activeUserId) {
          this._setSyncStatus(
            SYNC_STATUS.OFFLINE,
            'Koneksi terputus. Progres disimpan di perangkat lokal.'
          );
        }
      });
    }
  }

  getSyncState() {
    return {
      status: this._syncStatus,
      label: SYNC_STATUS_LABELS[this._syncStatus] || SYNC_STATUS_LABELS[SYNC_STATUS.IDLE],
      error: this._syncError,
      lastSyncedAt: this._lastSyncedAt,
      hasPendingChanges: this._hasPendingChanges,
      userId: this._activeUserId
    };
  }

  subscribeSyncStatus(callback) {
    if (typeof callback === 'function') {
      this._statusListeners.push(callback);
    }
    return () => {
      this._statusListeners = this._statusListeners.filter(cb => cb !== callback);
    };
  }

  subscribeCloudMerge(callback) {
    if (typeof callback === 'function') {
      this._progressMergeListeners.push(callback);
    }
    return () => {
      this._progressMergeListeners = this._progressMergeListeners.filter(cb => cb !== callback);
    };
  }

  _setSyncStatus(status, errorMessage = null) {
    this._syncStatus = status;
    this._syncError = errorMessage;
    const snapshot = this.getSyncState();
    for (const cb of this._statusListeners) {
      try {
        cb(snapshot);
      } catch (err) {
        console.error('Error pada listener status sinkronisasi:', err);
      }
    }
  }

  _notifyCloudMerge(mergedState) {
    for (const cb of this._progressMergeListeners) {
      try {
        cb(mergedState);
      } catch (err) {
        console.error('Error pada listener cloud merge:', err);
      }
    }
  }

  /**
   * Mengatur user aktif saat sesi autentikasi tervalidasi
   */
  setActiveUser(userId) {
    if (this._activeUserId !== userId) {
      this._clearDebounce();
      this._activeUserId = userId || null;
      this._hasPendingChanges = false;
      this._syncError = null;
      if (!this._activeUserId) {
        this._setSyncStatus(SYNC_STATUS.IDLE, null);
      }
    }
  }

  getActiveUser() {
    return this._activeUserId;
  }

  _clearDebounce() {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
  }

  /**
   * Menjalankan Initial Sync & Merge saat pengguna berhasil login atau memulihkan session (Bagian 6)
   */
  async performInitialSync(userId) {
    this.setActiveUser(userId);
    if (!userId) {
      return { ok: false, progress: this.localAdapter.getProgress() };
    }

    // 1. Buat backup snapshot lokal sebelum melakukan initial sync
    const localBeforeSync = this.localAdapter.getProgress();
    this.localAdapter.saveBackupSnapshot(localBeforeSync);

    if (!this._isBrowserOnline()) {
      this._hasPendingChanges = true;
      this._setSyncStatus(
        SYNC_STATUS.OFFLINE,
        'Perangkat sedang offline. Menggunakan progres lokal.'
      );
      return { ok: false, offline: true, progress: localBeforeSync };
    }

    this._setSyncStatus(SYNC_STATUS.SYNCING, null);

    // 2. Baca progres dari Cloud (public.user_progress)
    const cloudResult = await this.cloudAdapter.fetchUserProgress(userId);

    // Kondisi 4 — Pembacaan Cloud gagal atau tidak ada internet
    if (!cloudResult.ok) {
      this._hasPendingChanges = true;
      const isNetworkIssue = !this._isBrowserOnline();
      this._setSyncStatus(
        isNetworkIssue ? SYNC_STATUS.OFFLINE : SYNC_STATUS.ERROR,
        cloudResult.error?.message || 'Gagal membaca progres dari cloud. Data lokal tetap aman.'
      );
      return {
        ok: false,
        error: cloudResult.error,
        progress: localBeforeSync
      };
    }

    const localHasData = hasMeaningfulProgress(localBeforeSync);
    const cloudHasRow = cloudResult.exists;
    const cloudState = cloudResult.progress || createInitialProgressState();
    const cloudHasData = cloudHasRow && hasMeaningfulProgress(cloudState);

    // Kondisi 1 — Cloud kosong, Local memiliki progres (atau keduanya kosong untuk inisialisasi awal)
    if (!cloudHasData && localHasData) {
      const sanitizedLocal = this.localAdapter.saveProgress(localBeforeSync, {
        preserveUpdatedAt: true
      });
      const saveRes = cloudHasRow
        ? await this.cloudAdapter.updateUserProgress(userId, sanitizedLocal)
        : await this.cloudAdapter.insertUserProgress(userId, sanitizedLocal);

      if (!saveRes.ok) {
        // Fallback ke upsert jika terjadi race condition pada insert/update
        const fallbackRes = await this.cloudAdapter.saveUserProgress(userId, sanitizedLocal);
        if (!fallbackRes.ok) {
          this._hasPendingChanges = true;
          this._setSyncStatus(
            SYNC_STATUS.ERROR,
            fallbackRes.error?.message || 'Gagal mengunggah progres lokal ke cloud.'
          );
          return { ok: false, error: fallbackRes.error, progress: sanitizedLocal };
        }
      }

      this._hasPendingChanges = false;
      this._lastSyncedAt = new Date().toISOString();
      this._setSyncStatus(SYNC_STATUS.SYNCED, null);
      this._notifyCloudMerge(sanitizedLocal);
      return { ok: true, condition: 'local_to_cloud', progress: sanitizedLocal };
    }

    // Kondisi 2 — Cloud memiliki progres, Local kosong
    if (cloudHasData && !localHasData) {
      const savedLocal = this.localAdapter.saveProgress(cloudState, {
        preserveUpdatedAt: true
      });
      this._hasPendingChanges = false;
      this._lastSyncedAt = new Date().toISOString();
      this._setSyncStatus(SYNC_STATUS.SYNCED, null);
      this._notifyCloudMerge(savedLocal);
      return { ok: true, condition: 'cloud_to_local', progress: savedLocal };
    }

    // Kondisi 3 — Cloud dan Local sama-sama memiliki progres (Merge Deterministik)
    if (cloudHasData && localHasData) {
      const merged = mergeProgressStates(localBeforeSync, cloudState);
      const cloudAlreadyIdentical = areProgressStatesEqual(merged, cloudState);

      const savedLocal = this.localAdapter.saveProgress(merged, {
        preserveUpdatedAt: cloudAlreadyIdentical
      });

      // Kondisi 5 — Sinkronisasi berulang: jika state hasil merge sudah sama persis dengan cloud,
      // tidak perlu menduplikasi penulisan atau cukup konfirmasi sinkron.
      if (!cloudAlreadyIdentical) {
        const updateRes = await this.cloudAdapter.saveUserProgress(userId, savedLocal);
        if (!updateRes.ok) {
          this._hasPendingChanges = true;
          this._setSyncStatus(
            SYNC_STATUS.ERROR,
            updateRes.error?.message || 'Gagal menyimpan hasil penggabungan progres ke cloud.'
          );
          this._notifyCloudMerge(savedLocal);
          return { ok: false, error: updateRes.error, progress: savedLocal };
        }
      }

      this._hasPendingChanges = false;
      this._lastSyncedAt = new Date().toISOString();
      this._setSyncStatus(SYNC_STATUS.SYNCED, null);
      this._notifyCloudMerge(savedLocal);
      return { ok: true, condition: 'merged', progress: savedLocal };
    }

    // Keduanya kosong (akun baru & perangkat baru): pastikan baris awal tersedia di cloud
    if (!cloudHasRow) {
      const initialClean = this.localAdapter.saveProgress(localBeforeSync, {
        preserveUpdatedAt: true
      });
      const initRes = await this.cloudAdapter.saveUserProgress(userId, initialClean);
      if (!initRes.ok) {
        this._hasPendingChanges = true;
        this._setSyncStatus(
          SYNC_STATUS.ERROR,
          initRes.error?.message || 'Gagal menyiapkan penyimpanan cloud awal.'
        );
        return { ok: false, error: initRes.error, progress: initialClean };
      }
      this._hasPendingChanges = false;
      this._lastSyncedAt = new Date().toISOString();
      this._setSyncStatus(SYNC_STATUS.SYNCED, null);
      return { ok: true, condition: 'initialized_empty', progress: initialClean };
    }

    this._hasPendingChanges = false;
    this._lastSyncedAt = new Date().toISOString();
    this._setSyncStatus(SYNC_STATUS.SYNCED, null);
    return { ok: true, condition: 'already_empty_synced', progress: localBeforeSync };
  }

  /**
   * Menjadwalkan sinkronisasi latar belakang dengan debounce agar perubahan cepat tidak membanjiri request
   */
  scheduleCloudSync({ forceOverwrite = false } = {}) {
    if (!this._activeUserId) return;

    this._hasPendingChanges = true;
    if (!this._isBrowserOnline()) {
      this._setSyncStatus(
        SYNC_STATUS.OFFLINE,
        'Offline — perubahan disimpan di perangkat dan akan disinkronkan saat online.'
      );
      return;
    }

    this._setSyncStatus(SYNC_STATUS.PENDING, null);
    this._clearDebounce();

    if (this.debounceMs <= 0) {
      this.flushCloudSync({ forceOverwrite });
      return;
    }

    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this.flushCloudSync({ forceOverwrite });
    }, this.debounceMs);
  }

  /**
   * Menjalankan sinkronisasi ke Supabase segera
   */
  async flushCloudSync({ forceOverwrite = false } = {}) {
    this._clearDebounce();
    const userId = this._activeUserId;
    if (!userId) {
      return { ok: false, reason: 'unauthenticated' };
    }

    if (!this._isBrowserOnline()) {
      this._hasPendingChanges = true;
      this._setSyncStatus(
        SYNC_STATUS.OFFLINE,
        'Offline — progres lokal menunggu koneksi internet.'
      );
      return { ok: false, reason: 'offline' };
    }

    this._setSyncStatus(SYNC_STATUS.SYNCING, null);
    const currentLocal = this.localAdapter.getProgress();

    let payloadToPush = currentLocal;

    // Jika bukan reset paksa, periksa dan gabungkan dengan data cloud terbaru agar aman multi-perangkat (Laptop A & B)
    if (!forceOverwrite) {
      const remoteFetch = await this.cloudAdapter.fetchUserProgress(userId);
      if (remoteFetch.ok && remoteFetch.exists && remoteFetch.progress) {
        payloadToPush = mergeProgressStates(currentLocal, remoteFetch.progress);
        this.localAdapter.saveProgress(payloadToPush, { preserveUpdatedAt: true });
      }
    }

    const writeResult = await this.cloudAdapter.saveUserProgress(userId, payloadToPush);
    if (!writeResult.ok) {
      this._hasPendingChanges = true;
      const isOfflineNow = !this._isBrowserOnline();
      this._setSyncStatus(
        isOfflineNow ? SYNC_STATUS.OFFLINE : SYNC_STATUS.ERROR,
        writeResult.error?.message || 'Gagal menyinkronkan progres ke cloud.'
      );
      return { ok: false, error: writeResult.error, progress: payloadToPush };
    }

    this._hasPendingChanges = false;
    this._lastSyncedAt = new Date().toISOString();
    this._setSyncStatus(SYNC_STATUS.SYNCED, null);
    this._notifyCloudMerge(payloadToPush);
    return { ok: true, progress: payloadToPush };
  }

  /**
   * Mekanisme coba ulang (retry) manual maupun otomatis saat kembali online
   */
  async retrySync() {
    if (!this._activeUserId) return { ok: false, reason: 'unauthenticated' };
    return this.performInitialSync(this._activeUserId);
  }

  // --- Delegasi API standar StorageService (kompatibel penuh dengan MVP 1) ---

  getProgress() {
    return this.localAdapter.getProgress();
  }

  saveProgress(state, options = {}) {
    const saved = this.localAdapter.saveProgress(state, options);
    if (this._activeUserId && !options.skipCloudSync) {
      this.scheduleCloudSync();
    }
    return saved;
  }

  saveBackupSnapshot(state = null) {
    return this.localAdapter.saveBackupSnapshot(state);
  }

  getBackupSnapshot() {
    return this.localAdapter.getBackupSnapshot();
  }

  resetProgress() {
    const initial = this.localAdapter.resetProgress();
    if (this._activeUserId) {
      const cleanReset = this.localAdapter.saveProgress(initial);
      this.scheduleCloudSync({ forceOverwrite: true });
      return cleanReset;
    }
    return initial;
  }

  getTheme() {
    return this.localAdapter.getTheme();
  }

  saveTheme(theme) {
    return this.localAdapter.saveTheme(theme);
  }

  getSidebarCollapsed() {
    return this.localAdapter.getSidebarCollapsed();
  }

  saveSidebarCollapsed(isCollapsed) {
    return this.localAdapter.saveSidebarCollapsed(isCollapsed);
  }
}

export const storageService = new StorageService();
export default storageService;
