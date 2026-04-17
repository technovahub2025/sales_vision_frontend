import { useEffect, useMemo, useState } from 'react';
import {
  applyTheme,
  getStoredThemeMode,
  setThemeMode,
  subscribeSystemTheme,
} from '../lib/theme';

export function useThemeMode() {
  const [mode, setMode] = useState(() => getStoredThemeMode());
  const [effectiveTheme, setEffectiveTheme] = useState(() => applyTheme(getStoredThemeMode()).effective);

  useEffect(() => {
    const next = applyTheme(mode);
    setEffectiveTheme(next.effective);
  }, [mode]);

  useEffect(() => {
    const unsubscribe = subscribeSystemTheme(() => {
      if (mode !== 'system') return;
      const next = applyTheme('system');
      setEffectiveTheme(next.effective);
    });
    return unsubscribe;
  }, [mode]);

  useEffect(() => {
    const onModeChanged = (event) => {
      const detail = event?.detail;
      if (!detail?.mode || !detail?.effective) return;
      setMode(detail.mode);
      setEffectiveTheme(detail.effective);
    };
    const onStorage = (event) => {
      if (event.key !== 'sv_theme') return;
      const nextMode = getStoredThemeMode();
      const next = applyTheme(nextMode);
      setMode(nextMode);
      setEffectiveTheme(next.effective);
    };
    window.addEventListener('sv-theme-mode', onModeChanged);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('sv-theme-mode', onModeChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const actions = useMemo(
    () => ({
      setMode: (nextMode) => {
        const next = setThemeMode(nextMode);
        setMode(next.mode);
        setEffectiveTheme(next.effective);
      },
    }),
    [],
  );

  return {
    mode,
    effectiveTheme,
    setMode: actions.setMode,
  };
}

export default useThemeMode;

