import castingApi from '../api/castingAxiosConfig';
import { getCurrentUserName } from '../utils/userHelpers';

const castingToolService = {
  /** Fetch units (tabs) for this project */
  getUnits: async () => {
    const response = await castingApi.get('/units');
    return response.data;
  },

  /** Fetch folders grouped by field (3-level navigation) */
  getFolders: async (params = {}) => {
    const response = await castingApi.get('/folders', { params });
    return response.data;
  },

  /** Fetch casting items with filters */
  getCastings: async (filters = {}) => {
    const response = await castingApi.get('/', { params: filters });
    return response.data;
  },

  /** Fetch a single casting by ID */
  getCastingById: async (id) => {
    const response = await castingApi.get(`/${id}`);
    return response.data;
  },

  /** Validate a character number */
  /**
   * GET /suggest?q=search&field=characterName|talentName
   * Returns matching castings for autocomplete with full details to auto-fill form.
   */
  suggestCastings: async (query, field = 'characterName') => {
    const response = await castingApi.get('/suggest', { params: { q: query, field } });
    return response.data;
  },

  /** Get character breakdown by name */
  getCharacterBreakdown: async (characterName) => {
    const response = await castingApi.get('/character-breakdowns', { params: { characterName } });
    return response.data;
  },

  /** Save (upsert) character breakdown */
  saveCharacterBreakdown: async (data) => {
    const response = await castingApi.post('/character-breakdowns', data);
    return response.data;
  },

  validateCharacterNumber: async (characterNumber, characterName) => {
    const response = await castingApi.post('/validate-character-number', {
      characterNumber,
      characterName,
    });
    return response.data;
  },

  /** Create a new casting (multipart for file uploads) */
  createCasting: async (formData) => {
    const userName = getCurrentUserName();
    if (userName && !formData.get('createdByName')) {
      formData.append('createdByName', userName);
    }
    const response = await castingApi.post('/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /** Update an existing casting */
  updateCasting: async (id, formData) => {
    const userName = getCurrentUserName();
    if (userName && !formData.get('updatedByName')) {
      formData.append('updatedByName', userName);
    }
    const response = await castingApi.put(`/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Move selected castings to a new status.
   * commonDetails: shared fields applied to all items (characterName, talentName, gender, castType, characterNumber, jobFrequency)
   * perItemDetails: per-item overrides [{ _id, episodes, characterNumber }]
   */
  moveCastings: async (castingIds, targetStatus, { commonDetails, perItemDetails, toolType = 'main' } = {}) => {
    const userName = getCurrentUserName();
    const response = await castingApi.put('/move/items', {
      castingIds,
      targetStatus,
      toolType,
      userName,
      commonDetails: commonDetails || null,
      perItemDetails: perItemDetails || null,
    });
    return response.data;
  },

  /** Move an entire folder to a new status */
  moveFolder: async (folderField, folderValue, currentStatus, targetStatus, { commonDetails, perItemDetails, toolType = 'main' } = {}) => {
    const userName = getCurrentUserName();
    const response = await castingApi.put('/move/folder', {
      folderField,
      folderValue,
      currentStatus,
      targetStatus,
      toolType,
      userName,
      commonDetails: commonDetails || null,
      perItemDetails: perItemDetails || null,
    });
    return response.data;
  },

  /** Delete a casting */
  deleteCasting: async (id) => {
    const response = await castingApi.delete(`/${id}`);
    return response.data;
  },

  /** Restore a soft-deleted casting */
  restoreCasting: async (id) => {
    const response = await castingApi.put(`/restore/${id}`);
    return response.data;
  },

  /** Get soft-deleted castings */
  getDeletedCastings: async (toolType = 'main') => {
    const response = await castingApi.get('/deleted', { params: { toolType } });
    return response.data;
  },

  /** Delete an entire folder */
  deleteFolder: async (folderField, folderValue, status, toolType = 'main') => {
    const response = await castingApi.post('/delete-folder', {
      folderField,
      folderValue,
      status,
      toolType,
    });
    return response.data;
  },

  /** Get badge/stats counts */
  getStats: async (toolType = 'main') => {
    const response = await castingApi.get('/stats', { params: { toolType } });
    return response.data;
  },

  /** Get all folder badges for a tab */
  getBadges: async (status, toolType = 'main') => {
    const response = await castingApi.get('/badges', { params: { status, toolType } });
    return response.data;
  },

  /** Mark a folder key as viewed */
  markViewed: async (folderKey) => {
    const response = await castingApi.post('/mark-viewed', { folderKey });
    return response.data;
  },

  /** Fetch link preview metadata */
  getLinkPreview: async (url) => {
    const response = await castingApi.post('/link-preview', { url });
    return response.data;
  },

  /** Generate PDF report */
  generatePDF: async (castingIds, title, includeDetails = true) => {
    const userName = getCurrentUserName();
    const response = await castingApi.post(
      '/generate-pdf',
      { castingIds, title, includeDetails, userName },
      { responseType: 'blob' }
    );
    return response.data;
  },

  /** Share castings to users */
  shareCastings: async (castingIds, userIds, message) => {
    const userName = getCurrentUserName();
    const response = await castingApi.post('/share', {
      castingIds,
      userIds,
      userName,
      message,
    });
    return response.data;
  },

  // ── Unit Chat (tab-level chat) ──

  /** Get unit chat messages for a tab */
  getUnitChats: async (unit) => {
    const response = await castingApi.get('/unit-chat', { params: { unit } });
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
    const response = await castingApi.post('/unit-chat', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // ── Image-level Comments ──

  /** Get comments for a casting */
  getComments: async (castingId) => {
    const response = await castingApi.get(`/${castingId}/comments`);
    return response.data;
  },

  /** Create a comment */
  createComment: async (castingId, formData) => {
    const userName = getCurrentUserName();
    if (userName && !formData.get('userName')) {
      formData.append('userName', userName);
    }
    const response = await castingApi.post(`/${castingId}/comments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /** Update a comment */
  updateComment: async (id, text) => {
    const response = await castingApi.put(`/comments/${id}`, { text });
    return response.data;
  },

  /** Delete a comment */
  deleteComment: async (id) => {
    const response = await castingApi.delete(`/comments/${id}`);
    return response.data;
  },
  /** Bulk import — send parsed rows as JSON (no images) */
  bulkImport: async (data) => {
    const response = await castingApi.post('/bulk-import', data);
    return response.data;
  },

  /** Bulk import with images — send FormData with castings JSON + image files */
  bulkImportWithImages: async (formData) => {
    const response = await castingApi.post('/bulk-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

export default castingToolService;
