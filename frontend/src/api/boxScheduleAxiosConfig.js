import axios from 'axios';
import { BOX_SCHEDULE_API_BASE_URL } from '../config/constants';
import { buildModuleDataHeader } from '../utils/encryption';

const AUTH_STORAGE_KEY = 'zillit-auth';

const boxScheduleApi = axios.create({
  baseURL: BOX_SCHEDULE_API_BASE_URL,
  timeout: 30000,
});

boxScheduleApi.interceptors.request.use(
  (config) => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const { user } = JSON.parse(stored);
        if (user?.userId && user?.projectId && user?.deviceId) {
          const encryptedHeader = buildModuleDataHeader(
            user.userId,
            user.projectId,
            user.deviceId
          );
          config.headers['moduledata'] = encryptedHeader;
        }
      }
    } catch (err) {
      console.error('Failed to build moduledata header:', err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

boxScheduleApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        window.location.href = '/login';
      }
    }
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'An unexpected error occurred';
    console.error('Box Schedule API Error:', message);
    return Promise.reject(error);
  }
);

export default boxScheduleApi;
