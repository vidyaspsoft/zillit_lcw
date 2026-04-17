import { theme as antdThemeUtils } from 'antd';

/**
 * Ant Design 5 dark theme configuration.
 * Uses `darkAlgorithm` to automatically generate dark token values,
 * then overrides specific tokens to match our warm parchment palette.
 *
 * Component-level overrides mirror antdTheme.js (light) to keep
 * border-radius, font-weight, etc. consistent across themes.
 */
const antdDarkTheme = {
  algorithm: antdThemeUtils.darkAlgorithm,
  token: {
    colorPrimary: '#E8930C',
    colorSuccess: '#22c55e',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',
    colorInfo: '#3b82f6',
    borderRadius: 10,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    fontSize: 14,

    // Override dark algorithm's defaults with warm dark palette
    colorBgContainer: '#252320',
    colorBgElevated: '#2e2b27',
    colorBgLayout: '#1a1916',
    colorBgSpotlight: '#2a2825',
    colorText: '#e8e4de',
    colorTextSecondary: '#a8a49c',
    colorTextTertiary: '#807c74',
    colorTextQuaternary: '#6e6a62',
    colorBorder: '#3a3733',
    colorBorderSecondary: '#322f2b',
    colorFill: '#2e2b27',
    colorFillSecondary: '#2a2825',
    colorFillTertiary: '#252320',
    colorFillQuaternary: '#1a1916',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
    boxShadowSecondary: '0 4px 6px -1px rgba(0,0,0,0.4), 0 2px 4px -2px rgba(0,0,0,0.3)',
  },
  components: {
    Button: {
      borderRadius: 10,
      controlHeight: 36,
      controlHeightSM: 30,
      fontWeight: 500,
    },
    Card: {
      borderRadiusLG: 14,
      boxShadowTertiary: '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
    },
    Modal: {
      borderRadiusLG: 16,
      contentBg: '#252320',
      headerBg: '#2a2825',
      footerBg: '#252320',
    },
    Drawer: {
      colorBgElevated: '#252320',
    },
    Input: {
      borderRadius: 10,
      controlHeight: 40,
      colorBgContainer: '#2a2825',
    },
    Select: {
      borderRadius: 10,
      controlHeight: 40,
      colorBgContainer: '#2a2825',
    },
    DatePicker: {
      colorBgContainer: '#2a2825',
    },
    Tag: {
      borderRadiusSM: 8,
    },
    Tabs: {
      cardBorderRadius: 10,
    },
    Upload: {
      borderRadiusLG: 12,
    },
    Segmented: {
      trackBg: '#2a2825',
    },
    Popover: {
      colorBgElevated: '#2a2825',
    },
    Tooltip: {
      colorBgSpotlight: '#2e2b27',
    },
  },
};

export default antdDarkTheme;
