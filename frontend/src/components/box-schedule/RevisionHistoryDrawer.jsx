import React, { useState, useEffect, useCallback } from 'react';
import { Drawer, Spin, DatePicker, Button } from 'antd';
import { FiFilter, FiX } from 'react-icons/fi';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import boxScheduleService from '../../services/boxScheduleService';

dayjs.extend(relativeTime);

const REVISION_COLOR_MAP = {
  White: '#f5f5f5',
  Blue: '#dbeafe',
  Pink: '#fce7f3',
  Yellow: '#fef9c3',
  Green: '#dcfce7',
  Goldenrod: '#fef3c7',
};

const REVISION_TEXT_MAP = {
  White: '#666',
  Blue: '#1e40af',
  Pink: '#be185d',
  Yellow: '#a16207',
  Green: '#166534',
  Goldenrod: '#92400e',
};

const RevisionHistoryDrawer = ({ open, onClose }) => {
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState(null);

  const loadRevisions = useCallback(async (range = dateRange) => {
    setLoading(true);
    try {
      const params = {};
      if (range && range[0] && range[1]) {
        params.startDate = range[0].startOf('day').valueOf();
        params.endDate = range[1].endOf('day').valueOf();
      }
      const data = await boxScheduleService.getRevisions(params);
      setRevisions(data.data || []);
    } catch {} finally { setLoading(false); }
  }, [dateRange]);

  useEffect(() => { if (open) loadRevisions(); }, [open, loadRevisions]);

  const handleDateChange = (dates) => {
    setDateRange(dates);
    loadRevisions(dates);
  };

  const clearFilter = () => {
    setDateRange(null);
    loadRevisions(null);
  };

  return (
    <Drawer open={open} onClose={onClose} placement="right" width={420}
      styles={{ header: { borderBottom: '1px solid #e0ddd8', background: '#fafaf8' }, body: { padding: 0, background: '#fff' } }}
      title={<span style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' }}>Revision History</span>}>

      {/* Date Range Filter */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0efec', background: '#fafaf8' }}>
        <div className="flex items-center gap-2">
          <FiFilter size={13} style={{ color: '#888', flexShrink: 0 }} />
          <DatePicker.RangePicker
            value={dateRange}
            onChange={handleDateChange}
            style={{ flex: 1 }}
            size="small"
            format="MMM D, YYYY"
            placeholder={['Start date', 'End date']}
            allowClear={false}
          />
          {dateRange && (
            <Button size="small" icon={<FiX size={12} />} onClick={clearFilter}
              style={{ borderRadius: '4px', borderColor: '#d0ccc5', color: '#888', padding: '0 6px' }}
              title="Clear filter" />
          )}
        </div>
        {dateRange && (
          <div style={{ fontSize: '11px', color: '#888', marginTop: '6px', paddingLeft: '21px' }}>
            Showing revisions from {dateRange[0].format('MMM D')} to {dateRange[1].format('MMM D, YYYY')}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Spin /></div>
      ) : revisions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 24px', color: '#bbb' }}>
          <p style={{ fontSize: '14px', fontWeight: '600', color: '#999' }}>
            {dateRange ? 'No revisions in this date range' : 'No revisions yet'}
          </p>
          <p style={{ fontSize: '12px' }}>
            {dateRange ? 'Try a different date range.' : 'Schedule changes will create revision entries.'}
          </p>
        </div>
      ) : (
        <div>
          {revisions.map((rev, i) => {
            const bg = REVISION_COLOR_MAP[rev.revisionColor] || '#f5f5f5';
            const textColor = REVISION_TEXT_MAP[rev.revisionColor] || '#666';
            const isLatest = i === 0 && !dateRange;

            return (
              <div key={rev._id} style={{
                display: 'flex', gap: '14px', padding: '16px 20px',
                borderBottom: '1px solid #f5f4f2',
                background: isLatest ? '#fafaf8' : '#fff',
              }}>
                {/* Revision badge */}
                <div style={{
                  width: '44px', height: '44px', borderRadius: '8px',
                  background: bg, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  border: `1px solid ${textColor}30`,
                }}>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: textColor, lineHeight: 1 }}>
                    {rev.revisionNumber}
                  </span>
                  <span style={{ fontSize: '8px', fontWeight: '600', color: textColor, letterSpacing: '0.5px', marginTop: '1px' }}>
                    REV
                  </span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2">
                    <span style={{
                      display: 'inline-block', padding: '1px 8px', borderRadius: '4px',
                      background: bg, color: textColor, fontSize: '11px', fontWeight: '700',
                      border: `1px solid ${textColor}30`,
                    }}>
                      {rev.revisionColor}
                    </span>
                    {isLatest && (
                      <span style={{ fontSize: '10px', color: '#27ae60', fontWeight: '600' }}>Current</span>
                    )}
                  </div>
                  {rev.description && (
                    <div style={{ fontSize: '13px', color: '#555', marginTop: '4px' }}>{rev.description}</div>
                  )}
                  <div style={{ fontSize: '11px', color: '#bbb', marginTop: '4px' }}>
                    {rev.changedBy?.name || 'Someone'} — {dayjs(rev.createdAt).format('MMM D, YYYY h:mm A')} ({dayjs(rev.createdAt).fromNow()})
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Drawer>
  );
};

export default RevisionHistoryDrawer;
