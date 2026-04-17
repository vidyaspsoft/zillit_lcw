/**
 * Semantic color palettes for light and dark themes.
 * Used by useTheme() hook — components do `const { colors } = useTheme()`.
 *
 * Naming convention:
 *   page/surface/border = backgrounds & structure
 *   text* = typography hierarchy
 *   surface* = contextual surface variants (hover, selected, etc.)
 */

export const lightColors = {
  // ── Page & Surface ──
  pageBg: '#f8f7f4',
  surface: '#ffffff',
  surfaceHover: '#fafaf6',
  surfaceAlt: '#fafaf8',
  surfaceAlt2: '#f4f3f0',
  surfaceSelected: '#eef3ff',
  surfaceExpanded: '#fdfcf8',
  surfaceDayOff: '#fbfbfb',
  surfaceMuted: '#f5f5f5',
  surfaceWarning: '#fef9ee',
  surfaceInfo: '#f0f5ff',
  surfaceNoteCard: '#fffdf0',
  surfaceNoteCardBorder: '#f0ebc8',
  surfaceHoverGreen: '#f0fdf4',
  surfaceHoverBlue: '#eef3ff',
  surfaceHoverRed: '#fef2f2',

  // ── Borders ──
  border: '#e0ddd8',
  borderLight: '#eeece8',
  borderMedium: '#d8d5cf',
  borderInput: '#ddd',
  borderButton: '#d0ccc5',
  borderDashed: '#ece9e3',

  // ── Text hierarchy ──
  textPrimary: '#1a1a1a',
  textBody: '#333333',
  textSecondary: '#555555',
  textMuted: '#888888',
  textSubtle: '#999999',
  textFaint: '#aaaaaa',
  textPlaceholder: '#bbbbbb',
  textDisabled: '#cccccc',
  textLink: '#1a73e8',

  // ── Solid / Action ──
  solidDark: '#1a1a1a',
  solidDarkText: '#ffffff',
  dangerBg: '#e74c3c',
  successText: '#27ae60',
  segmentedBg: '#f0efec',

  // ── Gradients ──
  gradientStart: '#ffffff',
  gradientEnd: '#fafaf8',

  // ── Shadows ──
  shadow: 'rgba(0,0,0,0.04)',
  shadowMd: 'rgba(0,0,0,0.06)',
  shadowHover: 'rgba(0,0,0,0.08)',

  // ── Calendar-specific ──
  calWeekendBg: '#fdfcfa',
  calCellHover: '#f8f7f0',
  calCellSelected: '#fdfcf4',
  calCellSelectedBorder: '#1a1a1a',
  calTodayBg: '#1a1a1a',
  calTodayText: '#ffffff',

  // ── Selection bar ──
  selectionBarBg: '#1a1a1a',
  selectionBarText: '#ffffff',

  // ── Scrollbar ──
  scrollbarThumb: '#CBD5E1',

  // ── Divider ──
  dividerGradient: '#cccccc',

  // ── Drawer ──
  drawerHeaderBg: '#fafaf8',
  drawerBodyBg: '#ffffff',

  // ── History card ──
  historyCardBg: '#fdfcfa',
  historyCardBorder: '#ece9e3',

  // ── Type badge ──
  typeBadgeBg: '#f0efec',
  typeBadgeBorder: '#e0ddd8',

  // ── Popover ──
  popoverBg: '#ffffff',
  popoverBorder: '#e0ddd8',
  popoverSelectedBg: '#f8f8f4',
};

export const darkColors = {
  // ── Page & Surface ──
  pageBg: '#1a1916',
  surface: '#252320',
  surfaceHover: '#2e2b27',
  surfaceAlt: '#2a2825',
  surfaceAlt2: '#232120',
  surfaceSelected: '#1e2a3d',
  surfaceExpanded: '#2c2a26',
  surfaceDayOff: '#222120',
  surfaceMuted: '#2a2826',
  surfaceWarning: '#2e2618',
  surfaceInfo: '#1a2030',
  surfaceNoteCard: '#2a2718',
  surfaceNoteCardBorder: '#3a3520',
  surfaceHoverGreen: '#1a2e1e',
  surfaceHoverBlue: '#1a2540',
  surfaceHoverRed: '#3a1a1a',

  // ── Borders ──
  border: '#3a3733',
  borderLight: '#322f2b',
  borderMedium: '#3e3b36',
  borderInput: '#444038',
  borderButton: '#4a463f',
  borderDashed: '#3a3733',

  // ── Text hierarchy ──
  textPrimary: '#e8e4de',
  textBody: '#d4d0c8',
  textSecondary: '#a8a49c',
  textMuted: '#807c74',
  textSubtle: '#6e6a62',
  textFaint: '#5a5650',
  textPlaceholder: '#504c46',
  textDisabled: '#444038',
  textLink: '#5b9cf5',

  // ── Solid / Action ──
  solidDark: '#e8e4de',
  solidDarkText: '#1a1916',
  dangerBg: '#c0392b',
  successText: '#2ecc71',
  segmentedBg: '#2a2825',

  // ── Gradients ──
  gradientStart: '#2a2825',
  gradientEnd: '#232120',

  // ── Shadows ──
  shadow: 'rgba(0,0,0,0.3)',
  shadowMd: 'rgba(0,0,0,0.4)',
  shadowHover: 'rgba(0,0,0,0.5)',

  // ── Calendar-specific ──
  calWeekendBg: '#242220',
  calCellHover: '#2e2b27',
  calCellSelected: '#2c2818',
  calCellSelectedBorder: '#e8e4de',
  calTodayBg: '#e8e4de',
  calTodayText: '#1a1916',

  // ── Selection bar ──
  selectionBarBg: '#0d0c0b',
  selectionBarText: '#e8e4de',

  // ── Scrollbar ──
  scrollbarThumb: '#4a463f',

  // ── Divider ──
  dividerGradient: '#3a3733',

  // ── Drawer ──
  drawerHeaderBg: '#2a2825',
  drawerBodyBg: '#252320',

  // ── History card ──
  historyCardBg: '#2a2825',
  historyCardBorder: '#3a3733',

  // ── Type badge ──
  typeBadgeBg: '#2a2825',
  typeBadgeBorder: '#3a3733',

  // ── Popover ──
  popoverBg: '#2a2825',
  popoverBorder: '#3a3733',
  popoverSelectedBg: '#332f2a',
};
