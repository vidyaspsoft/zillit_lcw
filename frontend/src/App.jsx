import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { useTheme } from './context/ThemeContext';

import LoginPage from './components/auth/LoginPage';
import Navbar from './components/common/Navbar';
import ToolsPage from './components/tools/ToolsPage';
import LocationToolPage from './components/location-tool/LocationToolPage';
import CastingToolPage from './components/casting-tool/CastingToolPage';
import WardrobeToolPage from './components/wardrobe-tool/WardrobeToolPage';
import BoxSchedulePage from './components/box-schedule/BoxSchedulePage';

import './App.css';

const ToastContainerThemed = () => {
  const { isDark } = useTheme();
  return (
    <ToastContainer
      position="bottom-right"
      autoClose={3000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme={isDark ? 'dark' : 'light'}
    />
  );
};

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const AuthenticatedApp = () => {
  const { colors } = useTheme();
  return (
    <AppProvider>
      <div className="flex flex-col h-screen overflow-hidden">
        <Navbar />
        <div className="flex flex-1 overflow-hidden mt-[var(--navbar-height)]">
          <main className="flex-1 overflow-y-auto" style={{ backgroundColor: colors.pageBg }}>
            <Routes>
              <Route path="/" element={<ToolsPage />} />
              <Route path="/location-tool" element={<LocationToolPage />} />
              <Route path="/casting-tool" element={<CastingToolPage toolType="main" />} />
              <Route path="/background-casting-tool" element={<CastingToolPage toolType="background" />} />
              <Route path="/costume-tool" element={<WardrobeToolPage toolType="main" />} />
              <Route path="/background-costume-tool" element={<WardrobeToolPage toolType="background" />} />
              <Route path="/box-schedule" element={<BoxSchedulePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </AppProvider>
  );
};

const LoginRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <LoginPage />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AuthenticatedApp />
              </ProtectedRoute>
            }
          />
        </Routes>
        <ToastContainerThemed />
      </AuthProvider>
    </Router>
  );
}

export default App;
