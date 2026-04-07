import React, { createContext, useContext, useMemo } from 'react';

/**
 * AppContext -- global application state shared across all pages.
 */
const AppContext = createContext(null);

/** @returns {Object} The current AppContext value */
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const value = useMemo(() => ({}), []);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export default AppContext;
