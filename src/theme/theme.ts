export type Theme = 'dark' | 'light'

/** Missing and legacy theme values use the product's dark default. */
export function normalizeTheme(value: unknown): Theme {
  return value === 'light' ? 'light' : 'dark'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#181a19' : '#ece7db')
}
