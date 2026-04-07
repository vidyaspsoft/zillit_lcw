import axios from 'axios';
import { API_BASE_URL } from '../config/constants';

const api = axios.create({ baseURL: API_BASE_URL, timeout: 30000 });

/**
 * Local cache of project users keyed by projectId.
 * Prevents re-fetching on every call.
 */
let cachedUsers = [];
let cachedProjectId = null;
let fetchPromise = null;

/**
 * Check if a string looks like a MongoDB ObjectId (24 hex chars).
 */
const looksLikeObjectId = (str) =>
  typeof str === 'string' && /^[a-f0-9]{24}$/i.test(str);

/**
 * Fetch and cache the project user list. Returns the cached list if already loaded
 * for the current project. Safe to call repeatedly — deduplicates in-flight requests.
 */
export const loadProjectUsers = async () => {
  try {
    const stored = localStorage.getItem('zillit-auth');
    if (!stored) return [];
    const { user } = JSON.parse(stored);
    if (!user?.projectId) return [];

    // Return cache if valid
    if (cachedProjectId === user.projectId && cachedUsers.length > 0) {
      return cachedUsers;
    }

    // Deduplicate concurrent calls
    if (fetchPromise && cachedProjectId === user.projectId) {
      return fetchPromise;
    }

    cachedProjectId = user.projectId;
    fetchPromise = api
      .get(`/auth/projects/${user.projectId}/users`)
      .then((response) => {
        const users = response.data?.data || response.data?.users || response.data || [];
        cachedUsers = Array.isArray(users) ? users : [];
        fetchPromise = null;
        return cachedUsers;
      })
      .catch((err) => {
        console.error('Failed to load project users:', err);
        fetchPromise = null;
        return cachedUsers;
      });

    return fetchPromise;
  } catch {
    return [];
  }
};

/**
 * Resolve a userId to a display name.
 * Checks the cached project-user list first, then falls back to the
 * current auth user from localStorage.
 *
 * @param {string} userId - The user ID to look up
 * @returns {string} The user's display name, or 'Unknown' if not found
 */
export const getUserName = (userId) => {
  if (!userId) return 'Unknown';

  // Check cached project users by _id or userId
  const match = cachedUsers.find(
    (u) => (u._id || u.userId) === userId
  );
  if (match) return match.name || match.userName || userId;

  // Fallback: check if it's the current logged-in user
  try {
    const stored = localStorage.getItem('zillit-auth');
    if (stored) {
      const { user } = JSON.parse(stored);
      if (user?.userId === userId && user?.name) return user.name;
    }
  } catch {}

  return 'Unknown';
};

/**
 * Resolve a user's display name from various possible fields.
 * Handles bad seed data where `name` might be an ObjectId string.
 * Tries: direct name fields → getUserName(userId) → projectUsers lookup → 'Unknown'.
 *
 * @param {Object} userObj - Object with possible name/userName/userId fields
 * @param {Array} [projectUsers] - Optional array of project users to search
 * @returns {string} The resolved display name
 */
export const resolveUserName = (userObj, projectUsers) => {
  if (!userObj) return 'Unknown';

  // Try direct name fields, but skip if they look like ObjectIds
  const directName = userObj.name || userObj.userName;
  if (directName && !looksLikeObjectId(directName)) {
    return directName;
  }

  // Try to resolve via userId from cached users
  // Prefer userObj.userId over userObj._id because for Mongoose subdocuments
  // (like task assignees), _id is the auto-generated subdocument ID, not the user's ID.
  const userId = userObj.userId || userObj._id;
  if (userId) {
    const resolved = getUserName(userId);
    if (resolved !== 'Unknown') return resolved;
  }

  // Try searching projectUsers array if provided
  if (projectUsers && userId) {
    const match = projectUsers.find(
      (u) => (u._id || u.userId) === userId
    );
    if (match) {
      const name = match.name || match.userName;
      if (name && !looksLikeObjectId(name)) return name;
    }
  }

  // Last resort: return whatever we have
  return directName || userId || 'Unknown';
};

/**
 * Get the current logged-in user's name from localStorage.
 */
export const getCurrentUserName = () => {
  try {
    const stored = localStorage.getItem('zillit-auth');
    if (stored) {
      const { user } = JSON.parse(stored);
      return user?.name || '';
    }
  } catch {}
  return '';
};

/**
 * Clear the user cache (e.g. on logout or project switch).
 */
export const clearUserCache = () => {
  cachedUsers = [];
  cachedProjectId = null;
  fetchPromise = null;
};
