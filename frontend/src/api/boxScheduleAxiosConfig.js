import axios from 'axios';
import { BOX_SCHEDULE_API_BASE_URL, BOX_SCHEDULE_HEADERS } from '../config/constants';

const AUTH_STORAGE_KEY = 'zillit-auth';

const boxScheduleApi = axios.create({
  baseURL: BOX_SCHEDULE_API_BASE_URL,
  timeout: 30000,
});

// SHA-256 of a string → lower-case hex (64 chars). Used to sign POST/PUT bodies.
async function sha256Hex(input) {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

boxScheduleApi.interceptors.request.use(
  async (config) => {
    config.headers['Accept'] = BOX_SCHEDULE_HEADERS.Accept;
    config.headers['Accept-Charset'] = BOX_SCHEDULE_HEADERS['Accept-Charset'];
    config.headers['Timezone'] = BOX_SCHEDULE_HEADERS.Timezone;
    config.headers['appversion'] = BOX_SCHEDULE_HEADERS.appversion;
    config.headers['cache-control'] = BOX_SCHEDULE_HEADERS['cache-control'];
    config.headers['devicename'] = BOX_SCHEDULE_HEADERS.devicename;
    config.headers['moduledata'] = BOX_SCHEDULE_HEADERS.moduledata;

    // Per-request bodyhash: SHA-256 of the body for POST/PUT, fixed for GET/DELETE.
    if (config.data != null && config.data !== '') {
      const raw = typeof config.data === 'string' ? config.data : JSON.stringify(config.data);
      config.data = raw;
      config.headers['bodyhash'] = await sha256Hex(raw);
    } else {
      config.headers['bodyhash'] = BOX_SCHEDULE_HEADERS.bodyhash;
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
