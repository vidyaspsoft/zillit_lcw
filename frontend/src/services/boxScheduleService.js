import boxScheduleApi from '../api/boxScheduleAxiosConfig';
import { getCurrentUserName } from '../utils/userHelpers';

const boxScheduleService = {
  // ── Schedule Types ──

  getTypes: async () => {
    const response = await boxScheduleApi.get('/types');
    return response.data;
  },

  createType: async ({ title, color }) => {
    const userName = getCurrentUserName();
    const response = await boxScheduleApi.post('/types', { title, color, userName });
    return response.data;
  },

  updateType: async (id, { title, color, order }) => {
    const userName = getCurrentUserName();
    const response = await boxScheduleApi.put(`/types/${id}`, { title, color, order, userName });
    return response.data;
  },

  deleteType: async (id) => {
    const userName = getCurrentUserName();
    const response = await boxScheduleApi.delete(`/types/${id}`, { data: { userName } });
    return response.data;
  },

  // ── Schedule Days ──

  getDays: async (params = {}) => {
    const response = await boxScheduleApi.get('/days', { params });
    return response.data;
  },

  createDay: async (dayData) => {
    const userName = getCurrentUserName();
    const response = await boxScheduleApi.post('/days', { ...dayData, userName });
    return response.data;
  },

  updateDay: async (id, dayData) => {
    const userName = getCurrentUserName();
    const response = await boxScheduleApi.put(`/days/${id}`, { ...dayData, userName });
    return response.data;
  },

  deleteDay: async (id) => {
    const userName = getCurrentUserName();
    const response = await boxScheduleApi.delete(`/days/${id}`, { data: { userName } });
    return response.data;
  },

  bulkUpdateDays: async (updates) => {
    const userName = getCurrentUserName();
    const response = await boxScheduleApi.post('/days/bulk', { updates, userName });
    return response.data;
  },

  removeDates: async (entries) => {
    const userName = getCurrentUserName();
    const response = await boxScheduleApi.post('/days/remove-dates', { entries, userName });
    return response.data;
  },

  // ── Events ──

  getEvents: async (params = {}) => {
    const response = await boxScheduleApi.get('/events', { params });
    return response.data;
  },

  createEvent: async (eventData) => {
    const userName = getCurrentUserName();
    const response = await boxScheduleApi.post('/events', { ...eventData, userName });
    return response.data;
  },

  updateEvent: async (id, eventData) => {
    const userName = getCurrentUserName();
    const response = await boxScheduleApi.put(`/events/${id}`, { ...eventData, userName });
    return response.data;
  },

  deleteEvent: async (id) => {
    const userName = getCurrentUserName();
    const response = await boxScheduleApi.delete(`/events/${id}`, { data: { userName } });
    return response.data;
  },

  // ── Calendar ──

  getCalendar: async (params = {}) => {
    const response = await boxScheduleApi.get('/calendar', { params });
    return response.data;
  },

  // ── Activity Log ──

  getActivityLog: async (params = {}) => {
    const response = await boxScheduleApi.get('/activity-log', { params });
    return response.data;
  },

  // ── Revisions ──

  getRevisions: async (params = {}) => {
    const response = await boxScheduleApi.get('/revisions', { params });
    return response.data;
  },

  getCurrentRevision: async () => {
    const response = await boxScheduleApi.get('/revisions/current');
    return response.data;
  },

  // ── Duplicate ──

  duplicateDay: async (sourceDayId, newStartDate) => {
    const userName = getCurrentUserName();
    const response = await boxScheduleApi.post('/days/duplicate', { sourceDayId, newStartDate, userName });
    return response.data;
  },

  // ── Share ──

  generateShareLink: async () => {
    const userName = getCurrentUserName();
    const response = await boxScheduleApi.post('/share/generate-link', { userName });
    return response.data;
  },
};

export default boxScheduleService;
