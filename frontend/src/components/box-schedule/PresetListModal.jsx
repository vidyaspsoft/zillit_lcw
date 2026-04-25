import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Input, Button, Spin, Empty, Tooltip, Select, Divider, Tag } from 'antd';
import { FiPlus, FiSearch, FiArrowLeft, FiStar, FiInfo } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useTheme } from '../../context/ThemeContext';
import distributeService from '../../services/distributeService';

const ORANGE = '#F39C12';

/**
 * PresetListModal — two screens in one modal:
 *   list  → existing presets, "+ New Preset" button, info dialog for members
 *   form  → preset name input + multi-select user list
 *
 * Modes shared with `SelectInviteesModal` so this lives near it.
 */
const PresetListModal = ({ open, onClose }) => {
  const { colors } = useTheme();
  const [view, setView] = useState('list'); // 'list' | 'form'
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [presetMembersOf, setPresetMembersOf] = useState(null);

  // Form state
  const [presetName, setPresetName] = useState('');
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setView('list');
    setSearch('');
    setPresetName('');
    setSelectedUserIds([]);
    loadPresets();
  }, [open]);

  const loadPresets = async () => {
    setLoading(true);
    try {
      const list = await distributeService.getUserPresets();
      setPresets(list);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to load presets');
    } finally {
      setLoading(false);
    }
  };

  const ensureUsersLoaded = async () => {
    if (users.length > 0) return;
    setUsersLoading(true);
    try {
      const u = await distributeService.getProjectUsers();
      setUsers(u);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  };

  const filteredPresets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? presets.filter((p) => p.name.toLowerCase().includes(q)) : presets;
  }, [presets, search]);

  const handleSave = async () => {
    if (!presetName.trim()) {
      toast.error('Preset name is required');
      return;
    }
    if (selectedUserIds.length === 0) {
      toast.error('Select at least one user');
      return;
    }
    setSubmitting(true);
    try {
      await distributeService.createUserPreset(presetName.trim(), selectedUserIds);
      toast.success('Preset created');
      setView('list');
      await loadPresets();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to create preset');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──
  const renderList = () => (
    <div>
      <div className="flex gap-2" style={{ marginBottom: '12px' }}>
        <Input
          prefix={<FiSearch />}
          placeholder="Search presets…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
        />
        <Button
          type="primary"
          icon={<FiPlus />}
          onClick={() => {
            setView('form');
            ensureUsersLoaded();
          }}
          style={{ background: ORANGE, borderColor: ORANGE, fontWeight: 600 }}
        >
          New Preset
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>
      ) : filteredPresets.length === 0 ? (
        <Empty description="No presets yet" />
      ) : (
        <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
          {filteredPresets.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex', alignItems: 'center',
                padding: '12px', borderRadius: '8px',
                background: colors.surfaceAlt, marginBottom: '6px',
              }}
            >
              <FiStar size={18} color={ORANGE} style={{ marginRight: '12px' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: colors.textBody }}>{p.name}</div>
                <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '2px' }}>
                  {p.memberCount} member{p.memberCount === 1 ? '' : 's'}
                </div>
              </div>
              <Tooltip title="View members">
                <button
                  onClick={() => setPresetMembersOf(p)}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: '6px', color: colors.textSecondary,
                  }}
                >
                  <FiInfo size={18} />
                </button>
              </Tooltip>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderForm = () => (
    <div>
      <div className="flex items-center gap-2" style={{ marginBottom: '14px' }}>
        <Button icon={<FiArrowLeft />} onClick={() => setView('list')} type="text" />
        <span style={{ fontSize: '14px', fontWeight: 600, color: colors.textBody }}>New Preset</span>
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label style={{
          display: 'block', fontSize: '12px', fontWeight: 600,
          color: colors.textSecondary, marginBottom: '4px',
          letterSpacing: '0.5px', textTransform: 'uppercase',
        }}>
          Preset Name
        </label>
        <Input
          placeholder="e.g., My Crew"
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          size="large"
        />
      </div>

      <div>
        <label style={{
          display: 'block', fontSize: '12px', fontWeight: 600,
          color: colors.textSecondary, marginBottom: '4px',
          letterSpacing: '0.5px', textTransform: 'uppercase',
        }}>
          Select Users ({selectedUserIds.length})
        </label>
        {usersLoading ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}><Spin /></div>
        ) : (
          <Select
            mode="multiple"
            placeholder="Select users…"
            value={selectedUserIds}
            onChange={setSelectedUserIds}
            style={{ width: '100%' }}
            size="large"
            maxTagCount="responsive"
            optionFilterProp="label"
            filterOption={(input, option) => (option?.label || '').toLowerCase().includes(input.toLowerCase())}
            notFoundContent={users.length === 0 ? <Empty description="No users yet" /> : 'No matches'}
            dropdownRender={(menu) => (
              <div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px',
                }}>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => setSelectedUserIds(users.map((u) => u.id))}
                    style={{ color: ORANGE, fontWeight: 600, padding: 0 }}
                  >
                    Select All ({users.length})
                  </Button>
                  {selectedUserIds.length > 0 && (
                    <Button
                      type="link"
                      size="small"
                      onClick={() => setSelectedUserIds([])}
                      style={{ color: colors.textSecondary, padding: 0 }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <Divider style={{ margin: 0 }} />
                {menu}
              </div>
            )}
          >
            {users.map((u) => (
              <Select.Option key={u.id} value={u.id} label={u.fullName}>
                <div style={{ padding: '2px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: colors.textBody }}>{u.fullName}</span>
                    {u.isAdmin && (
                      <Tag color="orange" style={{ fontSize: '10px', margin: 0, padding: '0 6px', lineHeight: '16px' }}>ADMIN</Tag>
                    )}
                  </div>
                  {(u.departmentName || u.designationName) && (
                    <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '2px' }}>
                      {[u.departmentName, u.designationName].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              </Select.Option>
            ))}
          </Select>
        )}
      </div>

      <div className="flex justify-end gap-2" style={{
        marginTop: '16px', borderTop: `1px solid ${colors.borderLight}`, paddingTop: '12px',
      }}>
        <Button onClick={() => setView('list')}>Cancel</Button>
        <Button
          loading={submitting}
          onClick={handleSave}
          style={{ background: ORANGE, borderColor: ORANGE, color: '#fff', fontWeight: 600 }}
        >
          Save Preset
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        width={560}
        title={<span style={{ fontWeight: 700, fontSize: '16px' }}>{view === 'list' ? 'Presets' : 'New Preset'}</span>}
        styles={{ body: { padding: '16px 20px' } }}
        destroyOnClose
      >
        {view === 'list' ? renderList() : renderForm()}
      </Modal>

      <Modal
        open={!!presetMembersOf}
        onCancel={() => setPresetMembersOf(null)}
        title={presetMembersOf?.name || 'Preset'}
        footer={[<Button key="ok" onClick={() => setPresetMembersOf(null)}>OK</Button>]}
      >
        {presetMembersOf?.members?.length ? (
          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {presetMembersOf.members.map((m, idx) => (
              <div
                key={m.id || idx}
                style={{
                  padding: '8px 0',
                  borderBottom: idx < presetMembersOf.members.length - 1 ? `1px solid ${colors.borderLight}` : 'none',
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 500 }}>{m.fullName}</div>
                {m.designation && (
                  <div style={{ fontSize: '12px', color: colors.textSecondary }}>{m.designation}</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty description="No members" />
        )}
      </Modal>
    </>
  );
};

export default PresetListModal;
