import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { LOCATION_API_BASE_URL } from '../config/constants';

const AUTH_API_URL = LOCATION_API_BASE_URL.replace('/location', '');
import { buildModuleDataHeader } from '../utils/encryption';

/**
 * AuthContext -- manages authentication state (login, logout, token refresh).
 * Persists credentials to localStorage under AUTH_STORAGE_KEY.
 */
const AuthContext = createContext(null);

const AUTH_STORAGE_KEY = 'zillit-auth';

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Skip login — auto-authenticate and go directly to tools page
    const defaultUser = {
      userId: 'auto',
      projectId: 'auto',
      deviceId: 'auto',
      name: 'User',
    };
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.user?.userId && parsed.user?.projectId) {
          setUser(parsed.user);
        } else {
          setUser(defaultUser);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: defaultUser }));
        }
      } else {
        setUser(defaultUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: defaultUser }));
      }
    } catch (err) {
      setUser(defaultUser);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: defaultUser }));
    } finally {
      setIsAuthenticated(true);
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (userId, projectId, deviceId, userName) => {
    // Build a fresh encrypted moduledata header for the login validation
    const encryptedHeader = buildModuleDataHeader(userId, projectId, deviceId);

    // Call the login endpoint — it validates the encrypted header server-side
    const response = await axios.post(`${AUTH_API_URL}/auth/login`, {
      userId,
      projectId,
      deviceId,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'moduledata': encryptedHeader,
      },
    });

    if (response.data.status !== 1) {
      throw new Error(response.data.message || 'Login failed');
    }

    const userData = { userId, projectId, deviceId, name: userName || '' };

    const authData = {
      user: userData,
    };

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
    setUser(userData);
    setIsAuthenticated(true);

    return response.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const value = useMemo(() => ({
    isAuthenticated,
    user,
    loading,
    login,
    logout,
  }), [isAuthenticated, user, loading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
