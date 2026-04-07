import React, { useState, useEffect, useCallback } from 'react';
import { Drawer, Button, Spin } from 'antd';
import { FiPlus, FiEdit2, FiTrash2, FiCopy, FiShare2, FiClock } from 'react-icons/fi';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import boxScheduleService from '../../services/boxScheduleService';

dayjs.extend(relativeTime);

const ACTION_ICONS = {
  created: FiPlus,
  updated: FiEdit2,
  deleted: FiTrash2,
  duplicated: FiCopy,
  shared: FiShare2,
};

const ACTION_COLORS = {
  created: '#27ae60',
  updated: '#3498db',
  deleted: '#e74c3c',
  duplicated: '#8e44ad',
  shared: '#f39c12',
};

const ActivityLogDrawer = ({ open, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadLogs = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const data = await boxScheduleService.getActivityLog({ limit: 30, page: p });
      const result = data.data || {};
      if (p === 0) setLogs(result.logs || []);
      else setLogs((prev) => [...prev, ...(result.logs || [])]);
      setTotal(result.total || 0);
      setPage(p);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) loadLogs(0); }, [open, loadLogs]);

  const formatAction = (log) => {
    const target = log.targetType === 'schedule_day' ? 'schedule' : log.targetType;
    return `${log.action} ${target}`;
  };

  return (
    <Drawer open={open} onClose={onClose} placement="right" width={420}
      styles={{ header: { borderBottom: '1px solid #e0ddd8', background: '#fafaf8' }, body: { padding: 0, background: '#fff' } }}
      title={<span style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' }}>Activity Log</span>}>

      {loading && page === 0 ? (
        <div className="flex justify-center py-8"><Spin /></div>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 24px', color: '#bbb' }}>
          <FiClock size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <p style={{ fontSize: '14px', fontWeight: '600', color: '#999' }}>No activity yet</p>
          <p style={{ fontSize: '12px' }}>Changes to the schedule will appear here.</p>
        </div>
      ) : (
        <div>
          {logs.map((log, i) => {
            const Icon = ACTION_ICONS[log.action] || FiClock;
            const color = ACTION_COLORS[log.action] || '#888';
            return (
              <div key={log._id || i} style={{
                display: 'flex', gap: '12px', padding: '14px 20px',
                borderBottom: '1px solid #f5f4f2',
              }}>
                <div style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: '2px',
                }}>
                  <Icon size={13} style={{ color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#333' }}>
                    <strong>{log.performedBy?.name || 'Someone'}</strong>
                    {' '}<span style={{ color: '#888' }}>{formatAction(log)}</span>
                    {log.targetTitle && (
                      <> <strong>"{log.targetTitle}"</strong></>
                    )}
                  </div>
                  {log.details && (
                    <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>{log.details}</div>
                  )}
                  <div style={{ fontSize: '11px', color: '#ccc', marginTop: '4px' }}>
                    {dayjs(log.createdAt).fromNow()}
                  </div>
                </div>
              </div>
            );
          })}

          {logs.length < total && (
            <div style={{ padding: '16px', textAlign: 'center' }}>
              <Button onClick={() => loadLogs(page + 1)} loading={loading}
                style={{ borderRadius: '6px', borderColor: '#d0ccc5', color: '#888' }}>
                Load More
              </Button>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
};

export default ActivityLogDrawer;
