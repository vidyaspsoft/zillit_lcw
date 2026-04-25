import axios from 'axios';
import {
  PROJECT_API_BASE_URL,
  USER_PRESET_API_URL,
  BOX_SCHEDULE_HEADERS,
} from '../config/constants';

// Shared axios instance for distribute-picker fetches.
// Reuses the same encrypted moduledata/bodyhash as Box Schedule.
const distributeApi = axios.create({
  timeout: 30000,
  headers: {
    Accept: BOX_SCHEDULE_HEADERS.Accept,
    'Accept-Charset': BOX_SCHEDULE_HEADERS['Accept-Charset'],
    Timezone: BOX_SCHEDULE_HEADERS.Timezone,
    bodyhash: BOX_SCHEDULE_HEADERS.bodyhash,
    moduledata: BOX_SCHEDULE_HEADERS.moduledata,
  },
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
  // GET /api/v2/project/users — active users in current project
  async getProjectUsers() {
    const { data } = await distributeApi.get(`${PROJECT_API_BASE_URL}/project/users`);
    const list = data?.data ?? [];
    return list
      .filter((u) => (u.status || '').toUpperCase() === 'ACTIVE' || !u.status)
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
};

export default distributeService;
