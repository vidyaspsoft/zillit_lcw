import locationApi from '../api/locationAxiosConfig';
import { getCurrentUserName } from '../utils/userHelpers';

const locationToolService = {
  /** Fetch units (tabs) for this project */
  getUnits: async () => {
    const response = await locationApi.get('/units');
    return response.data;
  },

  /** Fetch folders grouped by field (3-level navigation) */
  getFolders: async (params = {}) => {
    const response = await locationApi.get('/folders', { params });
    return response.data;
  },

  /** Fetch location items with filters */
  getLocations: async (filters = {}) => {
    const response = await locationApi.get('/', { params: filters });
    return response.data;
  },

  /** Fetch a single location by ID */
  getLocationById: async (id) => {
    const response = await locationApi.get(`/${id}`);
    return response.data;
  },

  /** Create a new location (multipart for file uploads) */
  createLocation: async (formData) => {
    const userName = getCurrentUserName();
    if (userName && !formData.get('createdByName')) {
      formData.append('createdByName', userName);
    }
    const response = await locationApi.post('/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /** Update an existing location */
  updateLocation: async (id, formData) => {
    const userName = getCurrentUserName();
    if (userName && !formData.get('updatedByName')) {
      formData.append('updatedByName', userName);
    }
    const response = await locationApi.put(`/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Move selected locations to a new status.
   * commonDetails: shared fields applied to all items (location name, address, contact etc.)
   * perItemDetails: per-item overrides [{ _id, episodes, sceneNumber }]
   */
  moveLocations: async (locationIds, targetStatus, { commonDetails, perItemDetails } = {}) => {
    const userName = getCurrentUserName();
    const response = await locationApi.put('/move/items', {
      locationIds,
      targetStatus,
      userName,
      commonDetails: commonDetails || null,
      perItemDetails: perItemDetails || null,
    });
    return response.data;
  },

  /** Move an entire folder to a new status */
  moveFolder: async (folderField, folderValue, currentStatus, targetStatus, { commonDetails, perItemDetails } = {}) => {
    const userName = getCurrentUserName();
    const response = await locationApi.put('/move/folder', {
      folderField,
      folderValue,
      currentStatus,
      targetStatus,
      userName,
      commonDetails: commonDetails || null,
      perItemDetails: perItemDetails || null,
    });
    return response.data;
  },

  /** Delete a location */
  deleteLocation: async (id) => {
    const response = await locationApi.delete(`/${id}`);
    return response.data;
  },

  /** Restore a soft-deleted location */
  restoreLocation: async (id) => {
    const response = await locationApi.put(`/restore/${id}`);
    return response.data;
  },

  /** Get soft-deleted locations */
  getDeletedLocations: async () => {
    const response = await locationApi.get('/deleted');
    return response.data;
  },

  /** Delete an entire folder */
  deleteFolder: async (folderField, folderValue, status) => {
    const response = await locationApi.post('/delete-folder', {
      folderField,
      folderValue,
      status,
    });
    return response.data;
  },

  /** Get badge/stats counts */
  getStats: async () => {
    const response = await locationApi.get('/stats');
    return response.data;
  },

  /** Get all folder badges for a tab */
  getBadges: async (status) => {
    const response = await locationApi.get('/badges', { params: { status } });
    return response.data;
  },

  /** Mark a folder key as viewed */
  markViewed: async (folderKey) => {
    const response = await locationApi.post('/mark-viewed', { folderKey });
    return response.data;
  },

  /** Fetch link preview metadata */
  getLinkPreview: async (url) => {
    const response = await locationApi.post('/link-preview', { url });
    return response.data;
  },

  /** Generate PDF report */
  generatePDF: async (locationIds, title, includeDetails = true) => {
    const userName = getCurrentUserName();
    const response = await locationApi.post(
      '/generate-pdf',
      { locationIds, title, includeDetails, userName },
      { responseType: 'blob' }
    );
    return response.data;
  },

  /** Share locations to users */
  shareLocations: async (locationIds, userIds, message) => {
    const userName = getCurrentUserName();
    const response = await locationApi.post('/share', {
      locationIds,
      userIds,
      userName,
      message,
    });
    return response.data;
  },

  // ── Unit Chat (tab-level chat) ──

  /** Get unit chat messages for a tab */
  getUnitChats: async (unit) => {
    const response = await locationApi.get('/unit-chat', { params: { unit } });
    return response.data;
  },

  /** Send a unit chat message */
  createUnitChat: async (unit, text, files = []) => {
    const userName = getCurrentUserName();
    const formData = new FormData();
    formData.append('unit', unit);
    formData.append('text', text);
    formData.append('userName', userName);
    files.forEach((file) => formData.append('files', file));
    const response = await locationApi.post('/unit-chat', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // ── Image-level Comments ──

  /** Get comments for a location */
  getComments: async (locationId) => {
    const response = await locationApi.get(`/${locationId}/comments`);
    return response.data;
  },

  /** Create a comment */
  createComment: async (locationId, formData) => {
    const userName = getCurrentUserName();
    if (userName && !formData.get('userName')) {
      formData.append('userName', userName);
    }
    const response = await locationApi.post(`/${locationId}/comments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /** Update a comment */
  updateComment: async (id, text) => {
    const response = await locationApi.put(`/comments/${id}`, { text });
    return response.data;
  },

  /** Delete a comment */
  deleteComment: async (id) => {
    const response = await locationApi.delete(`/comments/${id}`);
    return response.data;
  },

  // ── Script Breakdown ──

  /** Get script scenes (optionally filtered by episode or search query) */
  getScriptScenes: async (params = {}) => {
    const response = await locationApi.get('/script-scenes', { params });
    return response.data;
  },

  /** Get list of episodes from script */
  getScriptEpisodes: async () => {
    const response = await locationApi.get('/script-episodes');
    return response.data;
  },

  /** Bulk delete multiple locations */
  bulkDeleteLocations: async (locationIds) => {
    const response = await locationApi.post('/bulk-delete', { locationIds });
    return response.data;
  },

  /** Get field configuration for this project */
  getFieldConfig: async () => {
    const response = await locationApi.get('/field-config');
    return response.data;
  },

  /** Save field configuration for this project */
  saveFieldConfig: async (requiredFields) => {
    const response = await locationApi.post('/field-config', { requiredFields });
    return response.data;
  },
};

export default locationToolService;
