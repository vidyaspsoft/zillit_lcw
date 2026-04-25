import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal, Input, Button, Spin, Empty, Tooltip } from 'antd';
import { FiSearch, FiUsers, FiUser, FiStar, FiInfo, FiCheck, FiGrid } from 'react-icons/fi';
import { useTheme } from '../../context/ThemeContext';
import distributeService from '../../services/distributeService';

/**
 * SelectInviteesModal — 5-tab Distribute-To picker.
 *
 * Returns via onConfirm({ distributeTo, distributeUserIds, distributeDepartmentIds, userPresetId, summary }).
 * `summary` is the human-readable label shown back on the parent form.
 *
 * Tabs: All Depts · Departments · Users · Preset · Self
 * Single-mode at a time — picking on one tab clears the others.
 */
const TABS = [
  { key: 'all_departments', label: 'All Depts' },
  { key: 'departments', label: 'Departments' },
  { key: 'users', label: 'Users' },
  { key: 'presets', label: 'Preset' },
  { key: 'self', label: 'Self' },
];

const ORANGE = '#F39C12';

const SelectInviteesModal = ({
  open,
  onClose,
  onConfirm,
  initialMode = '',
  initialUserIds = [],
  initialDepartmentIds = [],
  initialPresetId = null,
}) => {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState(initialMode || 'all_departments');

  // Per-mode selections
  const [allDeptsOn, setAllDeptsOn] = useState(initialMode === 'all_departments');
  const [selfOn, setSelfOn] = useState(initialMode === 'self');
  const [selectedDeptIds, setSelectedDeptIds] = useState(initialDepartmentIds);
  const [selectedUserIds, setSelectedUserIds] = useState(initialUserIds);
  const [selectedPresetId, setSelectedPresetId] = useState(initialPresetId);

  // Data
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Search inputs
  const [deptSearch, setDeptSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [presetSearch, setPresetSearch] = useState('');

  // Long-press / member-list dialog for presets
  const [presetMembersOf, setPresetMembersOf] = useState(null);

  // Reset state when re-opened with new initial values
  useEffect(() => {
    if (!open) return;
    setActiveTab(initialMode || 'all_departments');
    setAllDeptsOn(initialMode === 'all_departments');
    setSelfOn(initialMode === 'self');
    setSelectedDeptIds(initialDepartmentIds || []);
    setSelectedUserIds(initialUserIds || []);
    setSelectedPresetId(initialPresetId || null);
    setDeptSearch('');
    setUserSearch('');
    setPresetSearch('');
  }, [open, initialMode, initialUserIds, initialDepartmentIds, initialPresetId]);

  // Fetch data on first open
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
      distributeService.getProjectUsers().catch(() => []),
      distributeService.getDepartments().catch(() => []),
      distributeService.getUserPresets().catch(() => []),
    ])
      .then(([u, d, p]) => {
        if (!alive) return;
        setUsers(u);
        setDepartments(d);
        setPresets(p);
      })
      .catch((err) => alive && setError(err.message || 'Failed to load'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open]);

  // ── Mode-switch helpers (latest wins) ──
  const switchMode = useCallback((mode) => {
    setActiveTab(mode);
  }, []);

  const toggleAllDepts = () => {
    const next = !allDeptsOn;
    setAllDeptsOn(next);
    if (next) {
      setSelfOn(false);
      setSelectedDeptIds([]);
      setSelectedUserIds([]);
      setSelectedPresetId(null);
    }
  };

  const toggleSelf = () => {
    const next = !selfOn;
    setSelfOn(next);
    if (next) {
      setAllDeptsOn(false);
      setSelectedDeptIds([]);
      setSelectedUserIds([]);
      setSelectedPresetId(null);
    }
  };

  const toggleDept = (id) => {
    setSelectedDeptIds((prev) => {
      const has = prev.includes(id);
      const next = has ? prev.filter((x) => x !== id) : [...prev, id];
      if (next.length > 0) {
        setAllDeptsOn(false);
        setSelfOn(false);
        setSelectedUserIds([]);
        setSelectedPresetId(null);
      }
      return next;
    });
  };

  const toggleUser = (id) => {
    setSelectedUserIds((prev) => {
      const has = prev.includes(id);
      const next = has ? prev.filter((x) => x !== id) : [...prev, id];
      if (next.length > 0) {
        setAllDeptsOn(false);
        setSelfOn(false);
        setSelectedDeptIds([]);
        setSelectedPresetId(null);
      }
      return next;
    });
  };

  const pickPreset = (id) => {
    setSelectedPresetId(id);
    setAllDeptsOn(false);
    setSelfOn(false);
    setSelectedDeptIds([]);
    setSelectedUserIds([]);
  };

  const selectAllDeptsInList = () => {
    const ids = filteredDepts.map((d) => d.id);
    setSelectedDeptIds(ids);
    setAllDeptsOn(false);
    setSelfOn(false);
    setSelectedUserIds([]);
    setSelectedPresetId(null);
  };

  const selectAllUsersInList = () => {
    const ids = filteredUsers.map((u) => u.id);
    setSelectedUserIds(ids);
    setAllDeptsOn(false);
    setSelfOn(false);
    setSelectedDeptIds([]);
    setSelectedPresetId(null);
  };

  // ── Filtered lists ──
  const filteredDepts = useMemo(() => {
    const q = deptSearch.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter((d) => d.name.toLowerCase().includes(q));
  }, [departments, deptSearch]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.fullName.toLowerCase().includes(q));
  }, [users, userSearch]);

  const filteredPresets = useMemo(() => {
    const q = presetSearch.trim().toLowerCase();
    if (!q) return presets;
    return presets.filter((p) => p.name.toLowerCase().includes(q));
  }, [presets, presetSearch]);

  // ── Done counter ──
  const doneCount = useMemo(() => {
    if (activeTab === 'all_departments') return allDeptsOn ? users.length : 0;
    if (activeTab === 'self') return selfOn ? 1 : 0;
    if (activeTab === 'departments') return selectedDeptIds.length;
    if (activeTab === 'users') return selectedUserIds.length;
    if (activeTab === 'presets') return selectedPresetId ? 1 : 0;
    return 0;
  }, [activeTab, allDeptsOn, selfOn, selectedDeptIds, selectedUserIds, selectedPresetId, users.length]);

  // ── Confirm ──
  const handleConfirm = () => {
    let mode = '';
    let userIds = [];
    let deptIds = [];
    let presetId = null;
    let summary = '';

    if (allDeptsOn) {
      mode = 'all_departments';
      summary = 'All Departments';
    } else if (selfOn) {
      mode = 'self';
      summary = 'Only Me';
    } else if (selectedPresetId) {
      mode = 'presets';
      presetId = selectedPresetId;
      const p = presets.find((x) => x.id === selectedPresetId);
      summary = p ? p.name : 'Preset';
    } else if (selectedUserIds.length > 0) {
      mode = 'users';
      userIds = selectedUserIds;
      summary = `${userIds.length} user${userIds.length === 1 ? '' : 's'} selected — tap to edit`;
    } else if (selectedDeptIds.length > 0) {
      mode = 'departments';
      deptIds = selectedDeptIds;
      summary = `Selected Departments: ${deptIds.length}`;
    }

    onConfirm({
      distributeTo: mode,
      distributeUserIds: userIds,
      distributeDepartmentIds: deptIds,
      userPresetId: presetId,
      summary,
    });
    onClose();
  };

  // ── Render helpers ──
  const tabBtnStyle = (key) => ({
    padding: '6px 14px',
    borderRadius: '999px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    border: `1px solid ${activeTab === key ? ORANGE : colors.border}`,
    background: activeTab === key ? ORANGE : colors.surface,
    color: activeTab === key ? '#fff' : colors.textBody,
    whiteSpace: 'nowrap',
    transition: 'all 0.15s',
  });

  const renderRow = (left, right, onClick, selected) => (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 12px',
        borderRadius: '8px',
        cursor: 'pointer',
        background: selected ? `${ORANGE}15` : 'transparent',
        marginBottom: '4px',
      }}
    >
      <div style={{ marginRight: '10px' }}>
        {selected ? (
          <FiCheck size={18} color={ORANGE} />
        ) : (
          <div style={{ width: '18px', height: '18px', border: `1.5px solid ${colors.border}`, borderRadius: '4px' }} />
        )}
      </div>
      {left}
      {right}
    </div>
  );

  // ── Tab content ──
  const renderContent = () => {
    if (loading) {
      return <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>;
    }
    if (error) {
      return <div style={{ textAlign: 'center', padding: '40px 0', color: colors.dangerBg }}>{error}</div>;
    }

    if (activeTab === 'all_departments') {
      return (
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{
            width: '64px', height: '64px', margin: '0 auto 16px',
            borderRadius: '12px', background: `${ORANGE}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FiGrid size={32} color={ORANGE} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: colors.textPrimary, margin: '0 0 4px' }}>
            Invite all {users.length} team members
          </h3>
          <p style={{ fontSize: '13px', color: colors.textSecondary, margin: '0 0 20px' }}>
            Everyone in the project will be invited
          </p>
          <Button
            onClick={toggleAllDepts}
            disabled={users.length === 0}
            style={{
              background: allDeptsOn ? ORANGE : colors.surface,
              borderColor: allDeptsOn ? ORANGE : colors.border,
              color: allDeptsOn ? '#fff' : colors.textBody,
              fontWeight: 600,
              borderRadius: '999px',
              padding: '0 20px',
              height: '36px',
            }}
          >
            {allDeptsOn ? 'Selected ✓' : 'Select All'}
          </Button>
        </div>
      );
    }

    if (activeTab === 'self') {
      return (
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{
            width: '64px', height: '64px', margin: '0 auto 16px',
            borderRadius: '12px', background: `${ORANGE}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FiUser size={32} color={ORANGE} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: colors.textPrimary, margin: '0 0 4px' }}>Only You</h3>
          <p style={{ fontSize: '13px', color: colors.textSecondary, margin: '0 0 20px' }}>
            This event will be visible to you only
          </p>
          <Button
            onClick={toggleSelf}
            style={{
              background: selfOn ? ORANGE : colors.surface,
              borderColor: selfOn ? ORANGE : colors.border,
              color: selfOn ? '#fff' : colors.textBody,
              fontWeight: 600,
              borderRadius: '999px',
              padding: '0 20px',
              height: '36px',
            }}
          >
            {selfOn ? 'Selected ✓' : 'Select Me'}
          </Button>
        </div>
      );
    }

    if (activeTab === 'departments') {
      return (
        <div>
          <div className="flex gap-2" style={{ marginBottom: '12px' }}>
            <Input
              prefix={<FiSearch />}
              placeholder="Search departments…"
              value={deptSearch}
              onChange={(e) => setDeptSearch(e.target.value)}
              allowClear
            />
            <Button onClick={selectAllDeptsInList} type="link" style={{ color: ORANGE, fontWeight: 600 }}>
              Select All
            </Button>
          </div>
          {filteredDepts.length === 0 ? (
            <Empty description="No departments yet" />
          ) : (
            <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
              {filteredDepts.map((d) =>
                renderRow(
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FiUsers size={16} color={colors.textSecondary} />
                    <span style={{ fontSize: '14px', color: colors.textBody }}>{d.name}</span>
                  </div>,
                  null,
                  () => toggleDept(d.id),
                  selectedDeptIds.includes(d.id),
                ),
              )}
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'users') {
      return (
        <div>
          <div className="flex gap-2" style={{ marginBottom: '12px' }}>
            <Input
              prefix={<FiSearch />}
              placeholder="Search users…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              allowClear
            />
            <Button onClick={selectAllUsersInList} type="link" style={{ color: ORANGE, fontWeight: 600 }}>
              Select All
            </Button>
          </div>
          {filteredUsers.length === 0 ? (
            <Empty description="No users yet" />
          ) : (
            <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
              {filteredUsers.map((u) =>
                renderRow(
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: colors.textBody }}>{u.fullName}</span>
                      {u.isAdmin && (
                        <span style={{
                          fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
                          background: `${ORANGE}25`, color: ORANGE, fontWeight: 600,
                        }}>
                          ADMIN
                        </span>
                      )}
                    </div>
                    {(u.departmentName || u.designationName) && (
                      <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '2px' }}>
                        {[u.departmentName, u.designationName].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>,
                  null,
                  () => toggleUser(u.id),
                  selectedUserIds.includes(u.id),
                ),
              )}
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'presets') {
      return (
        <div>
          <Input
            prefix={<FiSearch />}
            placeholder="Search presets…"
            value={presetSearch}
            onChange={(e) => setPresetSearch(e.target.value)}
            allowClear
            style={{ marginBottom: '8px' }}
          />
          <p style={{ fontSize: '11px', color: colors.textSubtle, margin: '0 0 12px', fontStyle: 'italic' }}>
            Click the info icon to view preset members
          </p>
          {filteredPresets.length === 0 ? (
            <Empty description="No presets yet" />
          ) : (
            <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
              {filteredPresets.map((p) => {
                const selected = selectedPresetId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => pickPreset(p.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: selected ? `${ORANGE}15` : 'transparent',
                      marginBottom: '4px',
                    }}
                  >
                    <div style={{ marginRight: '10px' }}>
                      <div style={{
                        width: '18px', height: '18px', borderRadius: '50%',
                        border: `1.5px solid ${selected ? ORANGE : colors.border}`,
                        background: selected ? ORANGE : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {selected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }} />}
                      </div>
                    </div>
                    <FiStar size={16} color={ORANGE} style={{ marginRight: '10px' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: colors.textBody }}>{p.name}</div>
                      <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '2px' }}>
                        {p.memberCount} member{p.memberCount === 1 ? '' : 's'}
                      </div>
                    </div>
                    <Tooltip title="View members">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPresetMembersOf(p);
                        }}
                        style={{
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          padding: '4px', color: colors.textSecondary,
                        }}
                      >
                        <FiInfo size={16} />
                      </button>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        width={560}
        title={<span style={{ fontWeight: 700, fontSize: '16px' }}>Select Invitees</span>}
        styles={{ body: { padding: '16px 20px' } }}
        destroyOnClose
      >
        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '8px',
            marginBottom: '12px',
            borderBottom: `1px solid ${colors.borderLight}`,
          }}
        >
          {TABS.map((t) => (
            <button key={t.key} onClick={() => switchMode(t.key)} style={tabBtnStyle(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ minHeight: '320px' }}>{renderContent()}</div>

        {/* Footer */}
        <div className="flex justify-end gap-2" style={{ marginTop: '16px', borderTop: `1px solid ${colors.borderLight}`, paddingTop: '12px' }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            disabled={doneCount === 0}
            style={{
              background: doneCount === 0 ? colors.surfaceAlt : ORANGE,
              borderColor: doneCount === 0 ? colors.border : ORANGE,
              color: doneCount === 0 ? colors.textSubtle : '#fff',
              fontWeight: 600,
              borderRadius: '999px',
              padding: '0 18px',
            }}
          >
            Done ({doneCount})
          </Button>
        </div>
      </Modal>

      {/* Preset members dialog */}
      <Modal
        open={!!presetMembersOf}
        onCancel={() => setPresetMembersOf(null)}
        title={presetMembersOf?.name || 'Preset'}
        footer={[
          <Button key="ok" onClick={() => setPresetMembersOf(null)}>OK</Button>,
        ]}
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

export default SelectInviteesModal;
