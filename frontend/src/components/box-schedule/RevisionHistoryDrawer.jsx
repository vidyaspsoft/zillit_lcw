import React, { useState, useEffect, useCallback } from 'react';
import { Drawer, Spin } from 'antd';
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

  const loadRevisions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await boxScheduleService.getRevisions();
      setRevisions(data.data || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) loadRevisions(); }, [open, loadRevisions]);

  return (
    <Drawer open={open} onClose={onClose} placement="right" width={420}
      styles={{ header: { borderBottom: '1px solid #e0ddd8', background: '#fafaf8' }, body: { padding: 0, background: '#fff' } }}
      title={<span style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' }}>Revision History</span>}>

      {loading ? (
        <div className="flex justify-center py-8"><Spin /></div>
      ) : revisions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 24px', color: '#bbb' }}>
          <p style={{ fontSize: '14px', fontWeight: '600', color: '#999' }}>No revisions yet</p>
          <p style={{ fontSize: '12px' }}>Schedule changes will create revision entries.</p>
        </div>
      ) : (
        <div>
          {revisions.map((rev, i) => {
            const bg = REVISION_COLOR_MAP[rev.revisionColor] || '#f5f5f5';
            const textColor = REVISION_TEXT_MAP[rev.revisionColor] || '#666';
            const isLatest = i === 0;

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
                    {rev.changedBy?.name || 'Someone'} — {dayjs(rev.createdAt).fromNow()}
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
