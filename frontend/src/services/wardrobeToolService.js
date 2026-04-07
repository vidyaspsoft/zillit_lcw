import wardrobeApi from '../api/wardrobeAxiosConfig';
import { getCurrentUserName } from '../utils/userHelpers';

const wardrobeToolService = {
  /** Fetch units (tabs) for this project */
  getUnits: async () => {
    const response = await wardrobeApi.get('/units');
    return response.data;
  },

  /** Fetch folders grouped by field (3-level navigation) */
  getFolders: async (params = {}) => {
    const response = await wardrobeApi.get('/folders', { params });
    return response.data;
  },

  /** Fetch wardrobe items with filters */
  getWardrobes: async (filters = {}) => {
    const response = await wardrobeApi.get('/', { params: filters });
    return response.data;
  },

  /** Fetch a single wardrobe by ID */
  getWardrobeById: async (id) => {
    const response = await wardrobeApi.get(`/${id}`);
    return response.data;
  },

  /**
   * GET /suggest?q=search&field=characterName|talentName
   * Returns matching wardrobes for autocomplete with full details to auto-fill form.
   */
  suggestWardrobes: async (query, field = 'characterName') => {
    const response = await wardrobeApi.get('/suggest', { params: { q: query, field } });
    return response.data;
  },

  /** Get character breakdown by name */
  getCharacterBreakdown: async (characterName) => {
    const response = await wardrobeApi.get('/character-breakdowns', { params: { characterName } });
    return response.data;
  },

  /** Save (upsert) character breakdown */
  saveCharacterBreakdown: async (data) => {
    const response = await wardrobeApi.post('/character-breakdowns', data);
    return response.data;
  },

  /** Validate a character number */
  validateCharacterNumber: async (characterNumber, characterName) => {
    const response = await wardrobeApi.post('/validate-character-number', {
      characterNumber,
      characterName,
    });
    return response.data;
  },

  /** Create a new wardrobe (multipart for file uploads) */
  createWardrobe: async (formData) => {
    const userName = getCurrentUserName();
    if (userName && !formData.get('createdByName')) {
      formData.append('createdByName', userName);
    }
    const response = await wardrobeApi.post('/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /** Update an existing wardrobe */
  updateWardrobe: async (id, formData) => {
    const userName = getCurrentUserName();
    if (userName && !formData.get('updatedByName')) {
      formData.append('updatedByName', userName);
    }
    const response = await wardrobeApi.put(`/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Move selected wardrobes to a new status.
   * commonDetails: shared fields applied to all items
   * perItemDetails: per-item overrides [{ _id, episodes, characterNumber }]
   */
  moveWardrobes: async (wardrobeIds, targetStatus, { commonDetails, perItemDetails } = {}) => {
    const userName = getCurrentUserName();
    const response = await wardrobeApi.put('/move/items', {
      wardrobeIds,
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
    const response = await wardrobeApi.put('/move/folder', {
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

  /** Delete a wardrobe */
  deleteWardrobe: async (id) => {
    const response = await wardrobeApi.delete(`/${id}`);
    return response.data;
  },

  /** Restore a soft-deleted wardrobe */
  restoreWardrobe: async (id) => {
    const response = await wardrobeApi.put(`/restore/${id}`);
    return response.data;
  },

  /** Get soft-deleted wardrobes */
  getDeletedWardrobes: async (toolType = 'main') => {
    const response = await wardrobeApi.get('/deleted', { params: { toolType } });
    return response.data;
  },

  /** Delete an entire folder */
  deleteFolder: async (folderField, folderValue, status, toolType = 'main') => {
    const response = await wardrobeApi.post('/delete-folder', {
      folderField,
      folderValue,
      status,
      toolType,
    });
    return response.data;
  },

  /** Get badge/stats counts */
  getStats: async (toolType = 'main') => {
    const response = await wardrobeApi.get('/stats', { params: { toolType } });
    return response.data;
  },

  /** Get all folder badges for a tab */
  getBadges: async (status, toolType = 'main') => {
    const response = await wardrobeApi.get('/badges', { params: { status, toolType } });
    return response.data;
  },

  /** Mark a folder key as viewed */
  markViewed: async (folderKey) => {
    const response = await wardrobeApi.post('/mark-viewed', { folderKey });
    return response.data;
  },

  /** Fetch link preview metadata */
  getLinkPreview: async (url) => {
    const response = await wardrobeApi.post('/link-preview', { url });
    return response.data;
  },

  /** Generate PDF report */
  generatePDF: async (wardrobeIds, title, includeDetails = true) => {
    const userName = getCurrentUserName();
    const response = await wardrobeApi.post(
      '/generate-pdf',
      { wardrobeIds, title, includeDetails, userName },
      { responseType: 'blob' }
    );
    return response.data;
  },

  /** Share wardrobes to users */
  shareWardrobes: async (wardrobeIds, userIds, message) => {
    const userName = getCurrentUserName();
    const response = await wardrobeApi.post('/share', {
      wardrobeIds,
      userIds,
      userName,
      message,
    });
    return response.data;
  },

  // ── Unit Chat (tab-level chat) ──

  /** Get unit chat messages for a tab */
  getUnitChats: async (unit) => {
    const response = await wardrobeApi.get('/unit-chat', { params: { unit } });
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
    const response = await wardrobeApi.post('/unit-chat', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // ── Image-level Comments ──

  /** Get comments for a wardrobe */
  getComments: async (wardrobeId) => {
    const response = await wardrobeApi.get(`/${wardrobeId}/comments`);
    return response.data;
  },

  /** Create a comment */
  createComment: async (wardrobeId, formData) => {
    const userName = getCurrentUserName();
    if (userName && !formData.get('userName')) {
      formData.append('userName', userName);
    }
    const response = await wardrobeApi.post(`/${wardrobeId}/comments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /** Update a comment */
  updateComment: async (id, text) => {
    const response = await wardrobeApi.put(`/comments/${id}`, { text });
    return response.data;
  },

  /** Delete a comment */
  deleteComment: async (id) => {
    const response = await wardrobeApi.delete(`/comments/${id}`);
    return response.data;
  },

  /** Bulk import -- send parsed rows as JSON (no images) */
  bulkImport: async (data) => {
    const response = await wardrobeApi.post('/bulk-import', data);
    return response.data;
  },

  /** Bulk import with images -- send FormData with wardrobes JSON + image files */
  bulkImportWithImages: async (formData) => {
    const response = await wardrobeApi.post('/bulk-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // ── Wardrobe-specific methods ──

  /** Choose cast for wardrobe */
  chooseCast: async (query) => {
    const response = await wardrobeApi.get('/choose-cast', { params: { q: query } });
    return response.data;
  },

  /** Get measurements for a cast */
  getMeasurements: async (castId) => {
    const response = await wardrobeApi.get('/measurements', { params: { castId } });
    return response.data;
  },

  /** Save measurements */
  saveMeasurements: async (data) => {
    const response = await wardrobeApi.post('/measurements', data);
    return response.data;
  },

  /** Get temporary casts */
  getTempCasts: async (q = '') => {
    const response = await wardrobeApi.get('/temp-casts', { params: q ? { q } : {} });
    return response.data;
  },

  /** Create temporary cast */
  createTempCast: async (data) => {
    const response = await wardrobeApi.post('/temp-casts', data);
    return response.data;
  },

  /** Delete temporary cast */
  deleteTempCast: async (id) => {
    const response = await wardrobeApi.delete(`/temp-casts/${id}`);
    return response.data;
  },
};

export default wardrobeToolService;
