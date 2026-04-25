import axios from 'axios';
import {
  PROJECT_API_BASE_URL,
  USER_PRESET_API_URL,
  BOX_SCHEDULE_HEADERS,
} from '../config/constants';

// Shared axios instance for distribute-picker fetches.
// Reuses the same encrypted moduledata as Box Schedule. `bodyhash` is set
// per-request — fixed for GET (no body), SHA-256 of the body for POST/PUT.
const distributeApi = axios.create({
  timeout: 30000,
  headers: {
    Accept: BOX_SCHEDULE_HEADERS.Accept,
    'Accept-Charset': BOX_SCHEDULE_HEADERS['Accept-Charset'],
    Timezone: BOX_SCHEDULE_HEADERS.Timezone,
    appversion: BOX_SCHEDULE_HEADERS.appversion,
    'cache-control': BOX_SCHEDULE_HEADERS['cache-control'],
    devicename: BOX_SCHEDULE_HEADERS.devicename,
    moduledata: BOX_SCHEDULE_HEADERS.moduledata,
  },
});

/**
 * SHA-256 of a string → lower-case hex (64 chars).
 * Server validates POST/PUT bodyhash against the actual body; the fixed
 * value baked into BOX_SCHEDULE_HEADERS only matches an empty/test body.
 */
async function sha256Hex(input) {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Inject bodyhash on every request. For methods with a body, hash the
// serialised body so the server's signature check passes.
distributeApi.interceptors.request.use(async (config) => {
  if (config.data != null && config.data !== '') {
    const raw = typeof config.data === 'string' ? config.data : JSON.stringify(config.data);
    config.data = raw; // ensure axios sends exactly what we hashed
    config.headers['bodyhash'] = await sha256Hex(raw);
  } else {
    config.headers['bodyhash'] = BOX_SCHEDULE_HEADERS.bodyhash;
  }
  return config;
});

/**
 * Resolve a label key like "{department:abc}" → human readable.
 * Backend currently returns raw keys; until we have a label table, strip braces & prefix.
 */
export function resolveLabelKey(raw) {
  if (!raw) return '';
  const m = String(raw).match(/^\{[^:]+:([^}]+)\}$/);
  return m ? m[1] : raw;
}

export const distributeService = {
  // GET /api/v2/project/users — full user list for the current project.
  // Matches iOS: returns every user the API gives back (no status filter).
  async getProjectUsers() {
    const { data } = await distributeApi.get(`${PROJECT_API_BASE_URL}/project/users`);
    const list = data?.data ?? [];
    return list
      .filter((u) => !!u.user_id) // drop malformed rows that lack an id
      .map((u) => ({
        id: u.user_id,
        fullName: u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim(),
        departmentId: u.department_id,
        departmentName: resolveLabelKey(u.department_name),
        designationId: u.designation_id,
        designationName: resolveLabelKey(u.designation_name),
        isAdmin: !!u.is_admin,
        avatar: u.profile_picture?.url || u.profile_picture_thumbnail || '',
      }));
  },

  // GET /api/v2/departments
  async getDepartments() {
    const { data } = await distributeApi.get(`${PROJECT_API_BASE_URL}/departments`);
    const list = data?.data ?? [];
    return list.map((d) => ({
      id: d.id || d._id,
      name: resolveLabelKey(d.department_name),
      systemDefined: !!d.system_defined,
    }));
  },

  // GET /api/v2/user-preset
  async getUserPresets() {
    const { data } = await distributeApi.get(USER_PRESET_API_URL);
    const list = data?.data ?? [];
    return list.map((p) => ({
      id: p.id || p._id,
      name: p.preset_name,
      memberCount: (p.users || []).length,
      members: (p.users || []).map((m) => ({
        id: m.user_id,
        fullName: m.full_name,
        designation: resolveLabelKey(m.designation),
      })),
    }));
  },

  // POST /api/v2/user-preset — body: { preset_name, user_ids: [...] }
  async createUserPreset(presetName, userIds) {
    const { data } = await distributeApi.post(USER_PRESET_API_URL, {
      preset_name: presetName,
      user_ids: userIds,
    });
    return data?.data ?? data;
  },

  // POST /api/v2/user-preset — same endpoint as create, but with `preset_id`
  // in the body so the server treats it as an update.
  async updateUserPreset(id, presetName, userIds) {
    const { data } = await distributeApi.post(USER_PRESET_API_URL, {
      preset_id: id,
      preset_name: presetName,
      user_ids: userIds,
    });
    return data?.data ?? data;
  },
};

export default distributeService;
