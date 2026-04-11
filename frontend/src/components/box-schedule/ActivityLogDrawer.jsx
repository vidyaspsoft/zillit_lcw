import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Drawer, Spin, Select, DatePicker } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import boxScheduleService from '../../services/boxScheduleService';

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
  const [logs, setLogs] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState('all');
  const [filterDate, setFilterDate] = useState(null); // dayjs or null

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

  // Match each activity log to a revision by targetId + time proximity (~10s)
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

  // Flat filtered list, newest first
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
        header: { borderBottom: '1px solid #e0ddd8', background: '#fafaf8' },
        body: { padding: 0, background: '#fff' },
      }}
      title={
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '1.5px', color: '#1a1a1a' }}>
            HISTORY
          </div>
          <div style={{ fontSize: '11px', color: '#888', fontWeight: 400, marginTop: '2px' }}>
            Everything that changed in the Production Schedule
          </div>
        </div>
      }
    >
      {/* Filters */}
      <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid #e0ddd8', background: '#fafaf8' }}>
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
            background: '#fff',
            border: '1px solid #ece9e3',
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
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#555', letterSpacing: '0.3px' }}>
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
        <div style={{ textAlign: 'center', padding: '56px 24px', color: '#aaa' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.5 }}>
            {logs.length === 0 ? '📜' : '🔍'}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#666', marginBottom: '6px' }}>
            {logs.length === 0 ? 'No history yet' : 'No matching changes'}
          </div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            {logs.length === 0
              ? 'Changes to schedules, events, and notes will appear here automatically.'
              : 'Try a different filter.'}
          </div>
        </div>
      ) : (
        <div style={{ padding: '14px 16px', background: '#fff' }}>
          {filteredLogs.map((log) => {
            const meta = ACTION_META[log.action] || { label: (log.action || '').toUpperCase(), color: '#888' };
            const targetLabel = TARGET_LABELS[log.targetType] || log.targetType || '';
            const rev = getRevisionForLog(log);
            const context = buildContextLine(log);
            return (
              <div
                key={log._id}
                style={{
                  position: 'relative',
                  background: '#fdfcfa',
                  border: '1px solid #ece9e3',
                  borderLeft: `4px solid ${meta.color}`,
                  borderRadius: '6px',
                  padding: '12px 14px 12px 16px',
                  marginBottom: '10px',
                }}
              >
                {/* Action + target */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '6px',
                  }}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: meta.color,
                    }}
                  />
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: meta.color,
                      letterSpacing: '0.8px',
                    }}
                  >
                    {meta.label}
                  </span>
                  {targetLabel && (
                    <>
                      <span style={{ fontSize: '11px', color: '#bbb' }}>·</span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#555',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        {targetLabel}
                      </span>
                    </>
                  )}
                </div>

                {/* Title */}
                {log.targetTitle && (
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#1a1a1a',
                      fontFamily: 'Georgia, serif',
                      marginBottom: context ? '6px' : '8px',
                    }}
                  >
                    "{log.targetTitle}"
                  </div>
                )}

                {/* Context line */}
                {context && (
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px', lineHeight: 1.5 }}>
                    {context}
                  </div>
                )}

                {/* Footer */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    marginTop: '4px',
                    paddingTop: '6px',
                    borderTop: '1px dashed #ece9e3',
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#888' }}>
                    <span style={{ fontWeight: 600, color: '#555' }}>
                      {dayjs(log.createdAt).format('MMM D · h:mm A')}
                    </span>
                    <span style={{ margin: '0 6px', color: '#ccc' }}>·</span>
                    <span>by </span>
                    <span style={{ fontWeight: 600, color: '#333' }}>
                      {log.performedBy?.name || 'Someone'}
                    </span>
                  </div>
                  {rev && (
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 800,
                        color: '#666',
                        background: '#f0efec',
                        padding: '3px 8px',
                        borderRadius: '10px',
                        border: '1px solid #e0ddd8',
                        letterSpacing: '0.5px',
                      }}
                    >
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
