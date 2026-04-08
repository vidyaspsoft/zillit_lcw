import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Drawer, Button, Spin, DatePicker } from 'antd';
import { FiPlus, FiEdit2, FiTrash2, FiCopy, FiShare2, FiClock, FiFilter, FiX, FiChevronDown, FiChevronRight } from 'react-icons/fi';
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
  const [revisions, setRevisions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filterDate, setFilterDate] = useState(null); // single dayjs date or null
  const [expandedDates, setExpandedDates] = useState({});

  const loadData = useCallback(async (p = 0, date = filterDate) => {
    setLoading(true);
    try {
      const params = { limit: 100, page: p };
      const revParams = {};
      if (date) {
        params.startDate = date.startOf('day').valueOf();
        params.endDate = date.endOf('day').valueOf();
        revParams.startDate = params.startDate;
        revParams.endDate = params.endDate;
      }

      const [logsData, revsData] = await Promise.all([
        boxScheduleService.getActivityLog(params),
        boxScheduleService.getRevisions(revParams),
      ]);

      const result = logsData.data || {};
      if (p === 0) setLogs(result.logs || []);
      else setLogs((prev) => [...prev, ...(result.logs || [])]);
      setTotal(result.total || 0);
      setPage(p);
      setRevisions(revsData.data || []);
    } catch {} finally { setLoading(false); }
  }, [filterDate]);

  useEffect(() => {
    if (open) {
      loadData(0);
      // Auto-expand today
      setExpandedDates({ [dayjs().format('YYYY-MM-DD')]: true });
    }
  }, [open, loadData]);

  const handleDateChange = (date) => {
    setFilterDate(date);
    setPage(0);
    if (date) {
      setExpandedDates({ [date.format('YYYY-MM-DD')]: true });
    } else {
      setExpandedDates({ [dayjs().format('YYYY-MM-DD')]: true });
    }
    loadData(0, date);
  };

  const clearFilter = () => {
    setFilterDate(null);
    setPage(0);
    setExpandedDates({ [dayjs().format('YYYY-MM-DD')]: true });
    loadData(0, null);
  };

  const toggleDate = (dateKey) => {
    setExpandedDates((prev) => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  // Group logs and revisions by date
  const groupedData = useMemo(() => {
    const groups = {};

    // Group activity logs by date
    logs.forEach((log) => {
      const dateKey = dayjs(log.createdAt).format('YYYY-MM-DD');
      if (!groups[dateKey]) groups[dateKey] = { logs: [], revisions: [] };
      groups[dateKey].logs.push(log);
    });

    // Group revisions by date
    revisions.forEach((rev) => {
      const dateKey = dayjs(rev.createdAt).format('YYYY-MM-DD');
      if (!groups[dateKey]) groups[dateKey] = { logs: [], revisions: [] };
      groups[dateKey].revisions.push(rev);
    });

    // Sort dates descending (newest first)
    const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    return sortedKeys.map((dateKey) => ({
      dateKey,
      date: dayjs(dateKey),
      isToday: dayjs(dateKey).isSame(dayjs(), 'day'),
      isYesterday: dayjs(dateKey).isSame(dayjs().subtract(1, 'day'), 'day'),
      logs: groups[dateKey].logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      revisions: groups[dateKey].revisions.sort((a, b) => b.revisionNumber - a.revisionNumber),
      totalItems: groups[dateKey].logs.length + groups[dateKey].revisions.length,
    }));
  }, [logs, revisions]);

  const formatAction = (log) => {
    const target = log.targetType === 'schedule_day' ? 'schedule' : log.targetType;
    return `${log.action} ${target}`;
  };

  const getDateLabel = (group) => {
    if (group.isToday) return 'Today';
    if (group.isYesterday) return 'Yesterday';
    return group.date.format('dddd, MMMM D, YYYY');
  };

  return (
    <Drawer open={open} onClose={onClose} placement="right" width={460}
      styles={{ header: { borderBottom: '1px solid #e0ddd8', background: '#fafaf8' }, body: { padding: 0, background: '#fff' } }}
      title={<span style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' }}>Activity & Revisions</span>}>

      {/* Single Date Filter */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0efec', background: '#fafaf8' }}>
        <div className="flex items-center gap-2">
          <FiFilter size={13} style={{ color: '#888', flexShrink: 0 }} />
          <DatePicker
            value={filterDate}
            onChange={handleDateChange}
            style={{ flex: 1 }}
            size="small"
            format="MMMM D, YYYY"
            placeholder="Filter by date"
            allowClear
            className="schedule-datepicker-clear"
          />
          {filterDate && (
            <Button size="small" icon={<FiX size={12} />} onClick={clearFilter}
              style={{ borderRadius: '4px', borderColor: '#d0ccc5', color: '#888', padding: '0 6px' }}
              title="Clear filter" />
          )}
        </div>
        {filterDate && (
          <div style={{ fontSize: '11px', color: '#888', marginTop: '6px', paddingLeft: '21px' }}>
            Showing: {filterDate.format('dddd, MMMM D, YYYY')}
          </div>
        )}
      </div>

      {loading && page === 0 ? (
        <div className="flex justify-center py-8"><Spin /></div>
      ) : groupedData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 24px', color: '#bbb' }}>
          <FiClock size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <p style={{ fontSize: '14px', fontWeight: '600', color: '#999' }}>
            {filterDate ? 'No activity on this date' : 'No activity yet'}
          </p>
          <p style={{ fontSize: '12px' }}>
            {filterDate ? 'Try a different date.' : 'Changes to the schedule will appear here.'}
          </p>
        </div>
      ) : (
        <div>
          {groupedData.map((group) => {
            const isExpanded = expandedDates[group.dateKey] === true;

            return (
              <div key={group.dateKey}>
                {/* Date Group Header */}
                <button
                  onClick={() => toggleDate(group.dateKey)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 20px', background: isExpanded ? '#f7f6f3' : '#fafaf8',
                    border: 'none', borderBottom: '1px solid #e0ddd8', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <FiChevronDown size={14} style={{ color: '#555' }} /> : <FiChevronRight size={14} style={{ color: '#999' }} />}
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#1a1a1a' }}>
                      {getDateLabel(group)}
                    </span>
                    {!group.isToday && !group.isYesterday && (
                      <span style={{ fontSize: '11px', color: '#bbb', fontWeight: '400' }}>
                        ({group.date.fromNow()})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {group.revisions.length > 0 && (
                      <span style={{
                        fontSize: '10px', fontWeight: '700', color: '#555',
                        background: '#f0efec', padding: '2px 8px', borderRadius: '4px',
                        border: '1px solid #e0ddd8',
                      }}>
                        Rev {group.revisions[0].revisionNumber}
                      </span>
                    )}
                    <span style={{
                      fontSize: '10px', fontWeight: '600', color: '#999',
                      background: '#f5f5f5', padding: '2px 8px', borderRadius: '10px',
                    }}>
                      {group.totalItems}
                    </span>
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div>
                    {/* Revisions for this date */}
                    {group.revisions.map((rev) => {
                      const typeColor = rev.typeColor || '#999';
                      const bgColor = `${typeColor}15`;
                      return (
                        <div key={`rev-${rev._id}`} style={{
                          display: 'flex', gap: '12px', padding: '12px 20px',
                          borderBottom: '1px solid #f5f4f2', background: '#fdfcfa',
                        }}>
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '8px',
                            background: bgColor, display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            border: `1px solid ${typeColor}40`,
                          }}>
                            <span style={{ fontSize: '12px', fontWeight: '800', color: typeColor, lineHeight: 1 }}>
                              {rev.revisionNumber}
                            </span>
                            <span style={{ fontSize: '7px', fontWeight: '600', color: typeColor, letterSpacing: '0.3px' }}>
                              REV
                            </span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="flex items-center gap-2">
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '1px 8px', borderRadius: '3px',
                                background: bgColor, color: '#444', fontSize: '10px', fontWeight: '700',
                                border: `1px solid ${typeColor}30`,
                              }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '2px', backgroundColor: typeColor }} />
                                Revision
                              </span>
                            </div>
                            {rev.description && (
                              <div style={{ fontSize: '12px', color: '#555', marginTop: '3px' }}>{rev.description}</div>
                            )}
                            <div style={{ fontSize: '10px', color: '#ccc', marginTop: '3px' }}>
                              {rev.changedBy?.name || 'Someone'} · {dayjs(rev.createdAt).format('h:mm A')}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Activity logs for this date */}
                    {group.logs.map((log, i) => {
                      const Icon = ACTION_ICONS[log.action] || FiClock;
                      const color = ACTION_COLORS[log.action] || '#888';
                      return (
                        <div key={log._id || `log-${i}`} style={{
                          display: 'flex', gap: '12px', padding: '12px 20px',
                          borderBottom: '1px solid #f5f4f2',
                        }}>
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, marginTop: '2px',
                          }}>
                            <Icon size={12} style={{ color }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '12px', color: '#333' }}>
                              <strong>{log.performedBy?.name || 'Someone'}</strong>
                              {' '}<span style={{ color: '#888' }}>{formatAction(log)}</span>
                              {log.targetTitle && (
                                <> <strong>"{log.targetTitle}"</strong></>
                              )}
                            </div>
                            {log.details && (
                              <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>{log.details}</div>
                            )}
                            <div style={{ fontSize: '10px', color: '#ccc', marginTop: '3px' }}>
                              {dayjs(log.createdAt).format('h:mm A')}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Empty group */}
                    {group.logs.length === 0 && group.revisions.length === 0 && (
                      <div style={{ padding: '16px 20px', fontSize: '12px', color: '#ccc', fontStyle: 'italic' }}>
                        No activity on this date.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {logs.length < total && (
            <div style={{ padding: '16px', textAlign: 'center' }}>
              <Button onClick={() => loadData(page + 1)} loading={loading}
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
