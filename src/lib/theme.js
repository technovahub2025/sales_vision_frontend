export const THEME_STORAGE_KEY = 'sv_theme';
export const THEME_MODES = ['light', 'dark', 'system'];

export function isValidThemeMode(value) {
  return THEME_MODES.includes(value);
}

export function getSystemTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(mode) {
  return mode === 'system' ? getSystemTheme() : mode;
}

export function getStoredThemeMode() {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isValidThemeMode(stored) ? stored : 'system';
}

export function applyTheme(mode) {
  const normalized = isValidThemeMode(mode) ? mode : 'system';
  const effective = resolveTheme(normalized);
  const root = document.documentElement;
  root.dataset.theme = effective;
  root.dataset.themeMode = normalized;
  return { mode: normalized, effective };
}

export function setThemeMode(mode) {
  const normalized = isValidThemeMode(mode) ? mode : 'system';
  window.localStorage.setItem(THEME_STORAGE_KEY, normalized);
  const payload = applyTheme(normalized);
  window.dispatchEvent(new CustomEvent('sv-theme-mode', { detail: payload }));
  return payload;
}

export function subscribeSystemTheme(listener) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => listener(getSystemTheme());
  mql.addEventListener('change', handler);
  return () => mql.removeEventListener('change', handler);
}

