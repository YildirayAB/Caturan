/**
 * Layanan Progres Belajar, Perhitungan XP, Level Pengguna, dan Streak Harian
 */

import { storageService, calculateXpFromCompletedLessons } from './storage.js';
import { CURRICULUM_CATEGORIES, getAllLessons, getLessonById } from '../data/curriculum.js';

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
      firstLesson: allLessons[0]
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

export const progressService = new ProgressService();
export default progressService;
