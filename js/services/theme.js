/**
 * Layanan Pengelolaan Tema (Light Mode & Dark Mode)
 */

import { storageService } from './storage.js';

export const THEME_LIGHT = 'light';
export const THEME_DARK = 'dark';

class ThemeService {
  constructor() {
    this._currentTheme = THEME_LIGHT;
    this._listeners = [];
  }

  init() {
    const saved = storageService.getTheme();
    this.setTheme(saved === THEME_DARK ? THEME_DARK : THEME_LIGHT, false);
  }

  getTheme() {
    return this._currentTheme;
  }

  isDark() {
    return this._currentTheme === THEME_DARK;
  }

  setTheme(theme, persist = true) {
    const normalized = theme === THEME_DARK ? THEME_DARK : THEME_LIGHT;
    this._currentTheme = normalized;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', normalized);
    }
    if (persist) {
      storageService.saveTheme(normalized);
    }
    this._notify();
  }

  toggleTheme() {
    const next = this._currentTheme === THEME_LIGHT ? THEME_DARK : THEME_LIGHT;
    this.setTheme(next, true);
    return next;
  }

  subscribe(callback) {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(cb => cb !== callback);
    };
  }

  _notify() {
    for (const cb of this._listeners) {
      cb(this._currentTheme);
    }
  }
}

export const themeService = new ThemeService();
export default themeService;
