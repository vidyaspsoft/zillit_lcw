import React, { useMemo } from 'react';
import { Modal, Button } from 'antd';
import dayjs from 'dayjs';
import { useTheme } from '../../context/ThemeContext';

/**
 * ConflictDialog — Shown when new schedule dates overlap existing ones.
 * Offers Replace, Extend, or Overlap resolution options with clear descriptions.
 */
const ConflictDialog = ({ open, conflicts = [], totalDays = 0, onResolve, onCancel, onBack }) => {
  const { colors } = useTheme();
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
        <p style={{ fontSize: '14px', color: colors.textBody, marginBottom: '12px' }}>
          {conflicts.length} date(s) overlap with existing schedules:
        </p>

        {/* Conflict list */}
        <div style={{
          border: `1px solid ${colors.border}`,
          borderRadius: '8px',
          maxHeight: '200px',
          overflowY: 'auto',
          marginBottom: '20px',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.border}`, background: colors.surfaceAlt2 }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', letterSpacing: '1px', color: colors.textSubtle, textTransform: 'uppercase' }}>Date</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', letterSpacing: '1px', color: colors.textSubtle, textTransform: 'uppercase' }}>Current Type</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', letterSpacing: '1px', color: colors.textSubtle, textTransform: 'uppercase' }}>Schedule</th>
              </tr>
            </thead>
            <tbody>
              {conflicts.map((c, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                  <td style={{ padding: '8px 12px', fontWeight: '500' }}>
                    {dayjs(c.date).format('ddd, MMM D')}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <div className="flex items-center gap-2">
                      <span style={{
                        display: 'inline-block', width: '8px', height: '8px',
                        backgroundColor: c.existingColor || colors.textSubtle, borderRadius: '2px',
                      }} />
                      {c.existingType}
                    </div>
                  </td>
                  <td style={{ padding: '8px 12px', color: colors.textMuted }}>
                    {c.existingTitle || '\u2014'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ fontSize: '14px', fontWeight: '600', color: colors.textBody, marginBottom: '12px' }}>
          What would you like to do?
        </p>

        <div className="flex flex-col gap-2">
          {/* Replace */}
          <Button
            block
            size="large"
            onClick={() => onResolve('replace')}
            style={{
              textAlign: 'left',
              height: 'auto',
              padding: '12px 16px',
              borderRadius: '8px',
              borderColor: colors.solidDark,
              background: colors.surfaceAlt,
            }}
          >
            <div>
              <strong style={{ fontSize: '14px' }}>Replace</strong>
              <span style={{ fontSize: '11px', color: colors.successText, marginLeft: '8px', fontWeight: '600' }}>Recommended</span>
              <br />
              <span style={{ fontSize: '12px', color: colors.textSecondary }}>
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
              <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                Keep existing schedule, only fill empty dates with new schedule
              </span>
            </div>
          </Button>

          {/* Overlap */}
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
              <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                Keep existing schedule and also add the new one on the same dates
              </span>
            </div>
          </Button>
        </div>

        <div className="flex justify-between mt-4">
          <Button onClick={onBack} style={{ borderRadius: '6px' }}>
            \u2190 Back to Edit Dates
          </Button>
          <Button onClick={onCancel} style={{ borderRadius: '6px' }}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConflictDialog;
