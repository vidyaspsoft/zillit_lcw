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
    const response = await boxScheduleApi.put(`/types/${id}`, { title, color, order });
    return response.data;
  },

  deleteType: async (id) => {
    const response = await boxScheduleApi.delete(`/types/${id}`);
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
    const response = await boxScheduleApi.put(`/days/${id}`, dayData);
    return response.data;
  },

  deleteDay: async (id) => {
    const response = await boxScheduleApi.delete(`/days/${id}`);
    return response.data;
  },

  bulkUpdateDays: async (updates) => {
    const response = await boxScheduleApi.post('/days/bulk', { updates });
    return response.data;
  },

  removeDates: async (entries) => {
    const response = await boxScheduleApi.post('/days/remove-dates', { entries });
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
    const response = await boxScheduleApi.put(`/events/${id}`, eventData);
    return response.data;
  },

  deleteEvent: async (id) => {
    const response = await boxScheduleApi.delete(`/events/${id}`);
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

  getRevisions: async () => {
    const response = await boxScheduleApi.get('/revisions');
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
