'use client'

import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'cs_theme'

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.55 1.55M18.25 18.25l1.55 1.55M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.55-1.55M18.25 5.75l1.55-1.55"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20.5 14.4A8.5 8.5 0 1 1 9.6 3.5a7 7 0 0 0 10.9 10.9Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Dark/light toggle — persists to localStorage; document attribute set eagerly in <head> script to avoid flash. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null)

  useEffect(() => {
    const current = (document.documentElement.getAttribute('data-theme') as Theme) || 'dark'
    setTheme(current)
  }, [])

  function toggle() {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    applyTheme(next)
    localStorage.setItem(STORAGE_KEY, next)
    setTheme(next)
  }

  const isLight = theme === 'light'

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      title={isLight ? 'Koyu temaya geç' : 'Açık temaya geç'}
      aria-label={isLight ? 'Koyu temaya geç' : 'Açık temaya geç'}
    >
      {isLight ? <MoonIcon /> : <SunIcon />}
    </button>
  )
}

export const themeInitScript = `
(function() {
  try {
    var saved = localStorage.getItem('${STORAGE_KEY}');
    var theme = saved === 'light' || saved === 'dark' ? saved : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
`
