import React, { useState } from 'react';
import { Modal, DatePicker, Button } from 'antd';
import { FiCopy } from 'react-icons/fi';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import boxScheduleService from '../../services/boxScheduleService';
import { useTheme } from '../../context/ThemeContext';

const DuplicateScheduleModal = ({ open, onClose, day, onSuccess }) => {
  const { colors } = useTheme();
  const [newStartDate, setNewStartDate] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleDuplicate = async () => {
    if (!newStartDate) { toast.error('Please select a start date'); return; }
    setSubmitting(true);
    try {
      await boxScheduleService.duplicateDay(day._id, newStartDate.startOf('day').valueOf());
      toast.success('Schedule duplicated');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to duplicate');
    } finally { setSubmitting(false); }
  };

  const originalDateRange = day?.calendarDays?.length > 0
    ? `${dayjs(Math.min(...day.calendarDays)).format('MMM D')} – ${dayjs(Math.max(...day.calendarDays)).format('MMM D, YYYY')}`
    : '';

  return (
    <Modal open={open} onCancel={onClose} centered width={420}
      title={<span style={{ fontSize: '16px', fontWeight: '700', color: colors.textPrimary }}>
        <FiCopy size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
        Duplicate Schedule
      </span>}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} style={{ borderRadius: '6px' }}>Cancel</Button>
          <Button onClick={handleDuplicate} loading={submitting} disabled={!newStartDate}
            style={{ background: colors.solidDark, borderColor: colors.solidDark, color: colors.solidDarkText, borderRadius: '6px', fontWeight: '600' }}>
            Duplicate
          </Button>
        </div>
      }>
      <div style={{ padding: '8px 0' }}>
        <div style={{
          padding: '12px 14px', background: colors.surfaceAlt, border: `1px solid ${colors.border}`,
          borderRadius: '8px', marginBottom: '16px', fontSize: '13px',
        }}>
          <div style={{ fontWeight: '600', color: colors.textBody, marginBottom: '4px' }}>
            {day?.typeName}: {day?.title || '(untitled)'}
          </div>
          <div style={{ color: colors.textMuted }}>
            {day?.calendarDays?.length || 0} day(s) — {originalDateRange}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: colors.textSecondary, marginBottom: '4px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            New Start Date
          </label>
          <DatePicker value={newStartDate} onChange={setNewStartDate} style={{ width: '100%' }}
            size="large" format="MMMM D, YYYY" placeholder="Select new start date" />
          <p style={{ fontSize: '12px', color: colors.textSubtle, marginTop: '6px' }}>
            All {day?.calendarDays?.length || 0} day(s) will be shifted to start from this date. Events will be copied too.
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default DuplicateScheduleModal;
