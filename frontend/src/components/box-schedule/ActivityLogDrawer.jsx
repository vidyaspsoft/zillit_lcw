import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Drawer, Spin, Select, DatePicker } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import boxScheduleService from '../../services/boxScheduleService';
import { useTheme } from '../../context/ThemeContext';

dayjs.extend(relativeTime);

// Map backend action codes → user-friendly verbs + colors
const ACTION_META = {
  created:    { label: 'ADDED',   color: '#27ae60' },
  updated:    { label: 'CHANGED', color: '#3498db' },
  deleted:    { label: 'REMOVED', color: '#e74c3c' },
  duplicated: { label: 'COPIED',  color: '#8e44ad' },
  shared:     { label: 'SHARED',  color: '#f39c12' },
};

// Map backend target types → plain English
const TARGET_LABELS = {
  schedule_day:  'Schedule',
  schedule_type: 'Schedule Type',
  event:         'Event',
  note:          'Note',
};

const ACTION_FILTER_OPTIONS = [
  { value: 'all',        label: 'All Actions' },
  { value: 'created',    label: '🟢 Added'    },
  { value: 'updated',    label: '🔵 Changed'  },
  { value: 'deleted',    label: '🔴 Removed'  },
  { value: 'duplicated', label: '🟣 Copied'   },
  { value: 'shared',     label: '🟠 Shared'   },
];

const ActivityLogDrawer = ({ open, onClose }) => {
  const { colors } = useTheme();
  const [logs, setLogs] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState('all');
  const [filterDate, setFilterDate] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, revsRes] = await Promise.all([
        boxScheduleService.getActivityLog({ limit: 200, page: 0 }),
        boxScheduleService.getRevisions({}),
      ]);
      setLogs(logsRes.data?.logs || []);
      setRevisions(revsRes.data || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  const getRevisionForLog = useCallback((log) => {
    if (!log.targetId) return null;
    const logTime = new Date(log.createdAt).getTime();
    let best = null;
    let bestDiff = Infinity;
    revisions.forEach((rev) => {
      if (String(rev.targetId) !== String(log.targetId)) return;
      const diff = Math.abs(new Date(rev.createdAt).getTime() - logTime);
      if (diff < bestDiff && diff < 10000) {
        bestDiff = diff;
        best = rev;
      }
    });
    return best;
  }, [revisions]);

  const filteredLogs = useMemo(() => {
    return logs
      .filter((log) => {
        if (actionFilter !== 'all' && log.action !== actionFilter) return false;
        if (filterDate && !dayjs(log.createdAt).isSame(filterDate, 'day')) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [logs, actionFilter, filterDate]);

  const buildContextLine = (log) => log.details || null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      width={480}
      styles={{
        header: { borderBottom: `1px solid ${colors.border}`, background: colors.drawerHeaderBg },
        body: { padding: 0, background: colors.drawerBodyBg },
      }}
      title={
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '1.5px', color: colors.textPrimary }}>
            HISTORY
          </div>
          <div style={{ fontSize: '11px', color: colors.textMuted, fontWeight: 400, marginTop: '2px' }}>
            Everything that changed in the Production Schedule
          </div>
        </div>
      }
    >
      {/* Filters */}
      <div style={{ padding: '14px 20px 12px', borderBottom: `1px solid ${colors.border}`, background: colors.drawerHeaderBg }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Select
            value={actionFilter}
            onChange={setActionFilter}
            options={ACTION_FILTER_OPTIONS}
            style={{ flex: 1 }}
            size="middle"
          />
          <DatePicker
            value={filterDate}
            onChange={setFilterDate}
            format="MMM D, YYYY"
            placeholder="Pick a date"
            allowClear
            style={{ flex: 1 }}
            className="schedule-datepicker-clear"
          />
        </div>

        {/* Color Legend */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px 14px',
            marginTop: '12px',
            padding: '8px 10px',
            background: colors.surface,
            border: `1px solid ${colors.borderDashed}`,
            borderRadius: '6px',
          }}
        >
          {Object.entries(ACTION_META).map(([key, meta]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: meta.color,
                  display: 'inline-block',
                }}
              />
              <span style={{ fontSize: '10px', fontWeight: 600, color: colors.textSecondary, letterSpacing: '0.3px' }}>
                {meta.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex justify-center py-10"><Spin /></div>
      ) : filteredLogs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 24px', color: colors.textFaint }}>
          <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.5 }}>
            {logs.length === 0 ? '📜' : '🔍'}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px' }}>
            {logs.length === 0 ? 'No history yet' : 'No matching changes'}
          </div>
          <div style={{ fontSize: '12px', color: colors.textSubtle }}>
            {logs.length === 0
              ? 'Changes to schedules, events, and notes will appear here automatically.'
              : 'Try a different filter.'}
          </div>
        </div>
      ) : (
        <div style={{ padding: '14px 16px', background: colors.drawerBodyBg }}>
          {filteredLogs.map((log) => {
            const meta = ACTION_META[log.action] || { label: (log.action || '').toUpperCase(), color: colors.textMuted };
            const targetLabel = TARGET_LABELS[log.targetType] || log.targetType || '';
            const rev = getRevisionForLog(log);
            const context = buildContextLine(log);
            return (
              <div
                key={log._id}
                style={{
                  position: 'relative',
                  background: colors.historyCardBg,
                  border: `1px solid ${colors.historyCardBorder}`,
                  borderLeft: `4px solid ${meta.color}`,
                  borderRadius: '6px',
                  padding: '12px 14px 12px 16px',
                  marginBottom: '10px',
                }}
              >
                {/* Action + target */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: meta.color }} />
                  <span style={{ fontSize: '11px', fontWeight: 800, color: meta.color, letterSpacing: '0.8px' }}>
                    {meta.label}
                  </span>
                  {targetLabel && (
                    <>
                      <span style={{ fontSize: '11px', color: colors.textPlaceholder }}>·</span>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {targetLabel}
                      </span>
                    </>
                  )}
                </div>

                {/* Title */}
                {log.targetTitle && (
                  <div style={{ fontSize: '14px', fontWeight: 700, color: colors.textPrimary, fontFamily: 'Georgia, serif', marginBottom: context ? '6px' : '8px' }}>
                    "{log.targetTitle}"
                  </div>
                )}

                {/* Context line */}
                {context && (
                  <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '8px', lineHeight: 1.5 }}>
                    {context}
                  </div>
                )}

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '4px', paddingTop: '6px', borderTop: `1px dashed ${colors.borderDashed}` }}>
                  <div style={{ fontSize: '11px', color: colors.textMuted }}>
                    <span style={{ fontWeight: 600, color: colors.textSecondary }}>
                      {dayjs(log.createdAt).format('MMM D · h:mm A')}
                    </span>
                    <span style={{ margin: '0 6px', color: colors.textDisabled }}>·</span>
                    <span>by </span>
                    <span style={{ fontWeight: 600, color: colors.textBody }}>
                      {log.performedBy?.name || 'Someone'}
                    </span>
                  </div>
                  {rev && (
                    <span style={{
                      fontSize: '9px', fontWeight: 800, color: colors.textSecondary,
                      background: colors.typeBadgeBg, padding: '3px 8px', borderRadius: '10px',
                      border: `1px solid ${colors.typeBadgeBorder}`, letterSpacing: '0.5px',
                    }}>
                      REV {rev.revisionNumber}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Drawer>
  );
};

export default ActivityLogDrawer;
