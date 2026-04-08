import React, { useMemo } from 'react';
import { Modal, Button } from 'antd';
import dayjs from 'dayjs';

/**
 * ConflictDialog — Shown when new schedule dates overlap existing ones.
 * Offers Replace, Extend, or Overlap resolution options with clear descriptions.
 */
const ConflictDialog = ({ open, conflicts = [], totalDays = 0, onResolve, onCancel, onBack }) => {
  // Check if ALL days conflict (Extend won't work in this case)
  const allDaysConflict = totalDays > 0 && conflicts.length >= totalDays;

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title={
        <span style={{
          fontSize: '16px',
          fontWeight: '700',
          letterSpacing: '1px',
          textTransform: 'uppercase',
        }}>
          Schedule Conflict
        </span>
      }
      footer={null}
      width={500}
      centered
    >
      <div style={{ padding: '8px 0' }}>
        <p style={{ fontSize: '14px', color: '#333', marginBottom: '12px' }}>
          {conflicts.length} date(s) overlap with existing schedules:
        </p>

        {/* Conflict list */}
        <div style={{
          border: '1px solid #e0ddd8',
          borderRadius: '8px',
          maxHeight: '200px',
          overflowY: 'auto',
          marginBottom: '20px',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e0ddd8', background: '#f7f6f3' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', letterSpacing: '1px', color: '#999', textTransform: 'uppercase' }}>Date</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', letterSpacing: '1px', color: '#999', textTransform: 'uppercase' }}>Current Type</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', letterSpacing: '1px', color: '#999', textTransform: 'uppercase' }}>Schedule</th>
              </tr>
            </thead>
            <tbody>
              {conflicts.map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0eeea' }}>
                  <td style={{ padding: '8px 12px', fontWeight: '500' }}>
                    {dayjs(c.date).format('ddd, MMM D')}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <div className="flex items-center gap-2">
                      <span style={{
                        display: 'inline-block', width: '8px', height: '8px',
                        backgroundColor: c.existingColor || '#999', borderRadius: '2px',
                      }} />
                      {c.existingType}
                    </div>
                  </td>
                  <td style={{ padding: '8px 12px', color: '#888' }}>
                    {c.existingTitle || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '12px' }}>
          What would you like to do?
        </p>

        <div className="flex flex-col gap-2">
          {/* Replace — always available, recommended when changing type */}
          <Button
            block
            size="large"
            onClick={() => onResolve('replace')}
            style={{
              textAlign: 'left',
              height: 'auto',
              padding: '12px 16px',
              borderRadius: '8px',
              borderColor: '#1a1a1a',
              background: '#fafaf8',
            }}
          >
            <div>
              <strong style={{ fontSize: '14px' }}>Replace</strong>
              <span style={{ fontSize: '11px', color: '#27ae60', marginLeft: '8px', fontWeight: '600' }}>Recommended</span>
              <br />
              <span style={{ fontSize: '12px', color: '#666' }}>
                Remove existing schedule on these dates and use your new schedule instead
              </span>
            </div>
          </Button>

          {/* Extend */}
          <Button
            block
            size="large"
            onClick={() => onResolve('extend')}
            style={{
              textAlign: 'left',
              height: 'auto',
              padding: '12px 16px',
              borderRadius: '8px',
            }}
          >
            <div>
              <strong style={{ fontSize: '14px' }}>Extend</strong>
              <br />
              <span style={{ fontSize: '12px', color: '#666' }}>
                Keep existing schedule, only fill empty dates with new schedule
              </span>
            </div>
          </Button>

          {/* Overlap — allow both */}
          <Button
            block
            size="large"
            onClick={() => onResolve('overlap')}
            style={{
              textAlign: 'left',
              height: 'auto',
              padding: '12px 16px',
              borderRadius: '8px',
            }}
          >
            <div>
              <strong style={{ fontSize: '14px' }}>Overlap</strong>
              <br />
              <span style={{ fontSize: '12px', color: '#666' }}>
                Keep existing schedule and also add the new one on the same dates
              </span>
            </div>
          </Button>
        </div>

        <div className="flex justify-between mt-4">
          <Button onClick={onBack} style={{ borderRadius: '6px' }}>
            ← Back to Edit Dates
          </Button>
          <Button onClick={onCancel} style={{ borderRadius: '6px' }}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConflictDialog;
