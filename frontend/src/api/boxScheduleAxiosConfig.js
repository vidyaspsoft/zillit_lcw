import axios from 'axios';
import { BOX_SCHEDULE_API_BASE_URL, BOX_SCHEDULE_HEADERS } from '../config/constants';

const AUTH_STORAGE_KEY = 'zillit-auth';

const boxScheduleApi = axios.create({
  baseURL: BOX_SCHEDULE_API_BASE_URL,
  timeout: 30000,
});

boxScheduleApi.interceptors.request.use(
  (config) => {
    config.headers['Accept'] = BOX_SCHEDULE_HEADERS.Accept;
    config.headers['Accept-Charset'] = BOX_SCHEDULE_HEADERS['Accept-Charset'];
    config.headers['Timezone'] = BOX_SCHEDULE_HEADERS.Timezone;
    config.headers['bodyhash'] = BOX_SCHEDULE_HEADERS.bodyhash;
    config.headers['moduledata'] = BOX_SCHEDULE_HEADERS.moduledata;
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
