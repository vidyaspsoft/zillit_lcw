import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import './index.css';
import App from './App';
import lightTheme from './theme/antdTheme';
import darkTheme from './theme/antdDarkTheme';
import { ThemeProvider, useTheme } from './context/ThemeContext';

/**
 * ThemedApp — reads theme mode from ThemeContext and passes the
 * matching Ant Design theme to ConfigProvider.
 */
const ThemedApp = () => {
  const { isDark } = useTheme();
  return (
    <ConfigProvider theme={isDark ? darkTheme : lightTheme}>
      <App />
    </ConfigProvider>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ThemeProvider>
    <ThemedApp />
  </ThemeProvider>
);
